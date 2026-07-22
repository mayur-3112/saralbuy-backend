import ImageKit from '@imagekit/nodejs';
import FileUpload from '../models/fileUpload.schema.js';
import { withTimeout } from '../utils/resilientCall.js';

const DUMMY_KEYS = ['your_public_key', 'dummy_public_key', 'dummy_private_key', ''];

const isImageKitConfigured = () => {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
  return (
    publicKey &&
    privateKey &&
    !DUMMY_KEYS.includes(publicKey) &&
    !DUMMY_KEYS.includes(privateKey)
  );
};

let client = null;
const getClient = () => {
  if (!client) {
    client = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public_key',
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'dummy_private_key',
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy_id/',
    });
  }
  return client;
};

const uploadFile = async file => {
  try {
    // Fallback to MongoDB storage when ImageKit is not configured
    if (!isImageKitConfigured()) {
      const doc = await FileUpload.create({
        data: file.buffer,
        contentType: file.mimetype,
        filename: file.originalname,
        size: file.size,
      });
      const baseUrl = process.env.BACKEND_URL || 'https://saralbuy-backend-2ndv.onrender.com';
      return `${baseUrl}/api/v1/files/${doc._id}`;
    }

    const activeClient = getClient();
    const result = await withTimeout(
      activeClient.files.upload({
        file: file.buffer.toString('base64'),
        fileName: file.originalname,
        folder: 'images',
      }),
      15000,
      'ImageKit upload timed out'
    );
    return result.url;
  } catch (err) {
    console.error('ImageKit upload failed, falling back to null URL:', err.message);
    return null;
  }
};

export default uploadFile;
