import mongoose, { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
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

export const getLatestThreeBidAndDraft = async (req, res) => {
  try {
    const user = req.user._id;
    if (!user) {
      return ApiResponse.errorResponse(res, 404, 'User not found');
    }
    const bids = await bidSchema
      .find({ sellerId: user })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId',
        },
      })
      .lean();
    if (!bids) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    //  for draft
    const drafts = await productSchema
      .find({ userId: user, draft: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('categoryId')
      .lean();
    if (!drafts) {
      return ApiResponse.errorResponse(res, 404, 'Draft not found');
    }

    return ApiResponse.successResponse(res, 200, 'Bid fetched successfully', {
      bids,
      drafts,
    });
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 400, 'Something went wrong while getting bid overview');
  }
};
export const bidOverViewbyId = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return ApiResponse.errorResponse(res, 400, 'Invalid bid or product id');
  }

  try {
    const bid = await bidSchema.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },

      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$product.categoryId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$categoryId'] },
              },
            },
          ],
          as: 'productCategory',
        },
      },
      {
        $unwind: { path: '$productCategory', preserveNullAndEmptyArrays: true },
      },

      {
        $addFields: {
          'product.category': '$productCategory',
        },
      },
      {
        $project: {
          productCategory: 0,
        },
      },
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
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: '$seller' },

      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyer',
        },
      },
      { $unwind: '$buyer' },

      {
        $project: {
          productId: 0,
          sellerId: 0,
          buyerId: 0,
          'product.categoryId': 0,
          'product.subCategoryId': 0,
        },
      },
    ]);

    if (!bid.length) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    return ApiResponse.successResponse(res, 200, 'Bid overview', bid[0]);
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Something went wrong while getting bid overview'
    );
  }
};
export const updateBidUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { budgetQuation, availableBrand, earliestDeliveryDate } = req.body;

    const bid = await bidSchema.findById(id);

    if (!bid) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    const userId = req.user.userId || req.user._id;
    if (bid.sellerId.toString() !== userId.toString()) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized to update this bid');
    }

    bid.budgetQuation = budgetQuation;
    bid.availableBrand = availableBrand;
    bid.earliestDeliveryDate = earliestDeliveryDate;
    await bid.save();

    return ApiResponse.successResponse(res, 200, 'Bid updated successfully', bid);
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Something went wrong while updating bid'
    );
  }
};

