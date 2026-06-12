import mongoose from 'mongoose';
let connection = null;
export default function mongoCtx() {
  if (connection) {
    return connection;
  }
  let dbUri = process.env.DB_CTX || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (dbUri) {
    dbUri = dbUri.trim().replace(/^["']|["']$/g, '');
  }

  connection = mongoose
    .connect(dbUri, {
      dbName: 'saralbuy',
      maxPoolSize: 10,
      family: 4,
    })
    .then(() => {
      console.log(
        JSON.stringify(
          {
            'Connected DB': mongoose.connection.name,
            'Mongo Host': mongoose.connection.host,
          },
          null,
          2
        )
      );
    })
    .catch(error => {
      console.error('Error connecting to MongoDB', error);
      process.exit(1);
    });
}
