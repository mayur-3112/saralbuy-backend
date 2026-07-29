import { ApiResponse } from '../helpers/ApiReponse.js';
import * as bidService from '../services/bid.service.js';
import { BidServiceError } from '../services/bid.service.js';

// M3.T1 (Implementation Master Plan) — thin controller layer: parse request,
// call the service, format the response. All business logic (queries,
// transactions, notifications) now lives in services/bid.service.js. Every
// route/response shape here is unchanged from before the extraction.
const handle = fn => async (req, res) => {
  try {
    const result = await fn(req);
    return ApiResponse.successResponse(res, result.statusCode, result.message, result.data);
  } catch (err) {
    if (err instanceof BidServiceError) {
      return ApiResponse.errorResponse(res, err.statusCode, err.message);
    }
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Something went wrong');
  }
};

export const getLatestThreeBidAndDraft = handle(req =>
  bidService.getLatestThreeBidAndDraft({ userId: req.user._id })
);

export const bidOverViewbyId = handle(req =>
  bidService.bidOverViewbyId({
    id: req.params.id,
    requesterId: req.user?.userId || req.user?._id,
  })
);

export const updateBidUserDetails = handle(req =>
  bidService.updateBidUserDetails({
    id: req.params.id,
    userId: req.user.userId || req.user._id,
    budgetQuation: req.body.budgetQuation,
    availableBrand: req.body.availableBrand,
    earliestDeliveryDate: req.body.earliestDeliveryDate,
  })
);

export const createBid = handle(req =>
  bidService.createBid({
    body: req.body,
    file: req.file,
    buyerId: req.params.buyerId,
    productId: req.params.productId,
    sellerId: req.user.userId,
  })
);

export const getAllBids = handle(req =>
  bidService.getAllBids({
    userId: req.user.userId,
    search: req.query.search,
    limit: req.query.limit,
    page: req.query.page,
    sortBy: req.query.sortBy,
  })
);

export const getBidById = handle(req =>
  bidService.getBidById({
    id: req.params.id,
    requesterId: req.user?.userId || req.user?._id,
    limit: req.query.limit,
    page: req.query.page,
  })
);

export const getBidByProductId = handle(req =>
  bidService.getBidByProductId({ productId: req.params.productId })
);

export const deleteBid = handle(req =>
  bidService.deleteBid({
    id: req.params.id,
    sellerId: req.user.userId || req.user._id,
  })
);

export const getBidDetailsBySellerIdAndProductId = handle(req =>
  bidService.getBidDetailsBySellerIdAndProductId({
    sellerId: req.params.sellerId,
    productId: req.params.productId,
    requesterId: req.user?.userId || req.user?._id,
  })
);

export const getBidsForProductCompare = handle(req =>
  bidService.getBidsForProductCompare({
    productId: req.params.productId,
    userId: req.user.userId || req.user._id,
  })
);

export const getRequirementTimeline = handle(req =>
  bidService.getRequirementTimeline({
    productId: req.params.productId,
    userId: req.user.userId || req.user._id,
  })
);

export const getBidStatsByProductId = handle(req =>
  bidService.getBidStatsByProductId({ productId: req.params.productId })
);

export const getBidActivityByProduct = handle(req =>
  bidService.getBidActivityByProduct({ productId: req.params.productId })
);

export const updateQuoteStatus = handle(req =>
  bidService.updateQuoteStatus({
    bidId: req.params.bidId,
    quoteStatus: req.body.quoteStatus,
    userId: req.user.userId || req.user._id,
  })
);
