import mongoose, { isValidObjectId } from 'mongoose';
import bidSchema from '../models/bid.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';
import productSchema from '../models/product.schema.js';
import requirementSchema from '../models/requirement.schema.js';
import cartSchema from '../models/cart.schema.js';
import userSchema from '../models/user.schema.js';
import { getIO } from '../config/socket.js';
import { onlineUsers } from '../socket/onlineUsers.js';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';
import productNotificaitonSchema from '../models/productNotificaiton.schema.js';
import uploadFile from '../config/imageKit.config.js';
import { maskedPartyView, cityOnly, maskName } from '../helpers/maskIdentity.js';
import { decryptField } from '../utils/fieldEncryption.js';

/**
 * M3.T1 (Implementation Master Plan) — service layer extracted out of
 * bid.controller.js. Pure extraction: every query, transaction, and side
 * effect below is unchanged from the controller it came from; only the
 * calling convention changed (plain params in, {statusCode, message, data}
 * out or a thrown BidServiceError, matching the established pattern in
 * verificationDecision.service.js) so the controller layer can become thin.
 */
export class BidServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// user.schema.js's gstin/pan getters only run on a real Mongoose document —
// .lean() (used throughout this file for read performance) skips the
// Mongoose document layer entirely and returns raw stored values, so any
// lean-fetched user object needs this applied explicitly before its
// gstin/pan reach a response.
const decryptUserGstPan = user => {
  if (!user) return user;
  if (user.gstin) user.gstin = decryptField(user.gstin);
  if (user.pan) user.pan = decryptField(user.pan);
  return user;
};

export async function getLatestThreeBidAndDraft({ userId }) {
  if (!userId) throw new BidServiceError(404, 'User not found');

  const bids = await bidSchema
    .find({ sellerId: userId })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate({ path: 'productId', populate: { path: 'categoryId' } })
    .lean();
  if (!bids) throw new BidServiceError(404, 'Bid not found');

  const drafts = await productSchema
    .find({ userId, draft: true })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('categoryId')
    .lean();
  if (!drafts) throw new BidServiceError(404, 'Draft not found');

  return { statusCode: 200, message: 'Bid fetched successfully', data: { bids, drafts } };
}

export async function bidOverViewbyId({ id, requesterId }) {
  if (!isValidObjectId(id)) throw new BidServiceError(400, 'Invalid bid or product id');

  // Ownership check — only the two parties to this bid may view it. Previously
  // ANY authenticated user who knew/guessed a bid id got the full raw buyer +
  // seller documents (password hash, phone, email, address, GSTIN, PAN, docs).
  const bidParties = await bidSchema.findById(id).select('sellerId buyerId').lean();
  if (!bidParties) throw new BidServiceError(404, 'Bid not found');
  const isParty =
    bidParties.sellerId?.toString() === requesterId?.toString() ||
    bidParties.buyerId?.toString() === requesterId?.toString();
  if (!isParty) throw new BidServiceError(403, 'Not authorized to view this bid');

  const bid = await bidSchema.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        let: { categoryId: '$product.categoryId' },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } }],
        as: 'productCategory',
      },
    },
    { $unwind: { path: '$productCategory', preserveNullAndEmptyArrays: true } },
    { $addFields: { 'product.category': '$productCategory' } },
    { $project: { productCategory: 0 } },
    {
      $addFields: {
        'product.subCategory': {
          $arrayElemAt: [
            {
              $filter: {
                input: '$product.category.subCategories',
                as: 'sub',
                cond: { $eq: ['$$sub._id', '$product.subCategoryId'] },
              },
            },
            0,
          ],
        },
      },
    },
    { $lookup: { from: 'users', localField: 'sellerId', foreignField: '_id', as: 'seller' } },
    { $unwind: '$seller' },
    { $lookup: { from: 'users', localField: 'buyerId', foreignField: '_id', as: 'buyer' } },
    { $unwind: '$buyer' },
    {
      $project: {
        productId: 0,
        sellerId: 0,
        buyerId: 0,
        'product.categoryId': 0,
        'product.subCategoryId': 0,
        // Never leave the server, for either party, regardless of role.
        'seller.password': 0,
        'seller.gstin': 0,
        'seller.pan': 0,
        'seller.gstinDocumentUrl': 0,
        'seller.panDocumentUrl': 0,
        'seller.verificationNotes': 0,
        'seller.verificationDecidedBy': 0,
        'buyer.password': 0,
        'buyer.gstin': 0,
        'buyer.pan': 0,
        'buyer.gstinDocumentUrl': 0,
        'buyer.panDocumentUrl': 0,
        'buyer.verificationNotes': 0,
        'buyer.verificationDecidedBy': 0,
      },
    },
  ]);

  if (!bid.length) throw new BidServiceError(404, 'Bid not found');

  const result = bid[0];
  // This endpoint is a bid-status check, not the deal-close identity reveal —
  // the buyer's contact details and real name stay masked here regardless of
  // who's asking (city-level location only). Seller identity is shown to the
  // buyer by design elsewhere in the app (see getBidsForProductCompare), so we
  // only mask the buyer side.
  if (result.buyer) {
    result.buyer = maskedPartyView(result.buyer);
  }

  return { statusCode: 200, message: 'Bid overview', data: result };
}

