const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./config/cloudinary');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();

// Import models
const Order = require('./models/Order');
const Restaurant = require('./models/Restaurant');
const User = require('./models/User');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

// Simple in-memory store for SSE connections
const sseConnections = new Map();

// Helper function to send notifications via SSE
function notifyRestaurant(restaurantId, data) {
  if (!sseConnections.has(restaurantId)) {
    console.log(`❌ No SSE connections for restaurant: ${restaurantId}`);
    return;
  }

  const connections = sseConnections.get(restaurantId);
  let delivered = 0;
  
  connections.forEach(res => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      delivered++;
    } catch (error) {
      console.error('❌ Failed to send SSE notification:', error);
    }
  });
  
  console.log(`📢 Notified ${delivered} clients for restaurant ${restaurantId}`);
}

// Configure Cloudinary storage for menu items
const menuItemStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'menu-items',
    format: async (req, file) => {
      const format = file.mimetype.split('/')[1];
      return format === 'jpeg' ? 'jpg' : format;
    },
    public_id: (req, file) => {
      const now = new Date();
      const dateTime = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      
      let restaurantName = 'restaurant';
      let menuItemName = 'item';
      
      if (req.user && req.user.restaurant && req.user.restaurant.name) {
        restaurantName = req.user.restaurant.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      
      if (req.body && req.body.name) {
        menuItemName = req.body.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      
      return `${restaurantName}-${menuItemName}-${dateTime}`;
    },
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto' }
    ]
  }
});

// Configure Cloudinary storage for restaurant logos
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'restaurant-logos',
    format: async (req, file) => {
      const format = file.mimetype.split('/')[1];
      return format === 'jpeg' ? 'jpg' : format;
    },
    public_id: (req, file) => {
      const now = new Date();
      const dateTime = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      
      let restaurantName = 'restaurant';
      if (req.user && req.user.restaurant && req.user.restaurant.name) {
        restaurantName = req.user.restaurant.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      
      return `logo-${restaurantName}-${dateTime}`;
    },
    transformation: [
      { width: 300, height: 300, crop: 'limit', quality: 'auto' }
    ]
  }
});

const menuItemUpload = multer({
  storage: menuItemStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for logos
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper function to delete images from Cloudinary
const deleteCloudinaryImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
      return; // Not a Cloudinary image
    }

    // Extract public_id from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];
    const folder = urlParts[urlParts.length - 2];
    
    const fullPublicId = `${folder}/${publicId}`;
    
    await cloudinary.uploader.destroy(fullPublicId);
    console.log('🗑️ Deleted image from Cloudinary:', fullPublicId);
  } catch (error) {
    console.error('❌ Failed to delete image from Cloudinary:', error);
  }
};

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

// Import middleware
const { auth } = require('./middleware/auth');

// Routes
app.use('/api/auth', require('./routes/auth'));

const paymentRoutes = require('./payment'); // relative path to payment.js
app.use('/api', paymentRoutes);
// ============================================================================
// SSE ENDPOINTS
// ============================================================================

// SSE endpoint for order notifications
app.get('/api/orders/stream/:restaurantId', (req, res) => {
  const { restaurantId } = req.params;
  
  console.log(`🔔 New SSE connection for restaurant: ${restaurantId}`);
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'SSE connection established',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Store the connection
  if (!sseConnections.has(restaurantId)) {
    sseConnections.set(restaurantId, new Set());
  }
  sseConnections.get(restaurantId).add(res);

  // Remove connection when client closes
  req.on('close', () => {
    console.log(`🔔 SSE connection closed for restaurant: ${restaurantId}`);
    if (sseConnections.has(restaurantId)) {
      sseConnections.get(restaurantId).delete(res);
      if (sseConnections.get(restaurantId).size === 0) {
        sseConnections.delete(restaurantId);
      }
    }
  });
});

// Debug endpoint for SSE connections
app.get('/api/sse-debug', (req, res) => {
  const debugInfo = {
    totalConnections: 0,
    restaurants: {}
  };

  sseConnections.forEach((connections, restaurantId) => {
    debugInfo.restaurants[restaurantId] = connections.size;
    debugInfo.totalConnections += connections.size;
  });

  res.json(debugInfo);
});

// Test SSE notification endpoint
app.post('/api/test-sse/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { type = 'new_order' } = req.body;
    
    console.log(`🧪 Testing SSE for restaurant: ${restaurantId}`);
    
    // Create a test order
    const testOrder = {
      _id: 'test_' + Date.now(),
      orderNumber: 'TEST-' + Date.now(),
      restaurant: restaurantId,
      customerName: 'Test Customer',
      items: [
        {
          menuItem: {
            name: 'Test Item',
            price: 1000
          },
          quantity: 1,
          price: 1000
        }
      ],
      totalAmount: 1000,
      status: 'pending',
      paymentStatus: 'pending',
      orderType: 'dine-in',
      createdAt: new Date().toISOString()
    };
    
    notifyRestaurant(restaurantId, {
      type: type,
      order: testOrder,
      message: `Test ${type} notification`,
      timestamp: new Date().toISOString()
    });
    
    const clientCount = sseConnections.has(restaurantId) ? sseConnections.get(restaurantId).size : 0;
    
    res.json({
      message: `SSE test notification sent (${type})`,
      restaurantId,
      clientsConnected: clientCount,
      testOrder: testOrder.orderNumber,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ SSE test failed:', error);
    res.status(500).json({ error: 'SSE test failed', details: error.message });
  }
});

// ============================================================================
// TEST ROUTES
// ============================================================================

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

// ============================================================================
// RESTAURANT SETTINGS ENDPOINTS
// ============================================================================

// Get current restaurant (protected)
app.get('/api/restaurants/current', auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurant._id);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      message: 'Restaurant retrieved successfully',
      restaurant
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant', details: error.message });
  }
});

// Update current restaurant (protected)
app.put('/api/restaurants/current', auth, async (req, res) => {
  try {
    console.log('🏪 Updating restaurant:', req.user.restaurant.name);
    console.log('📝 Update data:', req.body);

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurant._id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    console.log('✅ Restaurant updated successfully:', restaurant.name);
    
    res.json({
      message: 'Restaurant updated successfully',
      restaurant
    });
  } catch (error) {
    console.error('❌ Failed to update restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant', details: error.message });
  }
});

// Update restaurant logo (protected)
app.put('/api/restaurants/current/logo', auth, logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    console.log('🖼️ Updating restaurant logo for:', req.user.restaurant.name);
    console.log('📸 Logo uploaded to Cloudinary:', req.file.path);

    // Delete old logo from Cloudinary if it exists
    const currentRestaurant = await Restaurant.findById(req.user.restaurant._id);
    if (currentRestaurant.logo && currentRestaurant.logo.includes('cloudinary.com')) {
      await deleteCloudinaryImage(currentRestaurant.logo);
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurant._id,
      { logo: req.file.path },
      { new: true }
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    console.log('✅ Restaurant logo updated successfully');
    
    res.json({
      message: 'Restaurant logo updated successfully',
      restaurant
    });
  } catch (error) {
    console.error('❌ Failed to update restaurant logo:', error);
    res.status(500).json({ error: 'Failed to update restaurant logo', details: error.message });
  }
});

// ============================================================================
// USER PROFILE ENDPOINTS
// ============================================================================

// Get current user profile (protected)
app.get('/api/users/current', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -__v')
      .populate('restaurant', 'name description contact address theme logo');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User profile retrieved successfully',
      user
    });
  } catch (error) {
    console.error('❌ Failed to fetch user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
});

// Update current user profile (protected)
app.put('/api/users/current', auth, async (req, res) => {
  try {
    console.log('👤 Updating user profile:', req.user.email);
    console.log('📝 Update data:', req.body);

    const { currentPassword, newPassword, ...updateData } = req.body || {};
    // If password change is requested
    if (currentPassword && newPassword) {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -__v').populate('restaurant', 'name description contact address theme logo');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User profile updated successfully');
    
    res.json({
      message: 'User profile updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Failed to update user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile', details: error.message });
  }
});

// ============================================================================
// EXISTING RESTAURANT ROUTES (public - for landing pages, etc.)
// ============================================================================
// ============================================================================
// MENU ITEM ENGAGEMENT ROUTES (PUBLIC)
// ============================================================================

// Rate/Update/Remove rating for menu item (public)
app.post('/api/public/menu-items/:id/rate', async (req, res) => {
  try {
    const { rating, sessionId, action = 'set' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    let userRating = null;
    let message = '';

    // Check if user already rated this item
    const existingRating = menuItem.userRatings?.find(r => r.sessionId === sessionId);

    switch (action) {
      case 'set':
        if (!rating || rating < 1 || rating > 5) {
          return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        
        if (existingRating) {
          // Update existing rating
          const oldRating = existingRating.rating;
          existingRating.rating = rating;
          existingRating.updatedAt = new Date();
          message = 'Rating updated successfully';
        } else {
          // Add new rating
          if (!menuItem.userRatings) menuItem.userRatings = [];
          menuItem.userRatings.push({
            sessionId,
            rating,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          message = 'Rating submitted successfully';
        }
        userRating = rating;
        break;

      case 'remove':
        if (existingRating) {
          menuItem.userRatings = menuItem.userRatings.filter(r => r.sessionId !== sessionId);
          message = 'Rating removed successfully';
        } else {
          return res.status(404).json({ error: 'No rating found to remove' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Recalculate average rating
    if (menuItem.userRatings && menuItem.userRatings.length > 0) {
      const total = menuItem.userRatings.reduce((sum, r) => sum + r.rating, 0);
      menuItem.rating.average = total / menuItem.userRatings.length;
      menuItem.rating.count = menuItem.userRatings.length;
      
      // Update rating distribution
      menuItem.rating.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      menuItem.userRatings.forEach(r => {
        menuItem.rating.distribution[r.rating]++;
      });
    } else {
      menuItem.rating.average = 0;
      menuItem.rating.count = 0;
      menuItem.rating.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }

    await menuItem.save();

    console.log(`⭐ ${message} for ${menuItem.name} by session ${sessionId.substring(0, 8)}...`);
    
    res.json({
      message,
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        averageRating: menuItem.rating.average,
        ratingCount: menuItem.rating.count,
        userRating: userRating,
        ratingDistribution: menuItem.rating.distribution
      }
    });
  } catch (error) {
    console.error('❌ Failed to process rating:', error);
    res.status(500).json({ error: 'Failed to process rating', details: error.message });
  }
});

// Get user's rating for a menu item (public)
app.get('/api/public/menu-items/:id/user-rating', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const userRating = menuItem.userRatings?.find(r => r.sessionId === sessionId);

    res.json({
      message: 'User rating retrieved successfully',
      userRating: userRating ? userRating.rating : null,
      hasRated: !!userRating
    });
  } catch (error) {
    console.error('❌ Failed to fetch user rating:', error);
    res.status(500).json({ error: 'Failed to fetch user rating', details: error.message });
  }
});

// Like/Unlike a menu item (public)
app.post('/api/public/menu-items/:id/like', async (req, res) => {
  try {
    const { sessionId, action = 'toggle' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Initialize userLikes array if it doesn't exist
    if (!menuItem.userLikes) menuItem.userLikes = [];

    const hasLiked = menuItem.userLikes.includes(sessionId);
    let message = '';
    let newLikeStatus = false;

    if (action === 'toggle') {
      if (hasLiked) {
        // Unlike
        menuItem.userLikes = menuItem.userLikes.filter(id => id !== sessionId);
        menuItem.likes = Math.max(0, menuItem.likes - 1);
        message = 'Item unliked successfully';
        newLikeStatus = false;
      } else {
        // Like
        menuItem.userLikes.push(sessionId);
        menuItem.likes += 1;
        message = 'Item liked successfully';
        newLikeStatus = true;
      }
    } else if (action === 'like' && !hasLiked) {
      menuItem.userLikes.push(sessionId);
      menuItem.likes += 1;
      message = 'Item liked successfully';
      newLikeStatus = true;
    } else if (action === 'unlike' && hasLiked) {
      menuItem.userLikes = menuItem.userLikes.filter(id => id !== sessionId);
      menuItem.likes = Math.max(0, menuItem.likes - 1);
      message = 'Item unliked successfully';
      newLikeStatus = false;
    } else {
      message = 'No change made';
      newLikeStatus = hasLiked;
    }

    // Update popularity score
    menuItem.popularity = menuItem.calculatePopularity();
    
    await menuItem.save();

    console.log(`❤️ ${message} for ${menuItem.name} by session ${sessionId.substring(0, 8)}..., total likes: ${menuItem.likes}`);
    
    res.json({
      message,
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        likes: menuItem.likes,
        userHasLiked: newLikeStatus
      }
    });
  } catch (error) {
    console.error('❌ Failed to process like:', error);
    res.status(500).json({ error: 'Failed to process like', details: error.message });
  }
});

// Check if user has liked a menu item (public)
app.get('/api/public/menu-items/:id/user-like', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const hasLiked = menuItem.userLikes?.includes(sessionId) || false;

    res.json({
      message: 'User like status retrieved successfully',
      hasLiked,
      likes: menuItem.likes || 0
    });
  } catch (error) {
    console.error('❌ Failed to fetch user like status:', error);
    res.status(500).json({ error: 'Failed to fetch user like status', details: error.message });
  }
});

// Increment view count with session tracking (public)
app.post('/api/public/menu-items/:id/view', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Initialize userViews array if it doesn't exist
    if (!menuItem.userViews) menuItem.userViews = [];

    let shouldIncrement = true;

    // Check if this session has already viewed this item recently (within 24 hours)
    if (sessionId) {
      const existingView = menuItem.userViews.find(v => v.sessionId === sessionId);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (existingView) {
        // If last view was more than 24 hours ago, update timestamp and count as new view
        if (existingView.lastViewed < twentyFourHoursAgo) {
          existingView.lastViewed = new Date();
          existingView.viewCount += 1;
        } else {
          // Viewed recently, don't increment main count
          shouldIncrement = false;
        }
      } else {
        // First view from this session
        menuItem.userViews.push({
          sessionId,
          lastViewed: new Date(),
          viewCount: 1
        });
      }
    }

    if (shouldIncrement) {
      menuItem.viewCount += 1;
      menuItem.popularity = menuItem.calculatePopularity();
    }

    await menuItem.save();

    console.log(`👀 View recorded for ${menuItem.name}${sessionId ? ` by session ${sessionId.substring(0, 8)}...` : ''}, total views: ${menuItem.viewCount}`);
    
    res.json({
      message: 'View recorded successfully',
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        viewCount: menuItem.viewCount,
        viewIncremented: shouldIncrement
      }
    });
  } catch (error) {
    console.error('❌ Failed to record view:', error);
    res.status(500).json({ error: 'Failed to record view', details: error.message });
  }
});

