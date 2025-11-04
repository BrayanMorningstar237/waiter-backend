const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const multer = require('multer');
const Order = require('./models/Order');
const Restaurant = require('./models/Restaurant');
const User = require('./models/user');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

// Configure multer for menu item images
const menuItemStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/public/images/menu-items'));
  },
  filename: function (req, file, cb) {
    const now = new Date();
    const dateTime = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    
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
    
    const uniqueFilename = `${restaurantName}-${menuItemName}-${dateTime}${path.extname(file.originalname)}`;
    
    console.log(`📸 Saving image as: ${uniqueFilename}`);
    cb(null, uniqueFilename);
  }
});

// Configure multer for restaurant logos
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/public/images/restaurant-logos'));
  },
  filename: function (req, file, cb) {
    const now = new Date();
    const dateTime = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    let restaurantName = 'restaurant';
    if (req.user && req.user.restaurant && req.user.restaurant.name) {
      restaurantName = req.user.restaurant.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
    
    const uniqueFilename = `logo-${restaurantName}-${dateTime}${path.extname(file.originalname)}`;
    
    console.log(`🖼️ Saving logo as: ${uniqueFilename}`);
    cb(null, uniqueFilename);
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

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from frontend public folder
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));

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
    console.log('📸 Logo file:', req.file.filename);

    const logoPath = `/images/restaurant-logos/${req.file.filename}`;
    
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.user.restaurant._id,
      { logo: logoPath },
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

app.get('/api/menu-items', auth, async (req, res) => {
  try {
    const { categoryId } = req.query;
    const restaurantId = req.user.restaurant._id;
    
    console.log(`🔐 Fetching menu items for: ${req.user.restaurant.name} (${restaurantId})`);
    
    let query = { restaurant: restaurantId };
    
    if (categoryId) query.category = categoryId;

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
      // Handle new fields
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
      updateData.image = `/images/menu-items/${req.file.filename}`;
      console.log('📸 New image saved:', req.file.filename);
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
      // Handle new fields
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
      menuItemData.image = `/images/menu-items/${req.file.filename}`;
      console.log('📸 Image saved:', req.file.filename);
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
// UPDATED MENU ITEM ENGAGEMENT ROUTES WITH SESSION TRACKING
// ============================================================================

// Rate/Update/Remove rating (public)
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
// ORDERS ROUTES
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

// ============================================================================
// RESTAURANT RATING ENDPOINTS
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
// Create new order with table support
app.post('/api/orders', async (req, res) => {
  try {
    const { restaurant, customerName, table, items, totalAmount, orderType } = req.body;

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

    // MANUALLY GENERATE ORDER NUMBER
    const generateOrderNumber = () => {
      const date = new Date();
      const timestamp = date.getTime();
      const random = Math.floor(Math.random() * 1000);
      return `ORD-${timestamp}-${random}`;
    };

    const orderNumber = generateOrderNumber();
    console.log('🔢 Generated order number:', orderNumber);

    // Create order with manually generated orderNumber
    const order = new Order({
      orderNumber: orderNumber,
      restaurant,
      customerName: customerName.trim(),
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
      paymentStatus: 'pending'
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

    // Populate the order with all details including table
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('items.menuItem', 'name description image price category ingredients rating likes nutrition')
      .populate('restaurant', 'name contact address')
      .populate('table', 'tableNumber capacity status');

    console.log(`✅ New order created: ${populatedOrder.orderNumber} for ${customerName}`);
    if (table) {
      console.log(`🪑 Table: ${populatedOrder.table?.tableNumber}`);
    }
    console.log(`📊 Order details: ${populatedOrder.items.length} items, Total: ${totalAmount} CFA`);
    
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

// Update order status
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
    
    res.json({
      message: 'Order status updated successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// MARK ORDER AS PAID
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

    console.log('📦 Restaurant from database:');
    console.log('  - Name:', restaurant.name);
    console.log('  - Direct rating access:', restaurant.rating);
    
    // Convert to plain object
    let restaurantData = restaurant.toObject ? restaurant.toObject() : restaurant;
    
    console.log('🔍 Checking rating in plain object:', restaurantData.rating);
    console.log('📋 All keys in restaurant:', Object.keys(restaurantData));

    // CRITICAL FIX: Ensure rating exists in the response
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

    console.log('🎯 Final restaurant data being sent:', {
      name: restaurantData.name,
      rating: restaurantData.rating
    });

    res.json({ 
      message: 'Restaurant retrieved successfully',
      restaurant: restaurantData
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// Get restaurant menu items (public) - UPDATED with new fields
// Get restaurant menu items (public) - UPDATED with virtual fields
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
      // This ensures frontend always has the correct total
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
    { method: 'GET', path: '/api/menu-items/:id', description: 'Get specific menu item' },
    { method: 'POST', path: '/api/menu-items', description: 'Create menu item (protected)' },
    { method: 'PUT', path: '/api/menu-items/:id', description: 'Update menu item (protected)' },
    { method: 'DELETE', path: '/api/menu-items/:id', description: 'Delete menu item (protected)' },
    
    // UPDATED Menu engagement routes (public)
    { method: 'POST', path: '/api/public/menu-items/:id/rate', description: 'Rate/Update/Remove rating for menu item' },
    { method: 'GET', path: '/api/public/menu-items/:id/user-rating', description: 'Get user rating for menu item' },
    { method: 'POST', path: '/api/public/menu-items/:id/like', description: 'Like/Unlike menu item' },
    { method: 'GET', path: '/api/public/menu-items/:id/user-like', description: 'Check if user liked menu item' },
    { method: 'POST', path: '/api/public/menu-items/:id/view', description: 'Increment view count with session tracking' },
    { method: 'GET', path: '/api/public/menu-items/:id/engagement', description: 'Get menu item with user engagement status' },
    { method: 'GET', path: '/api/public/restaurants/:id/popular-items', description: 'Get popular menu items' },
    
    // Category routes (protected)
    { method: 'GET', path: '/api/categories', description: 'Get categories for logged-in restaurant (protected)' },
    { method: 'POST', path: '/api/categories', description: 'Create category (protected)' },
    { method: 'DELETE', path: '/api/categories/:id', description: 'Delete category (protected)' },
    
    // Table routes
    { method: 'GET', path: '/api/tables', description: 'Get tables (optional: restaurantId)' },
    
    // Order routes
    { method: 'GET', path: '/api/orders', description: 'Get orders for logged-in restaurant (protected)' },
    { method: 'GET', path: '/api/orders/:id', description: 'Get specific order (protected)' },
    { method: 'PUT', path: '/api/orders/:id/status', description: 'Update order status (protected)' },
    { method: 'PUT', path: '/api/orders/:id/pay', description: 'Mark order as paid (protected)' },
    { method: 'PUT', path: '/api/orders/:id/unpay', description: 'Mark order as unpaid (protected)' },
    
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
  console.log(`🖼️ Static images served from: http://localhost:${PORT}/images`);
  console.log(`📸 Menu item images: restaurantName-itemName-YYYY-MM-DDTHH-MM-SS.ext`);
  console.log(`🖼️ Restaurant logos: logo-restaurantName-YYYY-MM-DDTHH-MM-SS.ext`);
  console.log(`⭐ UPDATED: Enhanced engagement system with session tracking!`);
  console.log(`⭐ Features: User ratings (set/update/remove), Likes, Views with session tracking`);
});