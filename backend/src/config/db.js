'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger'); 

let isConnected = false; 
 
async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dev-dash';

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('✅ MongoDB connected');
  }); 

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected — attempting reconnect');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      dbName: 'dev-dash',
    });
  } catch (err) {
    logger.error({ err: err.message }, 'MongoDB initial connection failed. The server will stay up, but DB-dependent routes will fail until it reconnects.');
  }
}
 
async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connectDB, disconnectDB };
 