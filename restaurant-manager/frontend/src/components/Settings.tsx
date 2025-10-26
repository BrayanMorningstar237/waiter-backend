import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { defaultThemes } from '../types';
import type { RestaurantSettings, AdminSettings, RestaurantTheme } from '../types';

const Settings: React.FC = () => {
  const { restaurant, user, updateRestaurantSettings, updateAdminSettings, updateRestaurantLogo } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [activeTab, setActiveTab] = useState<'general' | 'theme' | 'admin' | 'preview'>(() => {
    const savedTab = localStorage.getItem('settings-active-tab');
    return (savedTab as 'general' | 'theme' | 'admin' | 'preview') || 'general';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Track current theme from restaurant and selected theme
  const [currentTheme, setCurrentTheme] = useState<RestaurantTheme | null>(null);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);

  const handleTabChange = (tab: 'general' | 'theme' | 'admin' | 'preview') => {
    setActiveTab(tab);
    localStorage.setItem('settings-active-tab', tab);
    setIsMobileMenuOpen(false);
  };

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
      
      const restaurantTheme = restaurant.theme || {
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        accentColor: '#10B981'
      };
      
      setThemeSettings(restaurantTheme);
      setCurrentTheme(restaurantTheme);
      setLogoPreview(restaurant.logo || '');

      // Find if current theme matches any default theme
      const matchingThemeIndex = defaultThemes.findIndex(theme => 
        theme.primaryColor === restaurantTheme.primaryColor &&
        theme.secondaryColor === restaurantTheme.secondaryColor
      );
      setSelectedThemeIndex(matchingThemeIndex !== -1 ? matchingThemeIndex : null);
    }

    if (user) {
      setAdminInfo(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email,
        phone: user.phone || ''
      }));
    }
  }, [restaurant, user]);

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
      showSuccess('Restaurant information updated successfully');
    } catch (error: any) {
      showError(error.message || 'Failed to update information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) {
      showError('Please select a logo file');
      return;
    }

    setIsLoading(true);
    try {
      await updateRestaurantLogo(logoFile);
      showSuccess('Logo updated successfully');
      setLogoFile(null);
    } catch (error: any) {
      showError(error.message || 'Failed to upload logo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await updateRestaurantSettings({ theme: themeSettings });
      setCurrentTheme(themeSettings);
      showSuccess('Theme updated successfully');
    } catch (error: any) {
      showError(error.message || 'Failed to update theme');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminInfo.newPassword && adminInfo.newPassword !== adminInfo.confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      await updateAdminSettings(adminInfo);
      
      setAdminInfo(prev => ({ 
        ...prev, 
        currentPassword: '', 
        newPassword: '', 
        confirmPassword: '' 
      }));
      
      showSuccess('Admin information updated successfully');
    } catch (error: any) {
      showError(error.message || 'Failed to update admin information');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (theme: RestaurantTheme, index: number) => {
    setThemeSettings(theme);
    setSelectedThemeIndex(index);
    showSuccess('Theme preview applied! Click "Save Theme" to confirm.');
  };

  // Check if current theme settings match the saved theme
  const isThemeChanged = () => {
    if (!currentTheme) return false;
    return (
      currentTheme.primaryColor !== themeSettings.primaryColor ||
      currentTheme.secondaryColor !== themeSettings.secondaryColor ||
      currentTheme.backgroundColor !== themeSettings.backgroundColor ||
      currentTheme.textColor !== themeSettings.textColor ||
      currentTheme.accentColor !== themeSettings.accentColor
    );
  };

  if (!restaurant || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <i className="ri-restaurant-2-line text-6xl text-green-600/60"></i>
          </div>
          <i className="ri-loader-4-line animate-spin text-3xl text-green-600 mb-4"></i>
          <p className="text-gray-600 font-medium">Loading your settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'ri-building-4-line', color: 'blue' },
    { id: 'admin', label: 'Admin', icon: 'ri-user-settings-line', color: 'green' },
    { id: 'theme', label: 'Appearance', icon: 'ri-palette-line', color: 'purple' },
    { id: 'preview', label: 'Preview', icon: 'ri-eye-line', color: 'orange' }
  ];

  const getTabColor = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.color || 'blue';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 py-4 sm:py-6 lg:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Enhanced Header */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <i className="ri-settings-3-line text-white text-lg lg:text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Restaurant Settings
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Customize your restaurant's appearance and configuration
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Navigation */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/50 mb-6 lg:mb-8 overflow-hidden">
          {/* Mobile Navigation */}
          <div className="lg:hidden border-b border-gray-100/50">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${getTabColor(activeTab)}-100 flex items-center justify-center`}>
                  <i className={`${tabs.find(t => t.id === activeTab)?.icon} text-lg text-${getTabColor(activeTab)}-600`}></i>
                </div>
                <div>
                  <span className="font-semibold text-gray-900 block">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </span>
                  <span className="text-xs text-gray-500">Tap to change section</span>
                </div>
              </div>
              <i className={`ri-arrow-${isMobileMenuOpen ? 'up' : 'down'}-s-line text-xl text-gray-400 group-hover:text-gray-600 transition-colors`}></i>
            </button>
            
            {isMobileMenuOpen && (
              <div className="border-t border-gray-100/50 bg-white/50 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-2 p-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as any)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${
                        activeTab === tab.id
                          ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/30`
                          : 'bg-white text-gray-700 hover:bg-gray-50/80 shadow-sm border border-gray-100'
                      }`}
                    >
                      <i className={`${tab.icon} text-xl mb-2 ${activeTab === tab.id ? 'text-white' : `text-${tab.color}-500`}`}></i>
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:block">
            <nav className="flex px-6 justify-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`flex items-center gap-3 px-6 py-5 border-b-2 font-semibold text-sm transition-all duration-300 relative group ${
                    activeTab === tab.id
                      ? `border-${tab.color}-500 text-${tab.color}-600 bg-gradient-to-r from-${tab.color}-50/50 to-transparent`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    activeTab === tab.id 
                      ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/30` 
                      : `bg-${tab.color}-100 text-${tab.color}-500 group-hover:bg-${tab.color}-500 group-hover:text-white`
                  }`}>
                    <i className={`${tab.icon} text-sm`}></i>
                  </div>
                  <span>{tab.label}</span>
                  
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-50"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Enhanced Content Area */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/50 overflow-hidden">
          <div className="sm:p-2 lg:p-8">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6 sm:space-y-8">
                {/* Restaurant Information Card */}
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-2xl p-2 sm:p-8 border border-blue-100/50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="ri-building-4-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Restaurant Information</h3>
                      <p className="text-sm text-gray-600 mt-1">Basic details about your restaurant</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleGeneralSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <i className="ri-restaurant-line text-blue-500"></i>
                          Restaurant Name
                        </label>
                        <input
                          type="text"
                          value={generalInfo.name || ''}
                          onChange={(e) => setGeneralInfo({ ...generalInfo, name: e.target.value })}
                          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80 backdrop-blur-sm"
                          placeholder="Your restaurant name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <i className="ri-file-text-line text-blue-500"></i>
                          Description
                        </label>
                        <input
                          type="text"
                          value={generalInfo.description || ''}
                          onChange={(e) => setGeneralInfo({ ...generalInfo, description: e.target.value })}
                          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80 backdrop-blur-sm"
                          placeholder="Brief description"
                        />
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-gray-100">
                      <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                          <i className="ri-phone-line text-white text-sm"></i>
                        </div>
                        Contact Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                          { key: 'phone', label: 'Phone', icon: 'ri-phone-line', type: 'tel' },
                          { key: 'email', label: 'Email', icon: 'ri-mail-line', type: 'email' },
                          { key: 'website', label: 'Website', icon: 'ri-global-line', type: 'url' }
                        ].map((field) => (
                          <div key={field.key} className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <i className={`${field.icon} text-green-500`}></i>
                              {field.label}
                            </label>
                            <input
                              type={field.type}
                              value={generalInfo.contact?.[field.key as keyof typeof generalInfo.contact] || ''}
                              onChange={(e) => setGeneralInfo({
                                ...generalInfo,
                                contact: { 
                                  ...generalInfo.contact, 
                                  [field.key]: e.target.value
                                } as any
                              })}
                              className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white/80"
                              placeholder={field.key === 'website' ? 'www.example.com' : field.key === 'phone' ? '+237 6 00 00 00 00' : 'email@example.com'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-gray-100">
                      <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                          <i className="ri-map-pin-line text-white text-sm"></i>
                        </div>
                        Address Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  {[
    { key: 'street', label: 'Street Address', icon: 'ri-road-map-line', fullWidth: true },
    { key: 'city', label: 'City', icon: 'ri-building-2-line' },
    { key: 'state', label: 'Region', icon: 'ri-government-line' }, // ✅ renamed label only
    { key: 'zipCode', label: 'Postal Code', icon: 'ri-map-pin-2-line' },
    { key: 'country', label: 'Country', icon: 'ri-earth-line' }
  ].map((field) => (
    <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <i className={`${field.icon} text-purple-500`}></i>
        {field.label}
      </label>

      {/* ✅ Region dropdown for the 'state' key */}
      {field.key === 'state' ? (
        <select
          value={generalInfo.address?.state || ''} // ✅ shows current region from backend
          onChange={(e) =>
            setGeneralInfo({
              ...generalInfo,
              address: {
                ...generalInfo.address,
                state: e.target.value
              } as any
            })
          }
          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white/80"
        >
          <option value="">Select Region</option>
          {[
            'Adamawa',
            'Centre',
            'East',
            'Far North',
            'Littoral',
            'North',
            'North West',
            'South',
            'South West',
            'West'
          ].map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={generalInfo.address?.[field.key as keyof typeof generalInfo.address] || ''}
          onChange={(e) =>
            setGeneralInfo({
              ...generalInfo,
              address: {
                ...generalInfo.address,
                [field.key]: e.target.value
              } as any
            })
          }
          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white/80"
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}
    </div>
  ))}
</div>

                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="group bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <i className="ri-loader-4-line animate-spin"></i>
                            Saving Changes...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <i className="ri-save-line group-hover:scale-110 transition-transform"></i>
                            Save Restaurant Info
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Logo Upload Card */}
                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-2xl p-6 sm:p-8 border border-purple-100/50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="ri-image-2-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Restaurant Logo</h3>
                      <p className="text-sm text-gray-600 mt-1">Upload your restaurant's logo</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleLogoSubmit} className="space-y-6">
                    <div className="bg-gradient-to-br from-white to-gray-50/50 border-2 border-dashed border-gray-300 rounded-2xl p-6 sm:p-8 hover:border-purple-300 transition-colors">
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex-shrink-0">
                          <div className="relative">
                            <img
                              src={logoPreview || '/api/placeholder/120/120'}
                              alt="Logo preview"
                              className="h-24 w-24 sm:h-32 sm:w-32 rounded-2xl object-cover border-4 border-white shadow-2xl"
                            />
                            {logoPreview && (
                              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                <i className="ri-check-line text-white text-sm"></i>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            id="logo-upload"
                            className="hidden"
                          />
                          <label
                            htmlFor="logo-upload"
                            className="inline-flex items-center gap-3 bg-white border-2 border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-semibold cursor-pointer hover:bg-gray-50 hover:border-purple-400 transition-all duration-300 shadow-sm hover:shadow-md"
                          >
                            <i className="ri-upload-cloud-2-line text-xl text-purple-500"></i>
                            Choose Image
                          </label>
                          <div className="text-sm text-gray-500 mt-4 space-y-1">
                            <p>• PNG, JPG, or GIF up to 5MB</p>
                            <p>• Recommended: 512x512px or larger</p>
                            <p>• Square format works best</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-center lg:justify-end">
                      <button
                        type="submit"
                        disabled={!logoFile || isLoading}
                        className=" bg-blue-600 text-white px-8 py-4 rounded-xl transition duration-200 hover:bg-blue-700 "
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <i className="ri-loader-4-line animate-spin"></i>
                            Uploading Logo...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <i className="ri-upload-line group-hover:scale-110 transition-transform"></i>
                            Upload Logo
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Theme Settings */}
            {activeTab === 'theme' && (
              <div className="space-y-6 sm:space-y-8">
                <div className="bg-gradient-to-br from-pink-50/50 to-rose-50/30 rounded-2xl p-2 sm:p-8 border border-pink-100/50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="ri-palette-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Theme Customization</h3>
                      <p className="text-sm text-gray-600 mt-1">Customize your restaurant's appearance</p>
                    </div>
                  </div>

                  {/* Theme Status Banner */}
                  {isThemeChanged() && (
                    <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-200 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                          <i className="ri-information-line text-white text-sm"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-amber-800">Theme Preview Active</p>
                          <p className="text-sm text-amber-700">You have unsaved theme changes. Click "Save Theme" to apply them.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Default Themes */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        Default Themes
                      </h4>
                      {currentTheme && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Current Theme</span>
                          <div className="w-3 h-3 rounded-full bg-blue-500 ml-3"></div>
                          <span>Selected</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {defaultThemes.map((theme, index) => {
                        const isCurrentTheme = currentTheme && 
                          currentTheme.primaryColor === theme.primaryColor &&
                          currentTheme.secondaryColor === theme.secondaryColor;
                        const isSelected = selectedThemeIndex === index;
                        
                        return (
                          <div
                            key={index}
                            onClick={() => applyTheme(theme, index)}
                            className={`group relative bg-white/80 backdrop-blur-sm border-2 rounded-2xl p-5 cursor-pointer transition-all duration-300 active:scale-95 overflow-hidden ${
                              isCurrentTheme 
                                ? 'border-green-500 shadow-lg shadow-green-500/20' 
                                : isSelected
                                ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                : 'border-gray-200 hover:border-pink-300 hover:shadow-xl'
                            }`}
                          >
                            {/* Status Indicators */}
                            <div className="absolute top-3 right-3 flex gap-1">
                              {isCurrentTheme && (
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                  <i className="ri-check-line text-white text-xs"></i>
                                </div>
                              )}
                              {isSelected && !isCurrentTheme && (
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                  <i className="ri-arrow-right-line text-white text-xs"></i>
                                </div>
                              )}
                            </div>

                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-pink-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                              <div className="flex items-center gap-2 mb-4">
                                {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map((color, i) => (
                                  <div
                                    key={i}
                                    className="w-8 h-8 rounded-lg border-2 border-white shadow-lg flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  ></div>
                                ))}
                              </div>
                              <div className="text-base font-bold text-gray-900 flex items-center gap-2">
                                Theme {index + 1}
                                {isCurrentTheme && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
                                )}
                                {isSelected && !isCurrentTheme && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Selected</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                <i className="ri-cursor-line text-pink-500"></i>
                                {isCurrentTheme ? 'Currently active' : 'Click to preview'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Theme */}
                  <form onSubmit={handleThemeSubmit}>
                    <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <i className="ri-settings-3-line text-pink-500"></i>
                      Create Custom Theme
                    </h4>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { key: 'primaryColor', label: 'Primary Color', icon: 'ri-brush-3-line', description: 'Main brand color' },
                        { key: 'secondaryColor', label: 'Secondary Color', icon: 'ri-paint-brush-line', description: 'Supporting color' },
                        { key: 'backgroundColor', label: 'Background', icon: 'ri-layout-line', description: 'Page background' },
                        { key: 'textColor', label: 'Text Color', icon: 'ri-font-color', description: 'Main text color' },
                        { key: 'accentColor', label: 'Accent Color', icon: 'ri-flashlight-line', description: 'Highlights & buttons' }
                      ].map((item) => (
                        <div key={item.key} className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                          <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <i className={`${item.icon} text-pink-500`}></i>
                            {item.label}
                          </label>
                          <p className="text-xs text-gray-500 mb-3">{item.description}</p>
                          <div className="flex items-center gap-3 bg-gray-50/50 rounded-lg p-2">
                            <input
                              type="color"
                              value={themeSettings[item.key as keyof RestaurantTheme] || '#FFFFFF'}
                              onChange={(e) => {
                                setThemeSettings({
                                  ...themeSettings,
                                  [item.key]: e.target.value
                                });
                                setSelectedThemeIndex(null); // Clear selected theme when customizing
                              }}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-white shadow-md cursor-pointer flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={themeSettings[item.key as keyof RestaurantTheme] || '#FFFFFF'}
                              onChange={(e) => {
                                setThemeSettings({
                                  ...themeSettings,
                                  [item.key]: e.target.value
                                });
                                setSelectedThemeIndex(null); // Clear selected theme when customizing
                              }}
                              className="flex-1 border-0 bg-transparent px-2 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pink-300 rounded"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-center lg:justify-end">
                      <button
                        type="submit"
                        disabled={isLoading || !isThemeChanged()}
                        className={`group px-8 py-4 rounded-xl font-semibold focus:outline-none focus:ring-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                          isThemeChanged()
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-blue-500/30 hover:shadow-blue-500/40'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <i className="ri-loader-4-line animate-spin"></i>
                            Saving Theme...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <i className="ri-save-line group-hover:scale-110 transition-transform"></i>
                            {isThemeChanged() ? 'Save Theme Changes' : 'No Changes to Save'}
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Admin Settings */}
            {activeTab === 'admin' && (
              <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/30 rounded-2xl p-6 sm:p-8 border border-emerald-100/50">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="ri-user-settings-line text-white text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Settings</h3>
                    <p className="text-sm text-gray-600 mt-1">Manage your account information</p>
                  </div>
                </div>
                
                <form onSubmit={handleAdminSubmit} className="space-y-6 max-w-3xl">
                  {/* Profile Information */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <i className="ri-user-line text-white text-sm"></i>
                      </div>
                      Profile Information
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <i className="ri-user-3-line text-blue-500"></i>
                          Admin Name
                        </label>
                        <input
                          type="text"
                          value={adminInfo.name || ''}
                          onChange={(e) => setAdminInfo({ ...adminInfo, name: e.target.value })}
                          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <i className="ri-mail-line text-blue-500"></i>
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={adminInfo.email}
                            onChange={(e) => setAdminInfo({ ...adminInfo, email: e.target.value })}
                            className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80"
                            placeholder="admin@restaurant.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <i className="ri-phone-line text-blue-500"></i>
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={adminInfo.phone || ''}
                            onChange={(e) => setAdminInfo({ ...adminInfo, phone: e.target.value })}
                            className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80"
                            placeholder="+237 6 00 00 00 00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Password Change */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <i className="ri-lock-password-line text-white text-sm"></i>
                      </div>
                      Change Password
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <i className="ri-key-2-line text-amber-500"></i>
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={adminInfo.currentPassword || ''}
                          onChange={(e) => setAdminInfo({ ...adminInfo, currentPassword: e.target.value })}
                          className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-white/80"
                          placeholder="Enter current password"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <i className="ri-key-line text-amber-500"></i>
                            New Password
                          </label>
                          <input
                            type="password"
                            value={adminInfo.newPassword || ''}
                            onChange={(e) => setAdminInfo({ ...adminInfo, newPassword: e.target.value })}
                            className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-white/80"
                            placeholder="Enter new password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <i className="ri-shield-keyhole-line text-amber-500"></i>
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={adminInfo.confirmPassword || ''}
                            onChange={(e) => setAdminInfo({ ...adminInfo, confirmPassword: e.target.value })}
                            className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-white/80"
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <i className="ri-loader-4-line animate-spin"></i>
                          Saving Changes...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <i className="ri-save-line group-hover:scale-110 transition-transform"></i>
                          Save Admin Settings
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Preview */}
            {activeTab === 'preview' && (
              <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-2xl  sm:p-2 border border-amber-100/50">
                <div className="flex items-center gap-4 mb-6 p-6 pb-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="ri-eye-line text-white text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Menu Preview</h3>
                    <p className="w-full text-sm text-gray-600 mt-1">See how your menu looks to customers</p>
                  </div>
                </div>
                
                {/* Menu Preview Component */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-2 sm:p-6 lg:p-8">
                  <div 
                    className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 max-w-3xl mx-auto border-2 backdrop-blur-sm"
                    style={{ 
                      backgroundColor: themeSettings.backgroundColor || '#FFFFFF',
                      color: themeSettings.textColor || '#1F2937',
                      borderColor: themeSettings.primaryColor + '20'
                    }}
                  >
                    {/* Menu Header */}
                    <div className="text-center mb-8 sm:mb-10">
                      {logoPreview && (
                        <div className="mb-5">
                          <img
                            src={logoPreview}
                            alt="Restaurant Logo"
                            className="h-16 w-16 sm:h-20 sm:w-20 mx-auto rounded-2xl object-cover shadow-lg ring-4 ring-white/50"
                          />
                        </div>
                      )}
                      <h1 
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3"
                        style={{ color: themeSettings.primaryColor }}
                      >
                        {generalInfo.name || 'Restaurant Name'}
                      </h1>
                      <p className="text-base sm:text-lg opacity-75 max-w-xl mx-auto">
                        {generalInfo.description || 'Your restaurant description appears here'}
                      </p>
                    </div>

                    {/* Divider */}
                    <div 
                      className="h-1 rounded-full mb-8 sm:mb-10 opacity-50"
                      style={{ 
                        background: `linear-gradient(90deg, transparent, ${themeSettings.secondaryColor}, transparent)` 
                      }}
                    ></div>

                    {/* Menu Section */}
                    <div>
                      <h2 
                        className="text-xl sm:text-2xl font-bold mb-5 flex items-center gap-3"
                        style={{ color: themeSettings.secondaryColor }}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: themeSettings.primaryColor + '15' }}
                        >
                          <i className="ri-restaurant-2-line" style={{ color: themeSettings.primaryColor }}></i>
                        </div>
                        Featured Appetizers
                      </h2>
                      
                      {/* Sample Menu Items */}
                      <div className="space-y-4 sm:space-y-5">
                        {[
                          { name: 'Garlic Bread', price: '$5.99', description: 'Freshly baked with garlic butter and herbs', icon: 'ri-bread-line' },
                          { name: 'Bruschetta', price: '$7.99', description: 'Tomato, basil, and mozzarella on toasted bread', icon: 'ri-plant-line' },
                          { name: 'Calamari', price: '$9.99', description: 'Crispy fried squid with marinara sauce', icon: 'ri-fish-line' }
                        ].map((item, index) => (
                          <div 
                            key={index} 
                            className="flex justify-between items-start gap-4 p-4 rounded-xl hover:shadow-md transition-all duration-300 group"
                            style={{ backgroundColor: themeSettings.primaryColor + '08' }}
                          >
                            <div className="flex gap-3 flex-1 min-w-0">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: themeSettings.primaryColor + '20' }}
                              >
                                <i className={item.icon} style={{ color: themeSettings.primaryColor }}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base sm:text-lg truncate">{item.name}</h3>
                                <p className="text-sm opacity-75 mt-1 line-clamp-2">{item.description}</p>
                              </div>
                            </div>
                            <span 
                              className="font-bold text-lg sm:text-xl whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg group-hover:scale-105 transition-transform"
                              style={{ 
                                color: themeSettings.accentColor || themeSettings.primaryColor,
                                backgroundColor: (themeSettings.accentColor || themeSettings.primaryColor) + '15'
                              }}
                            >
                              {item.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Call to Action */}
                    <div 
                      className="mt-8 sm:mt-10 p-5 sm:p-6 rounded-2xl text-center shadow-lg backdrop-blur-sm"
                      style={{ 
                        background: `linear-gradient(135deg, ${themeSettings.primaryColor}, ${themeSettings.secondaryColor})`,
                        color: 'white'
                      }}
                    >
                      <i className="ri-restaurant-line text-3xl mb-3 block opacity-90"></i>
                      <p className="font-bold text-base sm:text-lg mb-2">Visit us today for an unforgettable experience!</p>
                      <div className="text-sm sm:text-base opacity-95 space-y-1">
                        {generalInfo.contact?.phone && (
                          <p className="flex items-center justify-center gap-2">
                            <i className="ri-phone-line"></i>
                            {generalInfo.contact.phone}
                          </p>
                        )}
                        {generalInfo.contact?.email && (
                          <p className="flex items-center justify-center gap-2 break-all">
                            <i className="ri-mail-line"></i>
                            {generalInfo.contact.email}
                          </p>
                        )}
                        {generalInfo.contact?.website && (
                          <p className="flex items-center justify-center gap-2 break-all">
                            <i className="ri-global-line"></i>
                            {generalInfo.contact.website}
                          </p>
                        )}
                      </div>
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

export default Settings;