import mongoose, { isValidObjectId } from 'mongoose';
import uploadFile from '../config/imageKit.config.js';
import productSchema from '../models/product.schema.js';
import categorySchema from '../models/category.schema.js';
import userSchema from '../models/user.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';
import requirementSchema from '../models/requirement.schema.js';
import bidSchema from '../models/bid.schema.js';

/**
 * M3.T2 (Implementation Master Plan) — service layer extracted out of
 * product.controller.js. Pure extraction, same pattern as bid.service.js;
 * every query/response shape is unchanged. One deliberate improvement,
 * explicitly called for in M3.T2's own acceptance criteria: the "is this
 * RFQ open for quotes" predicate (draft:false, isSoldProduct:false,
 * bidExpiryDate not in the past) was duplicated across 5 call sites with
 * slightly different syntax each time — consolidated into rfqOpenFilter()
 * below since the logic was already being touched by this extraction.
 */
export class ProductServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Same predicate previously written 5 different ways: `$not: { $lt: now }`,
// an `$or` against missing/null/future dates, etc. — all equivalent to
// "not in the past OR not set", just expressed differently at each call
// site. One function now, used everywhere that logic is needed.
export function rfqOpenFilter(extra = {}) {
  return {
    draft: false,
    isSoldProduct: false,
    bidExpiryDate: { $not: { $lt: new Date() } },
    ...extra,
  };
}

export async function addProduct({ body, files, userId }) {
  const image = files?.image?.[0];
  const document = files?.document?.[0];
  const productBody = { ...body };
  ['paymentAndDelivery', 'oldProductValue'].forEach(key => {
    if (typeof productBody[key] === 'string') {
      try {
        productBody[key] = JSON.parse(productBody[key]);
      } catch {}
    }
  });

  if (Array.isArray(productBody.subCategoryId)) {
    productBody.subCategoryId = productBody.subCategoryId[0];
  }

  // Category and subCategory existence validation (only for published products, not drafts)
  if (productBody.draft === 'false' || productBody.draft === false || !productBody.draft) {
    if (!productBody.categoryId || !isValidObjectId(productBody.categoryId)) {
      throw new ProductServiceError(400, 'Invalid categoryId');
    }
    if (!productBody.subCategoryId || !isValidObjectId(productBody.subCategoryId)) {
      throw new ProductServiceError(400, 'Invalid subCategoryId');
    }
    const category = await categorySchema.findOne({
      _id: productBody.categoryId,
      'subCategories._id': productBody.subCategoryId,
    });
    if (!category) {
      throw new ProductServiceError(400, 'Selected Category or Subcategory does not exist');
    }
  }

  let imageUrl = null;
  let documentUrl = null;
  if (image) imageUrl = await uploadFile(image);
  if (document) documentUrl = await uploadFile(document);

  const product = await productSchema.create({
    title: productBody.title,
    description: productBody.description,
    quantity: productBody.quantity,
    minimumBudget: productBody.minimumBudget ? Number(productBody.minimumBudget) : undefined,
    brand: productBody.brand,
    brandName: productBody.brandName,
    categoryId: productBody.categoryId,
    subCategoryId: productBody.subCategoryId,
    userId,
    draft: productBody.draft === 'true' || productBody.draft === true,
    image: imageUrl,
    document: documentUrl,
    productType: productBody.productType,
    oldProductValue: productBody.oldProductValue,
    conditionOfProduct: productBody.conditionOfProduct,
    gender: productBody.gender,
    fuelType: productBody.fuelType,
    model: productBody.model,
    color: productBody.color,
    transmission: productBody.transmission,
    toolType: productBody.toolType,
    typeOfProduct: productBody.typeOfProduct,
    typeOfVehicle: productBody.typeOfVehicle,
    rateAService: productBody.rateAService,
    additionalDeliveryAndPackage: productBody.additionalDeliveryAndPackage,
    paymentAndDelivery: productBody.paymentAndDelivery,
    bidActiveDuration: productBody.bidActiveDuration,
    quantityUnit: productBody.quantityUnit,
  });

  if (productBody.draft === 'false') {
    await requirementSchema.create([{ productId: product._id, buyerId: userId, sellers: [] }]);
  }

  return { statusCode: 201, message: 'Product created successfully', data: product };
}

