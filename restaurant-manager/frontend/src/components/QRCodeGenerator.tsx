import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category } from '../types';
import { useToast } from '../contexts/ToastContext';

// QR Code Generator Skeleton Loader
const QRCodeGeneratorSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    {/* Top Navigation Header Skeleton */}
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="w-10 h-10 lg:w-24 lg:h-10 bg-gray-200 rounded-full lg:rounded-xl animate-pulse"></div>
        </div>
        
        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="w-32 h-12 bg-gray-200 rounded-xl animate-pulse flex-shrink-0"
            ></div>
          ))}
        </div>
      </div>
    </div>

    {/* Main Content Skeleton */}
    <div className="max-w-7xl mx-auto p-4 lg:p-8">
      <div className="grid lg:grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column - Generator Form Skeleton */}
        <div className="space-y-6 lg:space-y-8">
          {/* QR Code Settings Card Skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
            
            <div className="space-y-4">
              {/* Table Number Input Skeleton */}
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="h-3 w-48 bg-gray-200 rounded animate-pulse mt-1.5"></div>
              </div>

              {/* Category/Item Selection Skeleton */}
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-12 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>

              {/* Generate Button Skeleton */}
              <div className="h-14 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
          </div>

          {/* Tips Section Skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="space-y-1">
                  <div className="h-3 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Generated QR Codes Skeleton */}
        <div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>

            <div className="p-6">
              {/* Empty State Skeleton */}
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-200 rounded-2xl animate-pulse mx-auto mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mx-auto mb-1"></div>
                <div className="h-3 w-48 bg-gray-200 rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