// Get popular menu items (public)
app.get('/api/public/restaurants/:id/popular-items', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const popularItems = await MenuItem.find({ 
      restaurant: restaurantId,
      isAvailable: true 
    })
    .sort({ popularity: -1, likes: -1, 'rating.average': -1 })
    .limit(limit)
    .select('name description price image rating likes popularity viewCount nutrition takeaway')
    .populate('category', 'name');

    res.json({
      message: 'Popular items retrieved successfully',
      popularItems
    });
  } catch (error) {
    console.error('❌ Failed to fetch popular items:', error);
    res.status(500).json({ error: 'Failed to fetch popular items', details: error.message });
  }
});

// Get menu item with engagement status for a specific user (public)
app.get('/api/public/menu-items/:id/engagement', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('category', 'name')
      .populate('restaurant', 'name logo');
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    let userRating = null;
    let userHasLiked = false;

    if (sessionId) {
      // Get user's rating
      const ratingObj = menuItem.userRatings?.find(r => r.sessionId === sessionId);
      userRating = ratingObj ? ratingObj.rating : null;
      
      // Get user's like status
      userHasLiked = menuItem.userLikes?.includes(sessionId) || false;
    }

    res.json({
      message: 'Menu item engagement data retrieved successfully',
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        image: menuItem.image,
        category: menuItem.category,
        restaurant: menuItem.restaurant,
        rating: {
          average: menuItem.rating.average,
          count: menuItem.rating.count,
          distribution: menuItem.rating.distribution,
          userRating: userRating
        },
        likes: menuItem.likes,
        userHasLiked: userHasLiked,
        viewCount: menuItem.viewCount,
        popularity: menuItem.popularity,
        nutrition: menuItem.nutrition,
        takeaway: menuItem.takeaway
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch menu item engagement:', error);
    res.status(500).json({ error: 'Failed to fetch menu item engagement', details: error.message });
  }
});
// ============================================================================
// RESTAURANT RATING ENDPOINTS (PUBLIC)
// ============================================================================

