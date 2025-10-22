import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category } from '../types';
import { useToast } from '../contexts/ToastContext';

interface QRCodeData {
  type: 'table' | 'category' | 'item';
  id: string;
  name: string;
  url: string;
  generatedAt: string;
  tableNumber: string;
}

const QRCodeGenerator: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'table' | 'category' | 'item'>('table');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [generatedQRs, setGeneratedQRs] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [baseUrl, setBaseUrl] = useState<string>('');

  useEffect(() => {
    loadMenuData();
    setBaseUrl(`${window.location.origin}/order`);
  }, []);

  const loadMenuData = async () => {
    if (!user) {
      showError('No user found');
      return;
    }

    try {
      setLoading(true);
      const [menuResponse, categoriesResponse] = await Promise.all([
        menuService.getMenuItems(),
        menuService.getCategories()
      ]);

      const rawMenuItems = menuResponse?.menuItems || menuResponse?.data?.menuItems || menuResponse?.data || [];
      const rawCategories = categoriesResponse?.categories || categoriesResponse?.data?.categories || categoriesResponse?.data || [];

      const menuItems = rawMenuItems.map((item: any) => ({
        ...item,
        id: item.id || item._id,
        category: item.category?._id ? {
          id: item.category._id,
          name: item.category.name
        } : item.category
      }));

      const categories = rawCategories.map((category: any) => ({
        ...category,
        id: category.id || category._id
      }));

      setMenuItems(menuItems);
      setCategories(categories);
    } catch (error: any) {
      showError(`Failed to load menu data: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = (): void => {
    if (!tableNumber.trim()) {
      showError('Please enter a table number or name');
      return;
    }

    let url = '';
    let name = '';
    let type: 'table' | 'category' | 'item' = 'table';
    const params = new URLSearchParams();

    // Always include table number
    params.append('table', tableNumber.trim());

    switch (activeTab) {
      case 'table':
        url = `${baseUrl}?${params.toString()}`;
        name = `Table ${tableNumber}`;
        type = 'table';
        break;

      case 'category':
        if (!selectedCategory) {
          showError('Please select a category');
          return;
        }
        const category = categories.find(c => c.id === selectedCategory);
        if (!category) return;
        params.append('category', category.id);
        url = `${baseUrl}?${params.toString()}`;
        name = `${category.name} (Table ${tableNumber})`;
        type = 'category';
        break;

      case 'item':
        if (!selectedItem) {
          showError('Please select a menu item');
          return;
        }
        const item = menuItems.find(m => m.id === selectedItem);
        if (!item) return;
        params.append('item', item.id);
        url = `${baseUrl}?${params.toString()}`;
        name = `${item.name} (Table ${tableNumber})`;
        type = 'item';
        break;
    }

    const newQR: QRCodeData = {
      type,
      id: Date.now().toString(),
      name,
      url,
      generatedAt: new Date().toISOString(),
      tableNumber: tableNumber.trim()
    };

    setGeneratedQRs(prev => [newQR, ...prev]);
    
    // Reset selections but keep table number for convenience
    setSelectedCategory('');
    setSelectedItem('');
  };

  const downloadQRCode = async (qr: QRCodeData): Promise<void> => {
    try {
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr.url)}`;
      
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-${qr.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccess('QR code downloaded successfully!');
    } catch (error) {
      showError('Failed to download QR code');
    }
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('URL copied to clipboard!');
    }).catch(() => {
      showError('Failed to copy URL');
    });
  };

  const getQRCodeGradient = (type: string): string => {
    switch (type) {
      case 'table': return 'from-blue-50 via-blue-25 to-blue-100 border-blue-200/80';
      case 'category': return 'from-green-50 via-green-25 to-green-100 border-green-200/80';
      case 'item': return 'from-purple-50 via-purple-25 to-purple-100 border-purple-200/80';
      default: return 'from-gray-50 via-gray-25 to-gray-100 border-gray-200/80';
    }
  };

  const getQRCodeIcon = (type: string): string => {
    switch (type) {
      case 'table': return 'ri-table-line text-blue-600';
      case 'category': return 'ri-folder-line text-green-600';
      case 'item': return 'ri-restaurant-line text-purple-600';
      default: return 'ri-qr-code-line text-gray-600';
    }
  };

  const getBadgeColor = (type: string): string => {
    switch (type) {
      case 'table': return 'border-blue-300 bg-blue-100/80 text-blue-800';
      case 'category': return 'border-green-300 bg-green-100/80 text-green-800';
      case 'item': return 'border-purple-300 bg-purple-100/80 text-purple-800';
      default: return 'border-gray-300 bg-gray-100/80 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin mb-4"></i>
          <p className="text-gray-600">Loading QR code generator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600 shadow-2xl rounded-xl">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white truncate">
                QR Code <span className='hidden lg:inline'>Generator</span>
              </h1>
              <p className="text-blue-100/90 text-xs sm:text-sm lg:text-base mt-0.5 truncate">
                Create QR codes linked to customer tables
              </p>
            </div>
            <button
              onClick={loadMenuData}
              className="bg-white/20 backdrop-blur-lg text-white p-2.5 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3 rounded-xl sm:rounded-2xl font-semibold hover:bg-white/30 transition-all duration-300 flex items-center gap-2 flex-shrink-0 hover:scale-105 hover:shadow-lg"
            >
              <i className="ri-refresh-line text-lg lg:text-xl"></i>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Enhanced Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {[
              { id: 'table', icon: 'ri-table-line', label: 'Table', color: 'blue' },
              { id: 'category', icon: 'ri-folder-line', label: 'Category', color: 'green' },
              { id: 'item', icon: 'ri-restaurant-line', label: 'Menu Item', color: 'purple' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0 border-2 ${
                  activeTab === tab.id
                    ? `bg-white text-${tab.color}-600 border-${tab.color}-300 shadow-lg scale-105`
                    : `bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:scale-102`
                }`}
              >
                <i className={tab.icon}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-6  lg:py-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-5 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-4">
          {/* Generator Panel */}
          <div className="lg:col-span-3 xl:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl border border-white/60">
              

              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
                {/* Table Number Input */}
                <div>
                  <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-2">
                    Table Number/Name *
                  </label>
                  <div className="relative group">
                    <i className="ri-table-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors"></i>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g., '1', 'A1', 'Terrace', 'Bar-2'"
                      className="w-full pl-10 pr-4 py-3 sm:py-4 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base transition-all duration-300 bg-white/50 backdrop-blur-sm"
                    />
                  </div>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">
                    This will be automatically included in all QR codes to identify the customer's table
                  </p>
                </div>

                {/* Dynamic Content Based on Tab */}
                {activeTab === 'table' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4 sm:p-6">
                      <div className="flex gap-3">
                        <div className="bg-blue-100/80 rounded-lg p-3 flex-shrink-0">
                          <i className="ri-table-2 text-2xl text-blue-600"></i>
                        </div>
                        <div>
                          <p className="text-blue-900 text-sm sm:text-base lg:text-lg font-semibold">Table QR Code</p>
                          <p className="text-blue-800 text-xs sm:text-sm lg:text-base mt-1">
                            Customers scan to access the full menu with their table number automatically set.
                            Perfect for placing on tables throughout your restaurant.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'category' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-2">
                        Select Category *
                      </label>
                      <div className="relative group">
                        <i className="ri-folder-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-green-500 transition-colors"></i>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 sm:py-4 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-300 bg-white/50 backdrop-blur-sm appearance-none"
                        >
                          <option value="">Choose a category...</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-green-100/50 border border-green-200 rounded-xl p-4 sm:p-6">
                      <div className="flex gap-3">
                        <div className="bg-green-100/80 rounded-lg p-3 flex-shrink-0">
                          <i className="ri-folder-open text-2xl text-green-600"></i>
                        </div>
                        <div>
                          <p className="text-green-900 text-sm sm:text-base lg:text-lg font-semibold">Category QR Code</p>
                          <p className="text-green-800 text-xs sm:text-sm lg:text-base mt-1">
                            Customers scan to view only items from this specific category, with their table number automatically set.
                            Great for promotional displays or category-specific stations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'item' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-2">
                        Select Menu Item *
                      </label>
                      <div className="relative group">
                        <i className="ri-restaurant-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-purple-500 transition-colors"></i>
                        <select
                          value={selectedItem}
                          onChange={(e) => setSelectedItem(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 sm:py-4 border border-gray-300 rounded-xl focus:ring-3 focus:ring-purple-500/20 focus:border-purple-500 text-sm sm:text-base transition-all duration-300 bg-white/50 backdrop-blur-sm appearance-none"
                        >
                          <option value="">Choose a menu item...</option>
                          {menuItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} - {item.price.toLocaleString()} CFA
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl p-4 sm:p-6">
                      <div className="flex gap-3">
                        <div className="bg-purple-100/80 rounded-lg p-3 flex-shrink-0">
                          <i className="ri-restaurant-2 text-2xl text-purple-600"></i>
                        </div>
                        <div>
                          <p className="text-purple-900 text-sm sm:text-base lg:text-lg font-semibold">Menu Item QR Code</p>
                          <p className="text-purple-800 text-xs sm:text-sm lg:text-base mt-1">
                            Customers scan to go directly to this specific menu item with their table number automatically set.
                            Perfect for featured specials, daily promotions, or signature dishes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={generateQRCode}
                  disabled={
                    !tableNumber.trim() ||
                    (activeTab === 'category' && !selectedCategory) ||
                    (activeTab === 'item' && !selectedItem)
                  }
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white py-3.5 sm:py-4 lg:py-5 px-4 rounded-xl sm:rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-lg text-sm sm:text-base lg:text-lg"
                >
                  <i className="ri-qr-scan-2-line text-lg lg:text-xl"></i>
                  Generate QR Code
                </button>
              </div>
            </div>
          </div>

          {/* Generated QR Codes Section */}
          <div className="space-y-4 sm:space-y-6 ">
            <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl border border-white/60">
              <div className="p-4 sm:p-6 lg:p-8 border-b border-gray-100/60">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Generated Codes</h2>
                <p className="text-gray-600 text-xs sm:text-sm lg:text-base mt-1">
                  {generatedQRs.length} code{generatedQRs.length !== 1 ? 's' : ''} generated
                </p>
              </div>

              <div className="p-4 sm:p-6 lg:p-8 max-h-[70vh] overflow-y-auto">
                {generatedQRs.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 lg:py-16 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border-2 border-dashed border-gray-300/60">
                    <div className="animate-bounce mb-4">
                      <i className="ri-qr-code-line text-5xl sm:text-6xl text-gray-400/60"></i>
                    </div>
                    <p className="text-gray-500 text-sm sm:text-base lg:text-lg font-semibold">No QR Codes Yet</p>
                    <p className="text-gray-400 text-xs sm:text-sm lg:text-base mt-1 px-4">
                      Generate your first QR code to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                    {generatedQRs.map((qr) => (
                      <div
                        key={qr.id}
                        className={`bg-gradient-to-br ${getQRCodeGradient(qr.type)} border-2 rounded-2xl p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-lg hover:scale-102 group`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="bg-white/80 rounded-xl p-2 flex-shrink-0">
                              <i className={`${getQRCodeIcon(qr.type)} text-xl`}></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg truncate block">
                                {qr.name}
                              </span>
                              <span className="text-gray-600 text-xs sm:text-sm block">
                                Table: {qr.tableNumber}
                              </span>
                            </div>
                          </div>
                          <span className={`border-2 ${getBadgeColor(qr.type)} px-2 py-1 rounded-full text-xs font-bold capitalize flex-shrink-0`}>
                            {qr.type}
                          </span>
                        </div>

                        {/* QR Code Image */}
                        <div className="bg-white rounded-xl p-3 sm:p-4 mb-4 text-center border-2 border-white shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr.url)}&margin=10`}
                            alt={`QR Code for ${qr.name}`}
                            className="mx-auto rounded-lg w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40"
                          />
                        </div>

                        {/* URL Display */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs sm:text-sm lg:text-base">
                            <span className="text-gray-600 font-semibold">URL:</span>
                            <button
                              onClick={() => copyToClipboard(qr.url)}
                              className="text-blue-600 hover:text-blue-700 active:text-blue-800 flex items-center gap-1 font-semibold transition-all duration-200 hover:scale-105"
                            >
                              <i className="ri-clipboard-line"></i>
                              Copy
                            </button>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 bg-white/80 rounded-lg px-3 py-2 truncate border font-mono backdrop-blur-sm">
                            {qr.url}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => downloadQRCode(qr)}
                              className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-2.5 sm:py-3 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-105"
                            >
                              <i className="ri-download-line"></i>
                              <span>Download</span>
                            </button>
                            <button
                              onClick={() => window.open(qr.url, '_blank')}
                              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2.5 sm:py-3 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-105"
                            >
                              <i className="ri-eye-line"></i>
                              <span>Preview</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Pro Tips */}
            <div className="bg-gradient-to-br from-amber-50/80 to-yellow-100/50 backdrop-blur-sm border border-amber-200/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl">
              <div className="flex gap-3 sm:gap-4">
                <div className="bg-amber-100/80 rounded-xl p-3 flex-shrink-0">
                  <i className="ri-lightbulb-flash-line text-amber-600 text-xl sm:text-2xl"></i>
                </div>
                <div className="flex-1">
                  <p className="text-amber-900 font-bold text-sm sm:text-base lg:text-lg mb-2 sm:mb-3">Pro Tips</p>
                  <ul className="text-amber-800 text-xs sm:text-sm lg:text-base space-y-2">
                    <li className="flex items-center gap-2">
                      <i className="ri-checkbox-circle-line text-amber-600 text-base"></i>
                      Print table QR codes for each dining table
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="ri-checkbox-circle-line text-amber-600 text-base"></i>
                      Use category QR codes for promotional displays
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="ri-checkbox-circle-line text-amber-600 text-base"></i>
                      Item QR codes work great for featured specials
                    </li>
                    <li className="flex items-center gap-2">
                      <i className="ri-checkbox-circle-line text-amber-600 text-base"></i>
                      All QR codes automatically include table number
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;