import React, { useState, useEffect } from 'react';
import axios from 'axios';
import type { Order, OrderStats } from '../types/order';

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<OrderStats>({ 
    today: 0, 
    total: 0, 
    byStatus: [] 
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [filter]);

  const fetchOrders = async (): Promise<void> => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/orders?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setError('Failed to load orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/orders/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Ensure we have a valid stats object
      setStats(response.data.stats || { today: 0, total: 0, byStatus: [] });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Set default stats if API fails
      setStats({ today: 0, total: 0, byStatus: [] });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/orders/${orderId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`Order ${newStatus} successfully!`);
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order status');
    }
  };

  const markAsPaid = async (orderId: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/orders/${orderId}/pay`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Order marked as paid successfully!');
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      alert('Failed to mark order as paid');
    }
  };

  const getStatusColor = (status: Order['status']): string => {
    const colors: Record<Order['status'], string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-cyan-500',
      preparing: 'bg-orange-500',
      ready: 'bg-teal-500',
      served: 'bg-purple-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    };
    return colors[status];
  };

  const getStatusIcon = (status: Order['status']): string => {
    const icons: Record<Order['status'], string> = {
      pending: 'ri-time-line',
      confirmed: 'ri-checkbox-circle-line',
      preparing: 'ri-restaurant-line',
      ready: 'ri-check-double-line',
      served: 'ri-user-voice-line',
      completed: 'ri-checkbox-circle-fill',
      cancelled: 'ri-close-circle-line'
    };
    return icons[status];
  };

  const getPaymentStatusColor = (status: Order['paymentStatus']): string => {
    const colors: Record<Order['paymentStatus'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      refunded: 'bg-red-100 text-red-800'
    };
    return colors[status];
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFilterButtons = (): Array<{ key: string; label: string; icon: string }> => [
    { key: 'all', label: 'All Orders', icon: 'ri-list-check' },
    { key: 'pending', label: 'Pending', icon: 'ri-time-line' },
    { key: 'confirmed', label: 'Confirmed', icon: 'ri-checkbox-circle-line' },
    { key: 'preparing', label: 'Preparing', icon: 'ri-restaurant-line' },
    { key: 'ready', label: 'Ready', icon: 'ri-check-double-line' },
    { key: 'served', label: 'Served', icon: 'ri-user-voice-line' }
  ];

  // Safe access to stats with fallbacks
  const todayOrders = stats?.today || 0;
  const totalOrders = stats?.total || 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <i className="ri-error-warning-line text-red-500 text-lg mr-3"></i>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <i className="ri-restaurant-line text-blue-600"></i>
              Order Management
            </h1>
            <p className="text-gray-600 mt-2">Manage and track your restaurant orders</p>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center min-w-32">
              <div className="flex items-center justify-center gap-2 mb-2">
                <i className="ri-calendar-todo-line text-blue-500"></i>
                <span className="text-sm font-medium text-gray-600">Today</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{todayOrders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center min-w-32">
              <div className="flex items-center justify-center gap-2 mb-2">
                <i className="ri-file-list-3-line text-green-500"></i>
                <span className="text-sm font-medium text-gray-600">Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {getFilterButtons().map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                filter === key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              <i className={icon}></i>
              {label}
            </button>
          ))}
        </div>

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <i className="ri-inbox-line text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "You don't have any orders yet." 
                : `No orders with status "${filter}"`}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Order Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">#{order.orderNumber}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <i className="ri-time-line"></i>
                        <span>{formatTime(order.createdAt)} • {formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)} text-white`}>
                        <i className={getStatusIcon(order.status)}></i>
                        {order.status.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        <i className={order.paymentStatus === 'paid' ? 'ri-wallet-3-line' : 'ri-wallet-line'}></i>
                        {order.paymentStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <i className="ri-restaurant-2-line"></i>
                      <span className="capitalize">{order.orderType}</span>
                      {order.table && (
                        <>
                          <i className="ri-table-line ml-2"></i>
                          <span>Table {order.table.tableNumber}</span>
                        </>
                      )}
                    </div>
                    {order.customerName && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <i className="ri-user-line"></i>
                        <span>{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-gray-400">• {order.customerPhone}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-list-check"></i>
                    Order Items
                  </h4>
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 bg-gray-100 rounded px-2 py-1 text-sm">
                              {item.quantity}x
                            </span>
                            <span className="font-medium text-gray-900">{item.menuItem.name}</span>
                          </div>
                          {item.specialInstructions && (
                            <p className="text-sm text-gray-500 mt-1 italic">
                              <i className="ri-chat-1-line mr-1"></i>
                              {item.specialInstructions}
                            </p>
                          )}
                        </div>
                        <span className="font-medium text-green-600">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Total & Notes */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-900">Total Amount</span>
                    <span className="text-xl font-bold text-green-600">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  {order.customerNotes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <i className="ri-chat-quote-line text-yellow-500 mt-0.5"></i>
                        <div>
                          <span className="font-medium text-yellow-800 text-sm">Customer Note:</span>
                          <p className="text-yellow-700 text-sm mt-1">{order.customerNotes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Actions */}
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {/* Status Update Buttons */}
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order._id, 'confirmed')}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <i className="ri-check-line"></i>
                          Confirm
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order._id, 'cancelled')}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <i className="ri-close-line"></i>
                          Cancel
                        </button>
                      </>
                    )}

                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'preparing')}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-restaurant-line"></i>
                        Start Preparing
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'ready')}
                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-check-double-line"></i>
                        Mark Ready
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'served')}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-user-voice-line"></i>
                        Mark Served
                      </button>
                    )}

                    {order.status === 'served' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'completed')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-checkbox-circle-line"></i>
                        Complete
                      </button>
                    )}

                    {/* Payment Button */}
                    {order.paymentStatus === 'pending' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => markAsPaid(order._id)}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-wallet-3-line"></i>
                        Mark Paid
                      </button>
                    )}

                    {/* Cancel Button for Active Orders */}
                    {order.status !== 'cancelled' && order.status !== 'completed' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'cancelled')}
                        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <i className="ri-close-line"></i>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;