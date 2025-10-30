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

    if (!user.restaurant?._id) {
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
    if (!user?.restaurant?._id) {
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
    const restaurantId = user.restaurant._id;

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

  const getQRCodeGradient = (type: string): string => {
    switch (type) {
      case 'table': return 'from-blue-50 to-blue-100 border-blue-200';
      case 'category': return 'from-green-50 to-green-100 border-green-200';
      case 'item': return 'from-purple-50 to-purple-100 border-purple-200';
      default: return 'from-gray-50 to-gray-100 border-gray-200';
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
      case 'table': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'category': return 'bg-green-100 text-green-700 border-green-300';
      case 'item': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin mb-4"></i>
          <p className="text-gray-600 text-sm">Loading QR code generator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="px-3 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white">
                QR Generator
              </h1>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                Create QR codes for tables
              </p>
            </div>
            <button
              onClick={loadMenuData}
              className="bg-white/20 backdrop-blur text-white p-2 sm:px-4 sm:py-2.5 rounded-lg font-semibold hover:bg-white/30 transition-all flex items-center gap-2 flex-shrink-0"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
            {[
              { id: 'table', icon: 'ri-table-line', label: 'Table' },
              { id: 'category', icon: 'ri-folder-line', label: 'Category' },
              { id: 'item', icon: 'ri-restaurant-line', label: 'Item' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <i className={`${tab.icon} text-base`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 py-3 sm:px-6 max-w-7xl mx-auto">
        {/* Generator Panel */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-3">
          <div className="p-4 space-y-4">
            {/* Table Number Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Table Number/Name *
              </label>
              <div className="relative">
                <i className="ri-table-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g., '2', 'A1', 'Terrace'"
                  className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Identifies the customer's table
              </p>
            </div>

            {/* Dynamic Content */}
            {activeTab === 'category' && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Select Category *
                </label>
                <div className="relative">
                  <i className="ri-folder-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm appearance-none"
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
            )}

            {activeTab === 'item' && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Select Menu Item *
                </label>
                <div className="relative">
                  <i className="ri-restaurant-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
                  <select
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm appearance-none"
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
            )}

            {/* Generate Button */}
            <button
              onClick={generateQRCode}
              disabled={
                !tableNumber.trim() ||
                (activeTab === 'category' && !selectedCategory) ||
                (activeTab === 'item' && !selectedItem)
              }
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md text-sm"
            >
              <i className="ri-qr-scan-2-line text-lg"></i>
              Generate QR Code
            </button>
          </div>
        </div>

        {/* Pro Tips */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-100 border-2 border-amber-200 rounded-xl p-3 shadow-md mb-3">
          <div className="flex gap-2">
            <div className="bg-amber-100 rounded-lg p-2 flex-shrink-0">
              <i className="ri-lightbulb-flash-line text-amber-600 text-lg"></i>
            </div>
            <div className="flex-1">
              <p className="text-amber-900 font-bold text-sm mb-1.5">Pro Tips</p>
              <ul className="text-amber-800 text-xs space-y-1">
                <li className="flex items-start gap-1.5">
                  <i className="ri-checkbox-circle-line text-amber-600 mt-0.5 flex-shrink-0 text-sm"></i>
                  <span>Print table QR codes for dining tables</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <i className="ri-checkbox-circle-line text-amber-600 mt-0.5 flex-shrink-0 text-sm"></i>
                  <span>Category QR codes for promotions</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <i className="ri-checkbox-circle-line text-amber-600 mt-0.5 flex-shrink-0 text-sm"></i>
                  <span>Item QR codes for featured specials</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Generated QR Codes */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Generated Codes</h2>
            <p className="text-gray-600 text-xs mt-0.5">
              {generatedQRs.length} code{generatedQRs.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="p-3">
            {generatedQRs.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="mb-2">
                  <i className="ri-qr-code-line text-4xl text-gray-300"></i>
                </div>
                <p className="text-gray-500 text-sm font-semibold">No QR Codes Yet</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Generate your first code
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedQRs.map((qr) => (
                  <div
                    key={qr.id}
                    className={`bg-gradient-to-br ${getQRCodeGradient(qr.type)} border-2 rounded-xl p-3 transition-all`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="bg-white rounded-lg p-1.5">
                          <i className={`${getQRCodeIcon(qr.type)} text-base`}></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm truncate">
                            {qr.title}
                          </p>
                          <p className="text-gray-600 text-xs">
                            Table: {qr.tableNumber}
                          </p>
                        </div>
                      </div>
                      <span className={`${getBadgeColor(qr.type)} border px-2 py-0.5 rounded-full text-xs font-bold capitalize flex-shrink-0`}>
                        {qr.type}
                      </span>
                    </div>

                    {/* QR Code with Logo */}
                    <div className="bg-white rounded-lg p-3 mb-2 text-center border shadow-sm">
                      <div className="relative inline-block">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr.url)}&margin=10`}
                          alt={`QR Code for ${qr.title}`}
                          className="rounded-lg w-36 h-36 mx-auto"
                        />
                        {user?.restaurant?.logo && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1 rounded-md shadow-md">
                            <img
                              src={user.restaurant.logo}
                              alt="Logo"
                              className="w-9 h-9 object-contain"
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-700 mt-2">
                        {qr.title}
                      </p>
                    </div>

                    {/* URL */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-semibold">URL:</span>
                        <button
                          onClick={() => copyToClipboard(qr.url)}
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
                        >
                          <i className="ri-clipboard-line text-sm"></i>
                          Copy
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 bg-white rounded-lg px-2 py-1.5 break-all border font-mono leading-relaxed">
                        {qr.url}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => downloadQRCode(qr)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <i className="ri-download-line text-sm"></i>
                          Download
                        </button>
                        <button
                          onClick={() => window.open(qr.url, '_blank')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <i className="ri-eye-line text-sm"></i>
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;