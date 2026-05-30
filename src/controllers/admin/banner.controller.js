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

export const getBanners = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;
    const banners = await bannerSchema.find().skip(skip).limit(limit);
    const totalBanners = await bannerSchema.countDocuments();
    const totalPages = Math.ceil(totalBanners / limit);
    ApiResponse.successResponse(res, 200, 'users fetched', {
      banners,
      page,
      totalPages,
      totalBanners,
    });
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const BannerDetsById = async (req, res) => {
  const { bannerId } = req.params;
  try {
    const banner = await bannerSchema.findById(bannerId).lean();
    if (!banner) {
      return ApiResponse.errorResponse(res, 404, 'Banner not found');
    }
    ApiResponse.successResponse(res, 200, 'Banner details fetched', banner);
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const updateBanner = async (req, res) => {
  const { bannerId } = req.params;
  const { title, linkUrl,endPoint } = req.body;
  try {
    let banner = await bannerSchema.findById(bannerId);
    if (!banner) {
      return ApiResponse.errorResponse(res, 404, 'Banner not found');
    }
      if (req?.file) {
      banner.imageUrl = await uploadFile(req.file);
    }
  

    const newLinkUrl = banner.domain + endPoint;

    banner.title = title;
    banner.linkUrl = newLinkUrl;
    banner.endPoint= endPoint
    await banner.save();
    ApiResponse.successResponse(res, 200, 'Banner updated successfully', banner);
  } catch (error) {
    console.log(error)
    ApiResponse.errorResponse(res, 400, error.message);
  }
};