export async function addMultipleProducts({ body, userId }) {
  const { commonDetails, categoryGroups } = body;
  if (!categoryGroups || !Array.isArray(categoryGroups) || categoryGroups.length === 0) {
    throw new ProductServiceError(400, 'Category groups array is required');
  }

  if (typeof commonDetails.paymentAndDelivery === 'string') {
    try {
      commonDetails.paymentAndDelivery = JSON.parse(commonDetails.paymentAndDelivery);
    } catch {}
  }

  const createdProducts = [];
  for (const group of categoryGroups) {
    if (!group.items || group.items.length === 0) continue;

    const productPayload = {
      title: commonDetails.title,
      description: group.description || commonDetails.description,
      minimumBudget: commonDetails.minimumBudget ? Number(commonDetails.minimumBudget) : undefined,
      userId,
      draft: commonDetails.draft === 'true' || commonDetails.draft === true,
      paymentAndDelivery: commonDetails.paymentAndDelivery,
      bidExpiryDate: commonDetails.bidExpiryDate,
      isMultiple: true,
      categoryId: group.categoryId,
      items: group.items.map(item => ({
        subCategoryId: mongoose.isValidObjectId(item.subCategoryId) ? item.subCategoryId : null,
        subCategoryName: mongoose.isValidObjectId(item.subCategoryId) ? item.subCategoryName : item.subCategoryId,
        brand: item.brand,
        brandName: item.brandName,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        model: item.model,
        color: item.color,
        fuelType: item.fuelType,
        transmission: item.transmission,
        conditionOfProduct: item.conditionOfProduct,
        toolType: item.toolType,
        typeOfVehicle: item.typeOfVehicle,
        typeOfProduct: item.typeOfProduct,
        productType: item.productType,
        productCondition: item.productCondition,
        gender: item.gender,
        rateAService: item.rateAService,
      })),
    };

    const product = await productSchema.create(productPayload);

    if (productPayload.draft === false) {
      await requirementSchema.create([{ productId: product._id, buyerId: userId, sellers: [] }]);
    }

    createdProducts.push(product);
  }

  return { statusCode: 201, message: 'Multiple products created successfully', data: createdProducts };
}

export async function getTrendingCategory() {
  // Count must match what the listing shows: published, not sold, not expired.
  let trendingProducts = await productSchema.aggregate([
    {
      $match: {
        draft: false,
        isSoldProduct: false,
        $or: [
          { bidExpiryDate: { $gt: new Date() } },
          { bidExpiryDate: { $exists: false } },
          { bidExpiryDate: null },
        ],
      },
    },
    // Filter out legacy documents where expiry is undefined but they are older than their active duration (defaulting to 1 day)
    {
      $addFields: {
        calculatedExpiry: {
          $cond: {
            if: { $or: [{ $eq: ['$bidExpiryDate', null] }, { $not: ['$bidExpiryDate'] }] },
            then: {
              $add: [
                '$createdAt',
                { $multiply: [{ $toDouble: { $ifNull: ['$bidActiveDuration', '1'] } }, 24, 60, 60, 1000] },
              ],
            },
            else: '$bidExpiryDate',
          },
        },
      },
    },
    { $match: { calculatedExpiry: { $gt: new Date() } } },
    {
      $group: {
        _id: '$categoryId',
        count: { $sum: 1 },
        latestProductId: { $max: '$_id' },
        latestCreatedAt: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1 } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $project: {
        _id: 0,
        category: { _id: '$category._id', categoryName: '$category.categoryName', image: '$category.image' },
        productCount: '$count',
        latestProductId: 1,
        latestCreatedAt: 1,
      },
    },
  ]);

  // Fallback: If no products have been posted yet, populate with standard seeded categories
  if (!trendingProducts || trendingProducts.length === 0) {
    const fallbackCats = await categorySchema.find().lean();
    trendingProducts = fallbackCats.map(cat => ({
      category: { _id: cat._id, categoryName: cat.categoryName, image: cat.image },
      productCount: 0,
    }));
  }

  return { statusCode: 200, message: 'Trending categories', data: trendingProducts };
}

