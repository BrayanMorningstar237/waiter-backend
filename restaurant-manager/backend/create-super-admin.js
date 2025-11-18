// create-super-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/user');
const Restaurant = require('./models/Restaurant');

async function createSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('⚠️ Super admin already exists:', existingAdmin.email);
      return;
    }

    // Create a dummy restaurant for super admin
    const restaurant = new Restaurant({
      name: 'System Administration',
      description: 'System administration account',
      contact: {
        email: 'admin@system.com',
        phone: '000-000-0000'
      },
      isActive: false // This is a system account, not a real restaurant
    });

    const savedRestaurant = await restaurant.save();

    // Create super admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const superAdmin = new User({
      name: 'System Administrator',
      email: 'admin@system.com',
      password: hashedPassword,
      role: 'super_admin',
      restaurant: savedRestaurant._id
    });

    await superAdmin.save();

    console.log('✅ Super admin created successfully!');
    console.log('📧 Email: admin@system.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️ Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createSuperAdmin();