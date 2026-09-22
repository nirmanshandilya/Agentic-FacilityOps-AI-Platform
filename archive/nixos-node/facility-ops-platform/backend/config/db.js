const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri);
    isConnected = true;

    console.log(`[db] MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[db] MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