export async function getHomeProducts() {
  const topProductsPerCategory = await productSchema.aggregate([
    { $match: rfqOpenFilter() },
    { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'categoryInfo' } },
    { $unwind: '$categoryInfo' },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userInfo' } },
    { $unwind: '$userInfo' },
    {
      $group: {
        _id: '$categoryId',
        categoryName: { $first: '$categoryInfo.categoryName' },
        totalCount: { $sum: 1 },
        products: { $push: '$$ROOT' },
      },
    },
    { $sort: { totalCount: -1 } },
    { $limit: 2 },
    { $project: { _id: 1, categoryName: 1, totalCount: 1, products: { $slice: ['$products', 2] } } },
  ]);

  return { statusCode: 200, message: 'Products fetched successfully', data: topProductsPerCategory };
}

export async function getProductByName({ productName, categoryId }) {
  if (!productName) return { statusCode: 200, message: 'empty query', data: [] };

  const query = rfqOpenFilter({ title: { $regex: productName, $options: 'i' } });

  if (categoryId && categoryId !== 'all' && mongoose.Types.ObjectId.isValid(categoryId)) {
    query.categoryId = new mongoose.Types.ObjectId(categoryId);
  }

  const products = await productSchema
    .find(query, { title: 1, image: 1, description: 1 })
    .populate({ path: 'userId', select: 'firstName lastName address' })
    .populate({ path: 'categoryId', select: 'categoryName' })
    .limit(5)
    .lean();

  return { statusCode: 200, message: 'products found', data: products };
}

export async function searchProducts({ query, callerUserId }) {
  const {
    title, category, categoryId, sort, min_budget, max_budget, location,
    page = 1, limit = 10, skip,
  } = query;

  const limitValue = Math.max(parseInt(limit, 10), 1);
  const pageValue = Math.max(parseInt(page, 10), 1);
  const skipValue = skip ? parseInt(skip, 10) : (pageValue - 1) * limitValue;

  const buildSortObj = s => {
    switch (s) {
      case 'aplhabetically_a_z': return { title: 1 };
      case 'aplhabetically_z_a': return { title: -1 };
      case 'feature': return { feature: -1, createdAt: -1 };
      default: return { createdAt: -1 };
    }
  };

  const sortByBudget = (docs, direction) =>
    [...docs].sort((a, b) => {
      const aVal = Number(a.minimumBudget) || 0;
      const bVal = Number(b.minimumBudget) || 0;
      return direction === 'low_to_high' ? aVal - bVal : bVal - aVal;
    });

  const buildBudgetFilter = (min, max) => {
    const minNum = min != null && min !== '' ? Number(min) : null;
    const maxNum = max != null && max !== '' ? Number(max) : null;
    if (minNum === null && maxNum === null) return null;
    const condition = {};
    if (minNum !== null && !isNaN(minNum)) condition.$gte = minNum;
    if (maxNum !== null && !isNaN(maxNum)) condition.$lte = maxNum;
    return Object.keys(condition).length > 0 ? { minimumBudget: condition } : null;
  };

  const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const fetchProducts = async (filter, sortObj) =>
    productSchema
      .find(filter)
      .populate({ path: 'userId', select: 'firstName lastName address' })
      .populate({ path: 'categoryId', select: 'categoryName' })
      .sort(sortObj)
      .skip(skipValue)
      .limit(limitValue)
      .lean();

  // Expired RFQs drop out of browse.
  const filter = rfqOpenFilter();
  // A buyer shouldn't see their own posted RFQ in their own Explore/browse
  // results — this endpoint is for finding OTHER people's requirements.
  if (callerUserId) {
    filter.userId = { $ne: new mongoose.Types.ObjectId(callerUserId) };
  }
  let useTitleSearch = Boolean(title && typeof title === 'string' && title.trim().length >= 2);

  const catId = category || categoryId;
  const subCatId = query.subCategoryId;

  if (catId && catId !== 'All Projects') {
    if (!isValidObjectId(catId)) throw new ProductServiceError(400, 'Invalid categoryId');
    filter.categoryId = new mongoose.Types.ObjectId(catId);
  }

  if (subCatId) {
    if (!isValidObjectId(subCatId)) throw new ProductServiceError(400, 'Invalid subCategoryId');
    filter.subCategoryId = new mongoose.Types.ObjectId(subCatId);
  }

  const isPriceSort = sort === 'low_to_high' || sort === 'high_to_low';
  const sortObj = isPriceSort ? { createdAt: -1 } : buildSortObj(sort);

  const budgetFilter = buildBudgetFilter(min_budget, max_budget);
  if (budgetFilter) Object.assign(filter, budgetFilter);

  if (location && location.trim() !== '') {
    const matchingUsers = await userSchema
      .find({
        $or: [
          { address: { $regex: location.trim(), $options: 'i' } },
          { currentLocation: { $regex: location.trim(), $options: 'i' } },
        ],
      })
      .select('_id');
    // This overwrites the earlier own-RFQ exclusion (both target `userId`) —
    // re-apply it here by dropping the caller from the matched-location set.
    const userIds = matchingUsers
      .map(u => u._id)
      .filter(id => !callerUserId || id.toString() !== callerUserId.toString());
    filter.userId = { $in: userIds };
  }

  // BRANCH A — Title search
  if (useTitleSearch) {
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      throw new ProductServiceError(400, 'Valid product title is required (min 2 characters)');
    }

    const words = title
      .trim()
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(w => w.length > 1)
      .map(escapeRegex);

    if (words.length === 0) {
      throw new ProductServiceError(400, 'Search title contains no valid keywords');
    }

    const strongFilter = { ...filter, $and: words.map(w => ({ title: { $regex: `\\b${w}\\b`, $options: 'i' } })) };
    const mediumFilter = { ...filter, $and: words.map(w => ({ title: { $regex: w, $options: 'i' } })) };
    const weakFilter = { ...filter, $or: words.map(w => ({ title: { $regex: w, $options: 'i' } })) };

    let products = await fetchProducts(strongFilter, sortObj);
    let total = await productSchema.countDocuments(strongFilter);

    if (products.length === 0) {
      products = await fetchProducts(mediumFilter, sortObj);
      total = await productSchema.countDocuments(mediumFilter);
    }
    if (products.length === 0) {
      products = await fetchProducts(weakFilter, sortObj);
      total = await productSchema.countDocuments(weakFilter);
    }

    if (isPriceSort) products = sortByBudget(products, sort);

    return {
      statusCode: 200,
      message: 'Products fetched successfully',
      data: { total, totalPages: Math.ceil(total / limitValue), page: pageValue, limit: limitValue, skip: skipValue, products },
    };
  }

  // BRANCH B — Category / subCategory search
  let products = await fetchProducts(filter, sortObj);
  const total = await productSchema.countDocuments(filter);
  if (isPriceSort) products = sortByBudget(products, sort);

  return {
    statusCode: 200,
    message: 'Products fetched successfully',
    data: { total, totalPages: Math.ceil(total / limitValue), page: pageValue, limit: limitValue, skip: skipValue, products },
  };
}

