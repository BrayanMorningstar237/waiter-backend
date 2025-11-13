const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./config/cloudinary');
require('dotenv').config();

const app = express();

// Import models
const Order = require('./models/Order');
const Restaurant = require('./models/Restaurant');
const User = require('./models/user');
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

    // Generate order number
    const generateOrderNumber = () => {
      const date = new Date();
      const timestamp = date.getTime();
      const random = Math.floor(Math.random() * 1000);
      return `ORD-${timestamp}-${random}`;
    };

    const orderNumber = generateOrderNumber();
    console.log('🔢 Generated order number:', orderNumber);

    // Create order
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