import jwt from 'jsonwebtoken';
import { ApiResponse } from '../helpers/ApiReponse.js';
import { JWT_SECRET } from '../config/secrets.js';
import * as productService from '../services/product.service.js';
import { ProductServiceError } from '../services/product.service.js';

// M3.T2 (Implementation Master Plan) — thin controller layer: parse request,
// call the service, format the response. All business logic (queries,
// validation, uploads) now lives in services/product.service.js. Every
// route/response shape here is unchanged from before the extraction.
const handle = fn => async (req, res) => {
  try {
    const result = await fn(req);
    return ApiResponse.successResponse(res, result.statusCode, result.message, result.data);
  } catch (err) {
    if (err instanceof ProductServiceError) {
      return ApiResponse.errorResponse(res, err.statusCode, err.message);
    }
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Something went wrong');
  }
};

// Best-effort caller identity for public/anonymous routes — never rejects
// the request. Used to quietly exclude a logged-in buyer's own RFQs from
// their own Explore/browse results without requiring auth on this route.
function getOptionalUserId(req) {
  const token = req.cookies?.authToken;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded._id || null;
  } catch {
    return null;
  }
}

export const addProduct = handle(req =>
  productService.addProduct({ body: req.body, files: req.files, userId: req.user._id })
);

export const addMultipleProducts = handle(req =>
  productService.addMultipleProducts({ body: req.body, userId: req.user._id || req.user.userId })
);

export const getTrendingCategory = handle(() => productService.getTrendingCategory());

export const getHomeProducts = handle(() => productService.getHomeProducts());

export const getProductByName = handle(req =>
  productService.getProductByName({ productName: req.params.productName, categoryId: req.query.categoryId })
);

export const searchProductsController = handle(req =>
  productService.searchProducts({ query: req.query, callerUserId: getOptionalUserId(req) })
);

export const getProductById = handle(req => productService.getProductById({ productId: req.params.productId }));

export const getAllDraftProducts = handle(req =>
  productService.getAllDraftProducts({
    userId: req.user?.userId,
    page: req.query.page,
    limit: req.query.limit,
  })
);

export const deleteDraftProduct = handle(req =>
  productService.deleteDraftProduct({
    productId: req.params.productId,
    userId: req.user?.userId || req.user?._id,
  })
);

export const deleteProduct = handle(req =>
  productService.deleteProduct({ productId: req.params.productId, userId: req.user?.userId })
);

export const updateProduct = handle(req =>
  productService.updateProduct({ body: req.body, files: req.files, userId: req.user?.userId })
);

export const getDraftProductById = handle(req =>
  productService.getDraftProductById({
    productId: req.params.productId,
    userId: req.user?._id || req.user?.userId,
  })
);

export const updateDraftStatus = handle(req =>
  productService.updateDraftStatus({ body: req.body, files: req.files, userId: req.user?.userId })
);

export const saveAsDraft = handle(req =>
  productService.saveAsDraft({ body: req.body, files: req.files, userId: req.user?.userId })
);

export const getLiveExchangeStats = handle(() => productService.getLiveExchangeStats());

export const uploadMultipleRequirements = handle(req =>
  productService.uploadMultipleRequirements({
    body: req.body,
    files: req.files,
    userId: req.user._id || req.user.userId,
  })
);
