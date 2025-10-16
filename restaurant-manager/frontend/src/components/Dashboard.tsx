import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MenuManagement from './MenuManagement';
import Orders from './Orders';
import QRCodeGenerator from './QRCodeGenerator';
import Settings from './Settings';

type TabType = 'dashboard' | 'menu' | 'orders' | 'qr-codes' | 'settings';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const tabs = [
    { id: 'dashboard' as TabType, name: 'Dashboard', icon: 'ri-dashboard-line' },
    { id: 'menu' as TabType, name: 'Menu', icon: 'ri-menu-line' },
    { id: 'orders' as TabType, name: 'Orders', icon: 'ri-shopping-cart-line' },
    { id: 'qr-codes' as TabType, name: 'QR Codes', icon: 'ri-qr-code-line' },
    { id: 'settings' as TabType, name: 'Settings', icon: 'ri-settings-line' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'menu':
        return <MenuManagement />;
      case 'orders':
        return <Orders />;
      case 'qr-codes':
        return <QRCodeGenerator />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {user?.restaurant.logo ? (
                  <img 
                    src={`http://localhost:5000${user.restaurant.logo}`} 
                    alt={user.restaurant.name}
                    className="h-10 w-10 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <i className="ri-restaurant-2-line text-white text-lg"></i>
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {user?.restaurant.name}
                  </h1>
                  <p className="text-sm text-gray-500">Restaurant Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition duration-200 flex items-center space-x-2"
              >
                <i className="ri-logout-box-r-line"></i>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition duration-200 ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={tab.icon}></i>
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};

// Dashboard Content Component
const DashboardContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="py-8 sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl p-8 text-white mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="text-green-100 text-lg">
                Ready to manage {user?.restaurant.name} today?
              </p>
            </div>
            <div className="text-6xl opacity-20">
              <i className="ri-chef-hat-line"></i>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition duration-200 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition duration-200">
                <i className="ri-menu-line text-2xl text-blue-500"></i>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-blue-500 transition duration-200"></i>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Menu Management</h3>
            <p className="text-sm text-gray-500">Add, edit, and organize your menu items</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition duration-200 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition duration-200">
                <i className="ri-shopping-cart-line text-2xl text-green-500"></i>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-green-500 transition duration-200"></i>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Orders</h3>
            <p className="text-sm text-gray-500">View and manage customer orders</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition duration-200 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition duration-200">
                <i className="ri-qr-code-line text-2xl text-purple-500"></i>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-purple-500 transition duration-200"></i>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">QR Codes</h3>
            <p className="text-sm text-gray-500">Generate table and menu QR codes</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition duration-200 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition duration-200">
                <i className="ri-settings-line text-2xl text-orange-500"></i>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-orange-500 transition duration-200"></i>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Settings</h3>
            <p className="text-sm text-gray-500">Manage restaurant settings</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">25+</div>
              <div className="text-sm text-gray-500">Menu Items</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">8</div>
              <div className="text-sm text-gray-500">Tables</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">6</div>
              <div className="text-sm text-gray-500">Categories</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;