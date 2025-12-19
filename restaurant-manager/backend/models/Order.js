const mongoose = require('mongoose');

// Payment Details Schema
const paymentDetailSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['MTN MoMo', 'Orange Money', 'Pay at Counter', 'cash', 'card', 'bank_transfer', 'wallet', 'other']
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  transactionId: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  currency: {
    type: String,
    default: 'CFA'
  },
  paymentProvider: {
    type: String,
    trim: true,
    default: ''
  },
  customerEmail: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
});

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  specialInstructions: {
    type: String,
    trim: true,
    default: ''
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  customerName: {
    type: String,
    trim: true,
    default: ''
  },
  customerPhone: {
    type: String,
    trim: true,
    default: ''
  },
  customerEmail: {
    type: String,
    trim: true,
    default: ''
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  amountPaidWithCharges: { // ✅ NEW FIELD: Total amount paid including service charges
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentDetails: {
    type: paymentDetailSchema,
    default: null
  },
  orderType: {
    type: String,
    enum: ['dine-in', 'takeaway', 'delivery'],
    default: 'dine-in'
  },
  customerNotes: {
    type: String,
    trim: true,
    default: ''
  },
  preparationTime: {
    type: Number,
    default: 0
  },
  servedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customerPhone: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, paymentStatus: 1 });
// ✅ NEW INDEX: For queries on amountPaidWithCharges
orderSchema.index({ amountPaidWithCharges: 1 });
orderSchema.index({ restaurant: 1, amountPaidWithCharges: 1 });

// Pre-save middleware to generate order number and set amounts
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    this.orderNumber = `ORD-${timestamp}-${random}`;
    
    // ✅ Calculate amountPaidWithCharges for new orders
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      // If paymentDetails has amountPaid (with charges), use it
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else if (this.paymentStatus === 'paid') {
      // For paid orders without paymentDetails, use totalAmount
      this.amountPaidWithCharges = this.totalAmount;
    } else {
      // For pending payments, default to totalAmount
      this.amountPaidWithCharges = this.totalAmount;
    }
    
    console.log('💰 New order amounts set:', {
      totalAmount: this.totalAmount,
      amountPaidWithCharges: this.amountPaidWithCharges,
      difference: this.amountPaidWithCharges - this.totalAmount,
      paymentMethod: this.paymentDetails?.method || 'none'
    });
  }
  
  // ✅ Update paidAt based on payment status
  if (this.isModified('paymentStatus') && this.paymentStatus === 'paid' && !this.paidAt) {
    this.paidAt = new Date();
    
    // ✅ Update amountPaidWithCharges when payment status changes to paid
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else if (this.amountPaidWithCharges === 0) {
      // If not set yet, use totalAmount
      this.amountPaidWithCharges = this.totalAmount;
    }
  }
  
  // ✅ Ensure amountPaidWithCharges is always set (backward compatibility)
  if (!this.amountPaidWithCharges || this.amountPaidWithCharges === 0) {
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else {
      this.amountPaidWithCharges = this.totalAmount;
    }
  }
  
  next();
});

// ✅ Add a virtual getter for service charge amount (for easy access)
orderSchema.virtual('serviceCharge').get(function() {
  return this.amountPaidWithCharges - this.totalAmount;
});

// ✅ Ensure virtuals are included when converting to JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);