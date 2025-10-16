const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Restaurant = require('./models/Restaurant');
const User = require('./models/user');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

// Sample Cameroon-based restaurants with profile photos
const restaurants = [
  {
    name: "Bella Foods Buea",
    description: "Authentic Cameroonian cuisine with a modern twist in the heart of Buea",
    address: {
      street: "Molyko Street",
      city: "Buea",
      state: "Southwest",
      zipCode: "00237"
    },
    contact: {
      phone: "+237 6 77 89 01 23",
      email: "info@bellafoodsbuea.com"
    },
    operatingHours: {
      monday: { open: "07:00", close: "22:00" },
      tuesday: { open: "07:00", close: "22:00" },
      wednesday: { open: "07:00", close: "22:00" },
      thursday: { open: "07:00", close: "22:00" },
      friday: { open: "07:00", close: "23:00" },
      saturday: { open: "08:00", close: "23:00" },
      sunday: { open: "08:00", close: "21:00" }
    },
    logo: "/images/restaurants/bella-foods.jpg",
    theme: {
      primaryColor: "#1E40AF",
      secondaryColor: "#3B82F6"
    },
    admin: {
      name: "Manager Bella",
      email: "admin@bellafoodsbuea.com",
      password: "pass1"
    }
  },
  {
    name: "Mount Cameroon Grill",
    description: "Grilled specialties with breathtaking views of Mount Cameroon",
    address: {
      street: "Clermont Road",
      city: "Buea",
      state: "Southwest",
      zipCode: "00237"
    },
    contact: {
      phone: "+237 6 70 12 34 56",
      email: "contact@mountgrill.com"
    },
    operatingHours: {
      monday: { open: "10:00", close: "23:00" },
      tuesday: { open: "10:00", close: "23:00" },
      wednesday: { open: "10:00", close: "23:00" },
      thursday: { open: "10:00", close: "23:00" },
      friday: { open: "10:00", close: "00:00" },
      saturday: { open: "09:00", close: "00:00" },
      sunday: { open: "09:00", close: "22:00" }
    },
    logo: "/images/restaurants/mount-grill.jpg",
    theme: {
      primaryColor: "#059669",
      secondaryColor: "#10B981"
    },
    admin: {
      name: "Grill Master",
      email: "admin@mountgrill.com",
      password: "pass2"
    }
  },
  {
    name: "Fako Delights",
    description: "Traditional Fako region dishes in a cozy atmosphere",
    address: {
      street: "Bonduma Quarter",
      city: "Buea",
      state: "Southwest",
      zipCode: "00237"
    },
    contact: {
      phone: "+237 6 99 88 77 66",
      email: "hello@fakodelights.com"
    },
    operatingHours: {
      monday: { open: "08:00", close: "21:00" },
      tuesday: { open: "08:00", close: "21:00" },
      wednesday: { open: "08:00", close: "21:00" },
      thursday: { open: "08:00", close: "21:00" },
      friday: { open: "08:00", close: "22:00" },
      saturday: { open: "09:00", close: "22:00" },
      sunday: { open: "09:00", close: "20:00" }
    },
    logo: "/images/restaurants/fako-delights.jpg",
    theme: {
      primaryColor: "#7C3AED",
      secondaryColor: "#8B5CF6"
    },
    admin: {
      name: "Fako Manager",
      email: "admin@fakodelights.com",
      password: "pass3"
    }
  }
];

// Common categories for Cameroonian restaurants
const categories = [
  { name: "Main Dishes", description: "Traditional main courses", sortOrder: 1 },
  { name: "Grills & BBQ", description: "Freshly grilled meats and fish", sortOrder: 2 },
  { name: "Soups & Stews", description: "Hearty soups and traditional stews", sortOrder: 3 },
  { name: "Sides", description: "Perfect accompaniments", sortOrder: 4 },
  { name: "Drinks", description: "Refreshments and beverages", sortOrder: 5 },
  { name: "Desserts", description: "Sweet treats", sortOrder: 6 }
];

