// Cloudinary configuration - with debugging
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

console.log('🔧 Cloudinary Config Check:');
console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING');
console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? '***' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'MISSING');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test Cloudinary connection
cloudinary.api.ping()
  .then(result => console.log('✅ Cloudinary connection test:', result))
  .catch(error => console.error('❌ Cloudinary connection failed:', error));

module.exports = cloudinary;