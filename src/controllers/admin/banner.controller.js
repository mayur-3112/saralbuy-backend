import uploadFile from '../../config/imageKit.config.js';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import bannerSchema from '../../models/banner.schema.js';

export const uploadBanner = async (req, res) => {
  const file = req.file;
  if (!file) return ApiResponse.errorResponse(res, 401, 'Please upload a file', null);
  let imagePath = null;
  try {
    if (req?.file) {
      imagePath = await uploadFile(req.file);
    }
    const createBanner = await bannerSchema.create({
      ...req.body,
      imageUrl: imagePath,
    });
    return ApiResponse.successResponse(res, 200, 'Banner uploaded successfully', createBanner);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, 'Internal server error', error);
  }
};

export const getBanners = async (req, res) => {};
