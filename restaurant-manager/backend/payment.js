const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// Store payment status SSE connections
const paymentConnections = new Map();

// Helper function to notify payment status via SSE
function notifyPaymentStatus(transactionId, data) {
  if (!paymentConnections.has(transactionId)) {
    console.log(`❌ No SSE connections for transaction: ${transactionId}`);
    return;
  }

  const connections = paymentConnections.get(transactionId);
  let delivered = 0;
  
  connections.forEach(res => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      delivered++;
    } catch (error) {
      console.error('❌ Failed to send payment status SSE:', error);
    }
  });
  
  console.log(`💰 Notified ${delivered} clients for transaction ${transactionId}`);
}

// ================================
// COLLECT PAYMENT (Mobile Money)
// ================================
router.post('/payments/collect', async (req, res) => {
  try {
    const { amount, phoneNumber, provider = 'mtn' } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required',
      });
    }

    console.log(`💰 Initiating ${provider.toUpperCase()} payment for ${phoneNumber}: ${amount} XAF`);

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

    console.log('✅ Payment collection initiated:', {
      transactionId: response.data.data.id,
      status: response.data.data.status,
      amount: response.data.data.amount
    });

    res.json({
      success: true,
      data: response.data.data,
      reference: response.data.reference,
      message: `Payment collection initiated via ${provider.toUpperCase()}`
    });

  } catch (error) {
    console.error('❌ Payment collection failed:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// ================================
// PAYMENT STATUS WITH SSE
// ================================
router.get('/payment-status/:id/stream', async (req, res) => {
  const { id: transactionId } = req.params;
  
  console.log(`💰 New SSE connection for payment status: ${transactionId}`);
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Payment status SSE connection established',
    transactionId: transactionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Store the connection
  if (!paymentConnections.has(transactionId)) {
    paymentConnections.set(transactionId, new Set());
  }
  paymentConnections.get(transactionId).add(res);

  // Smart polling for payment status
  let pollingInterval;
  let attemptCount = 0;
  const maxAttempts = 60; // 5 minutes max (5 seconds * 60 attempts)
  const baseInterval = 5000; // Start with 5 seconds
  
  const pollPaymentStatus = async () => {
    try {
      attemptCount++;
      
      console.log(`🔄 Polling payment status for ${transactionId}, attempt ${attemptCount}`);
      
      const options = {
        method: 'GET',
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY
        }
      };

      const response = await axios.get(
        `https://api.pay.mynkwa.com/payments/${transactionId}`,
        options
      );

      const statusData = response.data;
      console.log(`💰 Payment ${transactionId} status:`, statusData.status);
      
      // Send status update via SSE
      res.write(`data: ${JSON.stringify({
        type: 'status_update',
        transactionId: transactionId,
        status: statusData.status,
        data: statusData,
        attempt: attemptCount,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // If payment is successful or failed, stop polling
      if (statusData.status === 'successful' || statusData.status === 'failed' || attemptCount >= maxAttempts) {
        clearInterval(pollingInterval);
        
        // Send final event
        res.write(`data: ${JSON.stringify({
          type: 'final_status',
          transactionId: transactionId,
          status: statusData.status,
          data: statusData,
          isFinal: true,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        console.log(`✅ Stopped polling for ${transactionId}, final status: ${statusData.status}`);
        
        // Clean up after delay
        setTimeout(() => {
          if (paymentConnections.has(transactionId)) {
            paymentConnections.get(transactionId).delete(res);
            if (paymentConnections.get(transactionId).size === 0) {
              paymentConnections.delete(transactionId);
            }
          }
          res.end();
        }, 2000);
      }
      
      // Adaptive polling - increase interval if still pending
      if (statusData.status === 'pending' && attemptCount > 10) {
        clearInterval(pollingInterval);
        pollingInterval = setInterval(pollPaymentStatus, 10000); // Switch to 10 seconds
        console.log(`⏱️ Slowed polling to 10s for ${transactionId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error polling payment ${transactionId}:`, error.message);
      
      // Send error via SSE
      res.write(`data: ${JSON.stringify({
        type: 'error',
        transactionId: transactionId,
        error: error.message,
        attempt: attemptCount,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // Stop polling on persistent errors
      if (attemptCount >= 3 && error.response?.status === 404) {
        clearInterval(pollingInterval);
        res.write(`data: ${JSON.stringify({
          type: 'not_found',
          transactionId: transactionId,
          error: 'Payment not found',
          isFinal: true,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        setTimeout(() => {
          if (paymentConnections.has(transactionId)) {
            paymentConnections.get(transactionId).delete(res);
            if (paymentConnections.get(transactionId).size === 0) {
              paymentConnections.delete(transactionId);
            }
          }
          res.end();
        }, 2000);
      }
    }
  };

  // Start polling with exponential backoff
  const startPolling = () => {
    // Initial immediate check
    setTimeout(pollPaymentStatus, 1000);
    
    // Then regular polling
    pollingInterval = setInterval(pollPaymentStatus, baseInterval);
  };

  startPolling();

  // Remove connection when client closes
  req.on('close', () => {
    console.log(`💰 SSE connection closed for payment: ${transactionId}`);
    clearInterval(pollingInterval);
    
    if (paymentConnections.has(transactionId)) {
      paymentConnections.get(transactionId).delete(res);
      if (paymentConnections.get(transactionId).size === 0) {
        paymentConnections.delete(transactionId);
      }
    }
  });

  // Handle client disconnect
  res.on('close', () => {
    console.log(`💰 Client disconnected from SSE for payment: ${transactionId}`);
    clearInterval(pollingInterval);
  });
});

// ================================
// CHECK SINGLE PAYMENT STATUS
// ================================
router.get('/payments/:id/status', async (req, res) => {
  try {
    const { id: transactionId } = req.params;
    
    console.log(`🔍 Single status check for payment: ${transactionId}`);
    
    const options = {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.MYNKWA_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.get(
      `https://api.pay.mynkwa.com/payments/${transactionId}`,
      options
    );

    console.log(`✅ Retrieved payment status for ${transactionId}:`, response.data.status);
    
    res.json({
      success: true,
      data: response.data,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to check payment status:', error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      checkedAt: new Date().toISOString()
    });
  }
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

      // Notify SSE connections if any
      if (event.data?.id) {
        const transactionId = event.data.id;
        notifyPaymentStatus(transactionId, {
          type: 'webhook_update',
          transactionId,
          status: event.data.status,
          data: event.data,
          source: 'webhook',
          timestamp: new Date().toISOString()
        });
        console.log(`🔔 Webhook notification sent via SSE for ${transactionId}`);
      }

      // Handle specific event types
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

// ================================
// DEBUG ENDPOINT
// ================================
router.get('/payment-connections-debug', (req, res) => {
  const debugInfo = {
    totalConnections: 0,
    transactions: {}
  };

  paymentConnections.forEach((connections, transactionId) => {
    debugInfo.transactions[transactionId] = connections.size;
    debugInfo.totalConnections += connections.size;
  });

  res.json(debugInfo);
});

module.exports = router;