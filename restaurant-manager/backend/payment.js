const express = require('express');
const router = express.Router();

// Initialize Nkwa Pay client (with better error handling)
let pay = null;

try {
  const { Pay } = require('@nkwa-pay/sdk');
  
  if (process.env.PAY_API_KEY_AUTH) {
    pay = new Pay({
      apiKeyAuth: process.env.PAY_API_KEY_AUTH,
      debugLogger: console,
    });
    console.log('✅ Nkwa Pay initialized successfully');
  } else {
    console.warn('⚠️ PAY_API_KEY_AUTH not set. Using mock payment mode.');
    pay = createMockPay();
  }
} catch (error) {
  console.error('❌ Failed to load Nkwa Pay SDK:', error.message);
  console.warn('🔄 Creating mock payment system');
  pay = createMockPay();
}

// Create mock payment functions for development/testing
function createMockPay() {
  console.log('🔄 Creating mock payment system');
  
  return {
    payments: {
      collect: async ({ amount, phoneNumber }) => {
        console.log('💰 Mock collect:', { amount, phoneNumber });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        
        const mockId = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
        
        return {
          payment: {
            id: mockId,
            reference: mockId,
            status: 'completed',
            amount: amount,
            phoneNumber: phoneNumber
          }
        };
      },
      
      disburse: async ({ amount, phoneNumber }) => {
        console.log('💰 Mock disburse:', { amount, phoneNumber });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockId = `MOCK-DIS-${Date.now()}`;
        
        return {
          payment: {
            id: mockId,
            status: 'completed'
          }
        };
      },
      
      get: async (id) => {
        console.log('🔍 Mock get payment:', id);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
          payment: {
            id: id,
            status: 'completed',
            amount: 1000,
            phoneNumber: '237671234567'
          }
        };
      }
    }
  };
}

// Collect payment endpoint
router.post('/collect', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Amount and phoneNumber are required' });
    }

    const response = await pay.payments.collect({ amount, phoneNumber });
    res.json({ success: true, data: response.payment });
  } catch (err) {
    console.error('❌ Collect payment error:', err);
    res.status(err.statusCode || 500).json({ 
      success: false, 
      error: err.message || 'Internal server error',
      isMock: !process.env.PAY_API_KEY_AUTH // Indicate if using mock
    });
  }
});

// Disburse payment endpoint
router.post('/disburse', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Amount and phoneNumber are required' });
    }

    const response = await pay.payments.disburse({ amount, phoneNumber });
    res.json({ success: true, data: response.payment });
  } catch (err) {
    console.error('❌ Disburse payment error:', err);
    res.status(err.statusCode || 500).json({ 
      success: false, 
      error: err.message || 'Internal server error',
      isMock: !process.env.PAY_API_KEY_AUTH
    });
  }
});

// Get payment status
router.get('/:id', async (req, res) => {
  try {
    const response = await pay.payments.get(req.params.id);
    res.json({ success: true, data: response.payment });
  } catch (err) {
    console.error('❌ Get payment error:', err);
    res.status(err.statusCode || 500).json({ 
      success: false, 
      error: err.message || 'Internal server error',
      isMock: !process.env.PAY_API_KEY_AUTH
    });
  }
});

// Export both router AND pay instance
module.exports = router;
module.exports.pay = pay; // Export pay for use in server.js