export async function getProductById({ productId }) {
  if (!isValidObjectId(productId)) throw new ProductServiceError(400, 'Invalid product ID');

  const product = await productSchema
    .findById(productId)
    .populate({ path: 'userId', select: 'firstName lastName address' })
    .populate({ path: 'categoryId', select: 'categoryName subCategories' });

  if (!product) throw new ProductServiceError(404, 'Product not found');

  const getStatus = await closeDealSchema
    .findOne({ productId })
    .select('closedDealStatus sellerRating')
    .lean();

  const dealStatus = getStatus?.closedDealStatus || null;
  const sellerRating = getStatus?.sellerRating ?? 0;

  const productObj = product.toObject();
  productObj.dealStatus = dealStatus;
  productObj.sellerRating = sellerRating;

  return { statusCode: 200, message: 'Product found', data: [{ mainProduct: productObj }] };
}

export async function getAllDraftProducts({ userId, page = 1, limit = 10 }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');

  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;
  const skip = (parsedPage - 1) * parsedLimit;

  const [products, total] = await Promise.all([
    productSchema
      .find({ draft: true, userId })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    productSchema.countDocuments({ draft: true, userId }),
  ]);

  const cleanProduct = prod => {
    if (!prod) return prod;
    const p = { ...prod };
    delete p.__v;
    if (p.categoryId) {
      p.categoryId = {
        _id: p.categoryId._id,
        categoryName: p.categoryId.categoryName,
        image: p.categoryId.image,
        updatedAt: p.categoryId.updatedAt,
      };
    }
    return { ...p, subProducts: [] };
  };

  const result = products.map(cleanProduct);

  return {
    statusCode: 200,
    message: 'Draft products fetched successfully',
    data: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit), data: result },
  };
}

