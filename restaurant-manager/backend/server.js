const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const multer = require('multer');


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/public/images/menu-items'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'menu-item-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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

// Routes
app.use('/api/auth', require('./routes/auth'));

// Import models for API routes
const Restaurant = require('./models/Restaurant');
const User = require('./models/user');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

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

// Restaurant Routes
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

// Menu Items Routes
app.get('/api/menu-items', async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.query;
    let query = {};
    
    if (restaurantId) query.restaurant = restaurantId;
    if (categoryId) query.category = categoryId;

    const menuItems = await MenuItem.find(query)
      .populate('category', 'name')
      .populate('restaurant', 'name')
      .select('-__v');

    res.json({
      message: 'Menu items retrieved successfully',
      menuItems
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

app.get('/api/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('category', 'name')
      .populate('restaurant', 'name');
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      message: 'Menu item retrieved successfully',
      menuItem
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu item', details: error.message });
  }
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    let query = {};
    
    if (restaurantId) query.restaurant = restaurantId;

    const categories = await Category.find(query)
      .populate('restaurant', 'name')
      .select('-__v')
      .sort('sortOrder');

    res.json({
      message: 'Categories retrieved successfully',
      categories
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

// Tables Routes
app.get('/api/tables', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    let query = {};
    
    if (restaurantId) query.restaurant = restaurantId;

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

// Seed data route
app.get('/api/seed-data', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync('npm run seed');
    
    res.json({ 
      message: 'Database seeded successfully!',
      output: stdout,
      error: stderr
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Seeding failed', 
      details: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
  }
});

// Protected route example
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

// List all available routes
app.get('/api', (req, res) => {
  const routes = [
    { method: 'GET', path: '/api', description: 'List all routes' },
    { method: 'GET', path: '/api/test', description: 'Test backend' },
    { method: 'GET', path: '/api/test-db', description: 'Test database connection' },
    { method: 'GET', path: '/api/db-info', description: 'Get database information' },
    { method: 'GET', path: '/api/seed-data', description: 'Seed database with sample data' },
    
    // Restaurant routes
    { method: 'GET', path: '/api/restaurants', description: 'Get all restaurants' },
    { method: 'GET', path: '/api/restaurants/:id', description: 'Get specific restaurant' },
    { method: 'GET', path: '/api/restaurant-data/:restaurantId', description: 'Get complete restaurant data' },
    
    // Menu routes
    { method: 'GET', path: '/api/menu-items', description: 'Get menu items (optional: restaurantId, categoryId)' },
    { method: 'GET', path: '/api/menu-items/:id', description: 'Get specific menu item' },
    
    // Category routes
    { method: 'GET', path: '/api/categories', description: 'Get categories (optional: restaurantId)' },
    
    // Table routes
    { method: 'GET', path: '/api/tables', description: 'Get tables (optional: restaurantId)' },
    
    // Auth routes
    { method: 'GET', path: '/api/auth', description: 'Auth base route' },
    { method: 'POST', path: '/api/auth/login', description: 'User login' },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user (protected)' },
    
    // Protected routes
    { method: 'GET', path: '/api/protected-test', description: 'Test protected route' },
    { method: 'GET', path: '/api/my-restaurant', description: 'Get current user restaurant data (protected)' }
  ];
  
  res.json({ 
    message: 'Available API routes',
    routes 
  });
});
// Menu Items Routes
app.get('/api/menu-items', async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.query;
    let query = {};
    
    if (restaurantId) query.restaurant = restaurantId;
    if (categoryId) query.category = categoryId;

    const menuItems = await MenuItem.find(query)
      .populate('category', 'name')
      .populate('restaurant', 'name')
      .select('-__v');

    res.json({
      message: 'Menu items retrieved successfully',
      menuItems
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

app.get('/api/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('category', 'name')
      .populate('restaurant', 'name');
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      message: 'Menu item retrieved successfully',
      menuItem
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu item', details: error.message });
  }
});

app.post('/api/menu-items', upload.single('image'), async (req, res) => {
  try {
    const menuItemData = {
      ...req.body,
      ingredients: req.body.ingredients ? JSON.parse(req.body.ingredients) : [],
      price: Number(req.body.price),
      preparationTime: Number(req.body.preparationTime),
      spiceLevel: Number(req.body.spiceLevel),
      isVegetarian: req.body.isVegetarian === 'true',
      isVegan: req.body.isVegan === 'true',
      isGlutenFree: req.body.isGlutenFree === 'true',
      isAvailable: req.body.isAvailable === 'true'
    };

    // If image was uploaded, add the image path
    if (req.file) {
      menuItemData.image = `/images/menu-items/${req.file.filename}`;
    }

    const menuItem = new MenuItem(menuItemData);
    const savedItem = await menuItem.save();
    
    const populatedItem = await MenuItem.findById(savedItem._id)
      .populate('category', 'name')
      .populate('restaurant', 'name');

    res.status(201).json({
      message: 'Menu item created successfully',
      menuItem: populatedItem
    });
  } catch (error) {
    console.error('Failed to create menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item', details: error.message });
  }
});

app.put('/api/menu-items/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      ingredients: req.body.ingredients ? JSON.parse(req.body.ingredients) : [],
      price: req.body.price ? Number(req.body.price) : undefined,
      preparationTime: req.body.preparationTime ? Number(req.body.preparationTime) : undefined,
      spiceLevel: req.body.spiceLevel ? Number(req.body.spiceLevel) : undefined,
      isVegetarian: req.body.isVegetarian ? req.body.isVegetarian === 'true' : undefined,
      isVegan: req.body.isVegan ? req.body.isVegan === 'true' : undefined,
      isGlutenFree: req.body.isGlutenFree ? req.body.isGlutenFree === 'true' : undefined,
      isAvailable: req.body.isAvailable ? req.body.isAvailable === 'true' : undefined
    };

    // If image was uploaded, update the image path
    if (req.file) {
      updateData.image = `/images/menu-items/${req.file.filename}`;
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name').populate('restaurant', 'name');
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      message: 'Menu item updated successfully',
      menuItem
    });
  } catch (error) {
    console.error('Failed to update menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item', details: error.message });
  }
});

app.delete('/api/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item', details: error.message });
  }
});
// Bulk delete menu items by restaurant
app.delete('/api/menu-items/bulk/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    console.log(`Bulk deleting menu items for restaurant: ${restaurantId}`);
    
    // Delete all menu items for this restaurant
    const result = await MenuItem.deleteMany({ restaurant: restaurantId });
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} menu items for restaurant ${restaurantId}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});

