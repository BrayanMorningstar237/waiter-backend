const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const securitySettingSchema = new mongoose.Schema({
  // RESTAURANT-SPECIFIC: Link to restaurant
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  
  // Setting type
  type: {
    type: String,
    required: true,
    default: 'withdrawal_security_code',
    enum: ['withdrawal_security_code']
  },
  
  // The security code (encrypted)
  value: {
    type: String,
    required: true
  },
  
  // Metadata
  description: {
    type: String,
    default: 'Security code required for payment withdrawals'
  },
  
  // Who last changed it
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // History of changes
  changeHistory: [{
    oldValue: String,
    newValue: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  
  // Settings
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Failed attempts tracking (for security)
  failedAttempts: {
    type: Number,
    default: 0
  },
  
  lastFailedAttempt: {
    type: Date
  },
  
  lockUntil: {
    type: Date,
    description: 'Temporary lock after too many failed attempts'
  }
}, {
  timestamps: true
});

// Compound index: restaurant + type
securitySettingSchema.index({ restaurant: 1, type: 1 }, { unique: true });

// Pre-save to encrypt the security code
securitySettingSchema.pre('save', async function(next) {
  // Only hash if value is modified and is not already hashed
  if (this.isModified('value') && !this.value.startsWith('$2a$')) {
    console.log(`🔐 Encrypting security code for restaurant ${this.restaurant}`);
    const salt = await bcrypt.genSalt(10);
    this.value = await bcrypt.hash(this.value, salt);
    
    // Track change in history if not the first save
    if (!this.isNew && this._originalValue) {
      if (!this.changeHistory) this.changeHistory = [];
      this.changeHistory.push({
        oldValue: this._originalValue,
        newValue: this.value,
        changedBy: this.lastUpdatedBy,
        reason: this._changeReason || 'Security update',
        changedAt: new Date()
      });
    }
  }
  next();
});

// Method to verify security code
securitySettingSchema.methods.verifyCode = async function(inputCode) {
  // Check if temporarily locked
  if (this.lockUntil && this.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((this.lockUntil - new Date()) / (1000 * 60));
    throw new Error(`Too many failed attempts. Try again in ${minutesLeft} minutes.`);
  }
  
  const isValid = await bcrypt.compare(inputCode, this.value);
  
  if (!isValid) {
    this.failedAttempts += 1;
    this.lastFailedAttempt = new Date();
    
    // Lock after 5 failed attempts for 30 minutes
    if (this.failedAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await this.save();
      throw new Error('Too many failed attempts. Account locked for 30 minutes.');
    }
    
    await this.save();
    return false;
  }
  
  // Reset failed attempts on successful verification
  this.failedAttempts = 0;
  this.lockUntil = null;
  await this.save();
  
  return true;
};

// Static method to get or create security setting FOR A SPECIFIC RESTAURANT
securitySettingSchema.statics.getWithdrawalSecurityCode = async function(restaurantId) {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required for restaurant-specific security settings');
  }
  
  let setting = await this.findOne({ 
    restaurant: restaurantId, 
    type: 'withdrawal_security_code' 
  });
  
  if (!setting) {
    // Create default if doesn't exist for this restaurant
    const Restaurant = mongoose.model('Restaurant');
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    
    setting = new this({
      restaurant: restaurantId,
      type: 'withdrawal_security_code',
      value: 'ADMIN123', // Default security code for this restaurant
      lastUpdatedBy: restaurantId, // Use restaurant ID as fallback
      description: `Security code for ${restaurant.name} withdrawals`
    });
    
    await setting.save();
    console.log(`✅ Created default security setting for restaurant: ${restaurant.name}`);
  }
  
  return setting;
};

module.exports = mongoose.model('SecuritySetting', securitySettingSchema);