export async function deleteDraftProduct({ productId, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');
  if (!isValidObjectId(productId)) throw new ProductServiceError(400, 'Invalid product ID');

  const draft = await productSchema.findOne({ _id: productId, draft: true });
  if (!draft) throw new ProductServiceError(404, 'Product not found');

  // ownership check — a user may only delete their own draft
  if (draft.userId.toString() !== userId.toString()) {
    throw new ProductServiceError(403, 'Not authorized');
  }

  const deletedProduct = await productSchema.deleteOne({ _id: productId, draft: true });
  return { statusCode: 200, message: 'Product deleted successfully', data: deletedProduct };
}

export async function deleteProduct({ productId, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');

  const product = await productSchema.findById(productId);
  if (!product) throw new ProductServiceError(404, 'Product not found');
  if (product.userId.toString() !== userId) throw new ProductServiceError(403, 'Not authorized');

  await productSchema.deleteOne({ _id: productId });
  // Also cleanup the associated requirement
  await requirementSchema.deleteOne({ productId });

  return { statusCode: 200, message: 'Product deleted successfully', data: null };
}

export async function updateProduct({ body, files, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');

  let { productId, products, ...updateFields } = body;

  if (!productId && products) {
    try {
      const parsed = typeof products === 'string' ? JSON.parse(products) : products;
      productId = parsed?.[0]?._id;
    } catch {}
  }

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ProductServiceError(400, 'Valid productId is required');
  }

  const product = await productSchema.findById(productId);
  if (!product) throw new ProductServiceError(404, 'Product not found');
  if (product.userId.toString() !== userId) throw new ProductServiceError(403, 'Not authorized');

  const catId = updateFields.categoryId || product.categoryId;
  const subCatId = updateFields.subCategoryId || product.subCategoryId;
  if (!catId || !isValidObjectId(catId)) throw new ProductServiceError(400, 'Invalid categoryId');
  if (!subCatId || !isValidObjectId(subCatId)) throw new ProductServiceError(400, 'Invalid subCategoryId');

  const categoryExists = await categorySchema.findOne({ _id: catId, 'subCategories._id': subCatId });
  if (!categoryExists) throw new ProductServiceError(400, 'Selected Category or Subcategory does not exist');

  if (typeof updateFields.paymentAndDelivery === 'string') {
    try {
      updateFields.paymentAndDelivery = JSON.parse(updateFields.paymentAndDelivery);
    } catch {}
  }

  let imageUrl = null;
  let documentUrl = null;
  if (files?.image?.[0]) imageUrl = await uploadFile(files.image[0]);
  if (files?.document?.[0]) documentUrl = await uploadFile(files.document[0]);

  const updatePayload = { ...updateFields };
  if (imageUrl) updatePayload.image = imageUrl;
  if (documentUrl) updatePayload.document = documentUrl;

  const updatedProduct = await productSchema.findByIdAndUpdate(productId, updatePayload, { new: true });

  return { statusCode: 200, message: 'Product updated successfully', data: updatedProduct };
}

export async function getDraftProductById({ productId, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ProductServiceError(400, 'Invalid product ID');

  const product = await productSchema
    .findOne({ _id: productId, draft: true, userId })
    .populate({ path: 'categoryId', select: '-subCategories' })
    .lean();

  if (!product) throw new ProductServiceError(404, 'Draft product not found');

  const cleanProduct = prod => {
    if (!prod) return prod;
    const p = { ...prod };
    if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;
    delete p.__v;
    return p;
  };

  return { statusCode: 200, message: 'Draft product fetched successfully', data: cleanProduct(product) };
}

async function resolveUpdatePayload({ body, files, userId, forceDraftValue }) {
  let { productId, products, ...updateFields } = body;

  if (!productId && products) {
    try {
      const parsed = typeof products === 'string' ? JSON.parse(products) : products;
      productId = parsed?.[0]?._id;
    } catch {}
  }

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ProductServiceError(400, 'Valid productId is required');
  }

  const product = await productSchema.findById(productId);
  if (!product) throw new ProductServiceError(404, 'Product not found');
  if (product.userId.toString() !== userId) throw new ProductServiceError(403, 'Not authorized');

  // saveAsDraft (forceDraftValue === true) intentionally skips category
  // validation — a draft can be incomplete by definition. Publish
  // (updateDraftStatus, forceDraftValue === false) requires it.
  if (forceDraftValue === false) {
    const catId = updateFields.categoryId || product.categoryId;
    const subCatId = updateFields.subCategoryId || product.subCategoryId;
    if (!catId || !isValidObjectId(catId)) throw new ProductServiceError(400, 'Invalid categoryId');
    if (!subCatId || !isValidObjectId(subCatId)) throw new ProductServiceError(400, 'Invalid subCategoryId');
    const categoryExists = await categorySchema.findOne({ _id: catId, 'subCategories._id': subCatId });
    if (!categoryExists) throw new ProductServiceError(400, 'Selected Category or Subcategory does not exist');
  }

  if (typeof updateFields.paymentAndDelivery === 'string') {
    try {
      updateFields.paymentAndDelivery = JSON.parse(updateFields.paymentAndDelivery);
    } catch {}
  }

  let imageUrl = null;
  let documentUrl = null;
  if (files?.image?.[0]) {
    const file = files.image[0];
    imageUrl = await uploadFile(file);
    if (file.key) updateFields.imageKey = file.key;
  }
  if (files?.document?.[0]) {
    documentUrl = await uploadFile(files.document[0]);
  }

  const updatePayload = { ...updateFields, draft: forceDraftValue };
  if (imageUrl) updatePayload.image = imageUrl;
  if (documentUrl) updatePayload.document = documentUrl;

  return { productId, userId, updatePayload };
}

export async function updateDraftStatus({ body, files, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');

  const { productId, updatePayload } = await resolveUpdatePayload({ body, files, userId, forceDraftValue: false });

  const updatedProduct = await productSchema.findByIdAndUpdate(productId, updatePayload, { new: true });

  try {
    await requirementSchema.create({ productId: updatedProduct._id, buyerId: userId, sellers: [] });
  } catch (err) {
    console.error('[Requirement Error]', err.message);
  }

  return { statusCode: 200, message: 'Product published successfully', data: updatedProduct };
}

export async function saveAsDraft({ body, files, userId }) {
  if (!userId) throw new ProductServiceError(400, 'User not authenticated');

  const { productId, updatePayload } = await resolveUpdatePayload({ body, files, userId, forceDraftValue: true });

  const updatedProduct = await productSchema.findByIdAndUpdate(productId, { $set: updatePayload }, { new: true });

  return { statusCode: 200, message: 'Draft saved successfully', data: updatedProduct };
}

/**
 * Live marketplace stats — surfaced on the landing page ProofStrip.
 *
 * HONEST NUMBERS ONLY. This endpoint used to pad every count (+142 suppliers,
 * +24 requirements, etc.) and inject fake "Bangalore / Peenya / Mysuru"
 * activity strings when real activity was sparse. Both are gone.
 *
 * When a metric is genuinely 0 or can't yet be computed (e.g. avg quote
 * time with too few samples), we return `null` — the frontend hides that
 * tile rather than displaying a misleading number.
 */
export async function getLiveExchangeStats() {
  const activeRequirements = await productSchema.countDocuments({
    draft: false, isSoldProduct: false, bidExpiryDate: { $gt: new Date() },
  });
  const closedDeals = await closeDealSchema.countDocuments({ closedDealStatus: 'completed' });
  const totalBids = await bidSchema.countDocuments();
  const activeSuppliers = await userSchema.countDocuments({
    role: 'user', status: 'active', verificationStatus: 'verified',
  });

  const soldProducts = await productSchema.find({ isSoldProduct: true }).select('minimumBudget').lean();
  let sourcedVolume = 0;
  for (const p of soldProducts) {
    const b = Number(p.minimumBudget);
    if (!isNaN(b) && b > 0) sourcedVolume += b;
  }

  let avgFirstQuoteMs = null;
  const firstBids = await bidSchema.aggregate([
    { $group: { _id: '$productId', firstBidAt: { $min: '$createdAt' } } },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
    { $project: { diffMs: { $subtract: ['$firstBidAt', '$p.createdAt'] } } },
    { $match: { diffMs: { $gt: 0 } } },
  ]);
  if (firstBids.length >= 5) {
    const sum = firstBids.reduce((s, x) => s + x.diffMs, 0);
    avgFirstQuoteMs = Math.round(sum / firstBids.length);
  }

  const [latestProducts, latestBids] = await Promise.all([
    productSchema.find({ draft: false }).sort({ createdAt: -1 }).limit(5)
      .populate({ path: 'userId', select: 'currentLocation' }).lean(),
    bidSchema.find().sort({ createdAt: -1 }).limit(5)
      .populate({ path: 'productId', select: 'title' })
      .populate({ path: 'sellerId', select: 'currentLocation' }).lean(),
  ]);

  const activities = [];
  for (const p of latestProducts) {
    const location = p.userId?.currentLocation;
    activities.push({
      type: 'requirement',
      title: location ? `RFQ posted for ${p.title} in ${location}` : `RFQ posted for ${p.title}`,
      time: p.createdAt,
    });
  }
  for (const b of latestBids) {
    if (!b.productId) continue;
    const location = b.sellerId?.currentLocation;
    activities.push({
      type: 'quote',
      title: location ? `Quote submitted for ${b.productId.title} from ${location}` : `Quote submitted for ${b.productId.title}`,
      time: b.createdAt,
    });
  }
  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return {
    statusCode: 200,
    message: 'Live stats fetched successfully',
    data: {
      sourcedVolume,
      activeRequirements,
      closedDeals,
      totalBids,
      activeSuppliers,
      avgFirstQuoteMs,
      activities: activities.slice(0, 8),
    },
  };
}

export async function uploadMultipleRequirements({ body, files, userId }) {
  const { commonDetails, categories, categoryGroups } = body;

  if (!categories || categories.length === 0) {
    throw new ProductServiceError(400, 'Categories array is required');
  }

  let documentUrl = null;
  if (files?.document && files.document.length > 0) {
    const urls = await Promise.all(files.document.map(file => uploadFile(file)));
    documentUrl = urls.filter(Boolean).join(',');
  } else {
    throw new ProductServiceError(400, 'Document file is required');
  }

  const parsedCommonDetails = typeof commonDetails === 'string' ? JSON.parse(commonDetails) : commonDetails;
  const parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories;
  const parsedCategoryGroups = categoryGroups
    ? (typeof categoryGroups === 'string' ? JSON.parse(categoryGroups) : categoryGroups)
    : null;

  const createdProducts = [];
  for (const catId of parsedCategories) {
    const matchingGroup = parsedCategoryGroups?.find(
      g => g.categoryId === catId || g.categoryId?.toString() === catId?.toString()
    );
    const itemsList =
      matchingGroup?.items?.map(item => ({
        subCategoryId: mongoose.isValidObjectId(item.subCategoryId) ? item.subCategoryId : null,
        subCategoryName: mongoose.isValidObjectId(item.subCategoryId) ? item.subCategoryName : item.subCategoryId,
        brand: item.brand,
        brandName: item.brandName,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        model: item.model,
        color: item.color,
        fuelType: item.fuelType,
        transmission: item.transmission,
        conditionOfProduct: item.conditionOfProduct,
        toolType: item.toolType,
        typeOfVehicle: item.typeOfVehicle,
        typeOfProduct: item.typeOfProduct,
        productType: item.productType,
        productCondition: item.productCondition,
        gender: item.gender,
        rateAService: item.rateAService,
      })) || [];

    const productPayload = {
      title: parsedCommonDetails.title,
      description: parsedCommonDetails.description,
      minimumBudget: parsedCommonDetails.minimumBudget ? Number(parsedCommonDetails.minimumBudget) : undefined,
      userId,
      draft: parsedCommonDetails.draft === 'true' || parsedCommonDetails.draft === true,
      paymentAndDelivery: parsedCommonDetails.paymentAndDelivery,
      bidExpiryDate: parsedCommonDetails.bidExpiryDate,
      isMultiple: true,
      isUpload: true,
      document: documentUrl,
      categoryId: catId,
      items: itemsList,
    };

    const product = await productSchema.create(productPayload);

    if (productPayload.draft === false) {
      await requirementSchema.create([{ productId: product._id, buyerId: userId, sellers: [] }]);
    }
    createdProducts.push(product);
  }

  return { statusCode: 201, message: 'Uploaded requirements created successfully', data: createdProducts };
}
