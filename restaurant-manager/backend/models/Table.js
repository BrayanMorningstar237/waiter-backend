const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Hall'
  },
  qrCode: {
    type: String, // URL or data for QR code
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for unique table numbers per restaurant
tableSchema.index({ tableNumber: 1, restaurant: 1 }, { unique: true });
tableSchema.index({ restaurant: 1, isAvailable: 1 });

module.exports = mongoose.model('Table', tableSchema);