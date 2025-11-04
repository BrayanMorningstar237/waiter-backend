// fix-ratings.js
const mongoose = require('mongoose');
require('dotenv').config();

async function fixRestaurantRatings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('restaurants').updateMany(
      { rating: { $exists: false } },
      { 
        $set: { 
          "rating": {
            "average": 0,
            "count": 0,
            "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
          }
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} restaurants`);
    console.log('Ratings field added to all restaurants missing it');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
}

fixRestaurantRatings();