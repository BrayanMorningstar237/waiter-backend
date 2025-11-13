// hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface WebSocketMessage {
  type: string;
  order?: any;
  orderId?: string;
  orderNumber?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPaymentStatus?: string;
  newPaymentStatus?: string;
  timestamp?: string;
  message?: string;
}

export const useWebSocket = (onMessage?: (data: WebSocketMessage) => void) => {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (isConnecting.current || !user?.restaurant?._id) return;

    isConnecting.current = true;
    
    try {
      const restaurantId = user.restaurant._id;
      const token = localStorage.getItem('token');
      const wsUrl = `ws://localhost:5000/ws?restaurantId=${restaurantId}&token=${token}&clientType=dashboard`;
      
      console.log('🔌 Connecting to WebSocket...');
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected');
        isConnecting.current = false;
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          // Handle heartbeat/pong messages
          if (data.type === 'heartbeat') {
            // Send pong response
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
            return;
          }
          
          if (data.type === 'connection_established') {
            console.log('✅ WebSocket connection established');
            return;
          }
          
          // Pass other messages to the callback
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        isConnecting.current = false;
        
        // Attempt reconnect after delay (with exponential backoff)
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
        
        reconnectTimeout.current = window.setTimeout(() => {
          console.log('🔄 Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        isConnecting.current = false;
      };

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      isConnecting.current = false;
    }
  }, [user, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
      ws.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage, disconnect, reconnect: connect };
};