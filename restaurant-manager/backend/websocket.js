const WebSocket = require('ws');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map to store clients by restaurant ID
    this.setupWebSocket();
    console.log('🔌 WebSocket Server Initialized');
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('✅ New WebSocket connection established');
      
      // Extract restaurantId from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const restaurantId = url.searchParams.get('restaurantId');
      const clientType = url.searchParams.get('clientType') || 'unknown';
      
      console.log(`🏪 Client connected: ${clientType} for restaurant ${restaurantId}`);
      
      if (!restaurantId) {
        console.log('❌ No restaurantId provided, closing connection');
        ws.close(1008, 'Restaurant ID required');
        return;
      }

      // Store client by restaurant ID - FIXED: Ensure the Set exists
      if (!this.clients.has(restaurantId)) {
        this.clients.set(restaurantId, new Set());
      }
      this.clients.get(restaurantId).add(ws);
      
      // Store restaurantId on the websocket connection for easy access
      ws.restaurantId = restaurantId;
      ws.clientType = clientType;

      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'connection_established',
        message: 'WebSocket connection established successfully',
        restaurantId: restaurantId,
        timestamp: new Date().toISOString()
      });

      // Handle messages from client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📨 Received WebSocket message:', data);
          
          switch (data.type) {
            case 'auth':
              console.log(`🔐 Authentication for restaurant: ${data.restaurantId}`);
              break;
            case 'pong':
            case 'heartbeat':
              console.log('🏓 Received heartbeat/pong');
              // Update last activity timestamp
              ws.lastActivity = Date.now();
              break;
            default:
              console.log('📨 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      });

      // Handle client disconnection
      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`);
        this.removeClient(restaurantId, ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.removeClient(restaurantId, ws);
      });

      // Set initial activity timestamp
      ws.lastActivity = Date.now();
      
      // Debug: Log current client count
      console.log(`👥 Current clients for restaurant ${restaurantId}: ${this.getClientsByRestaurant(restaurantId)}`);
    });

    // Setup heartbeat to check for dead connections
    this.setupHeartbeat();
  }

  removeClient(restaurantId, ws) {
    if (this.clients.has(restaurantId)) {
      const restaurantClients = this.clients.get(restaurantId);
      restaurantClients.delete(ws);
      
      if (restaurantClients.size === 0) {
        this.clients.delete(restaurantId);
      }
      
      console.log(`🗑️ Client removed from restaurant ${restaurantId}. Remaining: ${restaurantClients.size}`);
    }
  }

  setupHeartbeat() {
    // Check for dead connections every 30 seconds
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds timeout (more generous)
      
      this.clients.forEach((clients, restaurantId) => {
        const clientsArray = Array.from(clients); // Convert to array to avoid modification during iteration
        clientsArray.forEach(ws => {
          if (now - ws.lastActivity > timeout) {
            console.log(`💀 Closing dead connection for restaurant ${restaurantId}`);
            ws.terminate();
            this.removeClient(restaurantId, ws);
          } else {
            // Send ping to check if client is still alive
            if (ws.readyState === WebSocket.OPEN) {
              this.sendToClient(ws, {
                type: 'ping',
                timestamp: new Date().toISOString()
              });
            }
          }
        });
      });
    }, 30000);
  }

  // Safe method to send messages to a client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('❌ Failed to send message to client:', error);
        return false;
      }
    }
    return false;
  }

  // Notify all clients of a specific restaurant about a new order
  notifyNewOrder(order) {
    const restaurantId = order.restaurant._id || order.restaurant;
    console.log(`🔔 Notifying restaurant ${restaurantId} about new order: ${order.orderNumber}`);
    
    // DEBUG: Log current client state before notification
    console.log(`🔍 DEBUG: Before notification - Clients map has restaurant: ${this.clients.has(restaurantId)}`);
    if (this.clients.has(restaurantId)) {
      console.log(`🔍 DEBUG: Client count: ${this.clients.get(restaurantId).size}`);
    }
    
    this.notifyRestaurant(restaurantId, {
      type: 'new_order',
      order: order,
      message: 'New order received',
      timestamp: new Date().toISOString()
    });
  }

  // Notify all clients of a specific restaurant about order update
  notifyOrderUpdate(order) {
    const restaurantId = order.restaurant._id || order.restaurant;
    console.log(`🔔 Notifying restaurant ${restaurantId} about order update: ${order.orderNumber}`);
    
    this.notifyRestaurant(restaurantId, {
      type: 'order_updated',
      order: order,
      message: 'Order status updated',
      timestamp: new Date().toISOString()
    });
  }

  // Notify all clients of a specific restaurant about order payment
  notifyOrderPayment(order) {
    const restaurantId = order.restaurant._id || order.restaurant;
    console.log(`🔔 Notifying restaurant ${restaurantId} about order payment: ${order.orderNumber}`);
    
    this.notifyRestaurant(restaurantId, {
      type: 'order_paid',
      order: order,
      message: 'Order marked as paid',
      timestamp: new Date().toISOString()
    });
  }

  // FIXED: Generic method to notify all clients of a restaurant
  notifyRestaurant(restaurantId, message) {
    // Double-check if we have clients for this restaurant
    if (!this.clients.has(restaurantId)) {
      console.log(`❌ No connected clients for restaurant ${restaurantId}`);
      console.log(`🔍 Available restaurants: ${Array.from(this.clients.keys()).join(', ')}`);
      return;
    }

    const clients = this.clients.get(restaurantId);
    
    // Convert to array to avoid issues with Set modification during iteration
    const clientsArray = Array.from(clients);
    
    console.log(`📢 Notifying ${clientsArray.length} clients for restaurant ${restaurantId}`);
    
    let deliveredCount = 0;
    let failedCount = 0;

    clientsArray.forEach(ws => {
      const success = this.sendToClient(ws, message);
      if (success) {
        deliveredCount++;
        console.log(`✅ Notification sent to client for restaurant ${restaurantId}`);
      } else {
        failedCount++;
        console.log(`❌ Failed to send notification to client for restaurant ${restaurantId}`);
        // Remove dead client
        this.removeClient(restaurantId, ws);
      }
    });

    console.log(`📊 Notification stats for restaurant ${restaurantId}: ${deliveredCount} delivered, ${failedCount} failed`);
    
    // Final check - if all failed, log the current state
    if (deliveredCount === 0) {
      console.log(`🚨 CRITICAL: No notifications delivered to restaurant ${restaurantId}`);
      console.log(`🔍 Current client count: ${this.getClientsByRestaurant(restaurantId)}`);
    }
  }

  // Get number of connected clients for a specific restaurant
  getClientsByRestaurant(restaurantId) {
    return this.clients.has(restaurantId) ? this.clients.get(restaurantId).size : 0;
  }

  // Get total number of connected clients
  getClientCount() {
    let total = 0;
    this.clients.forEach(clients => {
      total += clients.size;
    });
    return total;
  }

  // Get detailed debug information
  getDetailedDebugInfo() {
    const debugInfo = {
      totalClients: this.getClientCount(),
      restaurants: {},
      serverStartTime: new Date().toISOString()
    };

    this.clients.forEach((clients, restaurantId) => {
      debugInfo.restaurants[restaurantId] = {
        clientCount: clients.size,
        clientTypes: {},
        connections: []
      };

      clients.forEach(ws => {
        const clientType = ws.clientType || 'unknown';
        if (!debugInfo.restaurants[restaurantId].clientTypes[clientType]) {
          debugInfo.restaurants[restaurantId].clientTypes[clientType] = 0;
        }
        debugInfo.restaurants[restaurantId].clientTypes[clientType]++;
        
        // Add connection details
        debugInfo.restaurants[restaurantId].connections.push({
          clientType: clientType,
          readyState: ws.readyState,
          lastActivity: ws.lastActivity,
          isAlive: Date.now() - ws.lastActivity < 60000
        });
      });
    });

    return debugInfo;
  }
}

module.exports = WebSocketServer;