export const createBid = async (req, res) => {
  const session = await mongoose.startSession();
  console.log('CREATE BID REQ BODY:', req.body);

  try {
    session.startTransaction();

    const {
      budgetQuation,
      status,
      availableBrand,
      earliestDeliveryDate,
      businessType,
      sellerType,
      priceBasis,
      taxes,
      freightTerms,
      paymentTerms,
      location,
      buyerNote,
    } = req.body;

    const { buyerId, productId } = req.params;
    const sellerId = req.user.userId;

    if (!isValidObjectId(buyerId) || !isValidObjectId(productId)) {
      throw new Error('Invalid sellerId or productId');
    }

    if (!budgetQuation) {
      throw new Error('budgetQuation is required');
    }

    const isProductIsSold = await productSchema
      .exists({ _id: productId, isSoldProduct: true })
      .session(session);
    if (isProductIsSold?._id)
      return ApiResponse.errorResponse(res, 400, 'This product is already sold');

    const existingBid = await bidSchema.findOne({ sellerId, buyerId, productId }, null, {
      session,
    });

    if (existingBid) {
      throw new Error('You have already placed a bid for this product');
    }

    const isSold = await closeDealSchema
      .exists({
        productId,
        closedDealStatus: 'completed',
        dealStatus: 'accepted',
      })
      .session(session);

    if (isSold?._id) {
      throw new Error('This product is already sold');
    }

    const sellerExists = await requirementSchema.findOne(
      {
        productId,
        buyerId,
        'sellers.sellerId': sellerId,
      },
      null,
      { session }
    );

    if (sellerExists) {
      throw new Error('You already placed bid in requirement');
    }

    const bid = await bidSchema.create(
      [
        {
          sellerId,
          buyerId,
          productId,
          budgetQuation,
          status: status || 'active',
          availableBrand,
          earliestDeliveryDate,
          sellerType,
          priceBasis,
          taxes,
          freightTerms,
          paymentTerms,
          location,
          buyerNote,
          businessType,
          ...(businessType === 'business' && {
            businessDets: req.body.businessDets,
          }),
        },
      ],
      { session }
    );

    const createdBid = bid[0];

    const updatedProduct = await productSchema.findByIdAndUpdate(
      productId,
      { $inc: { totalBidCount: 1 } },
      { new: true, session }
    );

    //  Requirement logic
    let requirement = await requirementSchema.findOne({ productId, buyerId }, null, { session });

    if (!requirement) {
      return ApiResponse.errorResponse(
        res,
        404,
        'Requirement not found for this product and buyer'
      );
    }
    const updatedRequirement = await requirementSchema.findOneAndUpdate(
      { productId, buyerId },
      {
        $push: {
          sellers: {
            sellerId,
            budgetAmount: budgetQuation,
            bidId: createdBid._id,
          },
        },
      },
      { new: true, session }
    );

    if (!updatedRequirement) {
      throw new Error('Requirement not found for this product and buyer');
    }

    // if (requirement) {
    //   requirement.sellers.push({
    //     sellerId,
    //     budgetAmount: budgetQuation,
    //     bidId: createdBid._id,
    //   });

    //   await requirement.save({ session });
    // } else {

    //   requirement = await requirementSchema.create(
    //     [
    //       {
    //         productId,
    //         buyerId,
    //         sellers: [
    //           {
    //             sellerId,
    //             budgetAmount: budgetQuation,
    //             bidId: createdBid._id,
    //           },
    //         ],
    //       },
    //     ],
    //     { session }
    //   );
    //   requirement = requirement[0];
    // }

    await cartSchema.findOneAndUpdate(
      { userId: sellerId },
      {
        $pull: {
          cartItems: {
            productIds: { $in: [productId] },
          },
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Populate response (outside transaction)
    const [sellerDetails, buyerDetails, productDetails] = await Promise.all([
      userSchema.findById(sellerId).select('-password -__v').lean(),
      userSchema.findById(buyerId).select('-password -__v').lean(),
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
          amount: budgetQuation,
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

    return ApiResponse.successResponse(res, 200, 'Bid created successfully', {
      bid: populatedBid,
      productId,
      sellerId,
      buyerId: updatedProduct.userId,
      requirementId: updatedRequirement?._id,
    });
  } catch (err) {
    console.log('CREATE BID ERROR------------->', err);
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    return ApiResponse.errorResponse(res, 400, err.message || 'Transaction failed');
  }
};

export const getAllBids = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search = '', limit = 10, page = 1, sortBy = 'desc' } = req.query;
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const sortOrder = sortBy === 'asc' ? 1 : -1;
    const pipeline = [
      {
        $match: {
          sellerId: new mongoose.Types.ObjectId(userId),
          // $or: [
          //   { sellerId: new mongoose.Types.ObjectId(userId) },
          //   { buyerId: new mongoose.Types.ObjectId(userId) }
          // ]
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ];
    if (search && search.trim() !== '') {
      pipeline.push({
        $match: {
          'product.title': { $regex: search, $options: 'i' },
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: '$seller' },

      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyer',
        },
      },
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
      {
        $unwind: {
          path: '$closedDeal',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          closedDealStatus: '$closedDeal.closedDealStatus',
        },
      },
      {
        $unset: 'closedDeal',
      }
    );

    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    const countResult = await bidSchema.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    pipeline.push({ $sort: { createdAt: sortOrder } });
    pipeline.push({ $skip: (parsedPage - 1) * parsedLimit });
    pipeline.push({ $limit: parsedLimit });

    let bids = await bidSchema.aggregate(pipeline);

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    await Promise.all(
      bids.map(async bid => {
        if (
          bid.status === 'active' &&
          bid.createdAt &&
          now - new Date(bid.createdAt).getTime() > twentyFourHours
        ) {
          await bidSchema.findByIdAndUpdate(bid._id, { status: 'inactive' });
          bid.status = 'inactive';
        }
      })
    );

    return ApiResponse.successResponse(res, 200, 'All bids fetched successfully', {
      total,
      page: parsedPage,
      limit: parsedLimit,
      bids,
    });
  } catch (err) {
    return ApiResponse.errorResponse(
      res,
      400,
      err.message || 'Something went wrong while fetching bids'
    );
  }
};

export const getBidById = async (req, res) => {
  try {
    const { id } = req.params;
    let dealStatus = 'pending';
    if (!isValidObjectId(id)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid bid id');
    }

    const { limit = 10, page = 1 } = req.query;
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);

    const bid = await bidSchema.findById(id).lean();
    if (!bid) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    const productId = bid.productId;

    let allBids = await bidSchema
      .find({ productId })
      .populate({
        path: 'sellerId',
        select: '-password -__v',
      })
      .lean();

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    allBids = await Promise.all(
      allBids.map(async b => {
        if (
          b.status === 'active' &&
          b.createdAt &&
          now - new Date(b.createdAt).getTime() > twentyFourHours
        ) {
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
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    // ✅ Pagination
    const totalSellers = sellersAll.length;
    const startIdx = (parsedPage - 1) * parsedLimit;
    const sellers = sellersAll.slice(startIdx, startIdx + parsedLimit);

    const productDoc = await productSchema
      .findById(productId)
      .populate({ path: 'categoryId', select: '-subCategories' })
      .lean();

    if (!productDoc) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    const cleanProduct = prod => {
      const p = { ...prod };
      if (p.userId?._id) p.userId = p.userId._id.toString();
      if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;
      delete p.__v;
      return p;
    };

    const deal = await closeDealSchema
      .findOne({ productId: productDoc._id })
      .select('closedDealStatus')
      .lean();

    if (deal?.closedDealStatus) {
      dealStatus = deal.closedDealStatus;
    }

    const product = { ...cleanProduct(productDoc), dealStatus };

    let buyer = null;
    if (product.userId) {
      const buyerData = await userSchema.findById(product.userId).select('-password -__v').lean();

      if (buyerData) {
        buyer = {
          _id: buyerData._id,
          firstName: buyerData.firstName,
          lastName: buyerData.lastName,
          email: buyerData.email,
          phone: buyerData.phone,
          currentLocation: buyerData.currentLocation || buyerData.address,
          profileImage: buyerData.profileImage,
        };
      }
    }

    // ⏱️ Check main bid expiry
    let mainBidStatus = bid.status;
    if (
      bid.status === 'active' &&
      bid.createdAt &&
      now - new Date(bid.createdAt).getTime() > twentyFourHours
    ) {
      await bidSchema.findByIdAndUpdate(bid._id, { status: 'inactive' });
      mainBidStatus = 'inactive';
    }

    //  Final response
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

    return ApiResponse.successResponse(res, 200, 'Bid details fetched successfully', responseObj);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to fetch bid details');
  }
};

export const getBidByProductId = async (req, res) => {
  const { productId } = req.params;
  try {
    const getBidDoc = await bidSchema.exists({
      productId,
    });
    if (!getBidDoc) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }
    return ApiResponse.successResponse(res, 200, 'Bid fetched successfully', getBidDoc);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const deleteBid = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { id } = req.params;
    const sellerId = req.user.userId || req.user._id;
    const bid = await bidSchema.findOne({ _id: id, sellerId }).session(session);
    if (!bid) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized to delete this bid');
    }

    await requirementSchema.findOneAndUpdate(
      { productId: bid.productId },
      { $pull: { sellers: { sellerId: bid.sellerId || sellerId } } },
      { session }
    );

    await bidSchema.deleteOne({ _id: id }).session(session);

    if (bid.productId) {
      await productSchema.findByIdAndUpdate(
        bid.productId,
        { $inc: { totalBidCount: -1 } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    return ApiResponse.successResponse(res, 200, 'Bid deleted successfully');
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return ApiResponse.errorResponse(
      res,
      400,
      err.message || 'Something went wrong while deleting bid'
    );
  }
};

export const getBidDetailsBySellerIdAndProductId = async (req, res) => {
  const { sellerId, productId } = req.params;
  try {
    const bidDetails = await bidSchema.findOne({ sellerId, productId }).populate('sellerId').lean();
    if (!bidDetails) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found for this seller and product');
    }
    return ApiResponse.successResponse(res, 200, 'Bid details fetched successfully', bidDetails);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message || 'Failed to fetch bid details');
  }
};

export const getBidStatsByProductId = async (req, res) => {
  const { productId } = req.params;
  try {
    if (!isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid product id');
    }
    const bids = await bidSchema.find({ productId }).select('budgetQuation');
    const totalBids = bids.length;
    if (totalBids === 0) {
      return ApiResponse.successResponse(res, 200, 'No bids found', {
        totalBids: 0,
        lowestQuote: 0,
        highestQuote: 0,
        averageQuote: 0,
      });
    }

    const quotes = bids.map(bid => bid.budgetQuation);
    const lowestQuote = Math.min(...quotes);
    const highestQuote = Math.max(...quotes);
    const averageQuote = quotes.reduce((a, b) => a + b, 0) / totalBids;

    return ApiResponse.successResponse(res, 200, 'Bid stats fetched successfully', {
      totalBids,
      lowestQuote,
      highestQuote,
      averageQuote,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message || 'Failed to fetch bid stats');
  }
};

export const updateQuoteStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { bidId } = req.params;
    const { quoteStatus } = req.body; // 'shortlisted', 'accepted', 'rejected'

    if (!['shortlisted', 'accepted', 'rejected'].includes(quoteStatus)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid quote status');
    }

    const bid = await bidSchema.findById(bidId).session(session);
    if (!bid) {
      return ApiResponse.errorResponse(res, 404, 'Bid not found');
    }

    // Only the buyer can update the quote status!
    const userId = req.user.userId || req.user._id;
    if (bid.buyerId.toString() !== userId.toString()) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized to update this bid status');
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
        const notif = await productNotificaitonSchema.create([{
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
          },
        }], { session });

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

    await session.commitTransaction();
    session.endSession();

    return ApiResponse.successResponse(res, 200, `Bid marked as ${quoteStatus} successfully`, bid);
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return ApiResponse.errorResponse(res, 500, err.message || 'Something went wrong while updating quote status');
  }
};
