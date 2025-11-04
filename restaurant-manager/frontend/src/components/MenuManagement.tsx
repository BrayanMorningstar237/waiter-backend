import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { menuService } from '../services/menu';
import type { MenuItem, Category, CreateMenuItemData, UpdateMenuItemData, MenuItemFormData } from '../types';
import { useToast } from '../contexts/ToastContext';

const MenuManagement: React.FC = () => {
  const { user, restaurant  } = useAuth();
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

  // Memoize data processing
const processMenuItems = useCallback((rawMenuItems: any[]) => {
  return rawMenuItems.map((item: any) => ({
    ...item,
    id: item.id || item._id, // Handle both id and _id
    category: item.category?._id ? {
      id: item.category._id,
      name: item.category.name
    } : item.category
  }));
}, []);

  const processCategories = useCallback((rawCategories: any[]) => {
  return rawCategories.map((category: any) => ({
    ...category,
    id: category.id || category._id // Handle both id and _id
  }));
}, []);

  // Optimized data loading with parallel requests and minimal processing
  const loadMenuData = useCallback(async () => {
    if (!user) {
      showError('No user found');
      return;
    }
    
    try {
      setLoading(true);
      
      // Parallel API calls for faster loading
      const [menuResponse, categoriesResponse] = await Promise.all([
        menuService.getMenuItems(),
        menuService.getCategories()
      ]);
      
      // Extract data with fallbacks
      const rawMenuItems = menuResponse?.menuItems || menuResponse?.data?.menuItems || menuResponse?.data || [];
      const rawCategories = categoriesResponse?.categories || categoriesResponse?.data?.categories || categoriesResponse?.data || [];
      
      // Process data efficiently
      const processedMenuItems = processMenuItems(rawMenuItems);
      const processedCategories = processCategories(rawCategories);
      
      // Batch state updates
      setMenuItems(processedMenuItems);
      setCategories(processedCategories);
    } catch (error: any) {
      if (error.response?.status === 401) {
        showError('Authentication failed. Please log in again.');
      } else {
        showError(`Failed to load menu data: ${error.response?.data?.error || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [user, showError, processMenuItems, processCategories]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Memoize filtered categories
  const { userCategories, predefinedCategories } = useMemo(() => {
    return {
      userCategories: categories.filter(cat => !cat.isPredefined),
      predefinedCategories: categories.filter(cat => cat.isPredefined)
    };
  }, [categories]);

  // Memoize filtered items for better performance
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = selectedCategory === 'all' || 
        (typeof item.category === 'string' ? item.category : item.category?.id) === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchTerm]);

  // Optimized item addition - no full reload
  const handleAddItem = useCallback(async (data: CreateMenuItemData, imageFile?: File) => {
  console.log('🔍 Debug - Restaurant object:', restaurant);
  
  // Use restaurant._id (MongoDB) or restaurant.id
  const restaurantId = restaurant?._id || restaurant?.id;
  
  if (!restaurantId) {
    showError('No restaurant ID found. Please make sure your restaurant profile is properly set up.');
    console.error('Restaurant ID not found. Restaurant object:', restaurant);
    return;
  }

  try {
    const payload: CreateMenuItemData = {
      ...data,
      restaurant: restaurantId, // Use the correct ID
      isAvailable: true
    };

    console.log('📦 Payload being sent with restaurant ID:', restaurantId);

    const response = await menuService.createMenuItem(payload, imageFile);
    
    // Optimistic update
    const newItem = processMenuItems([response.menuItem || response.data])[0];
    setMenuItems(prev => [...prev, newItem]);
    
    setShowAddModal(false);
    setTempFormData(null);
    showSuccess('Menu item created successfully!');
  } catch (error: any) {
    console.error('❌ Create menu item error:', error);
    showError(`Failed to create menu item: ${error.response?.data?.error || error.message}`);
  }
}, [restaurant, showError, showSuccess, processMenuItems]);

  // Optimized item editing - no full reload
  const handleEditItem = useCallback(async (id: string, data: Partial<MenuItem>, imageFile?: File) => {
    if (!id || id === 'undefined') {
      showError('Cannot edit item: ID is missing or invalid');
      return;
    }

    try {
      const updateData: UpdateMenuItemData = {
        ...data,
        category: typeof data.category === 'string' ? data.category : (data.category as any)?.id
      };

      const response = await menuService.updateMenuItem(id, updateData, imageFile);
      
      // Optimistic update - update item in state without full reload
      const updatedItem = processMenuItems([response.menuItem || response.data])[0];
      setMenuItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      
      setEditingItem(null);
      setTempFormData(null);
      showSuccess('Menu item updated successfully!');
    } catch (error: any) {
      showError(`Failed to update menu item: ${error.response?.data?.error || error.message}`);
    }
  }, [showError, showSuccess, processMenuItems]);

  // Optimized item deletion - no full reload
  const handleDeleteItem = useCallback(async (id: string) => {
    if (!id || id === 'undefined') {
      showError('Cannot delete item: ID is missing or invalid');
      return;
    }

    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await menuService.deleteMenuItem(id);
      
      // Optimistic update - remove item from state without full reload
      setMenuItems(prev => prev.filter(item => item.id !== id));
      
      showSuccess('Menu item deleted successfully!');
    } catch (error: any) {
      showError(`Failed to delete menu item: ${error.response?.data?.error || error.message}`);
    }
  }, [showError, showSuccess]);

  // Optimized availability toggle
  const toggleAvailability = useCallback(async (item: MenuItem) => {
    if (!item.id) return;
    
    // Optimistic UI update
    setMenuItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i
    ));
    
    try {
      await handleEditItem(item.id, { isAvailable: !item.isAvailable });
    } catch (error) {
      // Revert on error
      setMenuItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i
      ));
    }
  }, [handleEditItem]);

  // Optimized category creation - no full reload
const handleCreateCategory = useCallback(async (categoryName: string) => {
  const restaurantId = restaurant?._id || restaurant?.id;
  
  if (!restaurantId) {
    showError('No restaurant ID found for category creation.');
    return;
  }

  try {
    const newCategory = {
      name: categoryName,
      description: categoryName,
      restaurant: restaurantId, // Use the correct ID
      sortOrder: categories.length + 1,
      isPredefined: false
    };

    const response = await menuService.createCategory(newCategory);
    const createdCategory = processCategories([response.category || response.data])[0];
    
    // Optimistic update
    setCategories(prev => [...prev, createdCategory]);
    
    showSuccess('Category created successfully!');
    return createdCategory;
  } catch (error: any) {
    showError(`Failed to create category: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}, [restaurant, categories.length, showError, showSuccess, processCategories]);
 // Optimized category deletion - no full reload
  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Menu items in this category will become uncategorized.')) {
      return;
    }

    try {
      setDeletingCategoryId(categoryId);
      await menuService.deleteCategory(categoryId);
      
      // Optimistic update - remove category from state without full reload
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
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
  }, [showError, showSuccess]);

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
    <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-2 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-green-500 to-green-600 lg:rounded-2xl rounded-b-2xl sm:rounded-3xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 lg:p-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
              Menu Management
            </h1>
            <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
              Manage your menu items & categories
            </p>
          </div>

          <div className="flex justify-end w-full lg:w-auto gap-2 sm:gap-3">
            <button
              onClick={() => setShowCategoryManagement(true)}
              className="group relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-white/30 hover:scale-110 active:scale-95 transition-all duration-300"
              title="Manage Categories"
            >
              <i className="ri-folder-open-line text-xl sm:text-2xl lg:text-3xl"></i>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="group relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-white text-blue-600 flex items-center justify-center shadow-lg hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300"
              title="Add Menu Item"
            >
              <i className="ri-add-line text-2xl sm:text-3xl lg:text-4xl font-bold"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-100">
        <div className="flex gap-4 items-stretch">
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
        <div className="grid p-4 lg:p-0 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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

const MenuItemCard: React.FC<MenuItemCardProps> = React.memo(({ item, onEdit, onDelete, onToggleAvailability }) => {
  const [showMore, setShowMore] = React.useState(false);
  const categoryName = typeof item.category === 'string' ? 'Uncategorized' : item.category?.name || 'Uncategorized';

  return (
    <div className={`bg-white rounded-lg shadow-sm border transition-all duration-300 hover:shadow-md overflow-hidden ${
      item.isAvailable 
        ? 'border-green-100 hover:border-green-200' 
        : 'border-gray-300 opacity-60'
    } group flex flex-col h-full`}>
      
      {/* Image Section */}
      <div className="relative overflow-hidden aspect-[4/3]">
        {item.image ? (
          <img
            src={`http://localhost:5000${item.image}`}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
            <i className="ri-restaurant-line text-4xl text-green-200"></i>
          </div>
        )}
        
        {/* Availability Toggle - Responsive */}
        <button
          onClick={() => onToggleAvailability(item)}
          className={` z-20 absolute top-3 right-3 shadow-md backdrop-blur-sm transition-all duration-200 font-medium ${
            item.isAvailable 
              ? 'bg-green-600 z-20 text-white hover:bg-green-700' 
              : 'bg-gray-600 z-20 text-white hover:bg-gray-700'
          } px-3 py-1.5 z-20 rounded-full text-sm sm:inline-flex items-center gap-1.5 hidden`}
          title={item.isAvailable ? 'Click to mark as unavailable' : 'Click to mark as available'}
        >
          <i className={`ri-${item.isAvailable ? 'eye' : 'eye-off'}-line`}></i>
          <span>{item.isAvailable ? 'Available' : 'Unavailable'}</span>
        </button>

        {/* Icon Only Toggle for Small Screens */}
        <button
          onClick={() => onToggleAvailability(item)}
          className={`z-20 absolute top-3 right-3 shadow-md backdrop-blur-sm transition-all duration-200 ${
            item.isAvailable 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-600 text-white hover:bg-gray-700'
          } p-2 rounded-full sm:hidden`}
          title={item.isAvailable ? 'Click to mark as unavailable' : 'Click to mark as available'}
        >
          <i className={`ri-${item.isAvailable ? 'eye' : 'eye-off'}-line text-base`}></i>
        </button>

        {/* Unavailable Overlay */}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"></div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-1">
        
        {/* Title and Price */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-semibold text-gray-900 text-base leading-snug flex-1">
            {item.name}
          </h3>
          <span className="text-lg font-bold text-green-600 whitespace-nowrap">
            {item.price.toLocaleString()} <span className="text-sm text-green-500">CFA</span>
          </span>
        </div>

        {/* Category */}
        <span className="text-xs text-gray-500 mb-3">{categoryName}</span>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">
          {item.description}
        </p>

        {/* Essential Info - Always Visible */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mb-3 flex-wrap">
          {/* Rating */}
          {item.rating?.average && item.rating.average > 0 ? (
            <div className="flex items-center gap-1">
              <i className="ri-star-fill text-yellow-500"></i>
              <span className="font-medium text-gray-700">{item.rating.average.toFixed(1)}</span>
              <span className="text-gray-400">({item.rating.count || 0})</span>
            </div>
          ) : (
            <span className="text-gray-400">No ratings</span>
          )}

          {/* Spice Level */}
          {item.spiceLevel && item.spiceLevel > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: item.spiceLevel }).map((_, i) => (
                  <i key={i} className="ri-fire-fill text-red-500 text-xs"></i>
                ))}
              </div>
            </>
          )}

          {/* Dietary Icons (Compact) */}
          {(item.isVegetarian || item.isVegan || item.isGlutenFree) && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1">
                {item.isVegan && (
                  <i className="ri-leaf-fill text-green-600" title="Vegan"></i>
                )}
                {item.isVegetarian && !item.isVegan && (
                  <i className="ri-plant-fill text-green-500" title="Vegetarian"></i>
                )}
                {item.isGlutenFree && (
                  <i className="ri-shield-check-fill text-blue-500" title="Gluten Free"></i>
                )}
              </div>
            </>
          )}
        </div>

        {/* More Details - Collapsible */}
        {showMore && (
          <div className="mb-3 pb-3 border-b border-gray-100 space-y-2 text-xs text-gray-600">
            {item.nutrition?.calories && item.nutrition.calories > 0 && (
              <div className="flex items-center gap-2">
                <i className="ri-fire-line text-orange-500"></i>
                <span>{item.nutrition.calories} Kcalories</span>
              </div>
            )}
            {item.takeaway?.isTakeawayAvailable && (
              <div className="flex items-center gap-2">
                <i className="ri-shopping-bag-line text-green-600"></i>
                <span>Takeaway available</span>
              </div>
            )}
          </div>
        )}

        {/* Show More/Less Toggle */}
        {(item.nutrition?.calories || item.takeaway?.isTakeawayAvailable) && (
          <button
            onClick={() => setShowMore(!showMore)}
            className="text-xs text-green-600 hover:text-green-700 font-medium mb-3 flex items-center gap-1 transition-colors"
          >
            <span>{showMore ? 'Hide details' : 'View details'}</span>
            <i className={`ri-arrow-${showMore ? 'up' : 'down'}-s-line`}></i>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-3 border-t border-gray-100 mt-auto">
          <button
            onClick={() => onEdit(item)}
            className="text-gray-600 hover:text-green-600 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
          >
            <i className="ri-edit-line"></i>
            Edit
          </button>
          <button
            onClick={() => item.id && onDelete(item.id)}
            className="text-gray-600 hover:text-red-600 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
          >
            <i className="ri-delete-bin-line"></i>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

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
  const { restaurant } = useAuth();
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
    isTakeawayAvailable: item?.takeaway?.isTakeawayAvailable ?? true,
    takeawayPrice: item?.takeaway?.takeawayPrice || item?.price || 0,
    packagingFee: item?.takeaway?.packagingFee || 0,
    calories: item?.nutrition?.calories || 0,
    protein: item?.nutrition?.protein || 0,
    carbs: item?.nutrition?.carbs || 0,
    fat: item?.nutrition?.fat || 0,
    fiber: item?.nutrition?.fiber || 0,
    sugar: item?.nutrition?.sugar || 0,
    sodium: item?.nutrition?.sodium || 0
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item?.image || '');
  const [uploading, setUploading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

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
      takeawayPrice: formData.takeawayPrice || formData.price
    };

    if (item) {
      const updateData: UpdateMenuItemData = {
        ...submitData,
        category: formData.category
      };
      onSave(updateData, imageFile || undefined);
    } else {
      // Use restaurant._id or restaurant.id
      const restaurantId = restaurant?._id || restaurant?.id;
      onSave({
        ...submitData,
        restaurant: restaurantId || ''
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
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
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

            {/* Takeaway Options */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Takeaway Options
              </label>
              <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isTakeawayAvailable}
                    onChange={(e) => handleChange('isTakeawayAvailable', e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500 w-4 h-4"
                    disabled={uploading}
                  />
                  <i className="ri-takeaway-line text-orange-500 text-lg"></i>
                  <span className="text-sm text-gray-700 font-medium">Available for Takeaway</span>
                </label>

                {formData.isTakeawayAvailable && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Takeaway Price (CFA)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={formData.takeawayPrice}
                        onChange={(e) => handleChange('takeawayPrice', Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-orange-500/20 focus:border-orange-500 text-sm sm:text-base transition-all duration-200"
                        placeholder="Same as dine-in price"
                        disabled={uploading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to use regular price
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Packaging Fee (CFA)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={formData.packagingFee}
                        onChange={(e) => handleChange('packagingFee', Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-orange-500/20 focus:border-orange-500 text-sm sm:text-base transition-all duration-200"
                        placeholder="0"
                        disabled={uploading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Additional fee for takeaway packaging
                      </p>
                    </div>
                  </div>
                )}

                {formData.isTakeawayAvailable && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-orange-800">Total Takeaway Price:</span>
                      <span className="text-lg font-bold text-orange-600">
                        {(formData.takeawayPrice + formData.packagingFee).toLocaleString()} CFA
                      </span>
                    </div>
                    <div className="text-xs text-orange-600 mt-1">
                      (Price: {formData.takeawayPrice.toLocaleString()} CFA + Packaging: {formData.packagingFee.toLocaleString()} CFA)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nutrition Information */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Nutrition Information (Optional)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    KCalories
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.calories}
                    onChange={(e) => handleChange('calories', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.protein}
                    onChange={(e) => handleChange('protein', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.carbs}
                    onChange={(e) => handleChange('carbs', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.fat}
                    onChange={(e) => handleChange('fat', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>
              </div>
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