const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

// Add JWT Secret to environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

// Routes
app.use('/api/auth', require('./routes/auth'));

// Test Routes
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!' });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        res.json({ 
            message: 'Database connection successful!',
            collections: collections.map(col => col.name)
        });
    } catch (error) {
        res.status(500).json({ error: 'Database test failed', details: error.message });
    }
});

// Initialize Sample Data Route
app.get('/api/init-sample', async (req, res) => {
  try {
    const Restaurant = require('./models/Restaurant'); // Capital R
    const User = require('./models/user'); // Capital U
    const Category = require('./models/Category'); // Capital C
    const bcrypt = require('bcryptjs');
    
    // Create a sample restaurant
    const sampleRestaurant = new Restaurant({
      name: 'Sample Restaurant',
      description: 'A sample restaurant for testing',
      address: {
        street: '123 Main St',
        city: 'Sample City',
        state: 'SC',
        zipCode: '12345',
        country: 'USA'
      },
      contact: {
        phone: '+1234567890',
        email: 'info@samplerestaurant.com'
      }
    });
    
    const savedRestaurant = await sampleRestaurant.save();
    
    // Create predefined categories directly
    const predefinedCategories = [
      { name: 'Main Course', description: 'Main dishes and entrees', isPredefined: true, sortOrder: 1, restaurant: savedRestaurant._id },
      { name: 'Appetizers', description: 'Starters and small plates', isPredefined: true, sortOrder: 2, restaurant: savedRestaurant._id },
      { name: 'Soups & Salads', description: 'Fresh soups and salads', isPredefined: true, sortOrder: 3, restaurant: savedRestaurant._id },
      { name: 'Drinks & Beverages', description: 'Cold and hot beverages', isPredefined: true, sortOrder: 4, restaurant: savedRestaurant._id },
      { name: 'Desserts', description: 'Sweet treats and desserts', isPredefined: true, sortOrder: 5, restaurant: savedRestaurant._id },
      { name: 'Sides', description: 'Side dishes and extras', isPredefined: true, sortOrder: 6, restaurant: savedRestaurant._id },
      { name: 'Specials', description: 'Chef specials', isPredefined: true, sortOrder: 7, restaurant: savedRestaurant._id }
    ];
    
    await Category.insertMany(predefinedCategories);
    
    // Create a sample admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const sampleUser = new User({
      name: 'Restaurant Admin',
      email: 'admin@samplerestaurant.com',
      password: hashedPassword,
      role: 'admin',
      restaurant: savedRestaurant._id
    });
    
    const savedUser = await sampleUser.save();
    
    res.json({ 
      message: 'Sample restaurant, categories, and admin user created successfully!',
      restaurant: {
        id: savedRestaurant._id,
        name: savedRestaurant.name
      },
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email
      },
      login: {
        email: 'admin@samplerestaurant.com',
        password: 'admin123'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Initialization failed', details: error.message });
  }
});

// Add this to server.js before the PORT declaration
app.get('/api/check-users', async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find().populate('restaurant');
    res.json({ 
      message: 'Users in database',
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        restaurant: user.restaurant?.name
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});
// Add a protected test route
const { auth } = require('./middleware/auth');
app.get('/api/protected-test', auth, (req, res) => {
  res.json({ 
    message: 'This is a protected route!',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      restaurant: req.user.restaurant
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET === 'your-fallback-secret-key-change-in-production' ? 'Using fallback - set JWT_SECRET in .env' : 'Using environment variable'}`);
});