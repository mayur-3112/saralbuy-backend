import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import DealSurvey from '../models/dealSurvey.schema.js';

export const submitSurvey = async (req, res) => {
  try {
    const responderId = req.user.userId || req.user._id;
    const {
      dealId,
      wasDealClosed,
      finalAmount,
      rating,
      experience,
      wouldRecommend,
      feedback,
      issuesFaced,
    } = req.body;

    if (wasDealClosed === undefined || wasDealClosed === null) {
      return ApiResponse.errorResponse(res, 400, 'wasDealClosed is required');
    }

    if (dealId && !isValidObjectId(dealId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid dealId');
    }

    const survey = await DealSurvey.create({
      dealId,
      responderId,
      wasDealClosed,
      finalAmount,
      rating,
      experience,
      wouldRecommend,
      feedback,
      issuesFaced,
    });

    return ApiResponse.successResponse(res, 201, 'Survey submitted successfully', survey);
  } catch (err) {
    console.error('Submit survey error:', err.message);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to submit survey');
  }
};

export const getSurveyByDeal = async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!isValidObjectId(dealId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid dealId');
    }

    const survey = await DealSurvey.findOne({ dealId })
      .populate('responderId', '-password -__v')
      .lean();

    if (!survey) {
      return ApiResponse.errorResponse(res, 404, 'Survey not found for this deal');
    }

    return ApiResponse.successResponse(res, 200, 'Survey fetched successfully', survey);
  } catch (err) {
    console.error('Get survey error:', err.message);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to fetch survey');
  }
};
