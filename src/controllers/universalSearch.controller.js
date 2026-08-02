import mongoose from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import categorySchema from '../models/category.schema.js';
import userSchema from '../models/user.schema.js';
import productSchema from '../models/product.schema.js';
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
    const q = (req.query.q || req.query.query || '').trim();
    const { category, location, limit = 10 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

    if (!q || q.length < 1) {
      return ApiResponse.successResponse(res, 200, 'Universal search results', {
        categories: [],
        suppliers: [],
        products: [],
        rfqs: [],
        brands: [],
      });
    }

    const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanQ = escapeRegex(q);
    const regex = new RegExp(cleanQ, 'i');

    // Build sub-queries for parallel execution
    const categoryQuery = categorySchema
      .find({ categoryName: regex })
      .select('categoryName image subCategories')
      .limit(limitNum)
      .lean();

    const supplierFilter = {
      accountRole: 'supplier',
      status: 'active',
      $or: [
        { businessName: regex },
        { organizationName: regex },
        { supplierHeadline: regex },
        { supplierCategories: regex },
        { topBrands: regex },
        { currentLocation: regex },
        { address: regex },
        { storeAddress: regex },
      ],
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

    // RFQs (Active open buyer requirements)
    const rfqFilter = rfqOpenFilter({
      $or: [
        { title: regex },
        { description: regex },
        { 'items.subCategoryName': regex },
        { brand: regex },
        { brandName: regex },
      ],
    });

    if (category && category !== 'all' && mongoose.Types.ObjectId.isValid(category)) {
      rfqFilter.categoryId = new mongoose.Types.ObjectId(category);
    }

    const rfqQuery = productSchema
      .find(rfqFilter)
      .select('title description quantity minimumBudget brand brandName categoryId image createdAt items bidExpiryDate')
      .populate('categoryId', 'categoryName')
      .populate('userId', 'firstName lastName currentLocation address')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Products (Catalog listings / Items)
    const productFilter = {
      $or: [
        { title: regex },
        { description: regex },
        { brand: regex },
        { brandName: regex },
        { toolType: regex },
        { typeOfProduct: regex },
        { conditionOfProduct: regex },
      ],
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
    const verifiedSuppliers = suppliersRes.filter(s => s.verificationStatus === 'verified');
    const otherSuppliers = suppliersRes.filter(s => s.verificationStatus !== 'verified');
    const sortedSuppliers = [...verifiedSuppliers, ...otherSuppliers];

    // Extract matching distinct brand names
    const brandSet = new Set();
    // From matched suppliers topBrands
    suppliersRes.forEach(s => {
      if (Array.isArray(s.topBrands)) {
        s.topBrands.forEach(b => {
          if (b && regex.test(b)) brandSet.add(b.trim());
        });
      }
    });
    // From matched products brand / brandName
    productsRes.concat(rfqsRes).forEach(p => {
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
      rfqs: rfqsRes || [],
      brands: matchingBrands || [],
    });
  } catch (err) {
    console.error('universalSearch error:', err);
    return ApiResponse.errorResponse(res, 500, err?.message || 'Universal search failed');
  }
};
