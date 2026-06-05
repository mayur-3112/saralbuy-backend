import mongoose from "mongoose";
import { ApiResponse } from "../../helpers/ApiReponse.js";
import categorySchema from "../../models/category.schema.js";

export const getCategoryNameWise =async(req,res)=>{
    try {
        const category= req.params.category;
        const categoryData = await categorySchema.findOne({categoryName:category}).lean();
        return ApiResponse.successResponse(res,200,'category fetched',categoryData)
    } catch (error) {
        return ApiResponse.errorResponse(res,500,'something went wrong',error)
        
    }
}

export const updateCategory = async (req, res) => {
  try {
    const { categoryId, subCategory } = req.body;


    const findCategory = await categorySchema.findOne({_id: categoryId}).select('subCategories')
    const subCategoryIndex = findCategory.subCategories.findIndex((item) => item._id.toString() === subCategory._id.toString());
    if (subCategoryIndex === -1) {
      return ApiResponse.errorResponse(res, 404, 'Subcategory not found');
    }
    findCategory.subCategories[subCategoryIndex] = subCategory;
    await findCategory.save();


    console.log("UPDATED:", findCategory);

    return ApiResponse.successResponse(
      res,
      200,
      "category updated",
      findCategory
    );
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(
      res,
      500,
      "something went wrong",
      error
    );
  }
};