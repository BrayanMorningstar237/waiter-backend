const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const multer = require('multer');
const Order = require('./models/Order');
// Configure multer for file uploads with custom filename
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/public/images/menu-items'));
  },
  filename: function (req, file, cb) {
    // Get current date and time for unique identifier
    const now = new Date();
    const dateTime = now.toISOString()
      .replace(/:/g, '-')  // Replace colons with dashes for filename compatibility
      .replace(/\..+/, ''); // Remove milliseconds
    
    // Extract restaurant name and menu item name from request
    let restaurantName = 'restaurant';
    let menuItemName = 'item';
    
    // Try to get restaurant name from authenticated user
    if (req.user && req.user.restaurant && req.user.restaurant.name) {
      restaurantName = req.user.restaurant.name
        .toLowerCase()
        .replace(/\s+/g, '-')  // Replace spaces with dashes
        .replace(/[^a-z0-9-]/g, ''); // Remove special characters
    }
    
    // Try to get menu item name from request body
    if (req.body && req.body.name) {
      menuItemName = req.body.name
        .toLowerCase()
        .replace(/\s+/g, '-')  // Replace spaces with dashes
        .replace(/[^a-z0-9-]/g, ''); // Remove special characters
    }
    
    // Create unique filename with restaurant name, item name, and timestamp
    const uniqueFilename = `${restaurantName}-${menuItemName}-${dateTime}${path.extname(file.originalname)}`;
    
    console.log(`📸 Saving image as: ${uniqueFilename}`);
    console.log(`🏪 Restaurant: ${restaurantName}`);
    console.log(`🍽️ Menu item: ${menuItemName}`);
    console.log(`🕐 Timestamp: ${dateTime}`);
    
    cb(null, uniqueFilename);
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

// Import middleware
const { auth } = require('./middleware/auth');

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

// Restaurant Routes (public - for landing pages, etc.)
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

// ✅ CORRECTED: Menu Items Routes with proper restaurant filtering
app.get('/api/menu-items', auth, async (req, res) => {
  try {
    const { categoryId } = req.query;
    const restaurantId = req.user.restaurant._id; // Get from authenticated user
    
    console.log(`🔐 Fetching menu items for: ${req.user.restaurant.name} (${restaurantId})`);
    
    let query = { restaurant: restaurantId }; // Filter by user's restaurant ONLY
    
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

// ✅ CORRECTED: Categories Routes with proper restaurant filtering
app.get('/api/categories', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id; // Get from authenticated user
    
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
      restaurant: req.user.restaurant._id, // Set restaurant from authenticated user
      isPredefined: false // User-created categories are not predefined
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
    console.log('👤 User:', req.user.email);

    // Find the category first to check ownership and predefined status
    const category = await Category.findOne({
      _id: req.params.id,
      restaurant: req.user.restaurant._id // Ensure category belongs to user's restaurant
    });

    if (!category) {
      console.log('❌ Category not found or does not belong to restaurant');
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category is predefined
    if (category.isPredefined) {
      console.log('❌ Cannot delete predefined category:', category.name);
      return res.status(403).json({ 
        error: 'Cannot delete predefined categories. You can only delete categories you created.' 
      });
    }

    // Delete the category (only if it's not predefined and belongs to user's restaurant)
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
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  }
});
// Tables Routes (public - for QR code scanning, etc.)
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

// Debug route to check menu item ownership
app.get('/api/debug/menu-items-ownership', auth, async (req, res) => {
  try {
    const userRestaurantId = req.user.restaurant._id.toString();
    
    // Get all menu items with their restaurant info
    const allItems = await MenuItem.find()
      .populate('restaurant', 'name _id')
      .select('name restaurant');
    
    // Count items per restaurant
    const itemsByRestaurant = {};
    allItems.forEach(item => {
      const restId = item.restaurant._id.toString();
      const restName = item.restaurant.name;
      
      if (!itemsByRestaurant[restId]) {
        itemsByRestaurant[restId] = {
          restaurantName: restName,
          count: 0,
          items: []
        };
      }
      
      itemsByRestaurant[restId].count++;
      itemsByRestaurant[restId].items.push(item.name);
    });
    
    res.json({
      userRestaurant: {
        id: userRestaurantId,
        name: req.user.restaurant.name
      },
      itemsByRestaurant,
      totalItems: allItems.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
});

// Create menu item (protected)
app.post('/api/menu-items', auth, upload.single('image'), async (req, res) => {
  try {
    console.log('📦 Creating menu item with data:', req.body);
    console.log('🏪 Restaurant:', req.user.restaurant.name);
    console.log('👤 User:', req.user.name);
    
    const menuItemData = {
      ...req.body,
      restaurant: req.user.restaurant._id, // Set restaurant from authenticated user
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

// Update menu item (protected)
app.put('/api/menu-items/:id', auth, upload.single('image'), async (req, res) => {
  try {
    // Verify the menu item belongs to the user's restaurant
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (existingItem.restaurant.toString() !== req.user.restaurant._id.toString()) {
      return res.status(403).json({ error: 'Access denied - menu item does not belong to your restaurant' });
    }

    console.log('📦 Updating menu item:', req.params.id);
    console.log('🏪 Restaurant:', req.user.restaurant.name);
    console.log('📝 Update data:', req.body);

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

// Delete menu item (protected)
app.delete('/api/menu-items/:id', auth, async (req, res) => {
  try {
    // Verify the menu item belongs to the user's restaurant
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

// Bulk delete menu items by restaurant (protected)
app.delete('/api/menu-items/bulk/restaurant/:restaurantId', auth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Verify the restaurant ID matches the user's restaurant
    if (restaurantId !== req.user.restaurant._id.toString()) {
      return res.status(403).json({ error: 'Access denied - cannot delete items from other restaurants' });
    }
    
    console.log(`🗑️ Bulk deleting menu items for restaurant: ${req.user.restaurant.name} (${restaurantId})`);
    
    // Delete all menu items for this restaurant
    const result = await MenuItem.deleteMany({ restaurant: restaurantId });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} menu items`);
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} menu items for restaurant ${req.user.restaurant.name}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});

// Bulk delete menu items by IDs (protected)
app.delete('/api/menu-items/bulk/ids', auth, async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ 
        error: 'itemIds array is required in request body' 
      });
    }
    
    console.log(`🗑️ Bulk deleting ${itemIds.length} menu items for restaurant: ${req.user.restaurant.name}`);
    
    // Verify all items belong to the user's restaurant
    const items = await MenuItem.find({ _id: { $in: itemIds } });
    const unauthorizedItems = items.filter(item => 
      item.restaurant.toString() !== req.user.restaurant._id.toString()
    );
    
    if (unauthorizedItems.length > 0) {
      return res.status(403).json({ 
        error: 'Access denied - some items do not belong to your restaurant' 
      });
    }
    
    const result = await MenuItem.deleteMany({ 
      _id: { $in: itemIds } 
    });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} menu items`);
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} menu items`,
      deletedCount: result.deletedCount,
      requestedCount: itemIds.length
    });
  } catch (error) {
    console.error('❌ Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});

// Keep only specific number of items (delete all except first N) - protected
app.delete('/api/menu-items/bulk/restaurant/:restaurantId/keep/:count', auth, async (req, res) => {
  try {
    const { restaurantId, count } = req.params;
    
    // Verify the restaurant ID matches the user's restaurant
    if (restaurantId !== req.user.restaurant._id.toString()) {
      return res.status(403).json({ error: 'Access denied - cannot modify items from other restaurants' });
    }
    
    const keepCount = parseInt(count);
    
    console.log(`🗑️ Keeping only ${keepCount} items for restaurant: ${req.user.restaurant.name}`);
    
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
    
    console.log(`🗑️ Deleting ${itemsToDelete.length} items, keeping ${keepCount}`);
    
    // Delete the items
    const result = await MenuItem.deleteMany({ 
      _id: { $in: itemIdsToDelete } 
    });
    
    console.log(`✅ Successfully kept ${keepCount} items and deleted ${result.deletedCount} items`);
    
    res.json({
      message: `Successfully kept ${keepCount} items and deleted ${result.deletedCount} items`,
      deletedCount: result.deletedCount,
      keptCount: keepCount,
      totalItemsBefore: allItems.length
    });
  } catch (error) {
    console.error('❌ Failed to bulk delete menu items:', error);
    res.status(500).json({ 
      error: 'Failed to bulk delete menu items', 
      details: error.message 
    });
  }
});
// Order Routes (protected - restaurant admin only)
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
      .populate('items.menuItem', 'name description image')
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

app.get('/api/orders/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurant: req.user.restaurant._id
    })
      .populate('items.menuItem', 'name description image price ingredients')
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
      .populate('items.menuItem', 'name description image')
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

// Mark order as paid
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

    order.paymentStatus = 'paid';
    order.paidAt = new Date();

    const updatedOrder = await order.save();
    
    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('items.menuItem', 'name description image')
      .populate('table', 'tableNumber');

    console.log(`✅ Order ${req.params.id} marked as paid`);
    
    res.json({
      message: 'Order marked as paid successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('❌ Failed to mark order as paid:', error);
    res.status(500).json({ error: 'Failed to mark order as paid', details: error.message });
  }
});

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

// Get order statistics for dashboard
app.get('/api/orders/stats', auth, async (req, res) => {
  try {
    const restaurantId = req.user.restaurant._id;
    
    const stats = await Order.aggregate([
      {
        $match: {
          restaurant: mongoose.Types.ObjectId(restaurantId),
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments({ restaurant: restaurantId });
    const todayOrders = await Order.countDocuments({
      restaurant: restaurantId,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    res.json({
      message: 'Order statistics retrieved successfully',
      stats: {
        today: todayOrders,
        total: totalOrders,
        byStatus: stats
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch order statistics:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics', details: error.message });
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
    
    // Menu routes (protected)
    { method: 'GET', path: '/api/menu-items', description: 'Get menu items for logged-in restaurant (protected)' },
    { method: 'GET', path: '/api/menu-items/:id', description: 'Get specific menu item' },
    { method: 'POST', path: '/api/menu-items', description: 'Create menu item (protected)' },
    { method: 'PUT', path: '/api/menu-items/:id', description: 'Update menu item (protected)' },
    { method: 'DELETE', path: '/api/menu-items/:id', description: 'Delete menu item (protected)' },
    
    // Category routes (protected)
    { method: 'GET', path: '/api/categories', description: 'Get categories for logged-in restaurant (protected)' },
    
    // Table routes
    { method: 'GET', path: '/api/tables', description: 'Get tables (optional: restaurantId)' },
    
    // Auth routes
    { method: 'GET', path: '/api/auth', description: 'Auth base route' },
    { method: 'POST', path: '/api/auth/login', description: 'User login' },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user (protected)' },
    
    // Protected routes
    { method: 'GET', path: '/api/protected-test', description: 'Test protected route' },
    { method: 'GET', path: '/api/my-restaurant', description: 'Get current user restaurant data (protected)' },
    { method: 'GET', path: '/api/debug/menu-items-ownership', description: 'Debug menu item ownership (protected)' }
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
  console.log(`📸 Image naming format: restaurantName-itemName-YYYY-MM-DDTHH-MM-SS.ext`);
});