export async function updateBidUserDetails({ id, userId, budgetQuation, availableBrand, earliestDeliveryDate }) {
  const bid = await bidSchema.findById(id);
  if (!bid) throw new BidServiceError(404, 'Bid not found');

  if (bid.sellerId.toString() !== userId.toString()) {
    throw new BidServiceError(403, 'Not authorized to update this bid');
  }

  bid.budgetQuation = budgetQuation;
  bid.availableBrand = availableBrand;
  bid.earliestDeliveryDate = earliestDeliveryDate;
  await bid.save();

  return { statusCode: 200, message: 'Bid updated successfully', data: bid };
}

export async function createBid({ body, file, buyerId, productId, sellerId }) {
  const {
    status, availableBrand, earliestDeliveryDate, businessType,
    sellerType, priceBasis, taxes, freightTerms, paymentTerms, location, buyerNote,
  } = body;

  // When submitted as multipart (document-upload quote flow), objects arrive
  // as JSON strings and the quotation file arrives on req.file.
  let businessDets = body.businessDets;
  if (typeof businessDets === 'string') {
    try {
      businessDets = JSON.parse(businessDets);
    } catch {
      businessDets = undefined;
    }
  }

  // Per-material quote lines (see bid.schema.js's `items`). Same string-form
  // possibility as businessDets above. Optional — a bid on a single-item or
  // document-upload RFQ has nothing to break down and falls back to the
  // client-supplied lump-sum budgetQuation below.
  let quoteItems = body.items;
  if (typeof quoteItems === 'string') {
    try {
      quoteItems = JSON.parse(quoteItems);
    } catch {
      quoteItems = undefined;
    }
  }
  if (!Array.isArray(quoteItems)) quoteItems = [];

  // Uploaded BEFORE the transaction starts, not inside it: session.withTransaction
  // (below) may retry its callback on a transient error, and an external I/O
  // call like this must never be retried as a side effect of a DB-layer retry
  // (it would upload the file more than once).
  let quoteDocument = '';
  if (file) {
    quoteDocument = (await uploadFile(file)) || '';
  }

  if (!isValidObjectId(buyerId) || !isValidObjectId(productId)) {
    throw new BidServiceError(400, 'Invalid sellerId or productId');
  }

  const session = await mongoose.startSession();
  let createdBid, updatedProduct, updatedRequirement, resolvedBudgetQuation;
  try {
    // session.withTransaction (not manual startTransaction/commitTransaction)
    // automatically retries the callback on a TransientTransactionError and
    // retries the commit on UnknownTransactionCommitResult, per MongoDB's own
    // documented pattern — manual transaction handling had no retry at all.
    await session.withTransaction(async () => {
      // Prevent a buyer from quoting on their own requirement (market manipulation)
      const productOwner = await productSchema
        .findById(productId)
        .select('userId isSoldProduct items quantity')
        .session(session);
      if (!productOwner) {
        throw new BidServiceError(400, 'Product not found');
      }
      if (productOwner.userId.toString() === sellerId.toString()) {
        throw new BidServiceError(400, 'You cannot submit a quote on your own requirement');
      }
      if (productOwner.isSoldProduct) {
        throw new BidServiceError(400, 'This product is already sold');
      }

      // budgetQuation is ALWAYS derived server-side, never trusted from the
      // client — previously the client computed sum(unitPrice*qty) itself
      // and only sent the total, so nothing stopped a client from sending an
      // arbitrary number disconnected from the actual per-item prices.
      let normalizedItems = [];
      if (quoteItems.length > 0) {
        const productItemsById = new Map(
          (productOwner.items || []).map(pi => [pi._id.toString(), pi])
        );
        let total = 0;
        for (const line of quoteItems) {
          const unitPrice = Number(line.unitPrice);
          if (!line.productItemId || !isValidObjectId(line.productItemId)) {
            throw new BidServiceError(400, 'Each quote item requires a valid productItemId');
          }
          const productItem = productItemsById.get(line.productItemId.toString());
          if (!productItem) {
            throw new BidServiceError(400, 'One of the quoted items does not belong to this requirement');
          }
          if (!unitPrice || unitPrice <= 0) {
            throw new BidServiceError(400, 'Each quote item requires a unit price greater than 0');
          }
          const qty = Number(productItem.quantity) || 1;
          total += unitPrice * qty;
          normalizedItems.push({
            productItemId: line.productItemId,
            offeredBrand: line.offeredBrand || '',
            unitPrice,
            unit: line.unit || productItem.quantityUnit || '',
            availability: ['in_stock', 'lead_time', 'unavailable'].includes(line.availability)
              ? line.availability
              : 'in_stock',
            remarks: line.remarks || '',
          });
        }
        resolvedBudgetQuation = total;
      } else {
        // No per-item breakdown (single-item or document-upload RFQ) —
        // fall back to the lump-sum figure the client already computes for
        // those flows (there's nothing to derive it from server-side).
        resolvedBudgetQuation = Number(body.budgetQuation);
      }

      if (!resolvedBudgetQuation || resolvedBudgetQuation <= 0) {
        throw new BidServiceError(400, 'budgetQuation is required');
      }

      const existingBid = await bidSchema.findOne({ sellerId, buyerId, productId }, null, { session });
      if (existingBid) {
        throw new BidServiceError(400, 'You have already placed a bid for this product');
      }

      const isSold = await closeDealSchema
        .exists({ productId, closedDealStatus: 'completed', dealStatus: 'accepted' })
        .session(session);
      if (isSold?._id) {
        throw new BidServiceError(400, 'This product is already sold');
      }

      const sellerExists = await requirementSchema.findOne(
        { productId, buyerId, 'sellers.sellerId': sellerId },
        null,
        { session }
      );
      if (sellerExists) {
        throw new BidServiceError(400, 'You already placed bid in requirement');
      }

      const bid = await bidSchema.create(
        [
          {
            sellerId, buyerId, productId,
            budgetQuation: resolvedBudgetQuation,
            items: normalizedItems,
            status: status || 'active',
            availableBrand, earliestDeliveryDate, sellerType, priceBasis, taxes,
            freightTerms, paymentTerms, location, buyerNote, quoteDocument, businessType,
            ...(businessType === 'business' && { businessDets }),
          },
        ],
        { session }
      );

      createdBid = bid[0];

      updatedProduct = await productSchema.findByIdAndUpdate(
        productId,
        { $inc: { totalBidCount: 1 } },
        { new: true, session }
      );

      const requirement = await requirementSchema.findOne({ productId, buyerId }, null, { session });
      if (!requirement) {
        throw new BidServiceError(404, 'Requirement not found for this product and buyer');
      }
      updatedRequirement = await requirementSchema.findOneAndUpdate(
        { productId, buyerId },
        { $push: { sellers: { sellerId, budgetAmount: resolvedBudgetQuation, bidId: createdBid._id } } },
        { new: true, session }
      );
      if (!updatedRequirement) {
        throw new BidServiceError(400, 'Requirement not found for this product and buyer');
      }

      await cartSchema.findOneAndUpdate(
        { userId: sellerId },
        { $pull: { cartItems: { productIds: { $in: [productId] } } } },
        { session }
      );
    });
  } catch (err) {
    if (err instanceof BidServiceError) throw err;
    throw new BidServiceError(400, err.message || 'Transaction failed');
  } finally {
    session.endSession();
  }

  // Populate response (outside transaction)
  const [sellerDetails, buyerDetails, productDetails] = await Promise.all([
      userSchema.findById(sellerId).select('-password -__v').lean().then(decryptUserGstPan),
      userSchema.findById(buyerId).select('-password -__v').lean().then(decryptUserGstPan),
      productSchema.findById(productId).select('title images categoryId').lean(),
    ]);

    const populatedBid = {
      ...createdBid.toObject(),
      seller: sellerDetails,
      buyer: buyerDetails,
      product: productDetails,
    };

    try {
      const sellerName = `${sellerDetails.firstName} ${sellerDetails.lastName}`.trim();
      const productTitle = productDetails.title;

      const notif = await productNotificaitonSchema.create({
        recipientId: buyerId,
        senderId: sellerId,
        productId,
        type: 'new_bid',
        title: 'New quote received',
        description: `${sellerName} placed a new quote on your product "${productTitle}".`,
        roomId: null,
        metadata: {
          amount: resolvedBudgetQuation,
          bidId: createdBid._id.toString(),
          productId: productId.toString(),
        },
      });

      const io = getIO();
      const buyerSocketId = onlineUsers.get(buyerId.toString());
      if (io && buyerSocketId) {
        io.to(buyerSocketId).emit(SOCKET_EVENTS.NOTIFICATION_NEW, {
          _id: notif._id.toString(),
          type: notif.type,
          title: notif.title,
          description: notif.description,
          seen: false,
          roomId: null,
          dealId: null,
          createdAt: notif.createdAt,
          metadata: notif.metadata,
        });
      }
    } catch (notifErr) {
      // Don't fail the whole request if notification fails
      console.error('Bid notification error:', notifErr);
    }

    return {
      statusCode: 200,
      message: 'Bid created successfully',
      data: {
        bid: populatedBid,
        productId,
        sellerId,
        buyerId: updatedProduct.userId,
        requirementId: updatedRequirement?._id,
      },
    };
}

