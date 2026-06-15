import express from 'express';
import { isValidObjectId } from 'mongoose';
import FileUpload from '../models/fileUpload.schema.js';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const file = await FileUpload.findById(id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.set('Content-Type', file.contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    return res.send(file.data);
  } catch (err) {
    console.error('File serve error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
