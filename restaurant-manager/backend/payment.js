const express = require('express');
const { Pay } = require('@nkwa-pay/sdk');
const router = express.Router();

// Initialize Nkwa Pay client
const pay = new Pay({
    apiKeyAuth: process.env.PAY_API_KEY_AUTH,
    debugLogger: console,
});

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
        res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
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
        res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
    }
});

// Get payment status
router.get('/:id', async (req, res) => {
    try {
        const response = await pay.payments.get(req.params.id);
        res.json({ success: true, data: response.payment });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
    }
});

module.exports = router;