export async function getAllBids({ userId, search = '', limit = 10, page = 1, sortBy = 'desc' }) {
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const sortOrder = sortBy === 'asc' ? 1 : -1;
  const pipeline = [
    { $match: { sellerId: new mongoose.Types.ObjectId(userId) } },
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
  ];
  if (search && search.trim() !== '') {
    pipeline.push({ $match: { 'product.title': { $regex: search, $options: 'i' } } });
  }

  pipeline.push(
    { $lookup: { from: 'users', localField: 'sellerId', foreignField: '_id', as: 'seller' } },
    { $unwind: '$seller' },
    { $lookup: { from: 'users', localField: 'buyerId', foreignField: '_id', as: 'buyer' } },
    { $unwind: '$buyer' },
    {
      $lookup: {
        from: 'closeddeals',
        let: { productId: '$productId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$productId', '$$productId'] },
              closedDealStatus: { $in: ['completed', 'rejected'] },
            },
          },
        ],
        as: 'closedDeal',
      },
    },
    { $unwind: { path: '$closedDeal', preserveNullAndEmptyArrays: true } },
    { $addFields: { closedDealStatus: '$closedDeal.closedDealStatus' } },
    { $unset: 'closedDeal' }
  );

  const countPipeline = [...pipeline];
  countPipeline.push({ $count: 'total' });
  const countResult = await bidSchema.aggregate(countPipeline);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  pipeline.push({ $sort: { createdAt: sortOrder } });
  pipeline.push({ $skip: (parsedPage - 1) * parsedLimit });
  pipeline.push({ $limit: parsedLimit });

  const bids = await bidSchema.aggregate(pipeline);

  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  await Promise.all(
    bids.map(async bid => {
      if (bid.status === 'active' && bid.createdAt && now - new Date(bid.createdAt).getTime() > twentyFourHours) {
        await bidSchema.findByIdAndUpdate(bid._id, { status: 'inactive' });
        bid.status = 'inactive';
      }
    })
  );

  return {
    statusCode: 200,
    message: 'All bids fetched successfully',
    data: { total, page: parsedPage, limit: parsedLimit, bids },
  };
}

