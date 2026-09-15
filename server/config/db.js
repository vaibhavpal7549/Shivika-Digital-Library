const mongoose = require('mongoose');
const dns = require('dns');

// Ensure reliable SRV resolution across environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS fallback fails
}

/**
 * MongoDB Connection Module
 * 
 * Supports dual connection strategy:
 * 1. Primary: MongoDB Atlas (cloud)
 * 2. Fallback: Local MongoDB
 * 
 * Tries Atlas first, falls back to localhost if Atlas fails.
 */

const connectDB = async () => {
  const atlasURI = process.env.MONGODB_URI;
  const localURI = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/shivika-library';

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  };

  // Try MongoDB Atlas first
  if (atlasURI && !atlasURI.includes('YOUR_USERNAME')) {
    try {
      const conn = await mongoose.connect(atlasURI, options);
      console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
      setupConnectionHandlers();
      return conn;
    } catch (atlasError) {
      console.warn('⚠️  MongoDB Atlas connection failed:', atlasError.message);
      console.log('🔄 Trying local MongoDB...');
    }
  } else {
    console.log('ℹ️  MongoDB Atlas not configured, trying local...');
  }

  // Fallback to local MongoDB
  try {
    const conn = await mongoose.connect(localURI, options);
    console.log(`✅ Local MongoDB Connected: ${conn.connection.host}`);
    setupConnectionHandlers();
    return conn;
  } catch (localError) {
    console.error('❌ Local MongoDB connection failed:', localError.message);
    console.warn('⚠️  No MongoDB connection available. User data will not be persisted.');
    return null;
  }
};

/**
 * Setup connection event handlers
 */
const setupConnectionHandlers = () => {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });
};

module.exports = connectDB;