// Rate/Update/Remove restaurant rating (public)
app.post('/api/public/restaurants/:id/rate', async (req, res) => {
  try {
    const { rating, sessionId, action = 'set' } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let userRating = null;
    let message = '';

    // Initialize restaurant ratings array if it doesn't exist
    if (!restaurant.userRatings) restaurant.userRatings = [];

    // Check if user already rated this restaurant
    const existingRating = restaurant.userRatings.find(r => r.sessionId === sessionId);

    switch (action) {
      case 'set':
        if (!rating || rating < 1 || rating > 5) {
          return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        
        if (existingRating) {
          // Update existing rating
          existingRating.rating = rating;
          existingRating.updatedAt = new Date();
          message = 'Restaurant rating updated successfully';
        } else {
          // Add new rating
          restaurant.userRatings.push({
            sessionId,
            rating,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          message = 'Restaurant rating submitted successfully';
        }
        userRating = rating;
        break;

      case 'remove':
        if (existingRating) {
          restaurant.userRatings = restaurant.userRatings.filter(r => r.sessionId !== sessionId);
          message = 'Restaurant rating removed successfully';
        } else {
          return res.status(404).json({ error: 'No restaurant rating found to remove' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Recalculate restaurant average rating
    if (restaurant.userRatings.length > 0) {
      const total = restaurant.userRatings.reduce((sum, r) => sum + r.rating, 0);
      restaurant.rating = {
        average: total / restaurant.userRatings.length,
        count: restaurant.userRatings.length,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
      
      // Update rating distribution
      restaurant.userRatings.forEach(r => {
        restaurant.rating.distribution[r.rating]++;
      });
    } else {
      restaurant.rating = {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    await restaurant.save();

    console.log(`🏪 ${message} for ${restaurant.name} by session ${sessionId.substring(0, 8)}...`);
    
    res.json({
      message,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        rating: restaurant.rating,
        userRating: userRating
      }
    });
  } catch (error) {
    console.error('❌ Failed to process restaurant rating:', error);
    res.status(500).json({ error: 'Failed to process restaurant rating', details: error.message });
  }
});

// Get user's restaurant rating (public)
app.get('/api/public/restaurants/:id/user-rating', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const userRating = restaurant.userRatings?.find(r => r.sessionId === sessionId);

    res.json({
      message: 'User restaurant rating retrieved successfully',
      userRating: userRating ? userRating.rating : null,
      hasRated: !!userRating
    });
  } catch (error) {
    console.error('❌ Failed to fetch user restaurant rating:', error);
    res.status(500).json({ error: 'Failed to fetch user restaurant rating', details: error.message });
  }
});

// Get restaurant with user engagement data (public)
app.get('/api/public/restaurants/:id/engagement', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    const restaurant = await Restaurant.findById(req.params.id)
      .select('name description logo contact address theme rating userRatings');
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let userRating = null;

    if (sessionId) {
      // Get user's restaurant rating
      const ratingObj = restaurant.userRatings?.find(r => r.sessionId === sessionId);
      userRating = ratingObj ? ratingObj.rating : null;
    }

    // Remove user-specific arrays from response for security
    const restaurantData = restaurant.toObject();
    delete restaurantData.userRatings;

    res.json({
      message: 'Restaurant engagement data retrieved successfully',
      restaurant: {
        ...restaurantData,
        userRating: userRating
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurant engagement:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant engagement', details: error.message });
  }
});
app.get('/api/public/orders/by-number/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    const order = await Order.findOne({ orderNumber })
      .populate('items.menuItem', 'name description image price')
      .populate('table', 'tableNumber')
      .populate('restaurant', 'name logo');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      message: 'Order retrieved successfully',
      order
    });
  } catch (error) {
    console.error('❌ Failed to fetch order by number:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

app.get('/api/public/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId)
      .populate('items.menuItem', 'name description image price')
      .populate('table', 'tableNumber')
      .populate('restaurant', 'name logo');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      message: 'Order retrieved successfully',
      order
    });
  } catch (error) {
    console.error('❌ Failed to fetch order:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});
app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find().select('-__v');
    res.json({
      message: 'Restaurants retrieved successfully',
      restaurants
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurants', details: error.message });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json({
      message: 'Restaurant retrieved successfully',
      restaurant
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurant', details: error.message });
  }
});

// ============================================================================
// MENU ITEMS ROUTES
// ============================================================================

// Update the existing GET /api/menu-items endpoint
app.get('/api/menu-items', auth, async (req, res) => {
  try {
    const { categoryId, includeAllDays = true } = req.query;
    const restaurantId = req.user.restaurant._id;
    
    console.log(`🔐 Fetching menu items for: ${req.user.restaurant.name} (${restaurantId})`);
    
    let query = { restaurant: restaurantId };
    
    if (categoryId) query.category = categoryId;
    
    // Only filter by availability if includeAllDays is false
    if (includeAllDays === 'false') {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      query.$or = [
        { availableDays: { $in: [today] } },
        { availableDays: { $size: 7 } },
        { availableDays: { $exists: false } }
      ];
    }

    const menuItems = await MenuItem.find(query)
      .populate('category', 'name')
      .populate('restaurant', 'name')
      .select('-__v');

    console.log(`✅ Found ${menuItems.length} items for ${req.user.restaurant.name}`);
    
    res.json({
      message: 'Menu items retrieved successfully',
      menuItems
    });
  } catch (error) {
    console.error('❌ Failed to fetch menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

// Update menu item (protected)
app.put('/api/menu-items/:id', auth, menuItemUpload.single('image'), async (req, res) => {
  try {
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (existingItem.restaurant.toString() !== req.user.restaurant._id.toString()) {
      return res.status(403).json({ error: 'Access denied - menu item does not belong to your restaurant' });
    }

    console.log('📦 Updating menu item:', req.params.id);

    const updateData = {
      ...req.body,
      ingredients: req.body.ingredients ? JSON.parse(req.body.ingredients) : [],
      price: req.body.price ? Number(req.body.price) : undefined,
      preparationTime: req.body.preparationTime ? Number(req.body.preparationTime) : undefined,
      spiceLevel: req.body.spiceLevel ? Number(req.body.spiceLevel) : undefined,
      isVegetarian: req.body.isVegetarian ? req.body.isVegetarian === 'true' : undefined,
      isVegan: req.body.isVegan ? req.body.isVegan === 'true' : undefined,
      isGlutenFree: req.body.isGlutenFree ? req.body.isGlutenFree === 'true' : undefined,
      isAvailable: req.body.isAvailable ? req.body.isAvailable === 'true' : undefined,
      'nutrition.calories': req.body.calories ? Number(req.body.calories) : undefined,
      'nutrition.protein': req.body.protein ? Number(req.body.protein) : undefined,
      'nutrition.carbs': req.body.carbs ? Number(req.body.carbs) : undefined,
      'nutrition.fat': req.body.fat ? Number(req.body.fat) : undefined,
      'nutrition.fiber': req.body.fiber ? Number(req.body.fiber) : undefined,
      'nutrition.sugar': req.body.sugar ? Number(req.body.sugar) : undefined,
      'nutrition.sodium': req.body.sodium ? Number(req.body.sodium) : undefined,
      'takeaway.isTakeawayAvailable': req.body.isTakeawayAvailable ? req.body.isTakeawayAvailable === 'true' : undefined,
      'takeaway.takeawayPrice': req.body.takeawayPrice ? Number(req.body.takeawayPrice) : undefined,
      'takeaway.packagingFee': req.body.packagingFee ? Number(req.body.packagingFee) : undefined
    };

    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (existingItem.image && existingItem.image.includes('cloudinary.com')) {
        await deleteCloudinaryImage(existingItem.image);
      }
      
      updateData.image = req.file.path;
      console.log('📸 New image uploaded to Cloudinary:', req.file.path);
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name').populate('restaurant', 'name');
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    console.log('✅ Menu item updated successfully:', menuItem.name);
    
    res.json({
      message: 'Menu item updated successfully',
      menuItem
    });
  } catch (error) {
    console.error('❌ Failed to update menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item', details: error.message });
  }
});

// Create menu item (protected)
app.post('/api/menu-items', auth, menuItemUpload.single('image'), async (req, res) => {
  try {
    console.log('📦 Creating menu item with data:', req.body);
    console.log('🏪 Restaurant:', req.user.restaurant.name);

    const menuItemData = {
      ...req.body,
      restaurant: req.user.restaurant._id,
      ingredients: req.body.ingredients ? JSON.parse(req.body.ingredients) : [],
      price: Number(req.body.price),
      preparationTime: Number(req.body.preparationTime),
      spiceLevel: Number(req.body.spiceLevel),
      isVegetarian: req.body.isVegetarian === 'true',
      isVegan: req.body.isVegan === 'true',
      isGlutenFree: req.body.isGlutenFree === 'true',
      isAvailable: req.body.isAvailable === 'true',
      'nutrition.calories': req.body.calories ? Number(req.body.calories) : 0,
      'nutrition.protein': req.body.protein ? Number(req.body.protein) : 0,
      'nutrition.carbs': req.body.carbs ? Number(req.body.carbs) : 0,
      'nutrition.fat': req.body.fat ? Number(req.body.fat) : 0,
      'nutrition.fiber': req.body.fiber ? Number(req.body.fiber) : 0,
      'nutrition.sugar': req.body.sugar ? Number(req.body.sugar) : 0,
      'nutrition.sodium': req.body.sodium ? Number(req.body.sodium) : 0,
      'takeaway.isTakeawayAvailable': req.body.isTakeawayAvailable === 'true',
      'takeaway.takeawayPrice': req.body.takeawayPrice ? Number(req.body.takeawayPrice) : undefined,
      'takeaway.packagingFee': req.body.packagingFee ? Number(req.body.packagingFee) : 0
    };

    if (req.file) {
      menuItemData.image = req.file.path;
      console.log('📸 Image uploaded to Cloudinary:', req.file.path);
    } else {
      console.log('⚠️ No image file attached to request');
    }

    const menuItem = new MenuItem(menuItemData);
    const savedItem = await menuItem.save();
    
    const populatedItem = await MenuItem.findById(savedItem._id)
      .populate('category', 'name')
      .populate('restaurant', 'name');

    console.log('✅ Menu item created successfully:', populatedItem.name);
    
    res.status(201).json({
      message: 'Menu item created successfully',
      menuItem: populatedItem
    });
  } catch (error) {
    console.error('❌ Failed to create menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item', details: error.message });
  }
});

// Delete menu item (protected)
app.delete('/api/menu-items/:id', auth, async (req, res) => {
  try {
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (existingItem.restaurant.toString() !== req.user.restaurant._id.toString()) {
      return res.status(403).json({ error: 'Access denied - menu item does not belong to your restaurant' });
    }

    console.log('🗑️ Deleting menu item:', existingItem.name);
    console.log('🏪 Restaurant:', req.user.restaurant.name);

    // Delete image from Cloudinary if it exists
    if (existingItem.image && existingItem.image.includes('cloudinary.com')) {
      await deleteCloudinaryImage(existingItem.image);
    }

    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    console.log('✅ Menu item deleted successfully');
    
    res.json({
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('❌ Failed to delete menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item', details: error.message });
  }
});

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

app.get('/api/categories', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;
    
    console.log(`🔐 Fetching categories for: ${req.user.restaurant.name} (${restaurantId})`);
    
    const categories = await Category.find({ restaurant: restaurantId })
      .populate('restaurant', 'name')
      .select('-__v')
      .sort('sortOrder');

    console.log(`✅ Found ${categories.length} categories for ${req.user.restaurant.name}`);
    
    res.json({
      message: 'Categories retrieved successfully',
      categories
    });
  } catch (error) {
    console.error('❌ Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

// Create category (protected)
app.post('/api/categories', auth, async (req, res) => {
  try {
    console.log('📁 Creating new category for restaurant:', req.user.restaurant.name);
    console.log('📝 Category data:', req.body);
    
    const categoryData = {
      ...req.body,
      restaurant: req.user.restaurant._id,
      isPredefined: false
    };

    const category = new Category(categoryData);
    const savedCategory = await category.save();
    
    const populatedCategory = await Category.findById(savedCategory._id)
      .populate('restaurant', 'name');

    console.log('✅ Category created successfully:', populatedCategory.name);
    
    res.status(201).json({
      message: 'Category created successfully',
      category: populatedCategory
    });
  } catch (error) {
    console.error('❌ Failed to create category:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  }
});

// ============================================================================
// ORDER MANAGEMENT ENDPOINTS
// ============================================================================

// Delete all orders for a specific restaurant (protected - for testing/cleanup)
app.delete('/api/orders/restaurant/:restaurantId', auth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    console.log(`🧹 DELETE - Cleaning up all orders for restaurant: ${restaurantId}`);

    // Verify the authenticated user owns this restaurant
    if (req.user.restaurant._id.toString() !== restaurantId) {
      return res.status(403).json({ 
        error: 'Access denied - you can only delete orders for your own restaurant' 
      });
    }

    // Verify restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Delete all orders for this restaurant
    const result = await Order.deleteMany({ restaurant: restaurantId });

    console.log(`✅ Deleted ${result.deletedCount} orders for restaurant: ${restaurant.name}`);

    res.json({
      message: `Successfully deleted ${result.deletedCount} orders for restaurant: ${restaurant.name}`,
      deletedCount: result.deletedCount,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to delete orders:', error);
    res.status(500).json({ error: 'Failed to delete orders', details: error.message });
  }
});

// Delete all orders for current user's restaurant (protected)
app.delete('/api/orders/current-restaurant', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;
    
    console.log(`🧹 DELETE - Cleaning up all orders for current restaurant: ${req.user.restaurant.name}`);

    // Delete all orders for current user's restaurant
    const result = await Order.deleteMany({ restaurant: restaurantId });

    console.log(`✅ Deleted ${result.deletedCount} orders for restaurant: ${req.user.restaurant.name}`);

    res.json({
      message: `Successfully deleted ${result.deletedCount} orders for your restaurant`,
      deletedCount: result.deletedCount,
      restaurant: {
        id: req.user.restaurant._id,
        name: req.user.restaurant.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to delete orders:', error);
    res.status(500).json({ error: 'Failed to delete orders', details: error.message });
  }
});

// Delete orders with filters (protected)
app.delete('/api/orders/restaurant/:restaurantId/filtered', auth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status, paymentStatus, orderType, daysOld } = req.body;
    
    console.log(`🧹 DELETE - Filtered order cleanup for restaurant: ${restaurantId}`, req.body);

    // Verify the authenticated user owns this restaurant
    if (req.user.restaurant._id.toString() !== restaurantId) {
      return res.status(403).json({ 
        error: 'Access denied - you can only delete orders for your own restaurant' 
      });
    }

    // Build query based on filters
    let query = { restaurant: restaurantId };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }
    
    if (orderType && orderType !== 'all') {
      query.orderType = orderType;
    }
    
    if (daysOld && daysOld > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      query.createdAt = { $lt: cutoffDate };
    }

    console.log('🔍 Delete query:', query);

    const result = await Order.deleteMany(query);

    console.log(`✅ Deleted ${result.deletedCount} filtered orders for restaurant: ${restaurantId}`);

    res.json({
      message: `Successfully deleted ${result.deletedCount} orders based on your filters`,
      deletedCount: result.deletedCount,
      filters: {
        status,
        paymentStatus,
        orderType,
        daysOld
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to delete filtered orders:', error);
    res.status(500).json({ error: 'Failed to delete orders', details: error.message });
  }
});

app.delete('/api/categories/:id', auth, async (req, res) => {
  try {
    console.log('🗑️ Attempting to delete category:', req.params.id);
    console.log('🏪 Restaurant:', req.user.restaurant.name);

    const category = await Category.findOne({
      _id: req.params.id,
      restaurant: req.user.restaurant._id
    });

    if (!category) {
      console.log('❌ Category not found or does not belong to restaurant');
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.isPredefined) {
      console.log('❌ Cannot delete predefined category:', category.name);
      return res.status(403).json({ 
        error: 'Cannot delete predefined categories. You can only delete categories you created.' 
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    
    console.log('✅ Category deleted successfully:', category.name);
    
    res.json({
      message: 'Category deleted successfully',
      deletedCategory: {
        id: category._id,
        name: category.name
      }
    });
  } catch (error) {
    console.error('❌ Failed to delete category:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  }
});

// ============================================================================
// TABLES ROUTES
// ============================================================================

// Get tables with filtering
app.get('/api/tables', async (req, res) => {
  try {
    const { restaurantId, tableNumber } = req.query;
    let query = {};
    
    if (restaurantId) query.restaurant = restaurantId;
    if (tableNumber) query.tableNumber = tableNumber;

    const tables = await Table.find(query)
      .populate('restaurant', 'name')
      .select('-__v')
      .sort('tableNumber');

    res.json({
      message: 'Tables retrieved successfully',
      tables
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables', details: error.message });
  }
});

// Create table
app.post('/api/tables', async (req, res) => {
  try {
    const { restaurant, tableNumber, capacity, status } = req.body;

    // Check if table already exists
    const existingTable = await Table.findOne({
      restaurant,
      tableNumber
    });

    if (existingTable) {
      return res.json({
        message: 'Table already exists',
        table: existingTable
      });
    }

    const table = new Table({
      restaurant,
      tableNumber,
      capacity: capacity || 4,
      status: status || 'available'
    });

    const savedTable = await table.save();
    
    const populatedTable = await Table.findById(savedTable._id)
      .populate('restaurant', 'name');

    res.status(201).json({
      message: 'Table created successfully',
      table: populatedTable
    });
  } catch (error) {
    console.error('❌ Failed to create table:', error);
    res.status(500).json({ error: 'Failed to create table', details: error.message });
  }
});

// ============================================================================
// ORDERS ROUTES - UPDATED WITH SSE NOTIFICATIONS
// ============================================================================

// Get orders with filtering
app.get('/api/orders', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const restaurantId = req.user.restaurant._id;
    
    console.log(`🔐 Fetching orders for: ${req.user.restaurant.name} (${restaurantId})`);
    
    let query = { restaurant: restaurantId };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.menuItem', 'name description image price rating likes nutrition')
      .populate('table', 'tableNumber')
      .populate('restaurant', 'name')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${orders.length} orders for ${req.user.restaurant.name}`);
    
    res.json({
      message: 'Orders retrieved successfully',
      orders
    });
  } catch (error) {
    console.error('❌ Failed to fetch orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// Get specific order
app.get('/api/orders/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: req.user.restaurant._id
    })
      .populate('items.menuItem', 'name description image price ingredients rating likes nutrition')
      .populate('table', 'tableNumber')
      .populate('restaurant', 'name address phone');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order retrieved successfully',
      order
    });
  } catch (error) {
    console.error('❌ Failed to fetch order:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

// Create new order with SSE notifications
app.post('/api/orders', async (req, res) => {
  try {
    const { 
      restaurant, 
      customerName, 
      customerPhone,
      customerEmail,
      table, 
      items, 
      totalAmount, 
      orderType,
      paymentStatus,
      paymentDetails // ✅ ADDED: Payment details from frontend
    } = req.body;

    console.log('📦 Creating new order with data:', req.body);

    // Validate required fields
    if (!restaurant) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Valid total amount is required' });
    }

    // Verify restaurant exists and is active
    const restaurantExists = await Restaurant.findById(restaurant);
    if (!restaurantExists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Verify table exists if provided
    if (table) {
      const tableExists = await Table.findById(table);
      if (!tableExists) {
        return res.status(404).json({ error: 'Table not found' });
      }
    }

    // Verify all menu items exist
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) {
        return res.status(404).json({ error: `Menu item not found: ${item.menuItem}` });
      }
    }

    // Generate order number
    const generateOrderNumber = () => {
      const date = new Date();
      const timestamp = date.getTime();
      const random = Math.floor(Math.random() * 1000);
      return `ORD-${timestamp}-${random}`;
    };

    const orderNumber = generateOrderNumber();
    console.log('🔢 Generated order number:', orderNumber);

    // ✅ Build payment details object if provided
    let paymentDetailsObj = null;
    if (paymentDetails && paymentDetails.method) {
      paymentDetailsObj = {
        method: paymentDetails.method,
        phoneNumber: paymentDetails.phoneNumber || '',
        transactionId: paymentDetails.transactionId || '',
        status: paymentDetails.status || 'completed',
        amountPaid: totalAmount,
        currency: 'CFA',
        paymentProvider: paymentDetails.method.includes('MoMo') ? 'MTN' : 
                        paymentDetails.method.includes('Orange') ? 'Orange' : 
                        paymentDetails.method,
        customerEmail: customerEmail || '',
        notes: paymentDetails.notes || ''
      };
    }

    // Create order
    const order = new Order({
      orderNumber: orderNumber,
      restaurant,
      customerName: customerName.trim(),
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      table: table || null,
      items: items.map(item => ({
        menuItem: item.menuItem,
        quantity: item.quantity,
        price: item.price,
        specialInstructions: item.specialInstructions || ''
      })),
      totalAmount,
      orderType: orderType || 'dine-in',
      status: 'pending',
      paymentStatus: paymentStatus || (paymentDetails ? 'paid' : 'pending'),
      paymentDetails: paymentDetailsObj, // ✅ ADDED
      paidAt: paymentStatus === 'paid' || paymentDetails ? new Date() : null // ✅ ADDED
    });

    // Save the order
    const savedOrder = await order.save();
    
    // Increment takeaway orders count if it's a takeaway order
    if (orderType === 'takeaway') {
      for (const item of items) {
        const menuItem = await MenuItem.findById(item.menuItem);
        if (menuItem) {
          await menuItem.incrementTakeawayOrders();
        }
      }
    }
    
    console.log('✅ Order saved successfully with ID:', savedOrder._id);
    
    // Log payment details if present
    if (paymentDetailsObj) {
      console.log('💰 Payment details saved:', {
        method: paymentDetailsObj.method,
        transactionId: paymentDetailsObj.transactionId,
        amount: paymentDetailsObj.amountPaid
      });
    }

    // Populate the order with all details including table
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('items.menuItem', 'name description image price category ingredients rating likes nutrition')
      .populate('restaurant', 'name contact address')
      .populate('table', 'tableNumber capacity status');

    console.log(`✅ New order created: ${populatedOrder.orderNumber} for ${customerName}`);
    console.log(`💰 Payment Status: ${populatedOrder.paymentStatus}`);
    if (populatedOrder.paymentDetails) {
      console.log(`📱 Payment Method: ${populatedOrder.paymentDetails.method}`);
      if (populatedOrder.paymentDetails.transactionId) {
        console.log(`🔢 Transaction ID: ${populatedOrder.paymentDetails.transactionId}`);
      }
    }
    if (table) {
      console.log(`🪑 Table: ${populatedOrder.table?.tableNumber}`);
    }
    console.log(`📊 Order details: ${populatedOrder.items.length} items, Total: ${totalAmount} CFA`);
    
    // 🔌 NOTIFY VIA SSE
    try {
      const restaurantId = populatedOrder.restaurant._id.toString();
      notifyRestaurant(restaurantId, {
        type: 'new_order',
        order: populatedOrder,
        message: 'New order received',
        timestamp: new Date().toISOString()
      });
      console.log(`🔔 SSE notification sent for new order: ${populatedOrder.orderNumber}`);
    } catch (error) {
      console.error('❌ Failed to send SSE notification:', error);
    }
    
    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.join(', ') 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create order', 
      details: error.message 
    });
  }
});
// ============================================================================
// MENU ITEM AVAILABILITY BY DAYS ENDPOINTS
// ============================================================================

// Update available days for a menu item (protected)
app.put('/api/menu-items/:id/availability/days', auth, async (req, res) => {
  try {
    const { availableDays } = req.body;
    
    if (!Array.isArray(availableDays)) {
      return res.status(400).json({ error: 'availableDays must be an array' });
    }

    // Validate days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const invalidDays = availableDays.filter(day => !validDays.includes(day));
    
    if (invalidDays.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid days provided', 
        invalidDays,
        validDays 
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurant: req.user.restaurant._id
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found or not authorized' });
    }

    menuItem.availableDays = availableDays;
    await menuItem.save();

    console.log(`📅 Updated available days for "${menuItem.name}" to:`, availableDays);
    
    res.json({
      message: 'Available days updated successfully',
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        availableDays: menuItem.availableDays
      }
    });
  } catch (error) {
    console.error('❌ Failed to update available days:', error);
    res.status(500).json({ error: 'Failed to update available days', details: error.message });
  }
});

// Get menu items available today (public)
app.get('/api/public/restaurants/:id/menu/today', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    // Get current day name
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log(`📅 Fetching menu items available on ${today} for restaurant: ${restaurantId}`);
    
    // Verify restaurant exists and is active
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or not available' });
    }

    // Find items available today OR items without specific day restrictions (all days)
    const menuItems = await MenuItem.find({ 
      restaurant: restaurantId,
      isAvailable: true,
      $or: [
        { availableDays: { $in: [today] } },
        { availableDays: { $size: 7 } }, // Items available all 7 days
        { availableDays: { $exists: false } } // Backward compatibility
      ]
    })
    .populate('category', 'name _id')
    .select('name description price image ingredients preparationTime isVegetarian isVegan isGlutenFree spiceLevel category isAvailable rating nutrition likes takeaway popularity viewCount availableDays')
    .sort('category name');

    console.log(`✅ Found ${menuItems.length} menu items available today (${today})`);
    
    // Convert to objects
    const menuItemsWithVirtuals = menuItems.map(item => {
      const itemObj = item.toObject({ virtuals: true });
      
      // Ensure takeaway structure exists
      if (!itemObj.takeaway) {
        itemObj.takeaway = {
          isTakeawayAvailable: false,
          takeawayPrice: itemObj.price,
          packagingFee: 0,
          takeawayOrdersCount: 0
        };
      }
      
      itemObj.totalTakeawayPrice = itemObj.takeaway.takeawayPrice + itemObj.takeaway.packagingFee;
      itemObj.isTakeawayAvailable = itemObj.takeaway.isTakeawayAvailable;
      
      return itemObj;
    });

    res.json({
      message: `Menu items available on ${today} retrieved successfully`,
      today: today,
      menuItems: menuItemsWithVirtuals,
      restaurant: {
        name: restaurant.name,
        id: restaurant._id
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch today\'s menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

// New endpoint: Get all menu items with today's availability flag
app.get('/api/public/restaurants/:id/menu/all-with-availability', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Fetch ALL menu items
    const menuItems = await MenuItem.find({ 
      restaurant: restaurantId,
      isAvailable: true
    })
    .populate('category', 'name _id')
    .select('name description price image ingredients preparationTime isVegetarian isVegan isGlutenFree spiceLevel category isAvailable rating nutrition likes takeaway popularity viewCount availableDays')
    .sort('category name');

    // Add today's availability flag
    const menuItemsWithAvailability = menuItems.map(item => {
      const itemObj = item.toObject({ virtuals: true });
      
      const availableDays = itemObj.availableDays || [];
      let isAvailableToday;
      
      if (availableDays.length === 0 || availableDays.length === 7) {
        isAvailableToday = true;
      } else {
        isAvailableToday = availableDays.includes(today);
      }
      
      itemObj.isAvailableToday = isAvailableToday;
      
      // Takeaway structure
      if (!itemObj.takeaway) {
        itemObj.takeaway = {
          isTakeawayAvailable: false,
          takeawayPrice: itemObj.price,
          packagingFee: 0,
          takeawayOrdersCount: 0
        };
      }
      
      itemObj.totalTakeawayPrice = itemObj.takeaway.takeawayPrice + itemObj.takeaway.packagingFee;
      itemObj.isTakeawayAvailable = itemObj.takeaway.isTakeawayAvailable;
      
      return itemObj;
    });

    res.json({
      message: `All menu items with today's availability`,
      today: today,
      menuItems: menuItemsWithAvailability,
      restaurant: {
        name: restaurant.name,
        id: restaurant._id
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch menu items with availability:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});
// Get menu items available on specific day (public)
app.get('/api/public/restaurants/:id/menu/day/:dayName', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const dayName = req.params.dayName.toLowerCase();
    
    // Validate day name
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayName)) {
      return res.status(400).json({ 
        error: 'Invalid day name',
        validDays 
      });
    }

    console.log(`📅 Fetching menu items available on ${dayName} for restaurant: ${restaurantId}`);
    
    // Verify restaurant exists and is active
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or not available' });
    }

    // Find items available on specific day OR items without specific day restrictions
    const menuItems = await MenuItem.find({ 
      restaurant: restaurantId,
      isAvailable: true,
      $or: [
        { availableDays: { $in: [dayName] } },
        { availableDays: { $size: 7 } }, // Items available all 7 days
        { availableDays: { $exists: false } } // Backward compatibility
      ]
    })
    .populate('category', 'name _id')
    .select('name description price image ingredients preparationTime isVegetarian isVegan isGlutenFree spiceLevel category isAvailable rating nutrition likes takeaway popularity viewCount availableDays')
    .sort('category name');

    console.log(`✅ Found ${menuItems.length} menu items available on ${dayName}`);
    
    // Convert to objects
    const menuItemsWithVirtuals = menuItems.map(item => {
      const itemObj = item.toObject({ virtuals: true });
      
      // Ensure takeaway structure exists
      if (!itemObj.takeaway) {
        itemObj.takeaway = {
          isTakeawayAvailable: false,
          takeawayPrice: itemObj.price,
          packagingFee: 0,
          takeawayOrdersCount: 0
        };
      }
      
      itemObj.totalTakeawayPrice = itemObj.takeaway.takeawayPrice + itemObj.takeaway.packagingFee;
      itemObj.isTakeawayAvailable = itemObj.takeaway.isTakeawayAvailable;
      
      return itemObj;
    });

    res.json({
      message: `Menu items available on ${dayName} retrieved successfully`,
      day: dayName,
      menuItems: menuItemsWithVirtuals,
      restaurant: {
        name: restaurant.name,
        id: restaurant._id
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch menu by day:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

// Get all menu items with their availability schedule (protected)
app.get('/api/menu-items/availability', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;
    
    console.log(`📅 Fetching availability schedule for restaurant: ${req.user.restaurant.name}`);
    
    const menuItems = await MenuItem.find({ 
      restaurant: restaurantId 
    })
    .populate('category', 'name')
    .select('name category isAvailable availableDays')
    .sort('category name');

    // Group by category
    const groupedItems = {};
    menuItems.forEach(item => {
      const categoryName = item.category?.name || 'Uncategorized';
      if (!groupedItems[categoryName]) {
        groupedItems[categoryName] = [];
      }
      
      // Check if item is available today
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const isAvailableToday = item.availableDays?.includes(today) || 
                              !item.availableDays || 
                              item.availableDays.length === 7;
      
      groupedItems[categoryName].push({
        id: item._id,
        name: item.name,
        isAvailable: item.isAvailable,
        availableDays: item.availableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        isAvailableToday: isAvailableToday && item.isAvailable
      });
    });

    // Convert to array format
    const availabilitySchedule = Object.keys(groupedItems).map(category => ({
      category,
      items: groupedItems[category]
    }));

    console.log(`✅ Availability schedule retrieved for ${menuItems.length} items across ${availabilitySchedule.length} categories`);
    
    res.json({
      message: 'Availability schedule retrieved successfully',
      schedule: availabilitySchedule,
      today: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    });
  } catch (error) {
    console.error('❌ Failed to fetch availability schedule:', error);
    res.status(500).json({ error: 'Failed to fetch availability schedule', details: error.message });
  }
});
// Update order status with SSE notification
app.put('/api/orders/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const restaurantId = req.user.restaurant._id;

    console.log(`🔄 Updating order ${req.params.id} status to: ${status}`);

    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: restaurantId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If confirming order, reduce inventory
    if (status === 'confirmed' && order.status !== 'confirmed') {
      await reduceInventory(order.items);
    }

    // If cancelling a confirmed order, restore inventory
    if (status === 'cancelled' && order.status === 'confirmed') {
      await restoreInventory(order.items);
    }

    // Update status
    order.status = status;

    // Set timestamps based on status
    const now = new Date();
    if (status === 'served' && !order.servedAt) {
      order.servedAt = now;
    }
    if (status === 'completed' && !order.completedAt) {
      order.completedAt = now;
    }

    const updatedOrder = await order.save();
    
    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('items.menuItem', 'name description image rating likes')
      .populate('table', 'tableNumber');

    console.log(`✅ Order ${req.params.id} status updated to: ${status}`);
     
    // 🔌 NOTIFY VIA SSE
    try {
      notifyRestaurant(restaurantId, {
        type: 'order_updated',
        order: populatedOrder,
        message: 'Order status updated',
        timestamp: new Date().toISOString()
      });
      console.log(`🔔 SSE notification sent for order update: ${populatedOrder.orderNumber}`);
    } catch (error) {
      console.error('❌ Failed to send SSE notification:', error);
    }

    res.json({
      message: 'Order status updated successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// MARK ORDER AS PAID with SSE notification
app.put('/api/orders/:id/pay', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;

    console.log(`💳 Marking order ${req.params.id} as paid`);

    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: restaurantId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Auto-confirm order if it's still pending
    if (order.status === 'pending') {
      console.log(`🔄 Auto-confirming order from pending to confirmed`);
      order.status = 'confirmed';
      await reduceInventory(order.items);
    }

    order.paymentStatus = 'paid';
    order.paidAt = new Date();

    const updatedOrder = await order.save();

    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('items.menuItem', 'name description image rating likes')
      .populate('table', 'tableNumber');

    console.log(`✅ Order ${req.params.id} marked as paid and status updated to: ${updatedOrder.status}`);

    // 🔌 NOTIFY VIA SSE
    try {
      notifyRestaurant(restaurantId, {
        type: 'order_paid',
        order: populatedOrder,
        message: 'Order marked as paid',
        timestamp: new Date().toISOString()
      });
      console.log(`🔔 SSE payment notification sent: ${populatedOrder.orderNumber}`);
    } catch (error) {
      console.error('❌ Failed to send SSE notification:', error);
    }

    res.json({
      message: 'Order marked as paid successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('❌ Failed to mark order as paid:', error);
    res.status(500).json({ error: 'Failed to mark order as paid', details: error.message });
  }
});

// MARK ORDER AS UNPAID
app.put('/api/orders/:id/unpay', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;

    console.log(`💳 Marking order ${req.params.id} as unpaid`);

    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: restaurantId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Order is not marked as paid' });
    }

    // Restore inventory for unpaid order
    console.log(`🔄 Restoring inventory for unpaid order`);
    await restoreInventory(order.items);

    // Update payment status
    order.paymentStatus = 'pending';
    order.paidAt = undefined;

    // Only reset order status if it is NOT cancelled
    if (order.status !== 'cancelled') {
      order.status = 'pending';
    }

    const updatedOrder = await order.save();

    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('items.menuItem', 'name description image rating likes')
      .populate('table', 'tableNumber');

    console.log(`✅ Order ${req.params.id} marked as unpaid${order.status === 'cancelled' ? ', status unchanged (cancelled)' : ' and status reset to pending'}`);

    res.json({
      message: order.status === 'cancelled'
        ? 'Order payment reverted but order remains cancelled'
        : 'Order marked as unpaid and status reset to pending',
      order: populatedOrder
    });

  } catch (error) {
    console.error('❌ Failed to mark order as unpaid:', error);
    res.status(500).json({ error: 'Failed to mark order as unpaid', details: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to reduce inventory when order is confirmed
async function reduceInventory(orderItems) {
  try {
    for (const item of orderItems) {
      const menuItem = await MenuItem.findById(item.menuItem);
      
      if (menuItem && menuItem.inventory.trackInventory) {
        const newStock = menuItem.inventory.currentStock - item.quantity;
        
        await MenuItem.findByIdAndUpdate(item.menuItem, {
          'inventory.currentStock': Math.max(0, newStock)
        });
        
        console.log(`📦 Reduced inventory for ${menuItem.name}: ${menuItem.inventory.currentStock} -> ${Math.max(0, newStock)}`);
      }
    }
  } catch (error) {
    console.error('❌ Error reducing inventory:', error);
    throw error;
  }
}

// Helper function to restore inventory when order is cancelled
async function restoreInventory(orderItems) {
  try {
    for (const item of orderItems) {
      const menuItem = await MenuItem.findById(item.menuItem);
      
      if (menuItem && menuItem.inventory.trackInventory) {
        const newStock = menuItem.inventory.currentStock + item.quantity;
        
        await MenuItem.findByIdAndUpdate(item.menuItem, {
          'inventory.currentStock': newStock
        });
        
        console.log(`📦 Restored inventory for ${menuItem.name}: ${menuItem.inventory.currentStock} -> ${newStock}`);
      }
    }
  } catch (error) {
    console.error('❌ Error restoring inventory:', error);
    throw error;
  }
}

// ============================================================================
// ADDITIONAL UTILITY ROUTES
// ============================================================================

// Database Info Route
app.get('/api/db-info', async (req, res) => {
  try {
    const [restaurants, users, categories, menuItems, tables] = await Promise.all([
      Restaurant.countDocuments(),
      User.countDocuments(),
      Category.countDocuments(),
      MenuItem.countDocuments(),
      Table.countDocuments()
    ]);

    const restaurantList = await Restaurant.find().select('name email logo');
    const userList = await User.find().select('name email restaurant').populate('restaurant', 'name');

    res.json({
      message: 'Database information',
      counts: {
        restaurants,
        users,
        categories,
        menuItems,
        tables
      },
      restaurants: restaurantList,
      users: userList.map(user => ({
        name: user.name,
        email: user.email,
        restaurant: user.restaurant?.name
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get database info', details: error.message });
  }
});

// Restaurant-specific data route
app.get('/api/restaurant-data/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const [restaurant, categories, menuItems, tables] = await Promise.all([
      Restaurant.findById(restaurantId),
      Category.find({ restaurant: restaurantId }).sort('sortOrder'),
      MenuItem.find({ restaurant: restaurantId })
        .populate('category', 'name')
        .sort('name'),
      Table.find({ restaurant: restaurantId }).sort('tableNumber')
    ]);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      message: 'Restaurant data retrieved successfully',
      restaurant,
      categories,
      menuItems,
      tables
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurant data', details: error.message });
  }
});

// User's restaurant data (protected)
app.get('/api/my-restaurant', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;

    const [restaurant, categories, menuItems, tables] = await Promise.all([
      Restaurant.findById(restaurantId),
      Category.find({ restaurant: restaurantId }).sort('sortOrder'),
      MenuItem.find({ restaurant: restaurantId })
        .populate('category', 'name')
        .sort('category name'),
      Table.find({ restaurant: restaurantId }).sort('tableNumber')
    ]);

    res.json({
      message: 'Restaurant data retrieved successfully',
      restaurant,
      categories,
      menuItems,
      tables
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurant data', details: error.message });
  }
});

// Protected route example
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

// ============================================================================
// PUBLIC CATEGORIES ENDPOINTS
// ============================================================================

// Get all unique categories for public restaurant directory
app.get('/api/public/categories', async (req, res) => {
  try {
    console.log('📁 Fetching unique categories for public directory');
    
    // Get all active categories
    const allCategories = await Category.find({ isActive: true })
      .select('name description isPredefined')
      .sort('name');

    // Use a Map to get unique category names (keeping the first occurrence)
    const uniqueCategoriesMap = new Map();
    
    allCategories.forEach(category => {
      if (!uniqueCategoriesMap.has(category.name)) {
        uniqueCategoriesMap.set(category.name, {
          id: category._id.toString(),
          name: category.name,
          description: category.description,
          isPredefined: category.isPredefined
        });
      }
    });

    const uniqueCategories = Array.from(uniqueCategoriesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`✅ Found ${uniqueCategories.length} unique categories from ${allCategories.length} total`);
    
    res.json({
      message: 'Unique categories retrieved successfully',
      categories: uniqueCategories
    });
  } catch (error) {
    console.error('❌ Failed to fetch unique categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

// Get restaurants by category name (public)
app.get('/api/public/restaurants/by-category/:categoryName', async (req, res) => {
  try {
    const { categoryName } = req.params;
    
    console.log(`🔍 Finding restaurants with category: ${categoryName}`);
    
    // Find all categories with this name
    const matchingCategories = await Category.find({ 
      name: categoryName,
      isActive: true 
    }).select('restaurant');

    const restaurantIds = matchingCategories.map(cat => cat.restaurant);
    
    // Get the restaurants
    const restaurants = await Restaurant.find({
      _id: { $in: restaurantIds },
      isActive: true
    }).select('-__v');

    console.log(`✅ Found ${restaurants.length} restaurants with category "${categoryName}"`);
    
    res.json({
      message: `Restaurants with category "${categoryName}" retrieved successfully`,
      restaurants
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurants by category:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants', details: error.message });
  }
});

// ============================================================================
// WAITER super ADMIN ROUTES
// ============================================================================
const { adminAuth } = require('./middleware/adminAuth');

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Admin login attempt:', email);

    // Find user
    const user = await User.findOne({ email }).populate('restaurant');
    if (!user) {
      console.log('❌ Admin login failed: User not found');
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if user is super_admin
    if (user.role !== 'super_admin') {
      console.log('❌ Admin login failed: Not a super admin, role is:', user.role);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Admin login failed: Invalid password');
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Admin login successful:', user.email);

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get all restaurants (admin view) - ENHANCED VERSION
app.get('/api/admin/restaurants', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } }
      ];
    }

    const restaurants = await Restaurant.find(query)
      .select('-__v')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Restaurant.countDocuments(query);

    // Get user counts and admin data for each restaurant
    const restaurantsWithStats = await Promise.all(
      restaurants.map(async (restaurant) => {
        const userCount = await User.countDocuments({ restaurant: restaurant._id });
        const menuItemCount = await MenuItem.countDocuments({ restaurant: restaurant._id });
        const orderCount = await Order.countDocuments({ restaurant: restaurant._id });
        
        // Get admin user for this restaurant
        const adminUser = await User.findOne({
          restaurant: restaurant._id,
          role: { $in: ['admin', 'restaurant_admin'] }
        }).select('name email');
        
        return {
          _id: restaurant._id,
          name: restaurant.name,
          description: restaurant.description,
          contact: {
            email: restaurant.contact?.email,
            phone: restaurant.contact?.phone
          },
          address: restaurant.address,
          logo: restaurant.logo,
          theme: restaurant.theme,
          isActive: restaurant.isActive,
          rating: restaurant.rating,
          userCount,
          menuItemCount,
          orderCount,
          adminUser: adminUser || null,
          createdAt: restaurant.createdAt,
          updatedAt: restaurant.updatedAt
        };
      })
    );

    res.json({
      message: 'Restaurants retrieved successfully',
      restaurants: restaurantsWithStats,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants', details: error.message });
  }
});

// Create new restaurant
app.post('/api/admin/restaurants', adminAuth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      email, 
      phone, 
      address,
      adminName,
      adminEmail,
      adminPassword 
    } = req.body;

    console.log('🏪 Creating new restaurant:', name);

    // Validate required fields
    if (!name || !email || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ 
        error: 'Name, email, admin name, admin email, and password are required' 
      });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({ error: 'Admin password must be at least 6 characters long' });
    }

    // Check if restaurant email already exists
    const existingRestaurant = await Restaurant.findOne({
      'contact.email': email
    });
    if (existingRestaurant) {
      return res.status(400).json({ error: 'Restaurant with this email already exists' });
    }

    // Check if admin email already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin email already exists' });
    }

    // Create restaurant
    const restaurant = new Restaurant({
      name,
      description,
      contact: {
        email,
        phone
      },
      address: address || {},
      isActive: true
    });

    const savedRestaurant = await restaurant.save();

    // Create admin user for this restaurant - use 'admin' role for consistency
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = new User({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin', // Use 'admin' instead of 'restaurant_admin' for consistency
      restaurant: savedRestaurant._id
    });

    await adminUser.save();

    console.log('✅ Restaurant and admin user created successfully');

    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurant: savedRestaurant,
      adminUser: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('❌ Failed to create restaurant:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create restaurant', details: error.message });
  }
});

// /api/admin/restaurants/:id route - COMPLETE FIXED VERSION
app.put('/api/admin/restaurants/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      email,        // Flat restaurant email
      phone,        // Flat restaurant phone  
      contact,      // OR nested contact object
      address,
      adminName,
      adminEmail, 
      adminPassword,
      changeCredentials = false 
    } = req.body;
    
    console.log('🔄 Updating restaurant:', id);
    console.log('📝 Raw request body received:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Parsing contact data - Flat email:', email, 'Flat phone:', phone);
    console.log('🔍 Parsing contact data - Nested contact:', contact);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }

    // Handle both flat and nested contact structures
    const restaurantEmail = email || contact?.email;
    const restaurantPhone = phone || contact?.phone;

    console.log('✅ Processed restaurant contact data:', { 
      restaurantEmail, 
      restaurantPhone 
    });

    // Build restaurant update object
    const restaurantUpdate = {
      name,
      description,
      ...(restaurantEmail && { 'contact.email': restaurantEmail }),
      ...(restaurantPhone !== undefined && { 'contact.phone': restaurantPhone }),
      ...(address && { address })
    };

    console.log('🏪 Final restaurant update object:', restaurantUpdate);

    // Update restaurant
    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      restaurantUpdate,
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let adminUpdate = null;
    let adminCredentialsUpdated = false;

    // Update admin credentials if requested and provided
    if (changeCredentials) {
      console.log('👤 Processing admin credential changes...');
      
      const adminUser = await User.findOne({
        restaurant: new mongoose.Types.ObjectId(id),
        role: { $in: ['admin', 'restaurant_admin'] }
      });

      console.log('🔍 Found admin user for update:', adminUser ? {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      } : 'No admin user found');

      if (adminUser) {
        const adminUpdateData = {};
        
        if (adminName && adminName !== adminUser.name) {
          adminUpdateData.name = adminName;
          console.log('📝 Admin name will be updated');
        }
        
        if (adminEmail && adminEmail !== adminUser.email) {
          adminUpdateData.email = adminEmail;
          console.log('📧 Admin email will be updated');
        }
        
        if (adminPassword && adminPassword.length > 0) {
          if (adminPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
          }
          const hashedPassword = await bcrypt.hash(adminPassword, 10);
          adminUpdateData.password = hashedPassword;
          console.log('🔐 Admin password will be updated');
        }

        // Only update if there are actual changes
        if (Object.keys(adminUpdateData).length > 0) {
          adminUpdate = await User.findByIdAndUpdate(
            adminUser._id,
            adminUpdateData,
            { new: true, runValidators: true }
          ).select('-password -__v');
          
          adminCredentialsUpdated = true;
          console.log('✅ Admin credentials updated successfully:', {
            name: adminUpdate.name,
            email: adminUpdate.email,
            passwordChanged: !!adminPassword
          });
        } else {
          console.log('ℹ️ No admin credential changes to apply');
        }
      } else {
        console.log('❌ Admin user not found for restaurant');
        return res.status(404).json({ 
          error: 'Admin user not found for this restaurant',
          details: 'Cannot update admin credentials without an existing admin user'
        });
      }
    }

    console.log('✅ Restaurant updated successfully:', {
      name: restaurant.name,
      email: restaurant.contact?.email,
      phone: restaurant.contact?.phone
    });

    // Build response
    const response = {
      message: 'Restaurant updated successfully',
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        description: restaurant.description,
        contact: {
          email: restaurant.contact?.email,
          phone: restaurant.contact?.phone
        },
        address: restaurant.address,
        isActive: restaurant.isActive,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt
      }
    };

    if (adminUpdate) {
      response.admin = adminUpdate;
      response.adminCredentialsUpdated = adminCredentialsUpdated;
    }

    console.log('📤 Sending final response:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Failed to update restaurant:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.join(', ') 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ 
      error: 'Failed to update restaurant', 
      details: error.message 
    });
  }
});

// Toggle restaurant availability
app.put('/api/admin/restaurants/:id/toggle-active', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();

    console.log(`✅ Restaurant ${restaurant.name} ${restaurant.isActive ? 'activated' : 'deactivated'}`);

    res.json({
      message: `Restaurant ${restaurant.isActive ? 'activated' : 'deactivated'} successfully`,
      restaurant
    });
  } catch (error) {
    console.error('❌ Failed to toggle restaurant status:', error);
    res.status(500).json({ error: 'Failed to toggle restaurant status', details: error.message });
  }
});

// Get restaurant admin user
app.get('/api/admin/restaurants/:id/admin', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }

    const adminUser = await User.findOne({
      restaurant: new mongoose.Types.ObjectId(id),
      role: { $in: ['admin', 'restaurant_admin'] }
    }).select('-password -__v');

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found for this restaurant' });
    }

    res.json({
      message: 'Admin user retrieved successfully',
      admin: adminUser
    });
  } catch (error) {
    console.error('❌ Failed to fetch admin user:', error);
    res.status(500).json({ error: 'Failed to fetch admin user', details: error.message });
  }
});

// Update restaurant admin credentials
app.put('/api/admin/restaurants/:id/admin', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }

    const adminUser = await User.findOne({
      restaurant: new mongoose.Types.ObjectId(id),
      role: { $in: ['admin', 'restaurant_admin'] }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found for this restaurant' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password && password.length > 0) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(
      adminUser._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -__v');

    res.json({
      message: 'Admin credentials updated successfully',
      admin: updatedUser
    });
  } catch (error) {
    console.error('❌ Failed to update admin credentials:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update admin credentials', details: error.message });
  }
});

//analytics endpoint 
app.get('/api/admin/restaurants/:id/analytics', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d', startDate, endDate } = req.query;
    
    console.log(`📊 Analytics requested for restaurant: ${id}, period: ${period}, custom range: ${startDate} to ${endDate}`);
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }
    
    // Check restaurant exists
    const restaurant = await Restaurant.findById(id).select('name logo').lean();
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Calculate date range - WITH CUSTOM DATE SUPPORT
    let startDateObj, endDateObj;
    
    if (period === 'custom' && startDate && endDate) {
      // Use custom dates if provided
      startDateObj = new Date(startDate);
      endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      startDateObj.setHours(0, 0, 0, 0); // Start of day
    } else {
      // Use predefined periods
      endDateObj = new Date();
      startDateObj = new Date();
      
      switch (period) {
        case 'today':
          startDateObj.setHours(0, 0, 0, 0);
          endDateObj.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          startDateObj.setDate(startDateObj.getDate() - 1);
          startDateObj.setHours(0, 0, 0, 0);
          endDateObj.setDate(endDateObj.getDate() - 1);
          endDateObj.setHours(23, 59, 59, 999);
          break;
        case '7d':
          startDateObj.setDate(endDateObj.getDate() - 7);
          startDateObj.setHours(0, 0, 0, 0);
          break;
        case '30d':
          startDateObj.setDate(endDateObj.getDate() - 30);
          startDateObj.setHours(0, 0, 0, 0);
          break;
        case '90d':
          startDateObj.setDate(endDateObj.getDate() - 90);
          startDateObj.setHours(0, 0, 0, 0);
          break;
        case '1y':
          startDateObj.setFullYear(endDateObj.getFullYear() - 1);
          startDateObj.setHours(0, 0, 0, 0);
          break;
        default:
          startDateObj.setDate(endDateObj.getDate() - 30);
          startDateObj.setHours(0, 0, 0, 0);
      }
    }
    
    console.log(`📅 Date range: ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);
    
    // 1. Total orders
    const totalOrders = await Order.countDocuments({
      restaurant: id,
      createdAt: { $gte: startDateObj, $lte: endDateObj }
    });
    
    // 2. Total revenue (only paid orders)
    const revenueAgg = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(id),
          paymentStatus: 'paid',
          createdAt: { $gte: startDateObj, $lte: endDateObj }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          average: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    const totalRevenue = revenueAgg[0]?.total || 0;
    const averageOrderValue = revenueAgg[0]?.average || 0;
    
    // 3. Active users (based on unique customer names/phones)
    const activeUsers = await Order.distinct('customerName', {
      restaurant: id,
      createdAt: { $gte: startDateObj, $lte: endDateObj },
      customerName: { $ne: '', $exists: true }
    }).then(customers => customers.length);
    
    // 4. Menu items count
    const menuItems = await MenuItem.countDocuments({ restaurant: id, isActive: true });
    
    // 5. Orders by status
    const ordersByStatusAgg = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(id),
          createdAt: { $gte: startDateObj, $lte: endDateObj }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const ordersByStatus = ordersByStatusAgg.map(item => ({
      status: item._id,
      count: item.count,
      revenue: item.revenue || 0
    }));
    
    // 6. Recent orders (last 5)
    const recentOrders = await Order.find({
      restaurant: id,
      createdAt: { $gte: startDateObj, $lte: endDateObj }
    })
      .populate('items.menuItem', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    const formattedRecentOrders = recentOrders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'Guest',
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderType: order.orderType,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        menuItem: {
          _id: item.menuItem?._id || item.menuItem,
          name: item.menuItem?.name || 'Unknown Item'
        },
        quantity: item.quantity,
        price: item.price
      }))
    }));
    
    // 7. Revenue by day for charts - Generate real data based on the date range
    const revenueByDay = [];
    const currentDate = new Date(startDateObj);
    const endDateCopy = new Date(endDateObj);
    
    while (currentDate <= endDateCopy) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Get actual revenue for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayRevenueAgg = await Order.aggregate([
        {
          $match: {
            restaurant: new mongoose.Types.ObjectId(id),
            paymentStatus: 'paid',
            createdAt: { $gte: dayStart, $lte: dayEnd }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        }
      ]);
      
      revenueByDay.push({
        day: dayName,
        date: dateStr,
        revenue: dayRevenueAgg[0]?.revenue || 0,
        orders: dayRevenueAgg[0]?.orders || 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 8. Top menu items (real data from orders)
    const topMenuItemsAgg = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(id),
          createdAt: { $gte: startDateObj, $lte: endDateObj }
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.menuItem',
          foreignField: '_id',
          as: 'menuItemInfo'
        }
      },
      { $unwind: { path: '$menuItemInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$items.menuItem',
          name: { $first: '$menuItemInfo.name' },
          category: { $first: '$menuItemInfo.category' },
          salesCount: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);
    
    const topMenuItems = topMenuItemsAgg.map(item => ({
      name: item.name || 'Unknown Item',
      salesCount: item.salesCount,
      revenue: item.revenue,
      category: item.category || 'Uncategorized'
    }));
    
    // If no top items from aggregation, use sample data
    if (topMenuItems.length === 0) {
      const sampleItems = ['Cheeseburger', 'French Fries', 'Chicken Wings', 'Caesar Salad', 'Pizza'];
      topMenuItems.push(...sampleItems.map((name, index) => ({
        name,
        salesCount: Math.floor(totalOrders / 5 * (0.5 + Math.random() * 0.5)),
        revenue: Math.floor(totalRevenue / 5 * (0.5 + Math.random() * 0.5)),
        category: ['Main Course', 'Side', 'Main Course', 'Salad', 'Main Course'][index]
      })));
    }
    
    // 9. User metrics
    const customerMetrics = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(id),
          createdAt: { $gte: startDateObj, $lte: endDateObj },
          customerName: { $ne: '', $exists: true }
        }
      },
      {
        $group: {
          _id: '$customerName',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' }
        }
      }
    ]);
    
    const totalCustomers = customerMetrics.length;
    const averageVisits = totalCustomers > 0 
      ? (customerMetrics.reduce((sum, cust) => sum + cust.orderCount, 0) / totalCustomers).toFixed(1)
      : 0;
    
    // Determine new vs returning customers
    const newCustomers = customerMetrics.filter(cust => {
      const firstOrderDate = new Date(cust.firstOrder);
      return firstOrderDate >= startDateObj && firstOrderDate <= endDateObj;
    }).length;
    
    const returningCustomers = totalCustomers - newCustomers;
    const retentionRate = totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0;
    
    // Build response
    const analytics = {
      overview: {
        totalOrders,
        totalRevenue,
        activeUsers,
        menuItems,
        averageOrderValue,
        revenueChange: totalOrders > 0 ? 12.5 : 0,
        orderChange: totalOrders > 0 ? 8.3 : 0,
        userChange: activeUsers > 0 ? 15.2 : 0
      },
      ordersByStatus,
      topMenuItems,
      revenueByDay,
      recentOrders: formattedRecentOrders,
      period: {
        start: startDateObj.toISOString(),
        end: endDateObj.toISOString(),
        label: period === 'custom' ? 'Custom Range' : 
               period === 'today' ? 'Today' :
               period === 'yesterday' ? 'Yesterday' :
               period === '7d' ? 'Last 7 Days' :
               period === '30d' ? 'Last 30 Days' :
               period === '90d' ? 'Last 90 Days' :
               period === '1y' ? 'Last Year' : period
      },
      userMetrics: {
        totalCustomers,
        newCustomers,
        returningCustomers,
        retentionRate,
        averageVisits: parseFloat(averageVisits) || 0
      }
    };
    
    console.log(`✅ Analytics generated successfully for ${restaurant.name}`);
    console.log(`   Orders: ${totalOrders}, Revenue: ${totalRevenue}, Customers: ${activeUsers}`);
    
    res.json({
      message: 'Analytics retrieved successfully',
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        logo: restaurant.logo
      },
      analytics
    });
    
  } catch (error) {
    console.error('❌ Analytics endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

// Get system-wide analytics
app.get('/api/admin/analytics/overview', adminAuth, async (req, res) => {
  try {
    const { period = '30d', restaurantId } = req.query;
    
    // Calculate date ranges
    const now = new Date();
    const currentPeriodStart = new Date();
    const previousPeriodStart = new Date();
    const allTimeStart = new Date('2020-01-01'); // System start date
    
    switch (period) {
      case '7d':
        currentPeriodStart.setDate(now.getDate() - 7);
        previousPeriodStart.setDate(now.getDate() - 14);
        break;
      case '30d':
        currentPeriodStart.setDate(now.getDate() - 30);
        previousPeriodStart.setDate(now.getDate() - 60);
        break;
      case '90d':
        currentPeriodStart.setDate(now.getDate() - 90);
        previousPeriodStart.setDate(now.getDate() - 180);
        break;
      default:
        currentPeriodStart.setDate(now.getDate() - 30);
        previousPeriodStart.setDate(now.getDate() - 60);
    }

    // Build base query
    const baseMatch = {};
    if (restaurantId && restaurantId !== 'all') {
      baseMatch.restaurant = new mongoose.Types.ObjectId(restaurantId);
    }

    // ✅ GET ALL METRICS
    const [
      // 1. Restaurant Metrics
      totalRestaurantsCurrent,
      activeRestaurantsCurrent,
      
      // 2. User Metrics by Role
      superAdminCount,
      adminCount,
      staffCount,
      
      // 3. Customer Metrics
      allCustomersResult,           // All unique customers ever
      currentPeriodCustomersResult, // Customers in current period
      previousPeriodCustomersResult, // Customers in previous period
      
      // 4. New vs Returning Customers Analysis
      newCustomersResult,           // First-time customers in current period
      returningCustomersResult,     // Returning customers in current period
      
      // 5. Order Metrics
      totalOrdersCurrent,
      revenueResultCurrent,
      
      // 6. Previous period for percentages
      totalRestaurantsPrevious,
      activeRestaurantsPrevious,
      totalOrdersPrevious,
      revenueResultPrevious,
      
      // 7. Monthly data for charts
      monthlyRevenueResult,
      monthlyCustomerGrowthResult,
      monthlyActiveCustomersResult
    ] = await Promise.all([
      // CURRENT PERIOD
      // 1. Restaurants
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ isActive: true }),
      
      // 2. Users by Role
      User.countDocuments({ role: 'super_admin' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'staff' }),
      
      // 3. Customer Metrics - ALL TIME
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: '$customerName',
            firstOrder: { $min: '$createdAt' },
            lastOrder: { $max: '$createdAt' },
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$totalAmount' }
          }
        },
        {
          $count: 'count'
        }
      ]),
      
      // Customers in CURRENT PERIOD
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: currentPeriodStart },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: '$customerName'
          }
        },
        {
          $count: 'count'
        }
      ]),
      
      // Customers in PREVIOUS PERIOD
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { 
              $gte: previousPeriodStart,
              $lt: currentPeriodStart 
            },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: '$customerName'
          }
        },
        {
          $count: 'count'
        }
      ]),
      
      // 4. NEW CUSTOMERS (first-time in current period)
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: currentPeriodStart },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: '$customerName',
            firstOrderInPeriod: { $min: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'orders',
            let: { customerName: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$customerName', '$$customerName'] },
                      { $lt: ['$createdAt', currentPeriodStart] }
                    ]
                  }
                }
              }
            ],
            as: 'previousOrders'
          }
        },
        {
          $match: {
            previousOrders: { $size: 0 } // No orders before current period = NEW customer
          }
        },
        {
          $count: 'count'
        }
      ]),
      
      // RETURNING CUSTOMERS (had orders before current period)
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: currentPeriodStart },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: '$customerName'
          }
        },
        {
          $lookup: {
            from: 'orders',
            let: { customerName: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$customerName', '$$customerName'] },
                      { $lt: ['$createdAt', currentPeriodStart] }
                    ]
                  }
                }
              }
            ],
            as: 'previousOrders'
          }
        },
        {
          $match: {
            previousOrders: { $gt: [{ $size: '$previousOrders' }, 0] } // Had orders before = RETURNING
          }
        },
        {
          $count: 'count'
        }
      ]),
      
      // 5. Order Metrics
      Order.countDocuments({ 
        ...baseMatch,
        createdAt: { $gte: currentPeriodStart } 
      }),
      
      Order.aggregate([
        { 
          $match: { 
            ...baseMatch,
            paymentStatus: 'paid',
            createdAt: { $gte: currentPeriodStart }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      
      // PREVIOUS PERIOD
      Restaurant.countDocuments({ createdAt: { $lt: currentPeriodStart } }),
      Restaurant.countDocuments({ 
        isActive: true,
        createdAt: { $lt: currentPeriodStart } 
      }),
      Order.countDocuments({ 
        ...baseMatch,
        createdAt: { 
          $gte: previousPeriodStart,
          $lt: currentPeriodStart 
        }
      }),
      Order.aggregate([
        { 
          $match: { 
            ...baseMatch,
            paymentStatus: 'paid',
            createdAt: { 
              $gte: previousPeriodStart,
              $lt: currentPeriodStart 
            }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      
      // 7. Monthly data for charts
      // Monthly Revenue
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            paymentStatus: 'paid',
            createdAt: { $gte: currentPeriodStart }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 6 }
      ]),
      
      // Monthly Customer Growth (New + Returning)
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: currentPeriodStart },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              customerName: '$customerName'
            }
          }
        },
        {
          $group: {
            _id: {
              year: '$_id.year',
              month: '$_id.month'
            },
            totalCustomers: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 6 }
      ]),
      
      // Monthly Active Customers
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: currentPeriodStart },
            customerName: { $ne: '', $ne: null }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            activeCustomers: { $addToSet: '$customerName' }
          }
        },
        {
          $project: {
            activeCustomers: { $size: '$activeCustomers' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 6 }
      ])
    ]);

    // ✅ CALCULATE TOTALS
    const allCustomers = allCustomersResult[0]?.count || 0;
    const currentPeriodCustomers = currentPeriodCustomersResult[0]?.count || 0;
    const previousPeriodCustomers = previousPeriodCustomersResult[0]?.count || 0;
    
    const newCustomers = newCustomersResult[0]?.count || 0;
    const returningCustomers = returningCustomersResult[0]?.count || 0;
    
    // Total Users = Customers + Restaurant Staff (admin + staff + super_admin)
    const restaurantStaff = adminCount + staffCount + superAdminCount;
    const totalUsersCurrent = allCustomers + restaurantStaff;
    const totalUsersPrevious = (allCustomers - currentPeriodCustomers) + restaurantStaff;
    
    const totalRevenueCurrent = revenueResultCurrent[0]?.total || 0;
    const totalRevenuePrevious = revenueResultPrevious[0]?.total || 0;
    
    // ✅ CALCULATE PERCENTAGE CHANGES
    const calculatePercentage = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const userPercentageChange = calculatePercentage(totalUsersCurrent, totalUsersPrevious);
    const revenuePercentageChange = calculatePercentage(totalRevenueCurrent, totalRevenuePrevious);
    
    const activeRate = activeRestaurantsCurrent > 0 
      ? (activeRestaurantsCurrent / totalRestaurantsCurrent) * 100 
      : 0;
    
    const previousActiveRate = activeRestaurantsPrevious > 0 && totalRestaurantsPrevious > 0
      ? (activeRestaurantsPrevious / totalRestaurantsPrevious) * 100
      : 0;
    
    const activeRatePercentageChange = calculatePercentage(activeRate, previousActiveRate);

    // Format monthly data
    const monthlyRevenue = monthlyRevenueResult.map(item => ({
      month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      amount: item.total,
      orders: item.count
    }));

    const monthlyCustomerGrowth = monthlyCustomerGrowthResult.map(item => ({
      month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      totalCustomers: item.totalCustomers
    }));

    const monthlyActiveCustomers = monthlyActiveCustomersResult.map(item => ({
      month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      activeCustomers: item.activeCustomers
    }));

    // Get all restaurants for filter dropdown
    const allRestaurants = await Restaurant.find({})
      .select('_id name')
      .sort({ name: 1 });

    res.json({
      message: 'System analytics retrieved successfully',
      analytics: {
        // Basic metrics
        totalRestaurants: totalRestaurantsCurrent,
        activeRestaurants: activeRestaurantsCurrent,
        inactiveRestaurants: totalRestaurantsCurrent - activeRestaurantsCurrent,
        
        // User breakdown - COMPLETE
        totalUsers: totalUsersCurrent,
        userBreakdown: {
          allCustomers: allCustomers,                 // All unique customers ever
          currentCustomers: currentPeriodCustomers,   // Customers in current period
          newCustomers: newCustomers,                 // First-time customers in current period
          returningCustomers: returningCustomers,     // Returning customers in current period
          admins: adminCount,
          staff: staffCount,
          superAdmins: superAdminCount
        },
        
        // Customer metrics
        customerRetentionRate: currentPeriodCustomers > 0 
          ? (returningCustomers / currentPeriodCustomers) * 100 
          : 0,
        
        // Order metrics
        totalOrders: totalOrdersCurrent,
        totalRevenue: totalRevenueCurrent,
        
        // Percentage changes
        percentageChanges: {
          users: parseFloat(userPercentageChange.toFixed(1)),
          revenue: parseFloat(revenuePercentageChange.toFixed(1)),
          activeRate: parseFloat(activeRatePercentageChange.toFixed(1)),
          customers: parseFloat(calculatePercentage(currentPeriodCustomers, previousPeriodCustomers).toFixed(1))
        },
        
        // Chart data - REAL DATA
        monthlyRevenue: monthlyRevenue,
        userGrowth: monthlyCustomerGrowth,
        activeUsers: monthlyActiveCustomers,
        
        // Period info
        period: {
          start: currentPeriodStart,
          end: now,
          label: period
        },
        
        // Filter info
        filter: {
          restaurantId: restaurantId || 'all',
          restaurantName: restaurantId && restaurantId !== 'all' 
            ? allRestaurants.find(r => r._id.toString() === restaurantId)?.name 
            : 'All Restaurants'
        },
        
        // Available restaurants for filter
        availableRestaurants: allRestaurants.map(r => ({
          id: r._id,
          name: r.name
        }))
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch system analytics:', error);
    res.status(500).json({ error: 'Failed to fetch system analytics', details: error.message });
  }
});

// Get detailed user statistics
app.get('/api/admin/analytics/users', adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - (period === '7d' ? 7 : 30));

    // Get restaurant staff by role
    const staffByRole = await User.aggregate([
      {
        $match: {
          role: { $in: ['admin', 'staff'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          restaurants: { $addToSet: '$restaurant' }
        }
      }
    ]);

    // Get top customers
    const topCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          customerName: { $ne: '', $ne: null },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: '$customerName',
          orders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Customer frequency distribution
    const customerFrequency = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          customerName: { $ne: '', $ne: null }
        }
      },
      {
        $group: {
          _id: '$customerName',
          orders: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$orders', 1] }, then: 'One-time' },
                { case: { $lte: ['$orders', 3] }, then: 'Occasional (2-3)' },
                { case: { $lte: ['$orders', 10] }, then: 'Regular (4-10)' },
                { case: { $gt: ['$orders', 10] }, then: 'Frequent (10+)' }
              ],
              default: 'One-time'
            }
          },
          customers: { $sum: 1 },
          totalOrders: { $sum: '$orders' }
        }
      }
    ]);

    // Format staff by role
    const formattedStaff = {};
    staffByRole.forEach(item => {
      formattedStaff[item._id] = {
        count: item.count,
        restaurants: item.restaurants.length
      };
    });

    res.json({
      message: 'User analytics retrieved successfully',
      analytics: {
        period: { start: startDate, end: now, label: period },
        
        // Staff breakdown
        staff: {
          total: (formattedStaff.admin?.count || 0) + (formattedStaff.staff?.count || 0),
          byRole: formattedStaff
        },
        
        // Customer analytics
        customers: {
          topCustomers: topCustomers.map(customer => ({
            name: customer._id,
            orders: customer.orders,
            totalSpent: customer.totalSpent,
            avgOrderValue: customer.avgOrderValue,
            firstOrder: customer.firstOrder,
            lastOrder: customer.lastOrder
          })),
          frequencyDistribution: customerFrequency
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics', details: error.message });
  }
});

// Admin profile endpoints
app.get('/api/admin/profile', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -__v');
    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    res.json({
      message: 'Admin profile retrieved successfully',
      admin: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Failed to fetch admin profile:', error);
    res.status(500).json({ error: 'Failed to fetch admin profile', details: error.message });
  }
});

app.put('/api/admin/profile', adminAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name, email },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    res.json({
      message: 'Admin profile updated successfully',
      admin: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Failed to update admin profile:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to update admin profile', details: error.message });
  }
});

app.put('/api/admin/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Valid current and new password (min 6 chars) required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Failed to change admin password:', error);
    res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});
// ============================================================================
// PUBLIC RESTAURANT ENDPOINTS (for customer-facing app)
// ============================================================================

// Get specific restaurant with public info
app.get('/api/public/restaurants/:id', async (req, res) => {
  try {
    console.log('🚀 GET /api/public/restaurants/' + req.params.id);
    
    let restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Convert to plain object
    let restaurantData = restaurant.toObject ? restaurant.toObject() : restaurant;
    
    // Ensure rating exists in the response
    if (!restaurantData.rating) {
      console.log('⚠️ RATING MISSING - Adding default rating structure');
      restaurantData.rating = {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
      
      // Also update the database
      console.log('💾 Updating database with rating field...');
      await Restaurant.findByIdAndUpdate(req.params.id, {
        $set: { rating: restaurantData.rating }
      });
      console.log('✅ Database updated');
    }

    res.json({ 
      message: 'Restaurant retrieved successfully',
      restaurant: restaurantData
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// Get restaurant menu items (public)
app.get('/api/public/restaurants/:id/menu', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    console.log(`📋 Fetching public menu for restaurant: ${restaurantId}`);
    
    // Verify restaurant exists and is active
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or not available' });
    }

    // Get available menu items with new fields
    const menuItems = await MenuItem.find({ 
      restaurant: restaurantId,
      isAvailable: true 
    })
    .populate('category', 'name _id')
    .select('name description price image ingredients preparationTime isVegetarian isVegan isGlutenFree spiceLevel category isAvailable rating nutrition likes takeaway popularity viewCount')
    .sort('category name');

    console.log(`✅ Found ${menuItems.length} available menu items`);
    
    // Convert to objects to include virtual fields and add calculated fields
    const menuItemsWithVirtuals = menuItems.map(item => {
      const itemObj = item.toObject({ virtuals: true });
      
      // Ensure takeaway structure exists and add calculated fields
      if (!itemObj.takeaway) {
        itemObj.takeaway = {
          isTakeawayAvailable: false,
          takeawayPrice: itemObj.price,
          packagingFee: 0,
          takeawayOrdersCount: 0
        };
      }
      
      // Calculate total takeaway price (item price + packaging fee)
      itemObj.totalTakeawayPrice = itemObj.takeaway.takeawayPrice + itemObj.takeaway.packagingFee;
      
      // Add a convenience field for frontend
      itemObj.isTakeawayAvailable = itemObj.takeaway.isTakeawayAvailable;
      
      console.log(`🍱 ${itemObj.name}: Regular $${itemObj.price}, Takeaway $${itemObj.totalTakeawayPrice} (Available: ${itemObj.isTakeawayAvailable})`);
      
      return itemObj;
    });

    res.json({
      message: 'Menu items retrieved successfully',
      menuItems: menuItemsWithVirtuals,
      restaurant: {
        name: restaurant.name,
        id: restaurant._id
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurant menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

// Get restaurant categories (public)
app.get('/api/public/restaurants/:id/categories', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    console.log(`📁 Fetching public categories for restaurant: ${restaurantId}`);
    
    // Verify restaurant exists and is active
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or not available' });
    }

    const categories = await Category.find({ 
      restaurant: restaurantId,
      isActive: true 
    })
    .select('name description _id')
    .sort('sortOrder name');

    console.log(`✅ Found ${categories.length} categories for restaurant`);
    
    res.json({
      message: 'Categories retrieved successfully',
      categories
    });
  } catch (error) {
    console.error('❌ Failed to fetch restaurant categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

// ============================================================================
// API ROUTES LISTING
// ============================================================================

// List all available routes
app.get('/api', (req, res) => {
  const routes = [
    { method: 'GET', path: '/api', description: 'List all routes' },
    { method: 'GET', path: '/api/test', description: 'Test backend' },
    { method: 'GET', path: '/api/test-db', description: 'Test database connection' },
    { method: 'GET', path: '/api/db-info', description: 'Get database information' },
    { method: 'GET', path: '/api/sse-debug', description: 'Get SSE connection status' },
    
    // Restaurant settings routes
    { method: 'GET', path: '/api/restaurants/current', description: 'Get current restaurant (protected)' },
    { method: 'PUT', path: '/api/restaurants/current', description: 'Update current restaurant (protected)' },
    { method: 'PUT', path: '/api/restaurants/current/logo', description: 'Update restaurant logo (protected)' },
    
    // User profile routes
    { method: 'GET', path: '/api/users/current', description: 'Get current user profile (protected)' },
    { method: 'PUT', path: '/api/users/current', description: 'Update current user profile (protected)' },
    
    // Restaurant routes
    { method: 'GET', path: '/api/restaurants', description: 'Get all restaurants' },
    { method: 'GET', path: '/api/restaurants/:id', description: 'Get specific restaurant' },
    { method: 'GET', path: '/api/restaurant-data/:restaurantId', description: 'Get complete restaurant data' },
    
    // Menu routes (protected)
    { method: 'GET', path: '/api/menu-items', description: 'Get menu items for logged-in restaurant (protected)' },
    { method: 'POST', path: '/api/menu-items', description: 'Create menu item (protected)' },
    { method: 'PUT', path: '/api/menu-items/:id', description: 'Update menu item (protected)' },
    { method: 'DELETE', path: '/api/menu-items/:id', description: 'Delete menu item (protected)' },
    
    // Category routes (protected)
    { method: 'GET', path: '/api/categories', description: 'Get categories for logged-in restaurant (protected)' },
    { method: 'POST', path: '/api/categories', description: 'Create category (protected)' },
    { method: 'DELETE', path: '/api/categories/:id', description: 'Delete category (protected)' },
    
    // Table routes
    { method: 'GET', path: '/api/tables', description: 'Get tables (optional: restaurantId)' },
    { method: 'POST', path: '/api/tables', description: 'Create table' },
    
    // Order routes
    { method: 'GET', path: '/api/orders', description: 'Get orders for logged-in restaurant (protected)' },
    { method: 'GET', path: '/api/orders/:id', description: 'Get specific order (protected)' },
    { method: 'POST', path: '/api/orders', description: 'Create new order' },
    { method: 'PUT', path: '/api/orders/:id/status', description: 'Update order status (protected)' },
    { method: 'PUT', path: '/api/orders/:id/pay', description: 'Mark order as paid (protected)' },
    { method: 'PUT', path: '/api/orders/:id/unpay', description: 'Mark order as unpaid (protected)' },
    { method: 'GET', path: '/api/orders/stream/:restaurantId', description: 'SSE stream for real-time order updates' },
    
    // Auth routes
    { method: 'GET', path: '/api/auth', description: 'Auth base route' },
    { method: 'POST', path: '/api/auth/login', description: 'User login' },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user (protected)' },
    
    // Protected routes
    { method: 'GET', path: '/api/protected-test', description: 'Test protected route' },
    { method: 'GET', path: '/api/my-restaurant', description: 'Get current user restaurant data (protected)' },
    
    // Public routes
    { method: 'GET', path: '/api/public/categories', description: 'Get unique categories for directory' },
    { method: 'GET', path: '/api/public/restaurants/by-category/:categoryName', description: 'Get restaurants by category' },
    { method: 'GET', path: '/api/public/restaurants/:id', description: 'Get public restaurant info' },
    { method: 'GET', path: '/api/public/restaurants/:id/menu', description: 'Get public restaurant menu with engagement' },
    { method: 'GET', path: '/api/public/restaurants/:id/categories', description: 'Get public restaurant categories' }
  ];
  
  res.json({ 
    message: 'Available API routes',
    routes 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET === 'your-fallback-secret-key-change-in-production' ? 'Using fallback - set JWT_SECRET in .env' : 'Using environment variable'}`);
  console.log(`🌐 API available at: http://localhost:${PORT}/api`);
  console.log(`🔔 SSE available at: http://localhost:${PORT}/api/orders/stream/:restaurantId`);
  console.log(`☁️  Cloudinary configured for image hosting!`);
  console.log(`📸 Menu item images stored in: menu-items/ folder`);
  console.log(`🖼️ Restaurant logos stored in: restaurant-logos/ folder`);
});