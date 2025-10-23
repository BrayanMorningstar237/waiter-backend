import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { defaultThemes } from '../types';
import type { RestaurantSettings, AdminSettings, RestaurantTheme } from '../types';

const AdminSettings: React.FC = () => {
  const { restaurant, user, updateRestaurantSettings, updateAdminSettings, updateRestaurantLogo } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'theme' | 'admin' | 'preview'>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [generalInfo, setGeneralInfo] = useState<Partial<RestaurantSettings>>({
    name: '',
    description: '',
    contact: { phone: '', email: '', website: '' },
    address: { street: '', city: '', state: '', zipCode: '', country: '' }
  });

  const [themeSettings, setThemeSettings] = useState<RestaurantTheme>({
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    accentColor: '#10B981'
  });

  const [adminInfo, setAdminInfo] = useState<AdminSettings>({
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    if (restaurant) {
      setGeneralInfo({
        name: restaurant.name,
        description: restaurant.description || '',
        contact: { 
          phone: restaurant.contact?.phone || '', 
          email: restaurant.contact?.email || '',
          website: restaurant.contact?.website || ''
        },
        address: { 
          street: restaurant.address?.street || '',
          city: restaurant.address?.city || '',
          state: restaurant.address?.state || '',
          zipCode: restaurant.address?.zipCode || '',
          country: restaurant.address?.country || ''
        }
      });
      
      setThemeSettings(restaurant.theme || {
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF'
      });
      setLogoPreview(restaurant.logo || '');
    }

    if (user) {
      setAdminInfo(prev => ({
        ...prev,
        email: user.email,
        phone: user.phone || ''
      }));
    }
  }, [restaurant, user]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await updateRestaurantSettings(generalInfo);
      showMessage('success', 'Restaurant information updated successfully');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) return;

    setIsLoading(true);
    try {
      await updateRestaurantLogo(logoFile);
      showMessage('success', 'Logo updated successfully');
      setLogoFile(null);
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to upload logo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await updateRestaurantSettings({ theme: themeSettings });
      showMessage('success', 'Theme updated successfully');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update theme');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminInfo.newPassword && adminInfo.newPassword !== adminInfo.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      await updateAdminSettings(adminInfo);
      
      // Clear password fields
      setAdminInfo(prev => ({ 
        ...prev, 
        currentPassword: '', 
        newPassword: '', 
        confirmPassword: '' 
      }));
      
      showMessage('success', 'Admin information updated successfully');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update admin information');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (theme: RestaurantTheme) => {
    setThemeSettings(theme);
  };

  if (!restaurant || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-green-600 mb-4"></i>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your restaurant information, appearance, and admin settings
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center">
              <i className={`ri-${message.type === 'success' ? 'check' : 'error-warning'}-line mr-2`}></i>
              {message.text}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'general', label: 'General', icon: 'ri-restaurant-line' },
                { id: 'theme', label: 'Theme', icon: 'ri-palette-line' },
                { id: 'admin', label: 'Admin', icon: 'ri-user-settings-line' },
                { id: 'preview', label: 'Preview', icon: 'ri-eye-line' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-6 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <i className={`${tab.icon} mr-2`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Restaurant Information</h3>
                  <form onSubmit={handleGeneralSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Restaurant Name</label>
                        <input
                          type="text"
                          value={generalInfo.name || ''}
                          onChange={(e) => setGeneralInfo({ ...generalInfo, name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input
                          type="text"
                          value={generalInfo.description || ''}
                          onChange={(e) => setGeneralInfo({ ...generalInfo, description: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Contact Information</h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Phone</label>
                          <input
                            type="tel"
                            value={generalInfo.contact?.phone || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              contact: { 
                                ...generalInfo.contact, 
                                phone: e.target.value,
                                email: generalInfo.contact?.email || '',
                                website: generalInfo.contact?.website || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            value={generalInfo.contact?.email || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              contact: { 
                                ...generalInfo.contact, 
                                email: e.target.value,
                                phone: generalInfo.contact?.phone || '',
                                website: generalInfo.contact?.website || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Website</label>
                          <input
                            type="url"
                            value={generalInfo.contact?.website || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              contact: { 
                                ...generalInfo.contact, 
                                website: e.target.value,
                                phone: generalInfo.contact?.phone || '',
                                email: generalInfo.contact?.email || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Address</h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Street</label>
                          <input
                            type="text"
                            value={generalInfo.address?.street || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              address: { 
                                ...generalInfo.address, 
                                street: e.target.value,
                                city: generalInfo.address?.city || '',
                                state: generalInfo.address?.state || '',
                                zipCode: generalInfo.address?.zipCode || '',
                                country: generalInfo.address?.country || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">City</label>
                          <input
                            type="text"
                            value={generalInfo.address?.city || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              address: { 
                                ...generalInfo.address, 
                                city: e.target.value,
                                street: generalInfo.address?.street || '',
                                state: generalInfo.address?.state || '',
                                zipCode: generalInfo.address?.zipCode || '',
                                country: generalInfo.address?.country || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">State</label>
                          <input
                            type="text"
                            value={generalInfo.address?.state || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              address: { 
                                ...generalInfo.address, 
                                state: e.target.value,
                                street: generalInfo.address?.street || '',
                                city: generalInfo.address?.city || '',
                                zipCode: generalInfo.address?.zipCode || '',
                                country: generalInfo.address?.country || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
                          <input
                            type="text"
                            value={generalInfo.address?.zipCode || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              address: { 
                                ...generalInfo.address, 
                                zipCode: e.target.value,
                                street: generalInfo.address?.street || '',
                                city: generalInfo.address?.city || '',
                                state: generalInfo.address?.state || '',
                                country: generalInfo.address?.country || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Country</label>
                          <input
                            type="text"
                            value={generalInfo.address?.country || ''}
                            onChange={(e) => setGeneralInfo({
                              ...generalInfo,
                              address: { 
                                ...generalInfo.address, 
                                country: e.target.value,
                                street: generalInfo.address?.street || '',
                                city: generalInfo.address?.city || '',
                                state: generalInfo.address?.state || '',
                                zipCode: generalInfo.address?.zipCode || ''
                              }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Logo Upload */}
                <div className="border-t pt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Restaurant Logo</h3>
                  <form onSubmit={handleLogoSubmit} className="flex items-center space-x-6">
                    <div className="flex-shrink-0">
                      <img
                        src={logoPreview || '/api/placeholder/120/120'}
                        alt="Logo preview"
                        className="h-24 w-24 rounded-lg object-cover border border-gray-300"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                    </div>
                    <button
                      type="submit"
                      disabled={!logoFile || isLoading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isLoading ? 'Uploading...' : 'Upload Logo'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Theme Settings */}
            {activeTab === 'theme' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Theme Customization</h3>
                  
                  {/* Default Themes */}
                  <div className="mb-8">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Default Themes</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {defaultThemes.map((theme, index) => (
                        <div
                          key={index}
                          onClick={() => applyTheme(theme)}
                          className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-green-500 transition-colors"
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: theme.primaryColor }}
                            ></div>
                            <div
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: theme.secondaryColor }}
                            ></div>
                            <div
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: theme.accentColor }}
                            ></div>
                          </div>
                          <div className="text-sm font-medium text-gray-900 capitalize">
                            Theme {index + 1}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Click to apply
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Theme */}
                  <form onSubmit={handleThemeSubmit}>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Custom Theme</h4>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Primary Color
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="color"
                            value={themeSettings.primaryColor}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              primaryColor: e.target.value
                            })}
                            className="w-12 h-12 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={themeSettings.primaryColor}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              primaryColor: e.target.value
                            })}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Secondary Color
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="color"
                            value={themeSettings.secondaryColor}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              secondaryColor: e.target.value
                            })}
                            className="w-12 h-12 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={themeSettings.secondaryColor}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              secondaryColor: e.target.value
                            })}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Color
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="color"
                            value={themeSettings.backgroundColor || '#FFFFFF'}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              backgroundColor: e.target.value
                            })}
                            className="w-12 h-12 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={themeSettings.backgroundColor || '#FFFFFF'}
                            onChange={(e) => setThemeSettings({
                              ...themeSettings,
                              backgroundColor: e.target.value
                            })}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : 'Save Theme'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Admin Settings */}
            {activeTab === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Settings</h3>
                <form onSubmit={handleAdminSubmit} className="space-y-6 max-w-2xl">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email Address</label>
                      <input
                        type="email"
                        value={adminInfo.email}
                        onChange={(e) => setAdminInfo({ ...adminInfo, email: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <input
                        type="tel"
                        value={adminInfo.phone || ''}
                        onChange={(e) => setAdminInfo({ ...adminInfo, phone: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Change Password</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Current Password</label>
                        <input
                          type="password"
                          value={adminInfo.currentPassword || ''}
                          onChange={(e) => setAdminInfo({ ...adminInfo, currentPassword: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">New Password</label>
                          <input
                            type="password"
                            value={adminInfo.newPassword || ''}
                            onChange={(e) => setAdminInfo({ ...adminInfo, newPassword: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                          <input
                            type="password"
                            value={adminInfo.confirmPassword || ''}
                            onChange={(e) => setAdminInfo({ ...adminInfo, confirmPassword: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Preview */}
            {activeTab === 'preview' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Menu Preview</h3>
                <p className="text-gray-600 mb-6">
                  This is how your menu will appear to customers with the current theme.
                </p>
                
                {/* Menu Preview Component */}
                <div 
                  className="border border-gray-300 rounded-xl p-6 max-w-2xl mx-auto"
                  style={{ 
                    backgroundColor: themeSettings.backgroundColor || '#FFFFFF',
                    color: themeSettings.textColor || '#1F2937'
                  }}
                >
                  {/* Menu Header */}
                  <div className="text-center mb-8">
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Restaurant Logo"
                        className="h-16 w-16 mx-auto mb-4 rounded-lg object-cover"
                      />
                    )}
                    <h1 
                      className="text-3xl font-bold mb-2"
                      style={{ color: themeSettings.primaryColor }}
                    >
                      {generalInfo.name}
                    </h1>
                    <p className="text-lg opacity-75">{generalInfo.description}</p>
                  </div>

                  {/* Menu Categories */}
                  <div className="space-y-6">
                    {/* Sample Category */}
                    <div>
                      <h2 
                        className="text-xl font-semibold mb-4 pb-2 border-b"
                        style={{ borderColor: themeSettings.secondaryColor }}
                      >
                        Appetizers
                      </h2>
                      
                      {/* Sample Menu Items */}
                      <div className="space-y-4">
                        {[
                          { name: 'Garlic Bread', price: '$5.99', description: 'Freshly baked with garlic butter' },
                          { name: 'Bruschetta', price: '$7.99', description: 'Tomato, basil, and mozzarella on toasted bread' },
                          { name: 'Calamari', price: '$9.99', description: 'Crispy fried squid with marinara sauce' }
                        ].map((item, index) => (
                          <div key={index} className="flex justify-between items-start py-2">
                            <div>
                              <h3 className="font-medium">{item.name}</h3>
                              <p className="text-sm opacity-75 mt-1">{item.description}</p>
                            </div>
                            <span 
                              className="font-semibold whitespace-nowrap ml-4"
                              style={{ color: themeSettings.accentColor || themeSettings.primaryColor }}
                            >
                              {item.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Call to Action */}
                    <div 
                      className="mt-8 p-4 rounded-lg text-center"
                      style={{ 
                        backgroundColor: themeSettings.primaryColor,
                        color: 'white'
                      }}
                    >
                      <p className="font-semibold">Visit us today to enjoy our delicious food!</p>
                      <p className="text-sm opacity-90 mt-1">
                        {generalInfo.contact?.phone} • {generalInfo.contact?.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminSettingsComponent = AdminSettings;
export default AdminSettingsComponent;