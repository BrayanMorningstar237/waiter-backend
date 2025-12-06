const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,        // Remove this line if causing duplicate index
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {  
    type: String,
    trim: true
  },
  
  role: {
    type: String,
    enum: ['super_admin','admin', 'staff'],
    default: 'admin'
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Keep only one index definition
userSchema.index({ email: 1 });
userSchema.index({ restaurant: 1 });

module.exports = mongoose.model('User', userSchema);