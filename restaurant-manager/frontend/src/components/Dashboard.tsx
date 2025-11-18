import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import MenuManagement from './MenuManagement';
import OrderManagement from './OrderManagement';
import QRCodeGenerator from './QRCodeGenerator';
import Settings from './Settings';

type TabType = 'dashboard' | 'menu' | 'orders' | 'qr-codes' | 'settings';

// Define TypeScript interfaces for order data
interface OrderItem {
  menuItem: string;
  name: string;
  quantity: number;
  price: number;
  isTakeaway: boolean;
  specialInstructions?: string;
}

interface Table {
  tableNumber: string;
  _id: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  restaurant: {
    _id: string;
    name: string;
    logo?: string;
  };
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  orderType: 'dine-in' | 'takeaway';
  table?: Table;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

// SSE Hook for Dashboard
const useDashboardSSE = (restaurantId: string | undefined, onNewOrder: (order: Order) => void, onOrderUpdate: (order: Order) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectSSE = useCallback(() => {
    if (!restaurantId) {
      console.log('❌ No restaurant ID for SSE connection');
      return;
    }

    try {
      console.log(`🔔 Connecting SSE for dashboard: ${restaurantId}`);
      const eventSource = new EventSource(`http://localhost:5000/api/orders/stream/${restaurantId}`);
      
      eventSource.onopen = () => {
        console.log('✅ Dashboard SSE connection established');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔔 Dashboard SSE message received:', data);

          switch (data.type) {
            case 'connected':
              console.log('✅ Dashboard SSE connection confirmed');
              break;
            case 'new_order':
              console.log('🆕 New order via Dashboard SSE:', data.order.orderNumber);
              onNewOrder(data.order);
              break;
            case 'order_updated':
              console.log('🔄 Order updated via Dashboard SSE:', data.order.orderNumber);
              onOrderUpdate(data.order);
              break;
            case 'order_paid':
              console.log('💳 Order paid via Dashboard SSE:', data.order.orderNumber);
              onOrderUpdate(data.order);
              break;
            default:
              console.log('📨 Unknown Dashboard SSE message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Failed to parse Dashboard SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ Dashboard SSE error:', error);
        setIsConnected(false);
        eventSource.close();
        
        // Attempt reconnect after delay
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(3000 * reconnectAttempts.current, 30000);
          
          console.log(`🔄 Attempting Dashboard SSE reconnect in ${delay}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = window.setTimeout(() => {
            connectSSE();
          }, delay);
        } else {
          console.error('❌ Max Dashboard SSE reconnection attempts reached');
        }
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('❌ Failed to create Dashboard SSE connection:', error);
      setIsConnected(false);
    }
  }, [restaurantId, onNewOrder, onOrderUpdate]);

  useEffect(() => {
    connectSSE();

    return () => {
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
      }
      if (eventSourceRef.current) {
        console.log('🔔 Closing Dashboard SSE connection');
        eventSourceRef.current.close();
      }
    };
  }, [connectSSE]);

  return { isConnected };
};

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  
  // Get active tab and orderId from URL or default to 'dashboard'
  const activeTab = (searchParams.get('tab') as TabType) || 'dashboard';
  const orderIdParam = searchParams.get('orderId');

  const setActiveTab = (tab: TabType, orderId?: string) => {
    const params: any = { tab };
    if (orderId) {
      params.orderId = orderId;
    }
    setSearchParams(params);
  };

  // Fetch pending orders count
  const fetchPendingOrdersCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/orders?status=pending', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if response is OK
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPendingOrdersCount(data.orders?.length || 0);
    } catch (error) {
      console.error('Failed to fetch pending orders count:', error);
      setPendingOrdersCount(0); // Set to 0 on error
    }
  };

  // SSE callbacks
  const handleNewOrder = useCallback((newOrder: Order) => {
    console.log('Dashboard: New order received', newOrder);
    // Refresh pending orders count when new order comes in
    fetchPendingOrdersCount();
  }, []);

  const handleOrderUpdate = useCallback((updatedOrder: Order) => {
    console.log('Dashboard: Order updated', updatedOrder);
    // Refresh pending orders count when order is updated
    fetchPendingOrdersCount();
  }, []);

  // Use the SSE hook
  const { isConnected } = useDashboardSSE(
    user?.restaurant?._id,
    handleNewOrder,
    handleOrderUpdate
  );

  // Update connection status
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Clear orderId when switching away from orders tab
  useEffect(() => {
    if (activeTab !== 'orders' && orderIdParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('orderId');
      setSearchParams(newParams);
    }
  }, [activeTab, orderIdParam, searchParams, setSearchParams]);

  useEffect(() => {
    // Fetch count when orders tab is active or when component mounts
    if (activeTab === 'orders' || activeTab === 'dashboard') {
      fetchPendingOrdersCount();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'dashboard' as TabType, name: 'Dashboard', icon: 'ri-dashboard-line', mobileIcon: 'ri-home-line' },
    { id: 'menu' as TabType, name: 'Menu', icon: 'ri-restaurant-line', mobileIcon: 'ri-restaurant-2-line' },
    { 
      id: 'orders' as TabType, 
      name: 'Orders', 
      icon: 'ri-shopping-cart-line', 
      mobileIcon: 'ri-shopping-cart-2-line', 
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined 
    },
    { id: 'qr-codes' as TabType, name: 'QR Codes', icon: 'ri-qr-code-line', mobileIcon: 'ri-qr-scan-2-line' },
    { id: 'settings' as TabType, name: 'Settings', icon: 'ri-settings-line', mobileIcon: 'ri-settings-4-line' },
  ];

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'menu':
        setActiveTab('menu');
        break;
      case 'qr-codes':
        setActiveTab('qr-codes');
        break;
      case 'orders':
        setActiveTab('orders');
        break;
      case 'settings':
        setActiveTab('settings');
        break;
      default:
        break;
    }
  };

  const handleViewAllOrders = () => {
    setActiveTab('orders');
  };

  const handleOrderClick = (orderId: string) => {
    setActiveTab('orders', orderId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'menu':
        return <MenuManagement />;
      case 'orders':
        return <OrderManagement selectedOrderId={orderIdParam} autoScroll={!!orderIdParam} />;
      case 'qr-codes':
        return <QRCodeGenerator />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <DashboardContent 
            pendingOrdersCount={pendingOrdersCount} 
            onQuickAction={handleQuickAction}
            onViewAllOrders={handleViewAllOrders}
            onOrderClick={handleOrderClick}
            connectionStatus={connectionStatus}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30">
      {/* Sidebar - Desktop */}
      <nav className="hidden md:flex flex-col w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 fixed h-full z-20 shadow-sm">
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center space-x-3">
            {user?.restaurant.logo ? (
              <img
                src={`${user.restaurant.logo}`}
                alt={user.restaurant.name}
                className="h-10 w-10 rounded-xl object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div className="h-10 w-10 bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="ri-restaurant-2-line text-white text-lg"></i>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">
                {user?.restaurant.name}
              </h1>
              <p className="text-xs text-gray-500">Restaurant</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 group relative ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <i className={`${tab.icon} text-lg ${activeTab === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`}></i>
                <span className="font-medium text-sm">{tab.name}</span>
              </div>
              {tab.badge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === tab.id 
                    ? 'bg-white/20 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200/50">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-3">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 rounded-lg p-2">
                <i className="ri-lightbulb-line text-white text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 mb-1">Pro Tip</p>
                <p className="text-xs text-gray-600">Use QR codes to boost mobile orders</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 px-2">
            <div className="h-9 w-9 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <i className="ri-logout-box-r-line text-lg"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Section */}
      <div className="flex-1 md:ml-64">
        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-30 shadow-sm">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {user?.restaurant.logo ? (
                  <img
                    src={`${user.restaurant.logo}`}
                    alt={user.restaurant.name}
                    className="h-9 w-9 rounded-xl object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="h-9 w-9 bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="ri-restaurant-2-line text-white text-sm"></i>
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-bold text-gray-900 truncate max-w-[140px]">
                    {user?.restaurant.name}
                  </h1>
                  <p className="text-xs text-gray-500">Dashboard</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              >
                <i className="ri-logout-box-r-line text-lg"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="sm:px-6 lg:px-8 lg:py-8 pb-24 md:pb-8">
          {renderContent()}
        </main>

        {/* Bottom Navigation - Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 md:hidden z-20 shadow-lg">
          <div className="flex justify-around items-center px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-3 px-3 flex-1 min-w-0 transition-all duration-200 relative ${
                  activeTab === tab.id
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`}
              >
                {activeTab === tab.id && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
                )}
                <div className="relative">
                  <i className={`${tab.mobileIcon} text-xl mb-1`}></i>
                  {tab.badge && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium truncate">{tab.name}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

// DashboardContent Component
interface DashboardContentProps {
  pendingOrdersCount: number;
  onQuickAction: (action: string) => void;
  onViewAllOrders: () => void;
  onOrderClick: (orderId: string) => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

const DashboardContent: React.FC<DashboardContentProps> = ({ 
  pendingOrdersCount, 
  onQuickAction, 
  onViewAllOrders,
  onOrderClick,
  connectionStatus
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    menuItemsCount: 0,
    activeTables: 0,
    totalTables: 0,
    totalOrders: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch all data in parallel with full URLs like OrderManagement
      const [ordersResponse, menuItemsResponse, tablesResponse] = await Promise.all([
        fetch('http://localhost:5000/api/orders?status=all', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/menu-items', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/tables', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!ordersResponse.ok || !menuItemsResponse.ok || !tablesResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const ordersData = await ordersResponse.json();
      const menuItemsData = await menuItemsResponse.json();
      const tablesData = await tablesResponse.json();

      // Calculate stats
      const paidOrders = ordersData.orders?.filter((order: any) => order.paymentStatus === 'paid') || [];
      const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
      
      const activeTables = tablesData.tables?.filter((table: any) => 
        table.status === 'occupied' || table.status === 'reserved'
      ).length || 0;

      const totalTables = tablesData.tables?.length || 0;

      // Get recent orders (last 5)
      const recentOrdersData = ordersData.orders?.slice(0, 5).map((order: any) => ({
        id: order.orderNumber,
        table: order.table ? `Table ${order.table.tableNumber}` : 'Takeaway',
        items: `${order.items.length} item${order.items.length !== 1 ? 's' : ''}`,
        total: `${order.totalAmount.toLocaleString()} CFA`,
        status: order.status,
        time: formatTimeAgo(order.createdAt),
        _id: order._id
      })) || [];

      setStats({
        totalRevenue,
        menuItemsCount: menuItemsData.menuItems?.length || 0,
        activeTables: activeTables,
        totalTables: totalTables,
        totalOrders: ordersData.orders?.length || 0
      });

      setRecentOrders(recentOrdersData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''} ago`;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      preparing: 'bg-orange-100 text-orange-700',
      ready: 'bg-green-100 text-green-700',
      served: 'bg-teal-100 text-teal-700',
      completed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const dashboardStats = [
    { 
      label: 'Pending Orders', 
      value: pendingOrdersCount.toString(), 
      change: pendingOrdersCount > 0 ? `${pendingOrdersCount} waiting` : 'No pending orders', 
      icon: 'ri-shopping-bag-line', 
      color: 'blue', 
      trend: pendingOrdersCount > 0 ? 'up' : 'neutral' 
    },
    { 
      label: 'Revenue', 
      value: `${stats.totalRevenue.toLocaleString()} CFA`, 
      change: 'Today', 
      icon: 'ri-money-dollar-circle-line', 
      color: 'green', 
      trend: stats.totalRevenue > 0 ? 'up' : 'neutral' 
    },
    { 
      label: 'Menu Items', 
      value: stats.menuItemsCount.toString(), 
      change: 'Active items', 
      icon: 'ri-restaurant-line', 
      color: 'purple', 
      trend: 'neutral' 
    },
    { 
      label: 'Active Tables', 
      value: `${stats.activeTables}/${stats.totalTables}`,
      change: 'Occupied/Total', 
      icon: 'ri-table-line', 
      color: 'orange', 
      trend: 'neutral' 
    },
  ];

  const quickActions = [
    { icon: 'ri-add-circle-line', title: 'Add Menu Item', color: 'blue', desc: 'Create new dish', action: 'menu' },
    { icon: 'ri-qr-code-line', title: 'Generate QR', color: 'green', desc: 'Table QR codes', action: 'qr-codes' },
    { icon: 'ri-file-list-line', title: 'View Orders', color: 'purple', desc: 'Manage orders', action: 'orders' },
    { icon: 'ri-settings-3-line', title: 'Settings', color: 'orange', desc: 'Configure app', action: 'settings' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Loading Skeleton for Welcome Banner */}
        <div className="bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 lg:rounded-2xl rounded-b-2xl p-6 md:p-8 text-white shadow-xl animate-pulse">
          <div className="h-8 bg-green-400 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-green-400 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-green-400 rounded w-1/2"></div>
        </div>

        {/* Loading Skeleton for Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/50 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>

        {/* Loading Skeleton for Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 animate-pulse">
              <div className="p-5 border-b border-gray-200/50">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 animate-pulse">
              <div className="p-5 border-b border-gray-200/50">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 lg:rounded-2xl rounded-b-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/30 rounded-full translate-y-32 -translate-x-32 blur-3xl"></div>
        
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 text-green-700' 
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' 
                    ? 'bg-green-500 animate-pulse' 
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}></div>
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {user?.name}! 👋
            </h2>
            <p className="text-green-100 text-sm md:text-base max-w-md">
              {pendingOrdersCount > 0 
                ? `You have ${pendingOrdersCount} pending order${pendingOrdersCount > 1 ? 's' : ''} waiting for confirmation.` 
                : `Your restaurant has served ${stats.totalOrders} orders today.`}
            </p>
          </div>
          <div className="hidden sm:block text-6xl md:text-7xl opacity-20">
            <i className="ri-restaurant-2-fill"></i>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-lg group-hover:scale-110 transition-transform ${
                stat.color === 'blue' ? 'bg-blue-50' :
                stat.color === 'green' ? 'bg-green-50' :
                stat.color === 'purple' ? 'bg-purple-50' :
                'bg-orange-50'
              }`}>
                <i className={`${stat.icon} text-xl ${
                  stat.color === 'blue' ? 'text-blue-500' :
                  stat.color === 'green' ? 'text-green-500' :
                  stat.color === 'purple' ? 'text-purple-500' :
                  'text-orange-500'
                }`}></i>
              </div>
              <div className={`flex items-center space-x-1 text-xs font-semibold ${
                stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stat.trend === 'up' && <i className="ri-arrow-up-line"></i>}
                {stat.trend === 'down' && <i className="ri-arrow-down-line"></i>}
                <span>{stat.change}</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Recent Orders */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
            <div className="p-5 border-b border-gray-200/50">
              <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
              <p className="text-xs text-gray-500 mt-1">Frequently used features</p>
            </div>
            <div className="p-4 space-y-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onQuickAction(action.action)}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group cursor-pointer"
                >
                  <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${
                    action.color === 'blue' ? 'bg-blue-50' :
                    action.color === 'green' ? 'bg-green-50' :
                    action.color === 'purple' ? 'bg-purple-50' :
                    'bg-orange-50'
                  }`}>
                    <i className={`${action.icon} text-lg ${
                      action.color === 'blue' ? 'text-blue-500' :
                      action.color === 'green' ? 'text-green-500' :
                      action.color === 'purple' ? 'text-purple-500' :
                      'text-orange-500'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                    <p className="text-xs text-gray-500">{action.desc}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-gray-600 transition-colors"></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
            <div className="p-5 border-b border-gray-200/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Orders</h3>
                <p className="text-xs text-gray-500 mt-1">Latest customer orders</p>
              </div>
              <button 
                onClick={onViewAllOrders}
                className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {recentOrders.length > 0 ? (
                recentOrders.map((order: any, idx: number) => (
                  <div 
                    key={idx} 
                    onClick={() => onOrderClick(order._id)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <i className="ri-restaurant-line text-blue-600"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                            {order.id}
                          </p>
                          <p className="text-xs text-gray-500">{order.table} • {order.items}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">{order.total}</p>
                        <p className="text-xs text-gray-500">{order.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                        View Details →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <i className="ri-shopping-bag-line text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-500 text-sm">No recent orders found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;