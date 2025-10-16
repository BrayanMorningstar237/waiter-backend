import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category, CreateMenuItemData } from '../types';

const MenuManagement: React.FC = () => {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    if (!user?.restaurant.id) return;
    
    try {
      setLoading(true);
      const [menuResponse, categoriesResponse] = await Promise.all([
        menuService.getMenuItems(user.restaurant.id),
        menuService.getCategories(user.restaurant.id)
      ]);
      
      setMenuItems(menuResponse.menuItems || []);
      setCategories(categoriesResponse.categories || []);
    } catch (error) {
      console.error('Failed to load menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || 
      (typeof item.category === 'string' ? item.category : item.category.id) === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddItem = async (data: CreateMenuItemData) => {
    if (!user?.restaurant.id) return;

    try {
      await menuService.createMenuItem({
        ...data,
        restaurant: user.restaurant.id,
        isAvailable: true
      });
      await loadMenuData();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to create menu item:', error);
      alert('Failed to create menu item');
    }
  };

  const handleEditItem = async (id: string, data: Partial<MenuItem>) => {
    try {
      await menuService.updateMenuItem(id, data);
      await loadMenuData();
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update menu item:', error);
      alert('Failed to update menu item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await menuService.deleteMenuItem(id);
      await loadMenuData();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert('Failed to delete menu item');
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    await handleEditItem(item.id, { isAvailable: !item.isAvailable });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-green-500 animate-spin mb-4"></i>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-600 mt-1">Manage your restaurant menu items and categories</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2 shadow-lg shadow-green-500/25"
        >
          <i className="ri-add-line"></i>
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200/50">
          <i className="ri-restaurant-line text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No menu items found</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first menu item</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors"
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onEdit={setEditingItem}
              onDelete={handleDeleteItem}
              onToggleAvailability={toggleAvailability}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <MenuItemModal
          item={editingItem}
          categories={categories}
          onSave={editingItem ? 
            (data) => handleEditItem(editingItem.id, data) : 
            handleAddItem
          }
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
};

// Menu Item Card Component
interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (item: MenuItem) => void;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onEdit, onDelete, onToggleAvailability }) => {
  const categoryName = typeof item.category === 'string' ? 'Uncategorized' : item.category.name;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
      item.isAvailable ? 'border-transparent' : 'border-gray-200 opacity-60'
    }`}>
      {/* Image */}
      <div className="relative">
        {item.image ? (
          <img
            src={`http://localhost:5000${item.image}`}
            alt={item.name}
            className="w-full h-48 object-cover rounded-t-xl"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-xl flex items-center justify-center">
            <i className="ri-restaurant-line text-4xl text-gray-400"></i>
          </div>
        )}
        <div className="absolute top-3 right-3 flex space-x-2">
          <button
            onClick={() => onToggleAvailability(item)}
            className={`p-2 rounded-full shadow-lg ${
              item.isAvailable 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <i className={`ri-${item.isAvailable ? 'eye' : 'eye-off'}-line text-sm`}></i>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-lg truncate flex-1">{item.name}</h3>
          <span className="text-lg font-bold text-green-600 ml-2">
            {item.price.toLocaleString()} CFA
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
            {categoryName}
          </span>
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <i
                key={i}
                className={`ri-chili-line text-sm ${
                  i < item.spiceLevel ? 'text-red-500' : 'text-gray-300'
                }`}
              ></i>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-3">
          {item.isVegetarian && (
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">
              Veg
            </span>
          )}
          {item.isVegan && (
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
              Vegan
            </span>
          )}
          {item.isGlutenFree && (
            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
              GF
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(item)}
            className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center space-x-1"
          >
            <i className="ri-edit-line"></i>
            <span>Edit</span>
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-red-600 hover:text-red-700 font-semibold text-sm flex items-center space-x-1"
          >
            <i className="ri-delete-bin-line"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Menu Item Modal Component
interface MenuItemModalProps {
  item?: MenuItem | null;
  categories: Category[];
  onSave: (data: any) => void;
  onClose: () => void;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({ item, categories, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price || 0,
    category: (typeof item?.category === 'string' ? item.category : item?.category?.id) || '',
    ingredients: item?.ingredients?.join(', ') || '',
    preparationTime: item?.preparationTime || 15,
    isVegetarian: item?.isVegetarian || false,
    isVegan: item?.isVegan || false,
    isGlutenFree: item?.isGlutenFree || false,
    spiceLevel: item?.spiceLevel || 0,
    image: item?.image || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: Number(formData.price),
      preparationTime: Number(formData.preparationTime),
      spiceLevel: Number(formData.spiceLevel),
      ingredients: formData.ingredients.split(',').map(ing => ing.trim()).filter(ing => ing),
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {item ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Item Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., Grilled Tilapia"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Describe this menu item..."
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Price (CFA) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="50"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="2500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Preparation Time */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Preparation Time (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={formData.preparationTime}
                onChange={(e) => handleChange('preparationTime', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Spice Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Spice Level
              </label>
              <div className="flex items-center space-x-2">
                {[0, 1, 2, 3, 4].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleChange('spiceLevel', level)}
                    className={`p-2 rounded-lg transition-colors ${
                      formData.spiceLevel >= level 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <i className="ri-chili-line"></i>
                  </button>
                ))}
              </div>
            </div>

            {/* Ingredients */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Ingredients (comma separated)
              </label>
              <input
                type="text"
                value={formData.ingredients}
                onChange={(e) => handleChange('ingredients', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., Rice, Chicken, Vegetables, Spices"
              />
            </div>

            {/* Dietary Options */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Dietary Information
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isVegetarian}
                    onChange={(e) => handleChange('isVegetarian', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Vegetarian</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isVegan}
                    onChange={(e) => handleChange('isVegan', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Vegan</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isGlutenFree}
                    onChange={(e) => handleChange('isGlutenFree', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Gluten Free</span>
                </label>
              </div>
            </div>

            {/* Image URL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Image URL (optional)
              </label>
              <input
                type="url"
                value={formData.image}
                onChange={(e) => handleChange('image', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2"
            >
              <i className="ri-save-line"></i>
              <span>{item ? 'Update Item' : 'Create Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuManagement;