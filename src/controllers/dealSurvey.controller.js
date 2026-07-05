import { ApiResponse } from '../helpers/ApiReponse.js';
import dealSurveySchema from '../models/dealSurvey.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';

export const submitSurvey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dealId, overallRating, communicationRating, accuracyRating, deliveryRating, valueRating, review, wouldRecommend } = req.body;
    if (!dealId || !overallRating) return ApiResponse.errorResponse(res, 400, 'dealId and overallRating are required');
    const deal = await closeDealSchema.findById(dealId).lean();
    if (!deal) return ApiResponse.errorResponse(res, 404, 'Deal not found');
    if (deal.closedDealStatus !== 'completed') return ApiResponse.errorResponse(res, 400, 'Survey only for completed deals');
    const isBuyer = deal.buyerId.toString() === userId.toString();
    const isSeller = deal.sellerId.toString() === userId.toString();
    if (!isBuyer && !isSeller) return ApiResponse.errorResponse(res, 403, 'Not part of this deal');
    const survey = await dealSurveySchema.create({
      dealId, submittedBy: userId,
      role: isBuyer ? 'buyer' : 'seller',
      overallRating,
      communicationRating: communicationRating || null,
      accuracyRating: accuracyRating || null,
      deliveryRating: deliveryRating || null,
      valueRating: valueRating || null,
      review: review || '',
      wouldRecommend: wouldRecommend ?? null,
    });
    return ApiResponse.successResponse(res, 201, 'Survey submitted', survey);
  } catch (error) {
    if (error.code === 11000) return ApiResponse.errorResponse(res, 409, 'Already submitted survey for this deal');
    return ApiResponse.errorResponse(res, 500, 'Error submitting survey');
  }
};

export const checkSurveyStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dealId } = req.params;
    const existing = await dealSurveySchema.findOne({ dealId, submittedBy: userId }).lean();
    return ApiResponse.successResponse(res, 200, 'Survey status', { submitted: !!existing, survey: existing });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error checking survey status');
  }
};
