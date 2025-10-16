const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('🔧 Loading models for auth route...');
const User = require('../models/user');
const Restaurant = require('../models/Restaurant'); // Add this import
console.log('✅ Models loaded successfully');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Auth route is working!' });
});

router.post('/login', async (req, res) => {
  console.log('🔐 LOGIN ATTEMPT STARTED');
  console.log('📧 Email:', req.body.email);
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('🔍 Searching for user in database...');
    
    // Find user with error handling
    let user;
    try {
      user = await User.findOne({ email }).populate('restaurant');
    } catch (dbError) {
      console.error('❌ DATABASE ERROR:', dbError);
      return res.status(500).json({ error: 'Database error', details: dbError.message });
    }

    console.log('👤 User search result:', user ? 'FOUND' : 'NOT FOUND');
    
    if (!user) {
      console.log('❌ No user found with email:', email);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found - Name:', user.name);
    console.log('✅ Restaurant:', user.restaurant?.name);

    // Check password
    console.log('🔑 Starting password comparison...');
    let isPasswordValid;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      console.error('❌ BCRYPT ERROR:', bcryptError);
      return res.status(500).json({ error: 'Password verification failed' });
    }

    console.log('🔑 Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    console.log('🎫 Creating JWT token...');
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        restaurantId: user.restaurant._id 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log('✅ LOGIN SUCCESSFUL for:', user.email);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: {
          id: user.restaurant._id,
          name: user.restaurant.name
        }
      }
    });

  } catch (error) {
    console.error('💥 UNEXPECTED LOGIN ERROR:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

module.exports = router;