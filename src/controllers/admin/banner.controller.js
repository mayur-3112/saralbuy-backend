import { ApiResponse } from '../../helpers/ApiReponse.js';

export const uploadBanner = async (req, res) => {
  const file = req.file;
  if (!file) return ApiResponse.errorResponse(res, 401, 'Please upload a file', null);
};

export const getBanners = async (req, res) => {};
