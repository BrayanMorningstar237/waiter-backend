const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  image: {
    type: String, // URL to item image
    default: ''
  },
  ingredients: [{
    type: String,
    trim: true
  }],
  // Add to your MenuItem schema:
userRatings: [{
  sessionId: String,
  rating: Number,
  createdAt: Date,
  updatedAt: Date
}],
userLikes: [String], // Array of sessionIds who liked
userViews: [{
  sessionId: String,
  lastViewed: Date,
  viewCount: Number
}],
  allergens: [{
    type: String,
    trim: true
  }],
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  isGlutenFree: {
    type: Boolean,
    default: false
  },
  spiceLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  inventory: {
    currentStock: {
      type: Number,
      default: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    trackInventory: {
      type: Boolean,
      default: false
    }
  },
  
  // New fields for ratings, nutrition, and engagement
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    },
    distribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  
  nutrition: {
    calories: {
      type: Number,
      min: 0,
      default: 0
    },
    protein: {
      type: Number, // in grams
      min: 0,
      default: 0
    },
    carbs: {
      type: Number, // in grams
      min: 0,
      default: 0
    },
    fat: {
      type: Number, // in grams
      min: 0,
      default: 0
    },
    fiber: {
      type: Number, // in grams
      min: 0,
      default: 0
    },
    sugar: {
      type: Number, // in grams
      min: 0,
      default: 0
    },
    sodium: {
      type: Number, // in milligrams
      min: 0,
      default: 0
    }
  },
  
  likes: {
    type: Number,
    default: 0
  },
  
  takeaway: {
    isTakeawayAvailable: {
      type: Boolean,
      default: true
    },
    takeawayPrice: {
      type: Number,
      min: 0,
      default: function() {
        return this.price; // Default to regular price
      }
    },
    packagingFee: {
      type: Number,
      min: 0,
      default: 0
    },
    takeawayOrdersCount: {
      type: Number,
      default: 0
    }
  },
  
  // Additional engagement metrics
  popularity: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  orderCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for total takeaway price (item price + packaging fee)
menuItemSchema.virtual('totalTakeawayPrice').get(function() {
  return this.takeaway.takeawayPrice + this.takeaway.packagingFee;
});

// Method to update rating
menuItemSchema.methods.updateRating = function(newRating) {
  if (newRating < 1 || newRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  // Update distribution
  this.rating.distribution[newRating] += 1;
  
  // Update count and recalculate average
  this.rating.count += 1;
  const totalScore = Object.entries(this.rating.distribution).reduce((sum, [stars, count]) => {
    return sum + (parseInt(stars) * count);
  }, 0);
  
  this.rating.average = totalScore / this.rating.count;
  
  return this.save();
};

// Method to increment likes
menuItemSchema.methods.incrementLikes = function() {
  this.likes += 1;
  this.popularity = this.calculatePopularity();
  return this.save();
};

// Method to decrement likes
menuItemSchema.methods.decrementLikes = function() {
  this.likes = Math.max(0, this.likes - 1);
  this.popularity = this.calculatePopularity();
  return this.save();
};

// Method to increment takeaway orders
menuItemSchema.methods.incrementTakeawayOrders = function() {
  this.takeaway.takeawayOrdersCount += 1;
  this.orderCount += 1;
  this.popularity = this.calculatePopularity();
  return this.save();
};

// Method to increment view count
menuItemSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  this.popularity = this.calculatePopularity();
  return this.save();
};

// Method to calculate popularity score
menuItemSchema.methods.calculatePopularity = function() {
  const ratingWeight = 0.3;
  const likesWeight = 0.2;
  const ordersWeight = 0.3;
  const viewsWeight = 0.2;
  
  return (
    (this.rating.average / 5) * ratingWeight +
    (Math.min(this.likes, 100) / 100) * likesWeight +
    (Math.min(this.orderCount, 1000) / 1000) * ordersWeight +
    (Math.min(this.viewCount, 5000) / 5000) * viewsWeight
  ) * 100;
};

// Pre-save middleware to ensure takeaway price defaults to regular price if not set
menuItemSchema.pre('save', function(next) {
  if (this.isNew && !this.takeaway.takeawayPrice) {
    this.takeaway.takeawayPrice = this.price;
  }
  next();
});

// Indexes for efficient querying
menuItemSchema.index({ restaurant: 1, category: 1 });
menuItemSchema.index({ restaurant: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ 'rating.average': -1 });
menuItemSchema.index({ likes: -1 });
menuItemSchema.index({ popularity: -1 });
menuItemSchema.index({ 'nutrition.calories': 1 });
menuItemSchema.index({ 'takeaway.takeawayOrdersCount': -1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);