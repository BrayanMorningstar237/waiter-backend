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
// DISBURSE PAYMENT (Payout)
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

    console.log('✅ Disbursement initiated:', {
      transactionId: response.data.id,
      status: response.data.status,
      amount: response.data.amount
    });

    res.json({
      success: true,
      data: response.data,
      message: 'Disbursement initiated',
    });

  } catch (error) {
    console.error('❌ Disbursement failed:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// ================================
// WITHDRAWAL DISBURSEMENT (Payout to Restaurant)
// ================================
router.post('/withdrawals/disburse', async (req, res) => {
  try {
    const { 
      amount, 
      phoneNumber, 
      withdrawalId,
      provider = 'mtn' 
    } = req.body;

    if (!amount || !phoneNumber || !withdrawalId) {
      return res.status(400).json({
        success: false,
        message: 'Amount, phone number, and withdrawal ID are required',
      });
    }

    console.log(`💰 Processing withdrawal disbursement:`, {
      withdrawalId,
      amount: `${amount} XAF`,
      phoneNumber,
      provider: provider.toUpperCase()
    });

    // Call Mynkwa disbursement API
    const response = await axios.post(
      'https://api.pay.mynkwa.com/disburse',
      {
        amount: Number(amount),
        phoneNumber,
        provider: provider.toUpperCase()
      },
      {
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Withdrawal disbursement initiated:', {
      withdrawalId,
      transactionId: response.data.id,
      status: response.data.status,
      amount: response.data.amount,
      provider: provider.toUpperCase()
    });

    // Store SSE connection for withdrawal status
    if (response.data.id) {
      // You can implement SSE for withdrawal status if needed
    }

    res.json({
      success: true,
      data: response.data,
      withdrawalId: withdrawalId,
      message: `Withdrawal disbursement to ${phoneNumber} initiated via ${provider.toUpperCase()}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Withdrawal disbursement failed:', {
      error: error.response?.data || error.message,
      withdrawalId: req.body.withdrawalId
    });
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      withdrawalId: req.body.withdrawalId
    });
  }
});

// ================================
// WITHDRAWAL STATUS STREAM
// ================================
router.get('/withdrawals/:id/status-stream', async (req, res) => {
  const { id: withdrawalId } = req.params;
  
  console.log(`💰 New SSE connection for withdrawal status: ${withdrawalId}`);
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Withdrawal status SSE connection established',
    withdrawalId: withdrawalId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Store the connection
  if (!paymentConnections.has(withdrawalId)) {
    paymentConnections.set(withdrawalId, new Set());
  }
  paymentConnections.get(withdrawalId).add(res);

  // Polling for withdrawal status (similar to payment status)
  let pollingInterval;
  const pollWithdrawalStatus = async () => {
    try {
      console.log(`🔄 Polling withdrawal status for ${withdrawalId}`);
      
      // This would query your database for withdrawal status
      // For now, we'll simulate
      const mockStatus = {
        status: 'completed',
        amount: 100000,
        transactionId: `TXN-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      
      res.write(`data: ${JSON.stringify({
        type: 'withdrawal_status',
        withdrawalId: withdrawalId,
        status: mockStatus.status,
        data: mockStatus,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      if (mockStatus.status === 'completed' || mockStatus.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        res.write(`data: ${JSON.stringify({
          type: 'withdrawal_final',
          withdrawalId: withdrawalId,
          status: mockStatus.status,
          isFinal: true,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        // Clean up connection
        if (paymentConnections.has(withdrawalId)) {
          paymentConnections.get(withdrawalId).delete(res);
          if (paymentConnections.get(withdrawalId).size === 0) {
            paymentConnections.delete(withdrawalId);
          }
        }
        
        res.end();
      }
      
    } catch (error) {
      console.error(`❌ Error polling withdrawal ${withdrawalId}:`, error.message);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        withdrawalId: withdrawalId,
        error: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  };

  // Start polling
  pollingInterval = setInterval(pollWithdrawalStatus, 5000);

  // Remove connection when client closes
  req.on('close', () => {
    console.log(`💰 SSE connection closed for withdrawal: ${withdrawalId}`);
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    if (paymentConnections.has(withdrawalId)) {
      paymentConnections.get(withdrawalId).delete(res);
      if (paymentConnections.get(withdrawalId).size === 0) {
        paymentConnections.delete(withdrawalId);
      }
    }
  });
});
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

    console.log('🔍 Mynkwa API full response:', JSON.stringify(response.data, null, 2));
    
    console.log('✅ Payment collection initiated:', {
      transactionId: response.data.id,
      status: response.data.status,
      amount: response.data.amount
    });

    res.json({
      success: true,
      data: response.data,
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
    'X-Accel-Buffering': 'no'
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
  let initialPollTimeout;
  let attemptCount = 0;
  const maxAttempts = 60;
  const baseInterval = 5000;
  
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
      
      // ⭐️ CRITICAL FIX: Nkwa returns 'success' NOT 'successful'
      if (statusData.status === 'success' || statusData.status === 'failed' || attemptCount >= maxAttempts) {
        console.log(`🛑 FINAL STATUS DETECTED: ${statusData.status}. Stopping ALL polling...`);
        
        // ⭐️ CRITICAL: Clear ALL intervals and timeouts
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          console.log(`✅ Cleared polling interval for ${transactionId}`);
        }
        
        // Also clear the initial timeout
        if (initialPollTimeout) {
          clearTimeout(initialPollTimeout);
          initialPollTimeout = null;
        }
        
        // Create final event
        const finalEvent = {
          type: 'final_status',
          transactionId: transactionId,
          status: statusData.status,
          data: statusData,
          isFinal: true,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ Stopped polling for ${transactionId}, final status: ${statusData.status}`);
        
        // Send final event
        res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
        
        // Flush data to ensure it's sent
        if (res.flush) {
          res.flush();
        }
        
        // Clean up connection immediately
        if (paymentConnections.has(transactionId)) {
          paymentConnections.get(transactionId).delete(res);
          if (paymentConnections.get(transactionId).size === 0) {
            paymentConnections.delete(transactionId);
          }
        }
        
        // End the response stream immediately
        res.end();
        
        // ⭐️ IMPORTANT: Return to stop ALL further execution
        return;
      }
      
      // Adaptive polling - increase interval if still pending
      if (statusData.status === 'pending' && attemptCount > 10) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
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
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        
        // Also clear initial timeout
        if (initialPollTimeout) {
          clearTimeout(initialPollTimeout);
          initialPollTimeout = null;
        }
        
        res.write(`data: ${JSON.stringify({
          type: 'not_found',
          transactionId: transactionId,
          error: 'Payment not found',
          isFinal: true,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        // Clean up connection
        if (paymentConnections.has(transactionId)) {
          paymentConnections.get(transactionId).delete(res);
          if (paymentConnections.get(transactionId).size === 0) {
            paymentConnections.delete(transactionId);
          }
        }
        
        // End response
        res.end();
      }
    }
  };

  // Start polling with exponential backoff
  const startPolling = () => {
    // Store the initial timeout so we can clear it later
    initialPollTimeout = setTimeout(pollPaymentStatus, 1000);
    
    // Then regular polling
    pollingInterval = setInterval(pollPaymentStatus, baseInterval);
  };

  startPolling();

  // Remove connection when client closes
  req.on('close', () => {
    console.log(`💰 SSE connection closed for payment: ${transactionId}`);
    
    // Clear ALL intervals and timeouts
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (initialPollTimeout) {
      clearTimeout(initialPollTimeout);
      initialPollTimeout = null;
    }
    
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
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
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