const express = require('express');
const router = express.Router();
const { Pay } = require('@nkwa-pay/sdk');

// Initialize Nkwa Pay client
const pay = new Pay({
  apiKeyAuth: process.env.PAY_API_KEY_AUTH,
  debugLogger: console,
});

// Collect payment
router.post('/collect-payment', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Amount and phoneNumber are required' });
    }

    const response = await pay.payments.collect({ amount, phoneNumber });
    res.json({ success: true, data: response.payment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// Disburse payment
router.post('/disburse-payment', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Amount and phoneNumber are required' });
    }

    const response = await pay.payments.disburse({ amount, phoneNumber });
    res.json({ success: true, data: response.payment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// Check payment status
router.get('/payment/:id', async (req, res) => {
  try {
    const response = await pay.payments.get(req.params.id);
    res.json({ success: true, data: response.payment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
