import { isValidObjectId } from 'mongoose';
import productSchema from '../models/product.schema.js';
import { ApiResponse } from '../helpers/ApiReponse.js';
import cartSchema from '../models/cart.schema.js';

export const addToCart = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid or missing userId');
    }

    if (!productId || !isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid or missing productId');
    }

    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    let cart = await cartSchema.findOne({ userId });
    if (!cart) {
      cart = new cartSchema({ userId, cartItems: [] });
    }

    const alreadyExists = cart.cartItems.find(item => item.productIds.includes(productId));

    if (alreadyExists) {
      return ApiResponse.successResponse(res, 200, 'Product already in your cart', cart);
    }

    cart.cartItems.push({
      productIds: [productId],
      addedAt: new Date(),
    });

    await cart.save();

    return ApiResponse.successResponse(res, 201, 'Product added to cart', cart);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to add to cart');
  }
};

export const getUserCart = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    const cart = await cartSchema.findOne({ userId }).lean();

    if (!cart || !cart.cartItems.length) {
      return ApiResponse.successResponse(res, 200, 'Cart is empty', []);
    }

    // const cleanProduct = (prod) => {
    //   if (!prod) return prod;
    //   const p = { ...prod };
    //   if (p.userId?._id) p.userId = p.userId._id.toString();
    //   if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;
    //   delete p.__v;
    //   return p;
    // };
    const cleanProduct = prod => {
      if (!prod) return prod;

      const p = { ...prod };

      // Move populated user → buyerId
      if (p.userId) {
        p.buyerId = {
          _id: p.userId._id,
          firstName: p.userId.firstName,
          lastName: p.userId.lastName,
          address: p.userId.address,
        };
        delete p.userId; // remove original field
      }

      if (p.subCategoryId?._id) {
        p.subCategoryId = p.subCategoryId._id;
      }

      delete p.__v;

      return p;
    };

    const enhancedCartItems = (
      await Promise.all(
        cart.cartItems.map(async item => {
          const productId = item.productIds[0]; // always single now

          const product = await productSchema
            .findById(productId)
            .populate({ path: 'categoryId', select: '-subCategories' })
            .populate({
              path: 'userId',
              select: 'firstName lastName address',
            })
            .lean();

          return {
            product: product ? cleanProduct(product) : null,
            cartItemId: item._id,
            addedAt: item.addedAt,
          };
        })
      )
    ).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    const cartResponse = {
      _id: cart._id,
      userId: cart.userId,
      cartItems: enhancedCartItems,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };

    return ApiResponse.successResponse(res, 200, 'Cart fetched successfully', cartResponse);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to fetch cart');
  }
};

export const removeCart = async (req, res) => {
  try {
    const { cartId, productId } = req.params;

    const cart = await cartSchema.findById(cartId);
    if (!cart) {
      return ApiResponse.errorResponse(res, 404, 'Cart not found');
    }

    // Verify ownership
    const loggedInUserId = req.user?.userId || req.user?._id;
    if (!loggedInUserId || cart.userId.toString() !== loggedInUserId.toString()) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized to modify this cart');
    }

    cart.cartItems = cart.cartItems.filter(
      item => item.productIds[0].toString() !== productId.toString()
    );

    await cart.save();

    return ApiResponse.successResponse(res, 200, 'Cart item removed successfully');
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to remove cart item');
  }
};
