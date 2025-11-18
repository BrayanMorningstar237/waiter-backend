// scripts/checkSuperAdmin.js
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/user');

async function checkSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const superAdmin = await User.findOne({ role: 'super_admin' });
    
    if (!superAdmin) {
      console.log('❌ No super admin found!');
      return;
    }

    console.log('✅ Super admin found:');
    console.log('📧 Email:', superAdmin.email);
    console.log('👤 Name:', superAdmin.name);
    console.log('🔑 Role:', superAdmin.role);
    console.log('✅ Active:', superAdmin.isActive);
    console.log('🏪 Restaurant:', superAdmin.restaurant);

  } catch (error) {
    console.error('❌ Error checking super admin:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkSuperAdmin();