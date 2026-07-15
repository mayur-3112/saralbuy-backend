import express from 'express';
import auth from '../middleware/auth.middleware.js';
import { upload } from '../utils/multer.js';
import {
  getLatestThreeBidAndDraft,
  bidOverViewbyId,
  updateBidUserDetails,
  createBid,
  getAllBids,
  getBidById,
  getBidByProductId,
  getBidsForProductCompare,
  getRequirementTimeline,
  deleteBid,
  getBidDetailsBySellerIdAndProductId,
  getBidStatsByProductId,
  getBidActivityByProduct,
  updateQuoteStatus,
} from '../controllers/bid.controller.js';
const router = express.Router();
router.post('/create/:buyerId/:productId', auth, upload.single('quoteDocument'), createBid);
router.get('/get-three-latest-bid-and-draft', auth, getLatestThreeBidAndDraft);
router.get('/bid-overview/:id', auth, bidOverViewbyId);
router.put('/update-bid-user-dets/:id', auth, updateBidUserDetails);
router.put('/update-quote-status/:bidId', auth, updateQuoteStatus);
router.get('/get-all-bid', auth, getAllBids);
router.get('/bid-details/:id', auth, getBidById);
router.get('/get-bid-by-productId/:productId', auth, getBidByProductId);
router.get('/compare/:productId', auth, getBidsForProductCompare);
router.get('/timeline/:productId', auth, getRequirementTimeline);
router.get('/get-bid-stats/:productId', auth, getBidStatsByProductId);
router.get('/get-bid-activity/:productId', auth, getBidActivityByProduct);
router.delete('/delete-bid/:id', auth, deleteBid);
router.get('/get-bid-details/:productId/:sellerId', auth, getBidDetailsBySellerIdAndProductId);
export default router;