interface QRCodeData {
  type: 'table' | 'category' | 'item';
  id: string;
  name: string;
  url: string;
  generatedAt: string;
  tableNumber: string;
  title: string;
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
    setBaseUrl(`${window.location.origin}/waiter`);
  }, []);

  const loadMenuData = async () => {
    if (!user) {
      showError('No user found');
      return;
    }

    const restaurantId = user.restaurant?.id || (user.restaurant as any)?._id;
    
    if (!restaurantId) {
      showError('Restaurant ID not found. Please ensure you are logged in properly.');
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
    const restaurantId = user?.restaurant?.id || (user?.restaurant as any)?._id;
    
    if (!restaurantId) {
      showError('Restaurant ID not found. Please log in again.');
      return;
    }

    if (!tableNumber.trim()) {
      showError('Please enter a table number or name');
      return;
    }

    let url = '';
    let name = '';
    let title = '';
    let type: 'table' | 'category' | 'item' = 'table';
    const params = new URLSearchParams();

    params.append('table', tableNumber.trim());

    switch (activeTab) {
      case 'table':
        url = `${baseUrl}/restaurant/${restaurantId}/menu?${params.toString()}`;
        name = `Table ${tableNumber}`;
        title = `Table ${tableNumber}`;
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
        url = `${baseUrl}/restaurant/${restaurantId}/menu?${params.toString()}`;
        name = `${category.name} (Table ${tableNumber})`;
        title = `Table ${tableNumber} - ${category.name}`;
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
        url = `${baseUrl}/restaurant/${restaurantId}/menu?${params.toString()}`;
        name = `${item.name} (Table ${tableNumber})`;
        title = `Table ${tableNumber} - ${item.name}`;
        type = 'item';
        break;
    }

    const newQR: QRCodeData = {
      type,
      id: Date.now().toString(),
      name,
      url,
      title,
      generatedAt: new Date().toISOString(),
      tableNumber: tableNumber.trim()
    };

    setGeneratedQRs(prev => [newQR, ...prev]);
    setSelectedCategory('');
    setSelectedItem('');
    showSuccess('QR code generated successfully!');
  };

  const downloadQRCode = async (qr: QRCodeData): Promise<void> => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showError('Canvas not supported');
        return;
      }

      const qrSize = 400;
      const logoSize = 80;
      const padding = 20;
      const titleHeight = 60;
      const totalHeight = qrSize + titleHeight + padding * 3;
      
      canvas.width = qrSize + padding * 2;
      canvas.height = totalHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr.url)}&margin=10`;

      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
      });

      ctx.drawImage(qrImage, padding, padding + titleHeight, qrSize, qrSize);

      if (user?.restaurant?.logo) {
        const logoImage = new Image();
        logoImage.crossOrigin = 'anonymous';
        logoImage.src = user.restaurant.logo;

        await new Promise((resolve) => {
          logoImage.onload = resolve;
          logoImage.onerror = resolve;
        });

        const logoX = (canvas.width - logoSize) / 2;
        const logoY = padding + titleHeight + (qrSize - logoSize) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      }

      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(qr.title, canvas.width / 2, padding + 35);

      canvas.toBlob((blob) => {
        if (!blob) {
          showError('Failed to generate QR code image');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-${qr.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showSuccess('QR code downloaded successfully!');
      }, 'image/png');

    } catch (error) {
      console.error('Download error:', error);
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

  const deleteQRCode = (id: string): void => {
    setGeneratedQRs(prev => prev.filter(qr => qr.id !== id));
    showSuccess('QR code deleted');
  };

    if (loading) {
    return <QRCodeGeneratorSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">QR Generator</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create QR codes for your restaurant</p>
            </div>
            <button
              onClick={loadMenuData}
              className="w-10 h-10 lg:w-auto lg:px-4 lg:h-10 flex items-center justify-center rounded-full lg:rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors lg:gap-2"
            >
              <i className="ri-refresh-line text-xl text-gray-700"></i>
              <span className="hidden lg:inline font-semibold text-gray-700">Refresh</span>
            </button>
          </div>
          
          {/* Tabs - Always visible */}
          <div className="flex gap-2 overflow-x-auto mt-4 pb-1 scrollbar-hide">
            {[
              { id: 'table', icon: 'ri-table-2-line', label: 'Table QR', color: 'blue' },
              { id: 'category', icon: 'ri-folder-3-line', label: 'Category QR', color: 'emerald' },
              { id: 'item', icon: 'ri-restaurant-2-line', label: 'Item QR', color: 'violet' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-200`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className={`${tab.icon} text-lg`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="grid lg:grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column - Generator Form and Settings */}
          <div className="space-y-6 lg:space-y-8 w-50">
            {/* QR Code Settings Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-settings-3-line text-blue-600"></i>
                QR Code Settings
              </h2>
              
              <div className="space-y-4">
                {/* Table Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Table Number / Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <i className="ri-table-2-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g., Table 5, A1, Patio"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">This identifies the customer's location</p>
                </div>

                {/* Category Selection */}
                {activeTab === 'category' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Category <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <i className="ri-folder-3-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all outline-none appearance-none bg-white"
                      >
                        <option value="">Choose a category...</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                  </div>
                )}

                {/* Item Selection */}
                {activeTab === 'item' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Menu Item <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <i className="ri-restaurant-2-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <select
                        value={selectedItem}
                        onChange={(e) => setSelectedItem(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all outline-none appearance-none bg-white"
                      >
                        <option value="">Choose a menu item...</option>
                        {menuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {item.price?.toLocaleString?.() || '0'} CFA
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
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
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 disabled:shadow-none flex items-center justify-center gap-3"
                >
                  <i className="ri-qr-scan-2-line text-xl"></i>
                  Generate QR Code
                </button>
              </div>
            </div>

            {/* Tips Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-lightbulb-line text-amber-600"></i>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-2">Quick Tips</p>
                  <ul className="text-sm text-amber-800 space-y-2">
                    <li className="flex gap-2">
                      <i className="ri-check-line text-amber-600 mt-0.5"></i>
                      <span>Print and place QR codes on tables for easy customer access</span>
                    </li>
                    <li className="flex gap-2">
                      <i className="ri-check-line text-amber-600 mt-0.5"></i>
                      <span>Use category codes to highlight specific menu sections</span>
                    </li>
                    <li className="flex gap-2">
                      <i className="ri-check-line text-amber-600 mt-0.5"></i>
                      <span>Create item codes for daily specials or featured dishes</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Generated QR Codes */}
          <div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Generated QR Codes</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {generatedQRs.length} {generatedQRs.length === 1 ? 'code' : 'codes'} created
                    </p>
                  </div>
                  {generatedQRs.length > 0 && (
                    <button
                      onClick={() => setGeneratedQRs([])}
                      className="text-sm text-red-600 hover:text-red-700 font-semibold"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 max-h-[calc(100vh-300px)] lg:max-h-[calc(100vh-200px)] overflow-y-auto">
                {generatedQRs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <i className="ri-qr-code-line text-4xl text-gray-400"></i>
                    </div>
                    <p className="text-gray-900 font-semibold mb-1">No QR Codes Yet</p>
                    <p className="text-sm text-gray-500">Generate your first QR code to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {generatedQRs.map((qr) => (
                      <div
                        key={qr.id}
                        className={`relative border-2 rounded-2xl p-4 transition-all ${
                          qr.type === 'table' ? 'border-blue-200 bg-blue-50' :
                          qr.type === 'category' ? 'border-emerald-200 bg-emerald-50' :
                          'border-violet-200 bg-violet-50'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                                qr.type === 'table' ? 'bg-blue-200 text-blue-800' :
                                qr.type === 'category' ? 'bg-emerald-200 text-emerald-800' :
                                'bg-violet-200 text-violet-800'
                              }`}>
                                {qr.type}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-900">{qr.title}</h3>
                            <p className="text-sm text-gray-600 mt-0.5">Table: {qr.tableNumber}</p>
                          </div>
                          <button
                            onClick={() => deleteQRCode(qr.id)}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex items-center justify-center"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white rounded-xl p-4 mb-4 border-2 border-gray-200">
                          <div className="relative inline-block w-full">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr.url)}&margin=10`}
                              alt={qr.title}
                              className="w-full rounded-lg"
                            />
                            {user?.restaurant?.logo && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-lg shadow-lg border-2 border-gray-200">
                                <img
                                  src={user.restaurant.logo}
                                  alt="Logo"
                                  className="w-12 h-12 object-contain"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* URL */}
                        <div className="bg-white rounded-xl p-3 mb-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500">URL</span>
                            <button
                              onClick={() => copyToClipboard(qr.url)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <i className="ri-file-copy-line"></i>
                              Copy
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 break-all font-mono leading-relaxed">
                            {qr.url}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => downloadQRCode(qr)}
                            className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <i className="ri-download-2-line"></i>
                            Download
                          </button>
                          <button
                            onClick={() => window.open(qr.url, '_blank')}
                            className={`py-2.5 px-4 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                              qr.type === 'table' ? 'bg-blue-600 hover:bg-blue-700' :
                              qr.type === 'category' ? 'bg-emerald-600 hover:bg-emerald-700' :
                              'bg-violet-600 hover:bg-violet-700'
                            }`}
                          >
                            <i className="ri-external-link-line"></i>
                            Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;