export async function getBidById({ id, requesterId, limit = 10, page = 1 }) {
  if (!isValidObjectId(id)) throw new BidServiceError(400, 'Invalid bid id');

  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);

  const bid = await bidSchema.findById(id).lean();
  if (!bid) throw new BidServiceError(404, 'Bid not found');

  const productId = bid.productId;

  // Ownership check + role-based scoping. Previously this returned EVERY
  // seller's bid + price on the product to anyone who knew one bid id on it
  // (a direct cross-seller price/identity leak) — the buyer comparing quotes
  // is legitimate, but a seller must only ever see their own bid.
  const ownerProduct = await productSchema.findById(productId).select('userId').lean();
  if (!ownerProduct) throw new BidServiceError(404, 'Product not found');
  const isBuyer = ownerProduct.userId?.toString() === requesterId?.toString();
  const isBidOwner = bid.sellerId?.toString() === requesterId?.toString();
  if (!isBuyer && !isBidOwner) throw new BidServiceError(403, 'Not authorized to view this bid');

  let allBids = await bidSchema
    .find({ productId, ...(isBuyer ? {} : { sellerId: requesterId }) })
    .populate({
      path: 'sellerId',
      select: '-password -__v -gstin -pan -gstinDocumentUrl -panDocumentUrl -verificationNotes -verificationDecidedBy',
    })
    .lean();

  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  allBids = await Promise.all(
    allBids.map(async b => {
      if (b.status === 'active' && b.createdAt && now - new Date(b.createdAt).getTime() > twentyFourHours) {
        await bidSchema.findByIdAndUpdate(b._id, { status: 'inactive' });
        b.status = 'inactive';
      }
      return b;
    })
  );

  const sellersAll = allBids.map(b => ({
    _id: b._id,
    seller: b.sellerId,
    budgetQuation: b.budgetQuation,
    availableBrand: b.availableBrand,
    earliestDeliveryDate: b.earliestDeliveryDate,
    businessType: b.businessType,
    // Per-material quote lines — empty array on older bids and on
    // single-item/document-upload RFQs with no breakdown to show.
    items: b.items || [],
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  const totalSellers = sellersAll.length;
  const startIdx = (parsedPage - 1) * parsedLimit;
  const sellers = sellersAll.slice(startIdx, startIdx + parsedLimit);

  const productDoc = await productSchema
    .findById(productId)
    .populate({ path: 'categoryId', select: '-subCategories' })
    .lean();
  if (!productDoc) throw new BidServiceError(404, 'Product not found');

  const cleanProduct = prod => {
    const p = { ...prod };
    if (p.userId?._id) p.userId = p.userId._id.toString();
    if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;
    delete p.__v;
    return p;
  };

  const deal = await closeDealSchema.findOne({ productId: productDoc._id }).select('closedDealStatus').lean();
  let dealStatus = 'pending';
  if (deal?.closedDealStatus) dealStatus = deal.closedDealStatus;

  const product = { ...cleanProduct(productDoc), dealStatus };

  let buyer = null;
  if (product.userId) {
    const buyerData = decryptUserGstPan(await userSchema.findById(product.userId).select('-password -__v').lean());
    if (buyerData) {
      // The buyer sees their own full details; a seller viewing this bid gets
      // the masked view only (name masked, city-level location, no contact
      // info) — identity reveal happens through the deal-close flow, not here.
      buyer = isBuyer
        ? {
            _id: buyerData._id,
            firstName: buyerData.firstName,
            lastName: buyerData.lastName,
            email: buyerData.email,
            phone: buyerData.phone,
            currentLocation: buyerData.currentLocation || buyerData.address,
            profileImage: buyerData.profileImage,
          }
        : maskedPartyView(buyerData);
    }
  }

  let mainBidStatus = bid.status;
  if (bid.status === 'active' && bid.createdAt && now - new Date(bid.createdAt).getTime() > twentyFourHours) {
    await bidSchema.findByIdAndUpdate(bid._id, { status: 'inactive' });
    mainBidStatus = 'inactive';
  }

  const responseObj = {
    _id: bid._id,
    product,
    buyer,
    sellers,
    totalSellers,
    page: parsedPage,
    limit: parsedLimit,
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
    status: mainBidStatus,
  };

  return { statusCode: 200, message: 'Bid details fetched successfully', data: responseObj };
}

export async function getBidByProductId({ productId }) {
  const getBidDoc = await bidSchema.exists({ productId });
  if (!getBidDoc) throw new BidServiceError(404, 'Bid not found');
  return { statusCode: 200, message: 'Bid fetched successfully', data: getBidDoc };
}

export async function deleteBid({ id, sellerId }) {
  const session = await mongoose.startSession();
  try {
    // session.withTransaction auto-retries on TransientTransactionError,
    // matching createBid/updateQuoteStatus (see createBid's comment for why).
    await session.withTransaction(async () => {
      const bid = await bidSchema.findOne({ _id: id, sellerId }).session(session);
      if (!bid) throw new BidServiceError(403, 'Not authorized to delete this bid');

      await requirementSchema.findOneAndUpdate(
        { productId: bid.productId },
        { $pull: { sellers: { sellerId: bid.sellerId || sellerId } } },
        { session }
      );

      await bidSchema.deleteOne({ _id: id }).session(session);

      if (bid.productId) {
        await productSchema.findByIdAndUpdate(bid.productId, { $inc: { totalBidCount: -1 } }, { session });
      }
    });
    return { statusCode: 200, message: 'Bid deleted successfully', data: null };
  } catch (err) {
    if (err instanceof BidServiceError) throw err;
    throw new BidServiceError(400, err.message || 'Something went wrong while deleting bid');
  } finally {
    session.endSession();
  }
}

export async function getBidDetailsBySellerIdAndProductId({ sellerId, productId, requesterId }) {
  if (!isValidObjectId(productId) || !isValidObjectId(sellerId)) {
    throw new BidServiceError(400, 'Invalid product or seller id');
  }
  // Only the buyer who owns this product may view a seller's quote on it.
  // Previously ANY authenticated user could call this with any productId +
  // sellerId pair and get the seller's full raw document — password hash
  // included, since `.populate('sellerId')` had zero field exclusion.
  const product = await productSchema.findById(productId).select('userId').lean();
  if (!product) throw new BidServiceError(404, 'Product not found');
  if (product.userId?.toString() !== requesterId?.toString()) {
    throw new BidServiceError(403, 'Not authorized to view this quote');
  }

  const bidDetails = await bidSchema
    .findOne({ sellerId, productId })
    .populate('sellerId', 'firstName lastName phone currentLocation address profileImage verificationStatus businessName')
    .lean();
  if (!bidDetails) throw new BidServiceError(404, 'Bid not found for this seller and product');

  return { statusCode: 200, message: 'Bid details fetched successfully', data: bidDetails };
}

// SB-008: buyer-only side-by-side comparison of all quotes on a requirement
export async function getBidsForProductCompare({ productId, userId }) {
  if (!isValidObjectId(productId)) throw new BidServiceError(400, 'Invalid product id');
  // `items` included so the comparison grid can render each requested
  // material as its own row (name/spec/qty/unit), independent of any one
  // supplier's quote — the "Requested Item" column in an item-by-item
  // comparison, per the RFQ item-level procurement redesign.
  const product = await productSchema.findById(productId).select('userId title items isMultiple').lean();
  if (!product) throw new BidServiceError(404, 'Product not found');
  if (product.userId.toString() !== userId.toString()) {
    throw new BidServiceError(403, 'Only the buyer can compare quotes');
  }
  // `bids[].items` reaches the client unfiltered here (.lean() with no
  // projection) — each bid's per-material quote lines line up against
  // product.items by productItemId.
  const bids = await bidSchema
    .find({ productId })
    .populate('sellerId', 'firstName lastName phone currentLocation address profileImage')
    .sort({ budgetQuation: 1 })
    .lean();
  return { statusCode: 200, message: 'Quotes fetched', data: { product, bids } };
}

// SB-013: unified activity timeline for a requirement (buyer-only)
export async function getRequirementTimeline({ productId, userId }) {
  if (!isValidObjectId(productId)) throw new BidServiceError(400, 'Invalid product id');
  const product = await productSchema.findById(productId).select('userId title createdAt').lean();
  if (!product) throw new BidServiceError(404, 'Product not found');
  if (product.userId.toString() !== userId.toString()) {
    throw new BidServiceError(403, 'Only the buyer can view this timeline');
  }

  const [bids, deals] = await Promise.all([
    bidSchema.find({ productId }).populate('sellerId', 'firstName lastName').lean(),
    closeDealSchema.find({ productId }).populate('sellerId', 'firstName lastName').lean(),
  ]);

  const nameOf = s => `${s?.firstName || 'Seller'} ${s?.lastName || ''}`.trim();
  const events = [{ type: 'requirement_posted', at: product.createdAt, label: 'Requirement posted' }];

  for (const b of bids) {
    const name = nameOf(b.sellerId);
    events.push({ type: 'quote_placed', at: b.createdAt, label: `${name} placed a quote`, amount: b.budgetQuation });
    if (b.quoteStatus === 'shortlisted') events.push({ type: 'shortlisted', at: b.updatedAt, label: `${name} shortlisted` });
    if (b.quoteStatus === 'accepted') events.push({ type: 'accepted', at: b.updatedAt, label: `${name} accepted` });
  }
  for (const d of deals) {
    const name = nameOf(d.sellerId);
    events.push({ type: 'deal_proposed', at: d.createdAt, label: `Deal proposed with ${name}`, amount: d.amount, agreedTerms: d.agreedTerms });
    if (d.closedDealStatus === 'completed') events.push({ type: 'deal_completed', at: d.closedAt, label: `Deal completed with ${name}`, amount: d.amount, commissionAmount: d.commissionAmount });
    if (d.closedDealStatus === 'rejected') events.push({ type: 'deal_rejected', at: d.closedAt, label: `Deal rejected by ${name}` });
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { statusCode: 200, message: 'Timeline fetched', data: events };
}

export async function getBidStatsByProductId({ productId }) {
  if (!isValidObjectId(productId)) throw new BidServiceError(400, 'Invalid product id');
  const bids = await bidSchema.find({ productId }).select('budgetQuation');
  const totalBids = bids.length;
  if (totalBids === 0) {
    return {
      statusCode: 200,
      message: 'No bids found',
      data: { totalBids: 0, lowestQuote: 0, highestQuote: 0, averageQuote: 0 },
    };
  }

  const quotes = bids.map(bid => bid.budgetQuation);
  const lowestQuote = Math.min(...quotes);
  const highestQuote = Math.max(...quotes);
  const averageQuote = quotes.reduce((a, b) => a + b, 0) / totalBids;

  return {
    statusCode: 200,
    message: 'Bid stats fetched successfully',
    data: { totalBids, lowestQuote, highestQuote, averageQuote },
  };
}

/**
 * Anonymized bid activity for a product — what a prospective supplier sees
 * before/while quoting: how many quotes exist and a per-quote timeline of
 * non-identifying metadata. Deliberately excludes price (budgetQuation),
 * seller identity, and exact address — those stay confidential between
 * each seller and the buyer. Only city-level location (via cityOnly, same
 * masking already used for buyer identity elsewhere) plus delivery timeline
 * and brand offered, which are useful competitive signals without revealing
 * who's behind them.
 */
export async function getBidActivityByProduct({ productId }) {
  if (!isValidObjectId(productId)) throw new BidServiceError(400, 'Invalid product id');
  // Not filtered by status: 'active' — bids get marked 'inactive' when
  // superseded/merged elsewhere in this file, but that doesn't decrement
  // product.totalBidCount (only deleteBid does). Filtering here caused the
  // Bid History count to read 0 while the RFQ page's "Total Quote" badge,
  // which reads totalBidCount, showed 1 — same list must agree with that number.
  const bids = await bidSchema
    .find({ productId })
    .populate({ path: 'sellerId', select: 'firstName lastName businessName' })
    .select('createdAt location earliestDeliveryDate availableBrand sellerId')
    .sort({ createdAt: 1 })
    .lean();

  // Masked real name/business name (e.g. "R**** K***" or "A****** T***"),
  // same masking already used for buyer identity elsewhere — never the
  // literal "Supplier 1/2/3" placeholder the user asked to drop.
  const labelBySeller = new Map();
  const activity = bids
    .map(b => {
      const sellerKey = String(b.sellerId?._id || b.sellerId);
      if (!labelBySeller.has(sellerKey)) {
        const seller = b.sellerId;
        const displayName =
          seller?.businessName ||
          [seller?.firstName, seller?.lastName].filter(Boolean).join(' ') ||
          'Supplier';
        labelBySeller.set(sellerKey, maskName(displayName));
      }
      return {
        label: labelBySeller.get(sellerKey),
        createdAt: b.createdAt,
        location: cityOnly(b.location),
        earliestDeliveryDate: b.earliestDeliveryDate || null,
        availableBrand: b.availableBrand || null,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    statusCode: 200,
    message: 'Bid activity fetched successfully',
    data: { total: activity.length, bidders: labelBySeller.size, activity },
  };
}

// M3.T4 (Implementation Master Plan) — the quote-status field previously
// accepted any target value from any current state: an already-'accepted'
// bid (whose acceptance already triggered auto-rejecting every competing
// bid on the product, below) could be silently flipped to 'rejected' or
// back to 'shortlisted' with no guard at all, and 'rejected' had no
// terminal-state protection either. A real, if small, state machine now
// enforces the actual business rules — same pattern already established in
// verificationDecision.service.js for admin verification decisions.
//   pending     -> shortlisted | accepted | rejected
//   shortlisted -> accepted | rejected
//   accepted    -> (terminal — a deal is already effectively made)
//   rejected    -> (terminal)
const QUOTE_STATUS_TRANSITIONS = {
  pending: ['shortlisted', 'accepted', 'rejected'],
  shortlisted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

export async function updateQuoteStatus({ bidId, quoteStatus, userId }) {
  if (!['shortlisted', 'accepted', 'rejected'].includes(quoteStatus)) {
    throw new BidServiceError(400, 'Invalid quote status');
  }

  const session = await mongoose.startSession();
  let resultBid;
  try {
    // session.withTransaction auto-retries on TransientTransactionError,
    // matching createBid/deleteBid (see createBid's comment for why).
    await session.withTransaction(async () => {
      const bid = await bidSchema.findById(bidId).session(session);
      if (!bid) throw new BidServiceError(404, 'Bid not found');

      // Only the buyer can update the quote status!
      if (bid.buyerId.toString() !== userId.toString()) {
        throw new BidServiceError(403, 'Not authorized to update this bid status');
      }

      const currentStatus = bid.quoteStatus || 'pending';
      const allowedTargets = QUOTE_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedTargets.includes(quoteStatus)) {
        throw new BidServiceError(
          400,
          `Cannot change status from '${currentStatus}' to '${quoteStatus}' — this quote is already ${currentStatus}.`
        );
      }

      bid.quoteStatus = quoteStatus;
      await bid.save({ session });

      // If accepted, we auto-reject other bids for this product
      if (quoteStatus === 'accepted') {
        await bidSchema.updateMany(
          { productId: bid.productId, _id: { $ne: bidId } },
          { $set: { quoteStatus: 'rejected' } },
          { session }
        );
      }

      // Notify the Seller!
      try {
        const productDetails = await productSchema.findById(bid.productId).select('title').session(session);
        let title = '';
        let description = '';
        if (quoteStatus === 'shortlisted') {
          title = 'Quote Shortlisted!';
          description = `Your quote for "${productDetails.title}" has been shortlisted by the buyer.`;
        } else if (quoteStatus === 'accepted') {
          title = 'Quote Accepted!';
          description = `Congratulations! Your quote for "${productDetails.title}" was accepted.`;
        } else if (quoteStatus === 'rejected') {
          title = 'Quote Rejected';
          description = `Unfortunately, your quote for "${productDetails.title}" was rejected.`;
        }

        if (title) {
          const notif = await productNotificaitonSchema.create(
            [
              {
                recipientId: bid.sellerId,
                senderId: userId,
                productId: bid.productId,
                type: 'quote_status_update',
                title,
                description,
                roomId: null,
                metadata: {
                  quoteStatus,
                  bidId: bid._id.toString(),
                  productId: bid.productId.toString(),
                  buyerId: bid.buyerId.toString(),
                },
              },
            ],
            { session }
          );

          const io = getIO();
          const sellerSocketId = onlineUsers.get(bid.sellerId.toString());
          if (io && sellerSocketId) {
            io.to(sellerSocketId).emit(SOCKET_EVENTS.NOTIFICATION_NEW, {
              _id: notif[0]._id.toString(),
              type: notif[0].type,
              title: notif[0].title,
              description: notif[0].description,
              seen: false,
              roomId: null,
              dealId: null,
              createdAt: notif[0].createdAt,
              metadata: notif[0].metadata,
            });
          }
        }
      } catch (notifErr) {
        console.error('Bid notification error:', notifErr);
      }

      resultBid = bid;
    });

    return { statusCode: 200, message: `Bid marked as ${quoteStatus} successfully`, data: resultBid };
  } catch (err) {
    if (err instanceof BidServiceError) throw err;
    throw new BidServiceError(500, err.message || 'Something went wrong while updating quote status');
  } finally {
    session.endSession();
  }
}
