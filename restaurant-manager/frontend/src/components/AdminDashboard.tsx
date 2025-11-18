// components/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import type { Restaurant, SystemAnalytics } from '../types/admin';
import { adminService } from '../services/adminService';
import RestaurantForm from './RestaurantForm';
import AnalyticsTab from './AnalyticsTab';

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div className={value === index ? 'block' : 'hidden'}>
      {children}
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Settings state
  const [adminInfo, setAdminInfo] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [restaurantsData, analyticsData] = await Promise.all([
        adminService.getRestaurants(),
        adminService.getSystemAnalytics()
      ]);
      
      console.log('📊 Restaurants data:', restaurantsData);
      console.log('📈 Analytics data:', analyticsData);
      
      setRestaurants(restaurantsData.restaurants || []);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('❌ Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminInfo = async () => {
    try {
      const profile = await adminService.getProfile();
      setAdminInfo(prev => ({
        ...prev,
        name: profile.admin.name,
        email: profile.admin.email
      }));
    } catch (err: any) {
      console.error('Failed to load admin profile:', err);
      // Fallback to default values if API fails
      setAdminInfo(prev => ({
        ...prev,
        name: 'System Administrator',
        email: 'admin@system.com'
      }));
    }
  };

  useEffect(() => {
    fetchData();
    loadAdminInfo();
  }, [refreshTrigger]);

  const handleToggleStatus = async (restaurantId: string) => {
    try {
      await adminService.toggleRestaurantStatus(restaurantId);
      setRefreshTrigger(prev => prev + 1);
      setSuccess('Restaurant status updated successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateRestaurant = async (data: any) => {
    try {
      await adminService.createRestaurant(data);
      setOpenDialog(false);
      setRefreshTrigger(prev => prev + 1);
      setSuccess('Restaurant created successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setOpenDialog(true);
  };

  const handleUpdateRestaurant = async (data: any) => {
    if (!selectedRestaurant) return;

    // Convert flat fields to nested structure
    const updatePayload = {
      name: data.name,
      description: data.description,
      contact: {
        email: data.email,
        phone: data.phone,
      },
      // Include admin credential changes if requested
      ...(data.changeCredentials && {
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        changeCredentials: data.changeCredentials
      })
    };

    console.log("📤 Sending update payload:", updatePayload);

    try {
      await adminService.updateRestaurant(selectedRestaurant._id, updatePayload);
      setOpenDialog(false);
      setSelectedRestaurant(null);
      setRefreshTrigger(prev => prev + 1);
      setSuccess('Restaurant updated successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelEdit = () => {
    setOpenDialog(false);
    setSelectedRestaurant(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRestaurant(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setError('');
    setSuccess('');

    try {
      await adminService.updateProfile({
        name: adminInfo.name,
        email: adminInfo.email
      });
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setError('');
    setSuccess('');

    if (adminInfo.newPassword !== adminInfo.confirmPassword) {
      setError('New passwords do not match');
      setChangingPassword(false);
      return;
    }

    if (adminInfo.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setChangingPassword(false);
      return;
    }

    try {
      await adminService.changePassword(adminInfo.currentPassword, adminInfo.newPassword);
      setSuccess('Password changed successfully');
      setAdminInfo(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const resetPasswordFields = () => {
    setAdminInfo(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
  };

  // Safe restaurant data access
  const getRestaurantEmail = (restaurant: Restaurant) => {
    return restaurant.contact?.email || 'No email';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTabValue(3)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <i className="ri-settings-3-line mr-2"></i>
                Settings
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <i className="ri-logout-box-r-line mr-2"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['Overview', 'Restaurant Management', 'Analytics', 'Settings'].map((tab, index) => (
              <button
                key={tab}
                onClick={() => {
                  setTabValue(index);
                  clearMessages();
                  if (index === 3) resetPasswordFields();
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  tabValue === index
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="ri-error-warning-line text-red-400 text-lg"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="ri-checkbox-circle-line text-green-400 text-lg"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-1 text-sm text-green-700">{success}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setSuccess('')}
                  className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Panels */}
        <div className="py-6">
          {/* Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">System Overview</h2>
            
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <i className="ri-restaurant-line text-2xl text-blue-600 mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Total Restaurants</div>
                      <div className="text-2xl font-bold text-gray-900">{analytics.totalRestaurants}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <i className="ri-store-2-line text-2xl text-green-600 mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Active Restaurants</div>
                      <div className="text-2xl font-bold text-green-600">{analytics.activeRestaurants}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <i className="ri-user-line text-2xl text-purple-600 mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Total Users</div>
                      <div className="text-2xl font-bold text-gray-900">{analytics.totalUsers}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <i className="ri-money-dollar-circle-line text-2xl text-indigo-600 mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Total Revenue</div>
                      <div className="text-2xl font-bold text-indigo-600">
                        ${analytics.totalRevenue?.toLocaleString() || '0'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <i className="ri-history-line mr-2 text-blue-600"></i>
                  Recent Activity
                </h3>
              </div>
              <div className="p-6">
                <div className="text-center text-gray-500 py-8">
                  <i className="ri-information-line text-4xl mb-2 text-gray-300"></i>
                  <p>Recent activity will appear here</p>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Restaurant Management Tab */}
          <TabPanel value={tabValue} index={1}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Restaurant Management</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Refresh
                </button>
                <button
                  onClick={() => setOpenDialog(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <i className="ri-add-line mr-2"></i>
                  Add Restaurant
                </button>
              </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              {restaurants.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-restaurant-line text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Restaurants</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first restaurant</p>
                  <button
                    onClick={() => setOpenDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <i className="ri-add-line mr-2"></i>
                    Create Restaurant
                  </button>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Restaurant  Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Users
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Menu Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {restaurants.map((restaurant) => (
                      <tr key={restaurant._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <i className="ri-restaurant-line text-gray-400 mr-2"></i>
                            {restaurant.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <i className="ri-mail-line text-gray-400 mr-2"></i>
                            {getRestaurantEmail(restaurant)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                            restaurant.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            <i className={`ri-${restaurant.isActive ? 'check' : 'close'}-line mr-1`}></i>
                            {restaurant.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <i className="ri-user-line text-gray-400 mr-2"></i>
                            {restaurant.userCount || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <i className="ri-file-list-line text-gray-400 mr-2"></i>
                            {restaurant.menuItemCount || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <i className="ri-shopping-cart-line text-gray-400 mr-2"></i>
                            {restaurant.orderCount || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleToggleStatus(restaurant._id)}
                            className={`inline-flex items-center px-3 py-1 rounded text-xs ${
                              restaurant.isActive
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <i className={`ri-${restaurant.isActive ? 'pause' : 'play'}-line mr-1`}></i>
                            {restaurant.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleEditRestaurant(restaurant)}
                            className="inline-flex items-center px-3 py-1 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            <i className="ri-edit-line mr-1"></i>
                            Edit
                          </button>
                          <button
                            onClick={() => setTabValue(2)}
                            className="inline-flex items-center px-3 py-1 rounded text-xs bg-purple-100 text-purple-700 hover:bg-purple-200"
                          >
                            <i className="ri-bar-chart-line mr-1"></i>
                            Analytics
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabPanel>

          {/* Analytics Tab */}
          <TabPanel value={tabValue} index={2}>
            <AnalyticsTab />
          </TabPanel>

          {/* Settings Tab */}
          <TabPanel value={tabValue} index={3}>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profile Settings */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <i className="ri-user-settings-line mr-2 text-blue-600"></i>
                    Profile Information
                  </h3>
                  <form onSubmit={handleUpdateProfile}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Full Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={adminInfo.name}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={adminInfo.email}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your email address"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updatingProfile}
                        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingProfile ? (
                          <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Updating...
                          </>
                        ) : (
                          <>
                            <i className="ri-save-line mr-2"></i>
                            Update Profile
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Password Change */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <i className="ri-lock-password-line mr-2 text-green-600"></i>
                    Change Password
                  </h3>
                  <form onSubmit={handleChangePassword}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                          Current Password
                        </label>
                        <input
                          type="password"
                          id="currentPassword"
                          name="currentPassword"
                          value={adminInfo.currentPassword}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter current password"
                        />
                      </div>
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                          New Password
                        </label>
                        <input
                          type="password"
                          id="newPassword"
                          name="newPassword"
                          value={adminInfo.newPassword}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          id="confirmPassword"
                          name="confirmPassword"
                          value={adminInfo.confirmPassword}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Confirm new password"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={changingPassword || !adminInfo.currentPassword || !adminInfo.newPassword || !adminInfo.confirmPassword}
                        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {changingPassword ? (
                          <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Changing...
                          </>
                        ) : (
                          <>
                            <i className="ri-key-2-line mr-2"></i>
                            Change Password
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-lg shadow p-6 mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <i className="ri-information-line mr-2 text-purple-600"></i>
                  System Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <i className="ri-server-line text-blue-500 text-xl mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Backend Status</div>
                      <div className="text-sm text-green-600 font-medium">Running</div>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <i className="ri-database-2-line text-green-500 text-xl mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Database</div>
                      <div className="text-sm text-green-600 font-medium">Connected</div>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <i className="ri-time-line text-purple-500 text-xl mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Last Updated</div>
                      <div className="text-sm text-gray-900 font-medium">{new Date().toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <i className="ri-shield-check-line text-red-500 text-xl mr-3"></i>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Security</div>
                      <div className="text-sm text-green-600 font-medium">Protected</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white rounded-lg shadow p-6 mt-8 border border-red-200">
                <h3 className="text-lg font-medium text-red-900 mb-4 flex items-center">
                  <i className="ri-alert-line mr-2 text-red-600"></i>
                  Danger Zone
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Logout from all sessions</h4>
                    <p className="text-sm text-red-600 mt-1">This will log you out from all devices</p>
                  </div>
                  <button
                    onClick={onLogout}
                    className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <i className="ri-logout-box-r-line mr-2"></i>
                    Logout Everywhere
                  </button>
                </div>
              </div>
            </div>
          </TabPanel>
        </div>
      </div>

      {/* Add/Edit Restaurant Dialog */}
      {openDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedRestaurant ? 'Edit Restaurant' : 'Add New Restaurant'}
                </h3>
                <button
                  onClick={handleCloseDialog}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <RestaurantForm
                restaurant={selectedRestaurant}
                onSubmit={selectedRestaurant ? handleUpdateRestaurant : handleCreateRestaurant}
                onCancel={handleCancelEdit}
                isEditing={!!selectedRestaurant}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;