import mongoose from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import categorySchema from '../models/category.schema.js';
import userSchema from '../models/user.schema.js';
import productSchema from '../models/product.schema.js';
import requirementSchema from '../models/requirement.schema.js';
import { rfqOpenFilter } from '../services/product.service.js';

/**
 * Universal Search API
 * GET /api/v1/search/universal?q=...&category=...&location=...
 *
 * Single backend endpoint returning:
 * {
 *   categories: [],
 *   suppliers: [],
 *   products: [],
 *   rfqs: [],
 *   brands: []
 * }
 */
export const universalSearch = async (req, res) => {
  try {
    // Prevent stale cached responses across browsers / CDN proxies
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rawQ = (req.query.q || req.query.query || '').trim();
    const { category, location, limit = 10 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

    if (!rawQ || rawQ.length < 1) {
      return ApiResponse.successResponse(res, 200, 'Universal search results', {
        categories: [],
        suppliers: [],
        products: [],
        rfqs: [],
        brands: [],
      });
    }

    // Strip common ID prefixes like "RFQ-", "REQ-", "ID:", "#"
    const cleanedSearchStr = rawQ.replace(/^(rfq-|req-|id:|\s*#\s*)/i, '').trim();

    const isValidObjectId = mongoose.Types.ObjectId.isValid(cleanedSearchStr);
    const objectIdQuery = isValidObjectId ? new mongoose.Types.ObjectId(cleanedSearchStr) : null;

    const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapeRegex(rawQ), 'i');

    // If searching by Requirement ID directly, resolve its productId
    let matchedProductIdFromReqId = null;
    if (objectIdQuery) {
      const matchedReqDoc = await requirementSchema.findById(objectIdQuery).select('productId').lean();
      if (matchedReqDoc?.productId) {
        matchedProductIdFromReqId = matchedReqDoc.productId;
      }
    }

    // 1. Category Query
    const categoryOrConditions = [
      { categoryName: regex },
      { 'subCategories.name': regex },
    ];
    if (objectIdQuery) {
      categoryOrConditions.push({ _id: objectIdQuery });
    }
    const categoryQuery = categorySchema
      .find({ $or: categoryOrConditions })
      .select('categoryName image subCategories')
      .limit(limitNum)
      .lean();

    // 2. Supplier Query
    const supplierOrConditions = [
      { businessName: regex },
      { organizationName: regex },
      { supplierHeadline: regex },
      { supplierCategories: regex },
      { topBrands: regex },
      { currentLocation: regex },
      { address: regex },
      { storeAddress: regex },
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phone: regex },
    ];
    if (objectIdQuery) {
      supplierOrConditions.push({ _id: objectIdQuery });
    }

    const supplierFilter = {
      accountRole: 'supplier',
      status: 'active',
      $or: supplierOrConditions,
    };

    if (location && location.trim()) {
      const locRegex = new RegExp(escapeRegex(location.trim()), 'i');
      supplierFilter.$and = [
        {
          $or: [
            { currentLocation: locRegex },
            { address: locRegex },
            { storeAddress: locRegex },
          ],
        },
      ];
    }

    const supplierQuery = userSchema
      .find(supplierFilter)
      .select(
        'firstName lastName businessName organizationName profileImage currentLocation address ' +
        'verificationStatus accountRole businessDescription supplierCategories primaryCategoryId ' +
        'secondaryCategoryIds supplierHeadline topBrands businessSince createdAt'
      )
      .populate('primaryCategoryId', 'categoryName icon')
      .limit(limitNum)
      .lean();

    // 3. RFQs Query (Active open buyer requirements)
    const rfqOrConditions = [
      { title: regex },
      { description: regex },
      { 'items.subCategoryName': regex },
      { 'items.itemName': regex },
      { 'items.itemDescription': regex },
      { brand: regex },
      { brandName: regex },
    ];
    if (objectIdQuery) {
      rfqOrConditions.push({ _id: objectIdQuery });
    }
    if (matchedProductIdFromReqId) {
      rfqOrConditions.push({ _id: matchedProductIdFromReqId });
    }

    const rfqFilter = rfqOpenFilter({ $or: rfqOrConditions });
    if (category && category !== 'all' && mongoose.Types.ObjectId.isValid(category)) {
      rfqFilter.categoryId = new mongoose.Types.ObjectId(category);
    }

    const rfqQuery = productSchema
      .find(rfqFilter)
      .select('title description quantity minimumBudget brand brandName categoryId image createdAt items bidExpiryDate userId')
      .populate('categoryId', 'categoryName')
      .populate('userId', 'firstName lastName currentLocation address')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // 4. Products Query (Catalog listings / Items)
    const productOrConditions = [
      { title: regex },
      { description: regex },
      { brand: regex },
      { brandName: regex },
      { toolType: regex },
      { typeOfProduct: regex },
      { conditionOfProduct: regex },
      { 'items.subCategoryName': regex },
      { 'items.itemName': regex },
    ];
    if (objectIdQuery) {
      productOrConditions.push({ _id: objectIdQuery });
    }

    const productFilter = {
      $or: productOrConditions,
    };
    if (category && category !== 'all' && mongoose.Types.ObjectId.isValid(category)) {
      productFilter.categoryId = new mongoose.Types.ObjectId(category);
    }

    const productQuery = productSchema
      .find(productFilter)
      .select('title description quantity minimumBudget brand brandName categoryId image createdAt')
      .populate('categoryId', 'categoryName')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Execute queries in parallel for high performance
    const [categoriesRes, suppliersRes, rfqsRes, productsRes] = await Promise.all([
      categoryQuery,
      supplierQuery,
      rfqQuery,
      productQuery,
    ]);

    // Priority sort suppliers: verified first
    const verifiedSuppliers = (suppliersRes || []).filter(s => s.verificationStatus === 'verified');
    const otherSuppliers = (suppliersRes || []).filter(s => s.verificationStatus !== 'verified');
    const sortedSuppliers = [...verifiedSuppliers, ...otherSuppliers];

    // Map Requirement IDs for matched RFQs so frontend can route to Requirement Overview page
    const rfqProductIds = (rfqsRes || []).map(r => r._id);
    const reqDocs = rfqProductIds.length > 0
      ? await requirementSchema.find({ productId: { $in: rfqProductIds } }).select('_id productId').lean()
      : [];

    const reqMap = new Map();
    reqDocs.forEach(rd => reqMap.set(rd.productId.toString(), rd._id.toString()));

    const enrichedRfqs = (rfqsRes || []).map(r => ({
      ...r,
      requirementId: reqMap.get(r._id.toString()) || null,
    }));

    // Extract matching distinct brand names
    const brandSet = new Set();
    // From matched suppliers topBrands
    (suppliersRes || []).forEach(s => {
      if (Array.isArray(s.topBrands)) {
        s.topBrands.forEach(b => {
          if (b && regex.test(b)) brandSet.add(b.trim());
        });
      }
    });
    // From matched products & RFQs brand / brandName
    (productsRes || []).concat(rfqsRes || []).forEach(p => {
      if (p.brand && regex.test(p.brand)) brandSet.add(p.brand.trim());
      if (p.brandName && regex.test(p.brandName)) brandSet.add(p.brandName.trim());
    });

    const matchingBrands = Array.from(brandSet).slice(0, limitNum).map(name => ({
      name,
      matchedType: 'brand',
    }));

    return ApiResponse.successResponse(res, 200, 'Universal search results', {
      categories: categoriesRes || [],
      suppliers: sortedSuppliers || [],
      products: productsRes || [],
      rfqs: enrichedRfqs || [],
      brands: matchingBrands || [],
    });
  } catch (err) {
    console.error('universalSearch error:', err);
    return ApiResponse.errorResponse(res, 500, err?.message || 'Universal search failed');
  }
};
