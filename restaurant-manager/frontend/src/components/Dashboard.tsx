import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MenuManagement from './MenuManagement';
import OrderManagement from './OrderManagement';
import QRCodeGenerator from './QRCodeGenerator';
import Settings from './Settings'; // Import the Settings component
import { useSearchParams } from 'react-router-dom';
type TabType = 'dashboard' | 'menu' | 'orders' | 'qr-codes' | 'settings';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  
  // Get active tab from URL or default to 'dashboard'
  const activeTab = (searchParams.get('tab') as TabType) || 'dashboard';

  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };
  // Fetch pending orders count
 useEffect(() => {
    const fetchPendingOrdersCount = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/orders?status=pending', { // Fixed: added /api prefix
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

  const renderContent = () => {
    switch (activeTab) {
      case 'menu':
        return <MenuManagement />;
      case 'orders':
        return <OrderManagement />;
      case 'qr-codes':
        return <QRCodeGenerator />;
      case 'settings':
        return <Settings />; // Use the actual Settings component
      default:
        return <DashboardContent pendingOrdersCount={pendingOrdersCount} />;
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
                src={`http://localhost:5000${user.restaurant.logo}`}
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
                    src={`http://localhost:5000${user.restaurant.logo}`}
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

// Update DashboardContent to accept props
interface DashboardContentProps {
  pendingOrdersCount: number;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ pendingOrdersCount }) => {
  const { user } = useAuth();

  const stats = [
    { 
      label: 'Pending Orders', 
      value: pendingOrdersCount.toString(), 
      change: pendingOrdersCount > 0 ? `${pendingOrdersCount} waiting` : 'No pending orders', 
      icon: 'ri-shopping-bag-line', 
      color: 'blue', 
      trend: pendingOrdersCount > 0 ? 'up' : 'neutral' 
    },
    { label: 'Revenue', value: '1,245 CFA', change: '+8%', icon: 'ri-money-dollar-circle-line', color: 'green', trend: 'up' },
    { label: 'Menu Items', value: '156', change: '+3', icon: 'ri-restaurant-line', color: 'purple', trend: 'up' },
    { label: 'Active Tables', value: '8/12', change: '67%', icon: 'ri-table-line', color: 'orange', trend: 'neutral' },
  ];

  const quickActions = [
    { icon: 'ri-add-circle-line', title: 'Add Menu Item', color: 'blue', desc: 'Create new dish', action: 'menu' },
    { icon: 'ri-qr-code-line', title: 'Generate QR', color: 'green', desc: 'Table QR codes', action: 'qr-codes' },
    { icon: 'ri-file-list-line', title: 'View Orders', color: 'purple', desc: 'Manage orders', action: 'orders' },
    { icon: 'ri-settings-3-line', title: 'Settings', color: 'orange', desc: 'Configure app', action: 'settings' },
  ];

  // You can replace this with real data from your API
  const recentOrders = [
    { id: '#1234', table: 'Table 5', items: '3 items', total: '$45.50', status: 'preparing', time: '5 min ago' },
    { id: '#1233', table: 'Table 2', items: '2 items', total: '$28.00', status: 'ready', time: '12 min ago' },
    { id: '#1232', table: 'Table 8', items: '5 items', total: '$67.80', status: 'delivered', time: '18 min ago' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/30 rounded-full translate-y-32 -translate-x-32 blur-3xl"></div>
        
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {user?.name}! 👋
            </h2>
            <p className="text-green-100 text-sm md:text-base max-w-md">
              {pendingOrdersCount > 0 
                ? `You have ${pendingOrdersCount} pending order${pendingOrdersCount > 1 ? 's' : ''} waiting for confirmation.` 
                : 'Your restaurant is performing great today. Keep up the excellent work!'}
            </p>
          </div>
          <div className="hidden sm:block text-6xl md:text-7xl opacity-20">
            <i className="ri-restaurant-2-fill"></i>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
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
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
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
              <button className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center space-x-1">
                <span>View All</span>
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {recentOrders.map((order, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                        <i className="ri-restaurant-line text-blue-600"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{order.id}</p>
                        <p className="text-xs text-gray-500">{order.table} • {order.items}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{order.total}</p>
                      <p className="text-xs text-gray-500">{order.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      order.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'ready' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Remove the old SettingsContent and Placeholder components since we're using the actual Settings component

export default Dashboard;