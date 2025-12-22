const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

// Import Order model (adjust path based on your project structure)
const Order = require('./models/Order'); // or './models/Order'

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Verify RSA signature as per Nkwa Pay documentation
 * Message format: timestamp + callback_url + json_body
 */
function verifyRSASignature(publicKeyPem, message, signatureBase64) {
  try {
    console.log('🔐 Starting RSA signature verification...');
    
    // Decode base64 signature
    const signature = Buffer.from(signatureBase64, 'base64');
    
    // Compute SHA-256 hash of the message
    const digest = crypto.createHash('sha256').update(message).digest();
    
    console.log('✅ Digest computed');
    
    // Create verify object
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(digest);
    verify.end();
    
    // Verify the signature
    const isValid = verify.verify(publicKeyPem, signature);
    
    console.log(`🔐 Signature verification result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    return isValid;
    
  } catch (error) {
    console.error('❌ Error in signature verification:', error.message);
    return false;
  }
}

/**
 * Handle payment/collection events
 */
async function handlePaymentEvent(event) {
  try {
    console.log('💰 Processing payment event:', event.id);
    console.log('📋 Event details:', {
      type: event.type,
      status: event.status,
      reference: event.reference,
      amount: event.amount,
      phoneNumber: event.phoneNumber
    });
    
    // Update order payment status in your database
    if (event.reference) {
      // First try to find by orderNumber (which should be your reference)
      let order = await Order.findOne({ 
        orderNumber: event.reference 
      });
      
      // If not found, try to find by transaction ID in paymentDetails
      if (!order && event.id) {
        order = await Order.findOne({
          'paymentDetails.transactionId': event.id
        });
      }
      
      if (order) {
        const previousPaymentStatus = order.paymentStatus;
        
        // Map Nkwa Pay status to your schema status
        const statusMap = {
          'success': 'completed',
          'completed': 'completed', 
          'paid': 'completed',
          'failed': 'failed',
          'failure': 'failed',
          'pending': 'pending'
        };
        
        const mappedStatus = statusMap[event.status] || 'pending';
        const paymentMethod = event.phoneNumber ? 'MTN MoMo' : 'Orange Money';
        
        // Prepare payment details according to YOUR schema
        const paymentDetails = {
          method: paymentMethod,
          phoneNumber: event.phoneNumber || order.paymentDetails?.phoneNumber || '',
          transactionId: event.id,
          status: mappedStatus,
          amountPaid: event.amount || order.totalAmount,
          paymentDate: new Date(),
          currency: 'CFA',
          paymentProvider: 'Nkwa Pay',
          customerEmail: order.customerEmail || '',
          notes: `Webhook received: ${event.status}`
        };
        
        switch (mappedStatus) {
          case 'completed':
            order.paymentStatus = 'paid';
            order.paidAt = new Date();
            order.paymentDetails = paymentDetails;
            
            // Auto-confirm order if it's still pending
            if (order.status === 'pending') {
              order.status = 'confirmed';
            }
            
            // Calculate amountPaidWithCharges
            // Use the amountPaid from paymentDetails
            order.amountPaidWithCharges = paymentDetails.amountPaid;
            
            console.log(`✅ Order ${order.orderNumber} marked as PAID via webhook`);
            console.log(`💰 Amounts - Cart: ${order.totalAmount} CFA | Paid: ${order.amountPaidWithCharges} CFA`);
            break;
            
          case 'failed':
            order.paymentStatus = 'pending'; // Keep as pending for retry
            order.paymentDetails = {
              ...paymentDetails,
              notes: `Payment failed: ${event.failureReason || event.message || 'Unknown reason'}`
            };
            console.log(`❌ Order ${order.orderNumber} payment FAILED via webhook`);
            break;
            
          case 'pending':
            order.paymentStatus = 'pending';
            order.paymentDetails = paymentDetails;
            console.log(`⏳ Order ${order.orderNumber} payment PENDING via webhook`);
            break;
            
          default:
            console.log(`⚠️ Unknown status for order ${order.orderNumber}:`, event.status);
            order.paymentDetails = paymentDetails;
        }
        
        // Save the order
        await order.save();
        console.log(`💾 Order ${order.orderNumber} saved with status: ${order.paymentStatus}`);
        
        // Log if status changed
        if (previousPaymentStatus !== order.paymentStatus) {
          console.log(`🔄 Payment status changed: ${previousPaymentStatus} → ${order.paymentStatus}`);
        }
        
        return true;
        
      } else {
        console.log(`⚠️ No order found for reference: ${event.reference} or transaction ID: ${event.id}`);
        
        // Create a log for orphaned webhook events
        console.log('📦 Orphaned webhook event:', {
          reference: event.reference,
          transactionId: event.id,
          amount: event.amount,
          status: event.status,
          timestamp: new Date().toISOString()
        });
        
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Error handling payment event:', error.message);
    return false;
  }
}

// ================================
// COLLECT PAYMENT (UPDATED)
// ================================
router.post('/collect-payment', async (req, res) => {
  try {
    const { amount, phoneNumber, orderNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required',
      });
    }

    console.log(`💰 Collecting payment: ${amount} XAF from ${phoneNumber}`);
    
    // CRITICAL: Include orderNumber as reference for webhook matching
    const requestBody = {
      amount: Number(amount),
      phoneNumber,
      reference: orderNumber || `ORDER-${Date.now()}`
    };

    const response = await axios.post(
      'https://api.pay.mynkwa.com/collect',
      requestBody,
      {
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Payment collection initiated:', response.data);
    
    // Return the transaction ID and reference for tracking
    res.json({
      success: true,
      data: response.data,
      reference: requestBody.reference,
      message: 'Payment collection initiated'
    });

  } catch (error) {
    console.error('❌ Payment collection error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      message: 'Failed to initiate payment collection'
    });
  }
});

// ================================
// DISBURSE PAYMENT (SEND MONEY)
// ================================
router.post('/disburse-payment', async (req, res) => {
  try {
    const { amount, phoneNumber, reference } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required',
      });
    }

    console.log(`💸 Disbursing ${amount} XAF to ${phoneNumber}`);

    const requestBody = {
      amount: Number(amount),
      phoneNumber,
      reference: reference || `DISB-${Date.now()}`
    };

    const response = await axios.post(
      'https://api.pay.mynkwa.com/disburse',
      requestBody,
      {
        headers: {
          'X-API-Key': process.env.MYNKWA_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Disbursement initiated:', response.data);

    res.json({
      success: true,
      data: response.data,
      reference: requestBody.reference,
      message: 'Disbursement initiated',
    });

  } catch (error) {
    console.error('❌ Disbursement error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      message: 'Failed to initiate disbursement'
    });
  }
});

// ================================
// PAYMENT STATUS (REAL IMPLEMENTATION)
// ================================
router.get('/payment-status/:id', async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    console.log(`🔍 Checking payment status for: ${transactionId}`);
    
    // Check your database for webhook updates
    const order = await Order.findOne({
      'paymentDetails.transactionId': transactionId
    }).select('orderNumber paymentStatus paymentDetails totalAmount amountPaidWithCharges');
    
    if (order) {
      return res.json({
        success: true,
        transactionId,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        providerStatus: order.paymentDetails?.status,
        amount: order.totalAmount,
        amountPaid: order.amountPaidWithCharges,
        serviceCharge: order.serviceCharge,
        details: order.paymentDetails,
        checkedAt: new Date().toISOString(),
      });
    }
    
    // If not found in database
    res.json({
      success: true,
      transactionId,
      status: 'unknown',
      message: 'Transaction not found in system',
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to check payment status'
    });
  }
});

// ================================
// WEBHOOK (WITH RSA SIGNATURE VERIFICATION)
// ================================
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Get raw body as Buffer
  async (req, res) => {
    try {
      const signature = req.headers['x-signature'];
      const timestamp = req.headers['x-timestamp'];

      if (!signature || !timestamp) {
        console.error('❌ Missing signature or timestamp headers');
        return res.status(400).json({ error: 'Missing signature or timestamp headers' });
      }

      // 1. Convert raw Buffer to string
      const rawBodyString = req.body.toString('utf8');
      console.log('📦 Raw body string received:', rawBodyString);

      // 2. Now parse it as JSON
      const event = JSON.parse(rawBodyString);
      console.log('✅ Event parsed successfully:', event.id);

      // 3. YOUR LOGIC HERE (e.g., signature verification, updating orders)
      // ... rest of your webhook logic ...

      // 4. Always return 200 to acknowledge receipt[citation:4]
      res.status(200).json({ received: true, eventId: event.id });

    } catch (err) {
      console.error('❌ Webhook processing failed:', err.message);

      // Check if the error is from JSON.parse
      if (err instanceof SyntaxError) {
        return res.status(400).json({ error: 'Invalid JSON body', detail: err.message });
      }
      // For other errors, still return 200 to prevent Nkwa Pay from retrying[citation:4]
      res.status(200).json({ received: true, error: 'Processing failed' });
    }
  }
);

module.exports = router;