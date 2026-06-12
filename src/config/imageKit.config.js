import ImageKit from '@imagekit/nodejs';
const client = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadFile = async file => {
  try {
    const result = await client.files.upload({
      file: file.buffer.toString('base64'),
      fileName: file.originalname,
      folder: 'images',
    });
    return result.url;
  } catch (err) {
    console.error('ImageKit upload failed, falling back to null URL:', err.message);
    return null;
  }
};

export default uploadFile;