// Bulk delete menu items by IDs
app.delete('/api/menu-items/bulk/ids', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ 
        error: 'itemIds array is required in request body' 
      });
    }
    
    console.log(`Bulk deleting ${itemIds.length} menu items`);
    
    const result = await MenuItem.deleteMany({ 
      _id: { $in: itemIds } 
    });
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} menu items`,
      deletedCount: result.deletedCount,
      requestedCount: itemIds.length
    });
  } catch (error) {
    console.error('Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});

// Keep only specific number of items (delete all except first N)
app.delete('/api/menu-items/bulk/restaurant/:restaurantId/keep/:count', async (req, res) => {
  try {
    const { restaurantId, count } = req.params;
    const keepCount = parseInt(count);
    
    console.log(`Keeping only ${keepCount} items for restaurant: ${restaurantId}`);
    
    // First, get all menu items for this restaurant sorted by creation date
    const allItems = await MenuItem.find({ restaurant: restaurantId })
      .sort({ createdAt: 1 }); // oldest first
    
    if (allItems.length <= keepCount) {
      return res.json({
        message: `No items to delete. Restaurant already has ${allItems.length} items (<= ${keepCount})`,
        deletedCount: 0,
        keptCount: allItems.length
      });
    }
    
    // Items to delete (all except first 'keepCount' items)
    const itemsToDelete = allItems.slice(keepCount);
    const itemIdsToDelete = itemsToDelete.map(item => item._id);
    
    // Delete the items
    const result = await MenuItem.deleteMany({ 
      _id: { $in: itemIdsToDelete } 
    });
    
    res.json({
      message: `Successfully kept ${keepCount} items and deleted ${result.deletedCount} items`,
      deletedCount: result.deletedCount,
      keptCount: keepCount,
      totalItemsBefore: allItems.length
    });
  } catch (error) {
    console.error('Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET === 'your-fallback-secret-key-change-in-production' ? 'Using fallback - set JWT_SECRET in .env' : 'Using environment variable'}`);
  console.log(`🌐 API available at: http://localhost:${PORT}/api`);
  console.log(`🖼️ Static images served from: http://localhost:${PORT}/images`);
});