const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// ================================
// COLLECT PAYMENT
// ================================
router.post('/collect-payment', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required',
      });
    }

    const response = await axios.post(
      'https://api.pay.mynkwa.com/collect',
      {
        amount: Number(amount),
        phoneNumber,
      },
      {
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });

  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// ================================
// DISBURSE PAYMENT (SEND MONEY)
// ================================
router.post('/disburse-payment', async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required',
      });
    }

    console.log(`💰 Disbursing ${amount} XAF to ${phoneNumber}`);

    const response = await axios.post(
      'https://api.pay.mynkwa.com/disburse',
      {
        amount: Number(amount),
        phoneNumber,
      },
      {
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
      message: 'Disbursement initiated',
    });

  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// ================================
// PAYMENT STATUS (MOCK)
// ================================
router.get('/payment-status/:id', (req, res) => {
  res.json({
    success: true,
    data: {
      transactionId: req.params.id,
      status: 'pending',
      checkedAt: new Date().toISOString(),
    },
  });
});

// ================================
// WEBHOOK (WITH SIGNATURE VERIFICATION)
// ================================
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const signature = req.headers['x-mynkwa-signature'];
      const secret = process.env.MYNKWA_WEBHOOK_SECRET;

      if (!signature || !secret) {
        return res.status(401).json({ error: 'Missing signature or secret' });
      }

      // Verify signature
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

      if (computedSignature !== signature) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Parse event
      const event = JSON.parse(req.body.toString());

      console.log('📢 Webhook verified:', {
        type: event.type,
        id: event.data?.id,
        status: event.data?.status,
      });

      // Example handling
      if (event.type === 'payment.success') {
        console.log('✅ Payment successful:', event.data.id);
      }

      if (event.type === 'payment.failed') {
        console.log('❌ Payment failed:', event.data.id);
      }

      res.json({ received: true });

    } catch (err) {
      console.error('Webhook error:', err.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  }
);

module.exports = router;
