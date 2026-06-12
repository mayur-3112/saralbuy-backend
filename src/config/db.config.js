import mongoose from 'mongoose';
let connection = null;
export default function mongoCtx() {
  if (connection) {
    return connection;
  }
  connection = mongoose
    .connect(process.env.DB_CTX, {
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
