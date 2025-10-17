import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category, CreateMenuItemData, UpdateMenuItemData  } from '../types';

const MenuManagement: React.FC = () => {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    if (!user) {
      console.error('No user found');
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔐 Loading menu data for authenticated user:', user.name);
      console.log('🏪 User restaurant:', user.restaurant);
      
      // Remove restaurantId parameters - server gets it from auth token
      const [menuResponse, categoriesResponse] = await Promise.all([
        menuService.getMenuItems(), // No parameters needed
        menuService.getCategories() // No parameters needed
      ]);
      
      console.log('📋 Full menu response:', menuResponse);
      console.log('📁 Full categories response:', categoriesResponse);
      
      // Handle response structures
      const rawMenuItems = menuResponse?.menuItems || menuResponse?.data?.menuItems || menuResponse?.data || [];
      const rawCategories = categoriesResponse?.categories || categoriesResponse?.data?.categories || categoriesResponse?.data || [];
      
      // Map MongoDB _id to id for frontend compatibility
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
      
      console.log('✅ Mapped menu items:', menuItems.length);
      console.log('✅ Mapped categories:', categories.length);
      
      setMenuItems(menuItems);
      setCategories(categories);
    } catch (error: any) {
      console.error('❌ Failed to load menu data:', error);
      console.error('📡 Error response:', error.response?.data);
      
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        alert('Authentication failed. Please log in again.');
        // You might want to redirect to login here or refresh token
      } else {
        alert(`Failed to load menu data: ${error.response?.data?.error || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter categories to separate predefined vs user-created
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
      alert('No restaurant ID found');
      return;
    }

    try {
      console.log('Creating menu item with data:', data, 'Image file:', imageFile);
      
      const payload: CreateMenuItemData = {
        ...data,
        restaurant: user.restaurant.id,
        isAvailable: true
      };

      await menuService.createMenuItem(payload, imageFile);
      await loadMenuData();
      setShowAddModal(false);
      alert('Menu item created successfully!');
    } catch (error: any) {
      console.error('Failed to create menu item:', error);
      alert(`Failed to create menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditItem = async (id: string, data: Partial<MenuItem>, imageFile?: File) => {
    console.log('Editing item with ID:', id, 'Data:', data, 'Image file:', imageFile);
    
    if (!id || id === 'undefined') {
      console.error('Cannot edit item: ID is invalid', id);
      alert('Cannot edit item: ID is missing or invalid');
      return;
    }

    try {
      // Convert the data to UpdateMenuItemData format
      const updateData: UpdateMenuItemData = {
        ...data,
        // Ensure category is a string, not a Category object
        category: typeof data.category === 'string' ? data.category : (data.category as any)?.id
      };

      const response = await menuService.updateMenuItem(id, updateData, imageFile);
      console.log('Update response:', response.data);
      await loadMenuData();
      setEditingItem(null);
      alert('Menu item updated successfully!');
    } catch (error: any) {
      console.error('Failed to update menu item:', error);
      alert(`Failed to update menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    console.log('Deleting item with ID:', id);
    
    if (!id || id === 'undefined') {
      console.error('Cannot delete item: ID is invalid', id);
      alert('Cannot delete item: ID is missing or invalid');
      return;
    }

    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      const response = await menuService.deleteMenuItem(id);
      console.log('Delete response:', response.data);
      await loadMenuData();
      alert('Menu item deleted successfully!');
    } catch (error: any) {
      console.error('Failed to delete menu item:', error);
      alert(`Failed to delete menu item: ${error.response?.data?.error || error.message}`);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    if (!item.id) {
      console.error('Cannot toggle availability: Item ID is undefined', item);
      return;
    }
    await handleEditItem(item.id, { isAvailable: !item.isAvailable });
  };

  // Function to create a new category
  const handleCreateCategory = async (categoryName: string) => {
    if (!user?.restaurant?.id) {
      alert('No restaurant ID found');
      return;
    }

    try {
      console.log('Creating new category:', categoryName);
      
      const newCategory = {
        name: categoryName,
        description: categoryName, // Use name as description or provide empty string
        restaurant: user.restaurant.id,
        sortOrder: categories.length + 1,
        isPredefined: false // Set to false for user-created categories
      };

      const response = await menuService.createCategory(newCategory);
      console.log('Category created:', response);
      
      // Reload categories to include the new one
      await loadMenuData();
      
      return response.category || response.data;
    } catch (error: any) {
      console.error('Failed to create category:', error);
      alert(`Failed to create category: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  };

  // Add category deletion handler
  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Menu items in this category will become uncategorized.')) {
      return;
    }

    try {
      setDeletingCategoryId(categoryId);
      console.log('🗑️ Deleting category:', categoryId);
      
      await menuService.deleteCategory(categoryId);
      await loadMenuData(); // Reload to reflect changes
      
      alert('Category deleted successfully!');
    } catch (error: any) {
      console.error('❌ Failed to delete category:', error);
      const errorMessage = error.response?.data?.error || error.message;
      
      if (error.response?.status === 403) {
        alert('Cannot delete predefined categories. You can only delete categories you created.');
      } else {
        alert(`Failed to delete category: ${errorMessage}`);
      }
    } finally {
      setDeletingCategoryId(null);
    }
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
          <p className="text-sm text-gray-500">Restaurant ID: {user?.restaurant?.id}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Add Category Management Button */}
          <button
            onClick={() => setShowCategoryManagement(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center space-x-2 shadow-lg shadow-blue-500/25"
          >
            <i className="ri-folder-open-line"></i>
            <span>Manage Categories</span>
          </button>
          
          {/* Existing Add Menu Item Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2 shadow-lg shadow-green-500/25"
          >
            <i className="ri-add-line"></i>
            <span>Add Menu Item</span>
          </button>
        </div>
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

      {/* Debug Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-yellow-800">
          <i className="ri-information-line"></i>
          <span className="font-semibold">Debug Info:</span>
        </div>
        <div className="text-sm text-yellow-700 mt-1">
          <p>Menu Items: {menuItems.length}</p>
          <p>Categories: {categories.length} (Predefined: {predefinedCategories.length}, Custom: {userCategories.length})</p>
          <p>Filtered Items: {filteredItems.length}</p>
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
          onCreateCategory={handleCreateCategory}
          onSave={editingItem ? 
            (data, imageFile) => {
              console.log('Saving edit for item:', editingItem);
              console.log('Item ID:', editingItem.id);
              handleEditItem(editingItem.id!, data, imageFile);
            } : 
            (data, imageFile) => handleAddItem(data, imageFile)
          }
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Manage Categories</h2>
                <button
                  onClick={() => setShowCategoryManagement(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Predefined Categories Section */}
              {predefinedCategories.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <i className="ri-lock-line text-blue-500 mr-2"></i>
                    Predefined Categories
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    System categories cannot be deleted but can be used for your menu items.
                  </p>
                  <div className="grid gap-2">
                    {predefinedCategories.map(category => (
                      <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium text-gray-900">{category.name}</span>
                          {category.description && (
                            <p className="text-sm text-gray-600">{category.description}</p>
                          )}
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          System
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Categories Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <i className="ri-folder-user-line text-green-500 mr-2"></i>
                  Your Categories
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Categories you created can be edited or deleted.
                </p>
                
                {userCategories.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <i className="ri-folder-line text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-600">No custom categories yet</p>
                    <p className="text-sm text-gray-500 mt-1">Create categories when adding menu items</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {userCategories.map(category => (
                      <div key={category.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex-1">
                          <span className="font-medium text-gray-900 block">{category.name}</span>
                          {category.description && (
                            <p className="text-sm text-gray-600">{category.description}</p>
                          )}
                          
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Custom
                          </span>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={deletingCategoryId === category.id}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Category Usage Stats */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <i className="ri-information-line mr-2"></i>
                  Category Usage
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Predefined Categories: {predefinedCategories.length} (read-only)</p>
                  <p>• Your Categories: {userCategories.length} (editable)</p>
                  <p>• Total Categories: {categories.length}</p>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCategoryManagement(false)}
                  className="bg-gray-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
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

  console.log('Rendering menu item card:', item.id, item.name);

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
                  i < (item.spiceLevel || 0) ? 'text-red-500' : 'text-gray-300'
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
            onClick={() => {
              console.log('Edit button clicked for item:', item);
              console.log('Item ID:', item.id);
              onEdit(item);
            }}
            className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center space-x-1"
          >
            <i className="ri-edit-line"></i>
            <span>Edit</span>
          </button>
          <button
            onClick={() => {
              console.log('Delete button clicked for item:', item);
              console.log('Item ID:', item.id);
              if (item.id) {
                onDelete(item.id);
              } else {
                alert('Cannot delete: Item ID is missing');
              }
            }}
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
  onCreateCategory: (categoryName: string) => Promise<any>;
  onSave: (data: any, imageFile?: File) => void;
  onClose: () => void;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({ 
  item, 
  categories, 
  onCreateCategory, 
  onSave, 
  onClose 
}) => {
  const { user } = useAuth();
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
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item?.image || '');
  const [uploading, setUploading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      setImageFile(file);
      
      // Create preview
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
    if (!newCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      setCreatingCategory(true);
      console.log('Creating new category:', newCategoryName);
      
      const newCategory = await onCreateCategory(newCategoryName.trim());
      
      // Set the newly created category as selected
      if (newCategory && newCategory.id) {
        setFormData(prev => ({ ...prev, category: newCategory.id }));
        setNewCategoryName('');
        setShowAddCategory(false);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      // Error is already handled in the parent function
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploading) return;
    
    try {
      setUploading(true);
      console.log('Form submitted with data:', formData);
      
      const submitData = {
        ...formData,
        price: Number(formData.price),
        preparationTime: Number(formData.preparationTime),
        spiceLevel: Number(formData.spiceLevel),
        ingredients: formData.ingredients.split(',').map(ing => ing.trim()).filter(ing => ing),
      };

      // For editing, ensure we only pass the category ID as string
      if (item) {
        const updateData: UpdateMenuItemData = {
          ...submitData,
          category: formData.category // This is already a string from the form
        };
        onSave(updateData, imageFile || undefined);
      } else {
        // For creating, include restaurant ID
        onSave({
          ...submitData,
          restaurant: user?.restaurant?.id || ''
        }, imageFile || undefined);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setUploading(false);
    }
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
              {item ? `Edit Menu Item (ID: ${item.id})` : 'Add New Menu Item'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Item Image
              </label>
              <div className="flex items-center space-x-6">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        disabled={uploading}
                      >
                        <i className="ri-close-line text-sm"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <i className="ri-image-line text-2xl text-gray-400"></i>
                    </div>
                  )}
                </div>
                
                {/* Upload Controls */}
                <div className="flex-1">
                  <div className="space-y-2">
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
                      className={`block w-full bg-green-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-center cursor-pointer ${
                        uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
                      }`}
                    >
                      <i className="ri-upload-line mr-2"></i>
                      Choose Image
                    </label>
                    <p className="text-xs text-gray-500">
                      Recommended: Square image, max 5MB. JPG, PNG, or WebP.
                    </p>
                    {imageFile && (
                      <p className="text-sm text-green-600">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                <div className="space-y-2">
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    disabled={uploading}
                  >
                    <i className="ri-add-line"></i>
                    <span>Add New Category</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter new category name"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={creatingCategory}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="bg-blue-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={creatingCategory || !newCategoryName.trim()}
                    >
                      {creatingCategory ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-check-line"></i>
                      )}
                      <span>{creatingCategory ? 'Adding...' : 'Add'}</span>
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    }}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm font-medium"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={uploading}
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
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={uploading}
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
                disabled={uploading}
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
                    disabled={uploading}
                  />
                  <span className="text-sm text-gray-700">Vegetarian</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isVegan}
                    onChange={(e) => handleChange('isVegan', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                    disabled={uploading}
                  />
                  <span className="text-sm text-gray-700">Vegan</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isGlutenFree}
                    onChange={(e) => handleChange('isGlutenFree', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                    disabled={uploading}
                  />
                  <span className="text-sm text-gray-700">Gluten Free</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
              disabled={uploading || creatingCategory}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default MenuManagement;