// Sample menu items for Cameroonian cuisine with images
const menuItems = [
  // Main Dishes
  { 
    name: "Ndolé", 
    description: "Traditional bitterleaf stew with nuts, fish, and meat", 
    price: 4500, 
    category: "Main Dishes", 
    image: "/images/menu/ndole.jpg",
    preparationTime: 45, 
    isVegetarian: false,
    ingredients: ["Bitterleaf", "Peanuts", "Fish", "Beef", "Prawns", "Palm Oil"],
    spiceLevel: 2
  },
  { 
    name: "Achu Soup", 
    description: "Yellow soup with cocoyam fufu and cow skin", 
    price: 3500, 
    category: "Main Dishes", 
    image: "/images/menu/achu-soup.jpg",
    preparationTime: 60, 
    isVegetarian: false,
    ingredients: ["Cocoyam", "Palm Oil", "Cow Skin", "Traditional Spices"],
    spiceLevel: 3
  },
  { 
    name: "Eru", 
    description: "Wild spinach with waterleaf, palm oil, and smoked fish", 
    price: 3200, 
    category: "Main Dishes", 
    image: "/images/menu/eru.jpg",
    preparationTime: 50, 
    isVegetarian: false,
    ingredients: ["Eru Leaves", "Waterleaf", "Palm Oil", "Smoked Fish", "Beef"],
    spiceLevel: 2
  },
  { 
    name: "Koki Beans", 
    description: "Steamed black-eyed pea pudding with palm oil", 
    price: 2200, 
    category: "Main Dishes", 
    image: "/images/menu/koki-beans.jpg",
    preparationTime: 40, 
    isVegetarian: true,
    ingredients: ["Black-eyed Peas", "Palm Oil", "Spinach", "Peppers"],
    spiceLevel: 1
  },
  
  // Grills & BBQ
  { 
    name: "Grilled Tilapia", 
    description: "Whole tilapia grilled with special spices", 
    price: 5500, 
    category: "Grills & BBQ", 
    image: "/images/menu/grilled-tilapia.jpg",
    preparationTime: 30, 
    isVegetarian: false,
    ingredients: ["Fresh Tilapia", "Peppers", "Onions", "Garlic", "Ginger"],
    spiceLevel: 2
  },
  { 
    name: "Suya Beef", 
    description: "Spicy grilled beef skewers with peanut spice", 
    price: 2800, 
    category: "Grills & BBQ", 
    image: "/images/menu/suya-beef.jpg",
    preparationTime: 25, 
    isVegetarian: false,
    ingredients: ["Beef", "Suya Spice", "Peanuts", "Onions", "Tomatoes"],
    spiceLevel: 4
  },
  { 
    name: "Chicken Grill", 
    description: "Quarter chicken with special secret sauce", 
    price: 3500, 
    category: "Grills & BBQ", 
    image: "/images/menu/chicken-grill.jpg",
    preparationTime: 35, 
    isVegetarian: false,
    ingredients: ["Chicken", "Secret Sauce", "Garlic", "Ginger", "Herbs"],
    spiceLevel: 2
  },
  { 
    name: "Grilled Plantains", 
    description: "Ripe plantains grilled to perfection", 
    price: 1200, 
    category: "Grills & BBQ", 
    image: "/images/menu/grilled-plantains.jpg",
    preparationTime: 15, 
    isVegetarian: true,
    ingredients: ["Ripe Plantains", "Butter"],
    spiceLevel: 0
  },
  
  // Soups & Stews
  { 
    name: "Pepper Soup", 
    description: "Spicy goat meat or fish soup", 
    price: 2800, 
    category: "Soups & Stews", 
    image: "/images/menu/pepper-soup.jpg",
    preparationTime: 35, 
    isVegetarian: false,
    ingredients: ["Goat Meat", "Peppers", "Uziza", "Utazi", "Traditional Spices"],
    spiceLevel: 5
  },
  { 
    name: "Egusi Soup", 
    description: "Melon seed soup with vegetables and assorted meat", 
    price: 3200, 
    category: "Soups & Stews", 
    image: "/images/menu/egusi-soup.jpg",
    preparationTime: 45, 
    isVegetarian: false,
    ingredients: ["Egusi", "Pumpkin Leaves", "Beef", "Fish", "Palm Oil"],
    spiceLevel: 2
  },
  { 
    name: "Okra Soup", 
    description: "Fresh okra soup with fish and meat", 
    price: 3000, 
    category: "Soups & Stews", 
    image: "/images/menu/okra-soup.jpg",
    preparationTime: 40, 
    isVegetarian: false,
    ingredients: ["Fresh Okra", "Fish", "Beef", "Shrimp", "Palm Oil"],
    spiceLevel: 1
  },
  
  // Sides
  { 
    name: "Fufu Corn", 
    description: "Traditional corn fufu", 
    price: 800, 
    category: "Sides", 
    image: "/images/menu/fufu-corn.jpg",
    preparationTime: 20, 
    isVegetarian: true,
    ingredients: ["Corn Flour", "Water"],
    spiceLevel: 0
  },
  { 
    name: "Garri", 
    description: "Cassava flakes served with soup", 
    price: 600, 
    category: "Sides", 
    image: "/images/menu/garri.jpg",
    preparationTime: 5, 
    isVegetarian: true,
    ingredients: ["Cassava Garri", "Water"],
    spiceLevel: 0
  },
  { 
    name: "Fried Plantains", 
    description: "Sweet fried ripe plantains", 
    price: 1500, 
    category: "Sides", 
    image: "/images/menu/fried-plantains.jpg",
    preparationTime: 15, 
    isVegetarian: true,
    ingredients: ["Ripe Plantains", "Palm Oil"],
    spiceLevel: 0
  },
  { 
    name: "Bobolo", 
    description: "Fermented cassava stick", 
    price: 1200, 
    category: "Sides", 
    image: "/images/menu/bobolo.jpg",
    preparationTime: 10, 
    isVegetarian: true,
    ingredients: ["Cassava", "Banana Leaves"],
    spiceLevel: 0
  },
  
  // Drinks
  { 
    name: "Palm Wine", 
    description: "Fresh palm wine from local trees", 
    price: 1800, 
    category: "Drinks", 
    image: "/images/menu/palm-wine.jpg",
    preparationTime: 2, 
    isVegetarian: true,
    ingredients: ["Palm Sap"],
    spiceLevel: 0
  },
  { 
    name: "Fresh Fruit Juice", 
    description: "Seasonal fresh fruit juice (pineapple, mango, or orange)", 
    price: 1500, 
    category: "Drinks", 
    image: "/images/menu/fruit-juice.jpg",
    preparationTime: 5, 
    isVegetarian: true,
    ingredients: ["Fresh Fruits", "Water", "Sugar"],
    spiceLevel: 0
  },
  { 
    name: "Bottle Water", 
    description: "500ml bottled water", 
    price: 500, 
    category: "Drinks", 
    image: "/images/menu/water.jpg",
    preparationTime: 1, 
    isVegetarian: true,
    ingredients: ["Pure Water"],
    spiceLevel: 0
  },
  { 
    name: "Soft Drink", 
    description: "Coca-Cola, Fanta, or Sprite", 
    price: 800, 
    category: "Drinks", 
    image: "/images/menu/soft-drink.jpg",
    preparationTime: 2, 
    isVegetarian: true,
    ingredients: ["Carbonated Water", "Sugar", "Flavor"],
    spiceLevel: 0
  },
  
  // Desserts
  { 
    name: "Puff Puff", 
    description: "Sweet fried dough balls", 
    price: 1000, 
    category: "Desserts", 
    image: "/images/menu/puff-puff.jpg",
    preparationTime: 20, 
    isVegetarian: true,
    ingredients: ["Flour", "Sugar", "Yeast", "Nutmeg"],
    spiceLevel: 0
  },
  { 
    name: "Chin Chin", 
    description: "Sweet crunchy snack", 
    price: 800, 
    category: "Desserts", 
    image: "/images/menu/chin-chin.jpg",
    preparationTime: 25, 
    isVegetarian: true,
    ingredients: ["Flour", "Sugar", "Butter", "Nutmeg"],
    spiceLevel: 0
  },
  { 
    name: "Fruit Salad", 
    description: "Seasonal fruit mix with local fruits", 
    price: 1800, 
    category: "Desserts", 
    image: "/images/menu/fruit-salad.jpg",
    preparationTime: 10, 
    isVegetarian: true,
    ingredients: ["Pineapple", "Mango", "Banana", "Orange", "Pawpaw"],
    spiceLevel: 0
  },
  { 
    name: "Akara", 
    description: "Fried bean cakes", 
    price: 1200, 
    category: "Desserts", 
    image: "/images/menu/akara.jpg",
    preparationTime: 30, 
    isVegetarian: true,
    ingredients: ["Black-eyed Beans", "Onions", "Peppers", "Palm Oil"],
    spiceLevel: 1
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Restaurant.deleteMany({});
    await User.deleteMany({});
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
    await Table.deleteMany({});
    
    console.log('🧹 Cleared existing data');

    for (const restaurantData of restaurants) {
      console.log(`\n🏪 Creating ${restaurantData.name}...`);

      // Create restaurant
      const restaurant = new Restaurant({
        name: restaurantData.name,
        description: restaurantData.description,
        address: restaurantData.address,
        contact: restaurantData.contact,
        operatingHours: restaurantData.operatingHours,
        logo: restaurantData.logo,
        theme: restaurantData.theme
      });
      
      const savedRestaurant = await restaurant.save();
      console.log(`✅ Created restaurant: ${savedRestaurant.name}`);

      // Create categories for this restaurant
      const categoryDocs = [];
      for (const catData of categories) {
        const category = new Category({
          name: catData.name,
          description: catData.description,
          sortOrder: catData.sortOrder,
          restaurant: savedRestaurant._id,
          isPredefined: true
        });
        const savedCategory = await category.save();
        categoryDocs.push(savedCategory);
      }
      console.log(`✅ Created ${categoryDocs.length} categories`);

      // Create menu items for this restaurant
      let menuItemsCount = 0;
      for (const itemData of menuItems) {
        const category = categoryDocs.find(cat => cat.name === itemData.category);
        if (category) {
          const menuItem = new MenuItem({
            name: itemData.name,
            description: itemData.description,
            price: itemData.price,
            category: category._id,
            restaurant: savedRestaurant._id,
            image: itemData.image,
            preparationTime: itemData.preparationTime,
            isVegetarian: itemData.isVegetarian || false,
            ingredients: itemData.ingredients || [],
            spiceLevel: itemData.spiceLevel || 0
          });
          await menuItem.save();
          menuItemsCount++;
        }
      }
      console.log(`✅ Created ${menuItemsCount} menu items`);

      // Create tables for this restaurant
      const tables = [];
      for (let i = 1; i <= 8; i++) {
        const table = new Table({
          tableNumber: `T${i}`,
          restaurant: savedRestaurant._id,
          capacity: i <= 4 ? 4 : 6,
          location: i <= 4 ? 'Main Hall' : 'Terrace'
        });
        const savedTable = await table.save();
        tables.push(savedTable);
      }
      console.log(`✅ Created ${tables.length} tables`);

      // Create admin user
      const hashedPassword = await bcrypt.hash(restaurantData.admin.password, 12);
      const adminUser = new User({
        name: restaurantData.admin.name,
        email: restaurantData.admin.email,
        password: hashedPassword,
        role: 'admin',
        restaurant: savedRestaurant._id
      });
      
      const savedUser = await adminUser.save();
      console.log(`✅ Created admin user: ${savedUser.email} (password: ${restaurantData.admin.password})`);
    }

    console.log('\n🎉 Database seeded successfully with images!');
    console.log('\n📋 Login Credentials:');
    console.log('=====================');
    restaurants.forEach(restaurant => {
      console.log(`🏪 ${restaurant.name}`);
      console.log(`   Email: ${restaurant.admin.email}`);
      console.log(`   Password: ${restaurant.admin.password}`);
      console.log(`   Logo: ${restaurant.logo}`);
      console.log('');
    });

    console.log('\n📸 Image Paths Created:');
    console.log('=====================');
    console.log('Restaurant Logos:');
    restaurants.forEach(r => console.log(`   - ${r.logo}`));
    console.log('\nMenu Item Images:');
    const uniqueImages = [...new Set(menuItems.map(item => item.image))];
    uniqueImages.forEach(img => console.log(`   - ${img}`));

  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📤 Database connection closed');
    process.exit(0);
  }
};

// Run seeding
seedDatabase();