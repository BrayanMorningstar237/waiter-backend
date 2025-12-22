const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

// Import Order model (adjust path based on your project structure)
const Order = require('../models/Order'); // or './models/Order'

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
  express.raw({ type: 'application/json' }), // IMPORTANT: Use raw body for signature verification
  async (req, res) => {
    try {
      // Get headers (case-insensitive)
      const signature = req.headers['x-signature'] || req.headers['X-Signature'];
      const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];
      
      // Get the raw body as string
      const rawBody = req.body.toString();
      
      // Reconstruct the webhook URL that Nkwa Pay would use
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const webhookUrl = `${protocol}://${host}${req.originalUrl}`;
      
      console.log('\n📢 =========== WEBHOOK RECEIVED ===========');
      console.log('🌐 Webhook URL:', webhookUrl);
      console.log('📝 Signature present:', !!signature);
      console.log('⏰ Timestamp:', timestamp);
      console.log('📦 Body length:', rawBody.length, 'bytes');
      
      // Validate required headers
      if (!signature || !timestamp) {
        console.error('❌ Missing required headers');
        return res.status(400).json({ 
          error: 'Missing signature or timestamp headers'
        });
      }
      
      // Get public key from environment
      const publicKey = process.env.MYNKWA_PUBLIC_KEY;
      
      if (!publicKey) {
        console.error('❌ Public key not configured in environment');
        return res.status(500).json({ error: 'Server configuration error: Missing public key' });
      }
      
      console.log('🔑 Public key loaded');
      
      // Recompose the message as per Nkwa Pay docs: timestamp + callback_url + json_body
      const message = timestamp + webhookUrl + rawBody;
      
      console.log('🔐 Verifying signature...');
      
      // Verify the signature
      const isValid = verifyRSASignature(publicKey, message, signature);
      
      if (!isValid) {
        console.error('❌ SIGNATURE VERIFICATION FAILED');
        return res.status(401).json({ 
          error: 'Invalid signature',
          verificationFailed: true
        });
      }
      
      console.log('✅ SIGNATURE VERIFICATION SUCCESSFUL');
      
      // Parse the event data
      let event;
      try {
        event = JSON.parse(rawBody);
        console.log('✅ Event parsed successfully');
        console.log('📋 Event type:', event.type);
        console.log('📋 Event ID:', event.id);
        console.log('📋 Event status:', event.status);
        console.log('📋 Event reference:', event.reference);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError.message);
        return res.status(400).json({ 
          error: 'Invalid JSON body'
        });
      }
      
      // Process the event based on type
      let processed = false;
      
      switch (event.type?.toLowerCase()) {
        case 'collection':
        case 'payment':
          console.log('🔄 Processing payment/collection event');
          processed = await handlePaymentEvent(event);
          break;
          
        case 'disbursement':
          console.log('🔄 Processing disbursement event');
          // You would implement handleDisbursementEvent similar to handlePaymentEvent
          processed = true; // Placeholder
          break;
          
        case 'refund':
          console.log('🔄 Processing refund event');
          // You would implement handleRefundEvent
          processed = true; // Placeholder
          break;
          
        default:
          console.log(`⚠️ Unknown event type: ${event.type}`);
          processed = true;
      }
      
      console.log('✅ =========== WEBHOOK PROCESSED ===========\n');
      
      // IMPORTANT: Always return 200 OK to acknowledge receipt
      res.status(200).json({ 
        received: true, 
        verified: true,
        processed: processed,
        eventId: event.id,
        eventType: event.type,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('❌ =========== WEBHOOK ERROR ===========');
      console.error('❌ Error:', err.message);
      console.error('❌ ======================================\n');
      
      // Still return 200 to prevent retries for unexpected errors
      res.status(200).json({ 
        received: true, 
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;