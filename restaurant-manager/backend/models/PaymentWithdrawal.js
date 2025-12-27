const mongoose = require('mongoose');

const paymentWithdrawalSchema = new mongoose.Schema({
  // Restaurant reference
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  
  // Basic information
  withdrawalNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Date and time
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    required: true,
    enum: ['MTN', 'ORANGE', 'MTN MOMO', 'ORANGE MONEY', 'CASH'],
    uppercase: true
  },
  
  // Orders included in this withdrawal
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  }],
  
  // Financial information
  withdrawalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  customerCharges: {
    type: Number,
    required: true,
    min: 0,
    description: 'Sum of (amountPaidWithCharges - totalAmount) for all orders'
  },
  
  withdrawalFee: {
    type: Number,
    required: true,
    min: 0,
    description: '2% of withdrawalAmount (paid by platform)'
  },
  
  netProfit: {
    type: Number,
    required: true,
    description: 'customerCharges - withdrawalFee'
  },
  
  // Security and authorization
  securityCode: {
    type: String,
    required: true,
    description: 'Security code entered for authorization'
  },
  
  authorizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  authorizedRole: {
    type: String,
    required: true,
    enum: ['MANAGER', 'OWNER', 'ADMIN', 'SUPERVISOR', 'OTHER'],
    default: 'Manager'
  },
  
  customRole: {
    type: String,
    trim: true,
    default: '',
    description: 'If "Other" is selected, specify role here'
  },
  
  // Status tracking
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Transaction details
  transactionId: {
    type: String,
    trim: true,
    default: '',
    description: 'Transaction ID from mobile money provider'
  },
  
  // FIXED: Provider response field - use mongoose.Schema.Types.Mixed correctly
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    description: 'Raw response from payment provider'
  },
  
  // Bank/account details (where funds were sent)
  bankDetails: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankCode: { type: String, default: '' }
  },
  
  // Contact information
  paymentPhoneNumber: {
    type: String,
    required: true,
    description: 'Restaurant\'s mobile money number for withdrawal'
  },
  
  // Metadata
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Timestamps
  processedAt: {
    type: Date,
    description: 'When the withdrawal was processed by provider'
  },
  
  completedAt: {
    type: Date,
    description: 'When withdrawal was marked as completed'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
paymentWithdrawalSchema.index({ restaurant: 1, date: -1 });
paymentWithdrawalSchema.index({ restaurant: 1, paymentMethod: 1 });
paymentWithdrawalSchema.index({ withdrawalNumber: 1 });
paymentWithdrawalSchema.index({ status: 1 });
paymentWithdrawalSchema.index({ restaurant: 1, status: 1, date: -1 });
paymentWithdrawalSchema.index({ 'orders': 1 });

// Pre-save middleware to generate withdrawal number
paymentWithdrawalSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    this.withdrawalNumber = `WDL-${timestamp}-${random}`;
    
    // Ensure dates are set correctly
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

// Virtual getters
paymentWithdrawalSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

paymentWithdrawalSchema.virtual('formattedAmount').get(function() {
  return this.withdrawalAmount.toLocaleString();
});

paymentWithdrawalSchema.virtual('formattedFee').get(function() {
  return this.withdrawalFee.toLocaleString();
});

paymentWithdrawalSchema.virtual('formattedNetProfit').get(function() {
  return this.netProfit.toLocaleString();
});

// Static method to calculate totals for a restaurant
paymentWithdrawalSchema.statics.getRestaurantTotals = async function(restaurantId) {
  const result = await this.aggregate([
    { $match: { restaurant: restaurantId, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalWithdrawn: { $sum: '$withdrawalAmount' },
        totalFees: { $sum: '$withdrawalFee' },
        totalProfit: { $sum: '$netProfit' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || { totalWithdrawn: 0, totalFees: 0, totalProfit: 0, count: 0 };
};

// Static method to get withdrawal summary by date
paymentWithdrawalSchema.statics.getDailySummary = async function(restaurantId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        restaurant: restaurantId,
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          paymentMethod: '$paymentMethod'
        },
        totalAmount: { $sum: '$withdrawalAmount' },
        totalFees: { $sum: '$withdrawalFee' },
        totalProfit: { $sum: '$netProfit' },
        count: { $sum: 1 },
        ordersCount: { $sum: { $size: '$orders' } }
      }
    },
    { $sort: { '_id.date': -1 } }
  ]);
};

// Ensure virtuals are included
paymentWithdrawalSchema.set('toJSON', { virtuals: true });
paymentWithdrawalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PaymentWithdrawal', paymentWithdrawalSchema);