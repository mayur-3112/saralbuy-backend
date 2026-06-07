import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brands: [String],
  },
  { _id: true }
);

const categorySchema = new mongoose.Schema(
  {
    image: String,
    categoryName: { type: String, required: true },
    title: String,
    description: String,
    subCategories: [subCategorySchema],
  },
  { timestamps: false, versionKey: false }
);

export default mongoose.model('Category', categorySchema);
