import ImageKit from '@imagekit/nodejs';

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
    const activeClient = getClient();
    const result = await activeClient.files.upload({
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
