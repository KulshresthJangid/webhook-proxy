const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

module.exports = {
  PORT: process.env.PORT || 3550,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://admin:dog8homework%3F@127.0.0.1:27017/webhook-proxy?authSource=admin',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '', // If empty, authentication is disabled
  JWT_SECRET: process.env.JWT_SECRET || 'echoroute-super-secret-key-change-in-production',
};

