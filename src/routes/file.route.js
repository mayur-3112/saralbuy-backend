import express from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import FileUpload from '../models/fileUpload.schema.js';
import userSchema from '../models/user.schema.js';
import { JWT_SECRET } from '../config/secrets.js';

const router = express.Router();

// Files here are a mix of purposes: product images/banners (meant to be
// visible to any logged-in user browsing the marketplace) and KYC documents
// (GSTIN/PAN proof, meant to be visible only to the uploader and admins
// reviewing verification). Admins authenticate via a separate `adminToken`
// cookie (see adminAuth.middleware.js), not `authToken` — this route accepts
// either, since the admin verification screen legitimately needs to open
// these same URLs. Whichever cookie is present, we verify it ourselves
// rather than requiring both.
const identifyRequester = async req => {
  const userToken = req.cookies?.authToken;
  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, JWT_SECRET);
      return { userId: (decoded.userId || decoded._id || '').toString(), isAdmin: false };
    } catch {
      /* fall through to try adminToken */
    }
  }
  const adminToken = req.cookies?.adminToken;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, JWT_SECRET);
      const admin = await userSchema.findById(decoded._id).select('role');
      if (admin?.role === 'admin') {
        return { userId: decoded._id.toString(), isAdmin: true };
      }
    } catch {
      /* no valid session either way */
    }
  }
  return null;
};

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Set CORS & Cross-Origin-Resource-Policy headers so browser <img> tags
    // on saralbuy-frontend.vercel.app can render images without CORP blocking.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const file = await FileUpload.findById(id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // KYC documents (GSTIN/PAN proof) are sensitive — restrict to the uploader or admin.
    // Every other category (profile photos, avatars, product images, banners) is public
    // so <img> tags on the homepage showcase and supplier directory render smoothly for all visitors.
    if (file.category === 'kyc') {
      const requester = await identifyRequester(req);
      if (!requester) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!requester.isAdmin) {
        const owner = (file.uploadedBy || '').toString();
        if (!owner || owner !== requester.userId) {
          return res.status(403).json({ message: 'Not authorized to view this document' });
        }
      }
    }

    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000');
    return res.send(file.data);
  } catch (err) {
    console.error('File serve error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
