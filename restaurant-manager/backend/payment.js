// payment.js
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// ===== CONFIG =====
const MYNKWA_API_BASE = 'https://api.pay.mynkwa.com';
const MYNKWA_API_KEY = process.env.MYNKWA_API_KEY;

// ===== HELPER =====
const makeNkwaRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${MYNKWA_API_BASE}${endpoint}`,
    headers: {
      'X-API-Key': MYNKWA_API_KEY,
      'Content-Type': 'application/json'
    },
    data
  };

  console.log(`🌐 Mynkwa → ${method} ${endpoint}`);
  return axios(config);
};

const handleApiError = (res, error, operation) => {
  console.error(`❌ ${operation}:`, error.response?.data || error.message);

  res.status(error.response?.status || 500).json({
    success: false,
    message: `${operation} failed`,
    error: error.response?.data || error.message
  });
};

//
// ======================= ROUTES =======================
//

// Health check
router.get('/payments/health', (req, res) => {
  res.json({
    success: true,
    message: 'Mynkwa payments online'
  });
});

// Collect payment
router.post('/payments/collect', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required'
      });
    }

    const response = await makeNkwaRequest('POST', '/collect', {
      amount: Number(amount),
      phoneNumber: phoneNumber.toString()
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'Payment collection');
  }
});

// Disburse payment
router.post('/payments/disburse', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    const response = await makeNkwaRequest('POST', '/disburse', {
      amount: Number(amount),
      phoneNumber: phoneNumber.toString()
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'Payment disbursement');
  }
});

// Payment status
router.get('/payments/:id', async (req, res) => {
  try {
    const response = await makeNkwaRequest(
      'GET',
      `/payments/${req.params.id}`
    );

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'Payment status');
  }
});

// Webhook
router.post(
  '/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const event = JSON.parse(req.body.toString());

      console.log('📢 Mynkwa Webhook:', event.type, event.data?.id);

      // TODO: update Order status here
      // Order.findOneAndUpdate({ paymentId: event.data.id })

      res.status(200).json({ received: true });
    } catch (err) {
      res.status(400).json({ error: 'Invalid webhook payload' });
    }
  }
);

module.exports = router;
