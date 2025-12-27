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
  amountPaidWithCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  // ✅ Withdrawal status
  withdrawn: {
    type: Boolean,
    default: false
  },
  // ✅ Reference to withdrawal (if any)
  withdrawalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentWithdrawal',
    default: null
  },
  // ✅ REAL DATABASE FIELD - ADDED HERE (was missing!)
  isEligibleForWithdrawal: {
    type: Boolean,
    default: true
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

// Indexes
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customerPhone: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, paymentStatus: 1 });
orderSchema.index({ amountPaidWithCharges: 1 });
orderSchema.index({ restaurant: 1, amountPaidWithCharges: 1 });

// ✅ NEW INDEXES for withdrawal queries
orderSchema.index({ withdrawn: 1 });
orderSchema.index({ restaurant: 1, withdrawn: 1, createdAt: -1 });
orderSchema.index({ 'paymentDetails.method': 1, withdrawn: 1 });
orderSchema.index({ withdrawalId: 1 });
// ✅ Add index for the new field
orderSchema.index({ isEligibleForWithdrawal: 1 });
orderSchema.index({ restaurant: 1, isEligibleForWithdrawal: 1, createdAt: -1 });

// Pre-save middleware to generate order number and set amounts
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    this.orderNumber = `ORD-${timestamp}-${random}`;
    
    // Calculate amountPaidWithCharges for new orders
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else if (this.paymentStatus === 'paid') {
      this.amountPaidWithCharges = this.totalAmount;
    } else {
      this.amountPaidWithCharges = this.totalAmount;
    }
    
    // ✅ Auto-set eligibility for new orders
    if (this.paymentDetails && this.paymentDetails.method) {
      const method = this.paymentDetails.method.toLowerCase();
      const isMobilePayment = method.includes('mtn') || method.includes('orange');
      const serviceCharge = this.amountPaidWithCharges - this.totalAmount;
      
      this.isEligibleForWithdrawal = isMobilePayment && serviceCharge > 0;
    }
    
    console.log('💰 New order amounts set:', {
      totalAmount: this.totalAmount,
      amountPaidWithCharges: this.amountPaidWithCharges,
      difference: this.amountPaidWithCharges - this.totalAmount,
      paymentMethod: this.paymentDetails?.method || 'none',
      isEligibleForWithdrawal: this.isEligibleForWithdrawal
    });
  }
  
  // Update paidAt based on payment status
  if (this.isModified('paymentStatus') && this.paymentStatus === 'paid' && !this.paidAt) {
    this.paidAt = new Date();
    
    // Update amountPaidWithCharges when payment status changes to paid
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else if (this.amountPaidWithCharges === 0) {
      this.amountPaidWithCharges = this.totalAmount;
    }
    
    // ✅ Update eligibility when payment status changes to paid
    if (this.paymentDetails && this.paymentDetails.method) {
      const method = this.paymentDetails.method.toLowerCase();
      const isMobilePayment = method.includes('mtn') || method.includes('orange');
      const serviceCharge = this.amountPaidWithCharges - this.totalAmount;
      
      this.isEligibleForWithdrawal = isMobilePayment && serviceCharge > 0;
    }
  }
  
  // Ensure amountPaidWithCharges is always set (backward compatibility)
  if (!this.amountPaidWithCharges || this.amountPaidWithCharges === 0) {
    if (this.paymentDetails && this.paymentDetails.amountPaid) {
      this.amountPaidWithCharges = this.paymentDetails.amountPaid;
    } else {
      this.amountPaidWithCharges = this.totalAmount;
    }
  }
  
  next();
});

// ✅ Virtual getter for service charge amount
orderSchema.virtual('serviceCharge').get(function() {
  return this.amountPaidWithCharges - this.totalAmount;
});

// ✅ Virtual getter to check if order is eligible for withdrawal (backward compatibility)
orderSchema.virtual('isEligibleForWithdrawalVirtual').get(function() {
  return this.paymentStatus === 'paid' && 
         !this.withdrawn && 
         this.paymentDetails?.method && 
         (this.paymentDetails.method.toLowerCase().includes('mtn') || 
          this.paymentDetails.method.toLowerCase().includes('orange')) &&
         (this.amountPaidWithCharges - this.totalAmount) > 0;
});

// Ensure virtuals are included when converting to JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

// ✅ Static method to get orders for withdrawal - FIXED TIMEZONE ISSUE
orderSchema.statics.getOrdersForWithdrawal = async function(restaurantId, dateString, paymentMethod) {
  try {
    console.log('🔍 getOrdersForWithdrawal called:', {
      restaurantId: restaurantId.toString(),
      date: dateString,
      paymentMethod
    });
    
    // Parse the date string (format: YYYY-MM-DD) using UTC
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create start and end dates in UTC (not local time)
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    console.log('📅 UTC Date range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });
    
    const query = {
      restaurant: restaurantId,
      paymentStatus: 'paid',
      withdrawn: false,
      isEligibleForWithdrawal: true, // ✅ Now using REAL database field
      'paymentDetails.method': { $regex: paymentMethod, $options: 'i' },
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    console.log('🔍 Query:', JSON.stringify(query, null, 2));
    
    const results = await this.find(query).sort({ createdAt: 1 });
    
    console.log(`✅ Found ${results.length} orders for withdrawal`);
    results.forEach(order => {
      console.log(`   • ${order.orderNumber}: created at ${order.createdAt.toISOString()}, eligible: ${order.isEligibleForWithdrawal}`);
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Error in getOrdersForWithdrawal:', error);
    throw error;
  }
};

// ✅ Static method to mark orders as withdrawn
orderSchema.statics.markAsWithdrawn = async function(orderIds, withdrawalId) {
  return this.updateMany(
    { _id: { $in: orderIds } },
    { 
      $set: { 
        withdrawn: true,
        withdrawalId: withdrawalId
      }
    }
  );
};

// ✅ Static method to update eligibility for existing orders
orderSchema.statics.updateEligibilityForExistingOrders = async function() {
  console.log('🔄 Updating eligibility for existing orders...');
  
  const orders = await this.find({
    paymentStatus: 'paid',
    withdrawn: false,
    $or: [
      { 'paymentDetails.method': /mtn/i },
      { 'paymentDetails.method': /orange/i }
    ]
  });
  
  let updatedCount = 0;
  
  for (const order of orders) {
    const serviceCharge = (order.amountPaidWithCharges || 0) - (order.totalAmount || 0);
    const shouldBeEligible = serviceCharge > 0;
    
    if (shouldBeEligible && order.isEligibleForWithdrawal !== true) {
      order.isEligibleForWithdrawal = true;
      await order.save();
      updatedCount++;
    } else if (!shouldBeEligible && order.isEligibleForWithdrawal !== false) {
      order.isEligibleForWithdrawal = false;
      await order.save();
      updatedCount++;
    }
  }
  
  console.log(`✅ Updated eligibility for ${updatedCount} orders`);
  return updatedCount;
};

module.exports = mongoose.model('Order', orderSchema);