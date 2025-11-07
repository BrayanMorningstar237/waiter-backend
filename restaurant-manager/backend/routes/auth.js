const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

console.log('🔧 Loading models for auth route...');
const User = require('../models/user');
const Restaurant = require('../models/Restaurant'); // Add this import
console.log('✅ Models loaded successfully');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';
// Enable CORS for your frontend URL only (more secure)
app.use(cors({
  origin: 'https://waiter-frontend-cu6rrtd7h-waiters-projects-9df096ac.vercel.app', // <-- replace with your Vercel URL
  credentials: true, // if you plan to send cookies
}));

// Or for testing / open access (not recommended for production)
// app.use(cors());

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
    console.log('🖼️ Restaurant logo in DB:', user.restaurant?.logo); // Add this log
    console.log('📋 All restaurant fields:', user.restaurant ? Object.keys(user.restaurant.toObject ? user.restaurant.toObject() : user.restaurant) : 'No restaurant'); // Add this log

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
    
    // RETURN COMPLETE RESTAURANT DATA (not just id and name)
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: user.restaurant // Return the FULL restaurant object
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