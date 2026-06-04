import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.csv','.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const allowUploadFields = () => {
  return upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 5 },
  ]);
};
