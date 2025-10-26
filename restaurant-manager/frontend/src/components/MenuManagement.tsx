import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category, CreateMenuItemData, UpdateMenuItemData ,MenuItemFormData} from '../types';
import { useToast } from '../contexts/ToastContext';

const MenuManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [tempFormData, setTempFormData] = useState<any>(null);

  useEffect(() => {
    loadMenuData();
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
      if (error.response?.status === 401) {
        showError('Authentication failed. Please log in again.');
      } else {
        showError(`Failed to load menu data: ${error.response?.data?.error || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const userCategories = categories.filter(cat => !cat.isPredefined);
  const predefinedCategories = categories.filter(cat => cat.isPredefined);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || 
      (typeof item.category === 'string' ? item.category : item.category?.id) === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddItem = async (data: CreateMenuItemData, imageFile?: File) => {
    if (!user?.restaurant?.id) {
      showError('No restaurant ID found');
      return;
    }

    try {
      const payload: CreateMenuItemData = {
        ...data,
        restaurant: user.restaurant.id,
        isAvailable: true
      };

      await menuService.createMenuItem(payload, imageFile);
      await loadMenuData();
      setShowAddModal(false);
      setTempFormData(null);
      showSuccess('Menu item created successfully!');
    } catch (error: any) {
      showError(`Failed to create menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditItem = async (id: string, data: Partial<MenuItem>, imageFile?: File) => {
    if (!id || id === 'undefined') {
      showError('Cannot edit item: ID is missing or invalid');
      return;
    }

    try {
      const updateData: UpdateMenuItemData = {
        ...data,
        category: typeof data.category === 'string' ? data.category : (data.category as any)?.id
      };

      await menuService.updateMenuItem(id, updateData, imageFile);
      await loadMenuData();
      setEditingItem(null);
      setTempFormData(null);
      showSuccess('Menu item updated successfully!');
    } catch (error: any) {
      showError(`Failed to update menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!id || id === 'undefined') {
      showError('Cannot delete item: ID is missing or invalid');
      return;
    }

    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await menuService.deleteMenuItem(id);
      await loadMenuData();
      showSuccess('Menu item deleted successfully!');
    } catch (error: any) {
      showError(`Failed to delete menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    if (!item.id) return;
    await handleEditItem(item.id, { isAvailable: !item.isAvailable });
  };

  const handleCreateCategory = async (categoryName: string) => {
    if (!user?.restaurant?.id) {
      showError('No restaurant ID found');
      return;
    }

    try {
      const newCategory = {
        name: categoryName,
        description: categoryName,
        restaurant: user.restaurant.id,
        sortOrder: categories.length + 1,
        isPredefined: false
      };

      const response = await menuService.createCategory(newCategory);
      await loadMenuData();
      showSuccess('Category created successfully!');
      return response.category || response.data;
    } catch (error: any) {
      showError(`Failed to create category: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Menu items in this category will become uncategorized.')) {
      return;
    }

    try {
      setDeletingCategoryId(categoryId);
      await menuService.deleteCategory(categoryId);
      await loadMenuData();
      showSuccess('Category deleted successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      if (error.response?.status === 403) {
        showError('Cannot delete predefined categories. You can only delete categories you created.');
      } else {
        showError(`Failed to delete category: ${errorMessage}`);
      }
    } finally {
      setDeletingCategoryId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-green-500 animate-spin mb-4"></i>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-2  space-y-6">

  {/* Header */}
  <div className="bg-gradient-to-r from-green-600 via-green-500 to-green-600 lg:rounded-2xl rounded-b-2xl sm:rounded-3xl overflow-hidden">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 lg:p-8">
      
      {/* Title Section */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
          Menu Management
        </h1>
        <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
          Manage your menu items & categories
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end w-full lg:w-auto gap-2 sm:gap-3">
        <button
          onClick={() => setShowCategoryManagement(true)}
          className="group relative w-12 h-12 sm:w-
          14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-white/30 hover:scale-110 active:scale-95 transition-all duration-300"
          title="Manage Categories"
        >
          <i className="ri-folder-open-line text-xl sm:text-2xl lg:text-3xl"></i>
          <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs bg-gray-900 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Categories
          </span>
        </button>

        <button
          onClick={() => setShowAddModal(true)}
          className="group relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-white text-blue-600 flex items-center justify-center shadow-lg hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300"
          title="Add Menu Item"
        >
          <i className="ri-add-line text-2xl sm:text-3xl lg:text-4xl font-bold"></i>
          <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs bg-gray-900 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Add Item
          </span>
        </button>
      </div>
    </div>
  </div>

  {/* Search & Filter Section */}
 <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-100">
  <div className="flex gap-4 items-stretch">
    {/* Search Input */}
    <div className="flex-1 w-full">
      <div className="relative group">
        <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 text-lg sm:text-xl transition-colors"></i>
        <input
          type="text"
          placeholder="Search menu items by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 sm:pl-14 pr-4 py-3 sm:py-4 lg:py-5 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base lg:text-lg transition-all duration-300 hover:border-gray-300"
        />
      </div>
    </div>

    {/* Category Filter */}
    <div className="w-1/3">
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-4 py-3 sm:py-4 lg:py-5 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base lg:text-lg transition-all duration-300 bg-white hover:border-gray-300 cursor-pointer"
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

  {/* Search Results Info */}
  {(searchTerm || selectedCategory !== 'all') && (
    <div className="mt-4 sm:mt-6 p-4 sm:p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl sm:rounded-2xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2 text-blue-800">
          <i className="ri-information-line text-xl sm:text-2xl"></i>
          <span className="font-bold text-sm sm:text-base lg:text-lg">Search Results</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {searchTerm && (
            <span className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 font-medium">
              Search: "{searchTerm}"
            </span>
          )}
          {selectedCategory !== 'all' && (
            <span className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 font-medium">
              Category: {categories.find(c => c.id === selectedCategory)?.name}
            </span>
          )}
          <span className="bg-blue-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>
    </div>
  )}
</div>

   {/* Stats Cards */}
<div className="flex overflow-x-auto gap-3 p-2">
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/50 text-center flex-grow flex-shrink-0">
    <div className="text-xl font-bold text-green-600 mb-1">{menuItems.length}</div>
    <div className="text-gray-600 text-sm">Total Items</div>
  </div>

  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/50 text-center flex-grow flex-shrink-0">
    <div className="text-xl font-bold text-blue-600 mb-1">{categories.length}</div>
    <div className="text-gray-600 text-sm">Categories</div>
  </div>

  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/50 text-center flex-grow flex-shrink-0">
    <div className="text-xl font-bold text-purple-600 mb-1">{userCategories.length}</div>
    <div className="text-gray-600 text-sm">Custom Categories</div>
  </div>

  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/50 text-center flex-grow flex-shrink-0">
    <div className="text-xl font-bold text-orange-600 mb-1">{predefinedCategories.length}</div>
    <div className="text-gray-600 text-sm">System Categories</div>
  </div>
</div>



      {/* Menu Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-200/50">
          <i className="ri-restaurant-line text-4xl sm:text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">No menu items found</h3>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search criteria' 
              : 'Get started by adding your first menu item'
            }
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-xl"
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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
          onCreateCategory={handleCreateCategory}
          onSave={editingItem ? 
            (data, imageFile) => handleEditItem(editingItem.id!, data, imageFile) : 
            handleAddItem
          }
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
            setTempFormData(null);
          }}
          tempFormData={tempFormData}
          onTempFormDataChange={setTempFormData}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryManagement && (
        <CategoryManagementModal
          predefinedCategories={predefinedCategories}
          userCategories={userCategories}
          onDeleteCategory={handleDeleteCategory}
          deletingCategoryId={deletingCategoryId}
          onClose={() => setShowCategoryManagement(false)}
          onCreateCategory={handleCreateCategory}
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
  const categoryName = typeof item.category === 'string' ? 'Uncategorized' : item.category?.name || 'Uncategorized';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-lg ${
      item.isAvailable 
        ? 'border-transparent hover:border-green-200' 
        : 'border-gray-200 opacity-70'
    } group`}>
      {/* Image */}
      <div className="relative overflow-hidden rounded-t-2xl">
        {item.image ? (
          <img
            src={`http://localhost:5000${item.image}`}
            alt={item.name}
            className="w-full h-48 sm:h-56 object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-48 sm:h-56 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <i className="ri-restaurant-line text-4xl text-gray-400"></i>
          </div>
        )}
        
        {/* Availability Toggle */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => onToggleAvailability(item)}
            className={`p-2 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200 ${
              item.isAvailable 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <i className={`ri-${item.isAvailable ? 'eye' : 'eye-off'}-line text-sm`}></i>
          </button>
        </div>

        {/* Overlay on unavailable items */}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
            <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base sm:text-lg line-clamp-2 flex-1 pr-2">{item.name}</h3>
          <span className="text-lg font-bold text-green-600 whitespace-nowrap">
            {item.price.toLocaleString()} CFA
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{item.description}</p>

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
            {categoryName}
          </span>
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <i
                key={i}
                className={`ri-chili-line text-sm ${
                  i < (item.spiceLevel || 0) ? 'text-red-500' : 'text-gray-300'
                }`}
              ></i>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {item.isVegetarian && (
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">
              Vegetarian
            </span>
          )}
          {item.isVegan && (
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
              Vegan
            </span>
          )}
          {item.isGlutenFree && (
            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              Gluten Free
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(item)}
            className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center space-x-1.5 transition-colors duration-200"
          >
            <i className="ri-edit-line"></i>
            <span>Edit</span>
          </button>
          <button
            onClick={() => item.id && onDelete(item.id)}
            className="text-red-600 hover:text-red-700 font-semibold text-sm flex items-center space-x-1.5 transition-colors duration-200"
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
  onCreateCategory: (categoryName: string) => Promise<any>;
  onSave: (data: any, imageFile?: File) => void;
  onClose: () => void;
  tempFormData?: any;
  onTempFormDataChange?: (data: any) => void;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({ 
  item, 
  categories, 
  onCreateCategory, 
  onSave, 
  onClose,
  tempFormData,
  onTempFormDataChange
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<MenuItemFormData>(tempFormData || {
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
});
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item?.image || '');
  const [uploading, setUploading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Save form data to temp storage when it changes
  useEffect(() => {
    if (onTempFormDataChange) {
      onTempFormDataChange(formData);
    }
  }, [formData, onTempFormDataChange]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handleAddNewCategory = async () => {
  if (!newCategoryName.trim()) return;
  try {
    setCreatingCategory(true);
    const newCategory = await onCreateCategory(newCategoryName.trim());
    if (newCategory && newCategory.id) {
      setFormData((prev: MenuItemFormData) => ({ ...prev, category: newCategory.id }));
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  } catch (error) {
    // Error handling is done in the parent component
  } finally {
    setCreatingCategory(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (uploading) return;
  try {
    setUploading(true);
    const submitData = {
      ...formData,
      price: Number(formData.price),
      preparationTime: Number(formData.preparationTime),
      spiceLevel: Number(formData.spiceLevel),
      ingredients: formData.ingredients.split(',').map((ing: string) => ing.trim()).filter((ing: string) => ing),
    };

    if (item) {
      const updateData: UpdateMenuItemData = {
        ...submitData,
        category: formData.category
      };
      onSave(updateData, imageFile || undefined);
    } else {
      onSave({
        ...submitData,
        restaurant: user?.restaurant?.id || ''
      }, imageFile || undefined);
    }
  } catch (error) {
    // Error handling is done in the parent component
  } finally {
    setUploading(false);
  }
};

  const handleChange = (field: keyof MenuItemFormData, value: any) => {
  setFormData((prev: MenuItemFormData) => ({ ...prev, [field]: value }));
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {item ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={uploading || creatingCategory}
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Image Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Item Image
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border-2 border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                        disabled={uploading}
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <i className="ri-image-line text-2xl text-gray-400"></i>
                    </div>
                  )}
                </div>
                
                {/* Upload Controls */}
                <div className="flex-1 min-w-0">
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                      disabled={uploading}
                    />
                    <label
                      htmlFor="image-upload"
                      className={`block w-full bg-green-500 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-200 text-center cursor-pointer shadow-lg shadow-green-500/25 hover:shadow-xl ${
                        uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600 active:scale-95'
                      }`}
                    >
                      <i className="ri-upload-line mr-2"></i>
                      Choose Image
                    </label>
                    <p className="text-xs text-gray-500">
                      Recommended: Square image, max 5MB. JPG, PNG, or WebP.
                    </p>
                    {imageFile && (
                      <p className="text-sm text-green-600 font-medium">
                        <i className="ri-check-line mr-1"></i>
                        {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200"
                placeholder="e.g., Grilled Tilapia"
                disabled={uploading}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200 resize-none"
                placeholder="Describe this menu item..."
                disabled={uploading}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200"
                placeholder="2500"
                disabled={uploading}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Category *
              </label>
              
              {!showAddCategory ? (
                <div className="space-y-3">
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200 bg-white"
                    disabled={uploading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200 w-full justify-center py-2 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50"
                    disabled={uploading}
                  >
                    <i className="ri-add-line"></i>
                    <span>Add New Category</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter new category name"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base transition-all duration-200"
                      disabled={creatingCategory}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="bg-blue-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 min-w-20"
                      disabled={creatingCategory || !newCategoryName.trim()}
                    >
                      {creatingCategory ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-check-line"></i>
                      )}
                      <span className="hidden sm:inline">{creatingCategory ? 'Adding...' : 'Add'}</span>
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    }}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm font-medium transition-colors duration-200 w-full justify-center py-2"
                    disabled={creatingCategory}
                  >
                    <i className="ri-arrow-left-line"></i>
                    <span>Back to categories</span>
                  </button>
                </div>
              )}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200"
                disabled={uploading}
              />
            </div>

            {/* Spice Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Spice Level
              </label>
              <div className="flex items-center justify-between">
                {[0, 1, 2, 3, 4].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleChange('spiceLevel', level)}
                    className={`p-3 rounded-xl transition-all duration-200 ${
                      formData.spiceLevel >= level 
                        ? 'bg-red-100 text-red-600 shadow-inner' 
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={uploading}
                  >
                    <i className="ri-chili-line text-lg"></i>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200"
                placeholder="e.g., Rice, Chicken, Vegetables, Spices"
                disabled={uploading}
              />
            </div>

            {/* Dietary Options */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Dietary Information
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVegetarian}
                    onChange={(e) => handleChange('isVegetarian', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500 w-4 h-4"
                    disabled={uploading}
                  />
                  <i className="ri-leaf-line text-green-500 text-lg"></i>
                  <span className="text-sm text-gray-700 font-medium">Vegetarian</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVegan}
                    onChange={(e) => handleChange('isVegan', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500 w-4 h-4"
                    disabled={uploading}
                  />
                  <i className="ri-plant-line text-emerald-500 text-lg"></i>
                  <span className="text-sm text-gray-700 font-medium">Vegan</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isGlutenFree}
                    onChange={(e) => handleChange('isGlutenFree', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500 w-4 h-4"
                    disabled={uploading}
                  />
                  <i className="ri-wheat-line text-blue-500 text-lg"></i>
                  <span className="text-sm text-gray-700 font-medium">Gluten Free</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end space-y-3 sm:space-y-0 space-x-0 sm:space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-all duration-200 border border-gray-300 hover:border-gray-400 active:scale-95"
              disabled={uploading || creatingCategory}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-green-500/25 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              disabled={uploading || creatingCategory}
            >
              {uploading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>{item ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  <span>{item ? 'Update Item' : 'Create Item'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Category Management Modal Component
interface CategoryManagementModalProps {
  predefinedCategories: Category[];
  userCategories: Category[];
  onDeleteCategory: (categoryId: string) => void;
  deletingCategoryId: string | null;
  onClose: () => void;
  onCreateCategory: (categoryName: string) => Promise<any>;
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  predefinedCategories,
  userCategories,
  onDeleteCategory,
  deletingCategoryId,
  onClose,
  onCreateCategory
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      setCreatingCategory(true);
      await onCreateCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Categories</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Add New Category Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-1 flex items-center">
                  <i className="ri-add-circle-line text-green-600 mr-2"></i>
                  Add New Category
                </h3>
                <p className="text-green-700 text-sm">
                  Create custom categories for your menu items
                </p>
              </div>
              
              {!showAddCategory ? (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-green-500/25 hover:shadow-xl active:scale-95 whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  <span>Add Category</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    className="flex-1 px-4 py-3 border border-green-300 rounded-xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 text-sm sm:text-base transition-all duration-200"
                    disabled={creatingCategory}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCategory}
                      className="bg-green-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 min-w-20"
                      disabled={creatingCategory || !newCategoryName.trim()}
                    >
                      {creatingCategory ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-check-line"></i>
                      )}
                      <span className="hidden sm:inline">{creatingCategory ? 'Adding...' : 'Add'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryName('');
                      }}
                      className="bg-gray-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all duration-200 flex items-center space-x-2"
                    >
                      <i className="ri-close-line"></i>
                      <span className="hidden sm:inline">Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Predefined Categories Section */}
          {predefinedCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="ri-lock-line text-blue-500 mr-2"></i>
                Predefined Categories
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                System categories cannot be deleted but can be used for your menu items.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {predefinedCategories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 block">{category.name}</span>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full font-medium">
                      <i className="ri-lock-line mr-1"></i>
                      System
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Categories Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <i className="ri-folder-user-line text-green-500 mr-2"></i>
              Your Categories
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Categories you created can be edited or deleted.
            </p>
            
            {userCategories.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <i className="ri-folder-line text-4xl text-gray-400 mb-3"></i>
                <p className="text-gray-600 font-medium">No custom categories yet</p>
                <p className="text-gray-500 text-sm mt-1">Create your first category above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userCategories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 block">{category.name}</span>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-full font-medium">
                        <i className="ri-user-line mr-1"></i>
                        Custom
                      </span>
                      <button
                        onClick={() => onDeleteCategory(category.id)}
                        disabled={deletingCategoryId === category.id}
                        className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete category"
                      >
                        {deletingCategoryId === category.id ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className="ri-delete-bin-line"></i>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category Stats */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-6">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
              <i className="ri-bar-chart-line mr-2"></i>
              Category Statistics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{predefinedCategories.length + userCategories.length}</div>
                <div className="text-blue-800">Total Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{userCategories.length}</div>
                <div className="text-green-800">Your Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{predefinedCategories.length}</div>
                <div className="text-blue-800">System Categories</div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all duration-200 shadow-lg shadow-gray-500/25 hover:shadow-xl active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuManagement;