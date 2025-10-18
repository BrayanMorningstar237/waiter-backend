// services/menu.ts
import api from './api'; // Use the consolidated api instance
import type { Category, CreateMenuItemData, UpdateMenuItemData } from '../types';

// Debug function to verify authentication
const verifyAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('🔐 MenuService - Current token:', token ? `Present (${token.length} chars)` : 'MISSING');
  console.log('🔐 MenuService - Current user:', user ? JSON.parse(user).name : 'None');
  
  if (!token) {
    console.error('❌ MenuService - NO TOKEN FOUND - Authentication will fail');
  }
  
  return token;
};
const deleteCategory = async (categoryId: string): Promise<any> => {
  const response = await api.delete(`/categories/${categoryId}`);
  return response.data;
};
export const menuService = {
  // Get all menu items for the authenticated user's restaurant
  deleteCategory, getMenuItems: async () => {
    try {
      verifyAuth();
      console.log('🔐 MenuService - Fetching menu items for authenticated restaurant...');
      
      const response = await api.get('/menu-items');
      console.log('✅ MenuService - Menu items retrieved:', response.data.menuItems?.length || 0, 'items');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error fetching menu items:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get a single menu item
  getMenuItem: async (id: string) => {
    try {
      verifyAuth();
      console.log('🔐 MenuService - Fetching menu item:', id);
      
      const response = await api.get(`/menu-items/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error fetching menu item:', error.response?.data || error.message);
      throw error;
    }
  },

  // Create a new menu item with file upload
  createMenuItem: async (menuItem: CreateMenuItemData, imageFile?: File) => {
    try {
      verifyAuth();
      const formData = new FormData();
      
      // Append all menu item data
      Object.keys(menuItem).forEach(key => {
        const value = menuItem[key as keyof CreateMenuItemData];
        if (value !== undefined && value !== null) {
          if (key === 'ingredients' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else if (key === 'category' && typeof value === 'object') {
            // Handle category object - extract ID
            formData.append(key, (value as any).id || value);
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
        console.log('📦 MenuService - Image file included:', imageFile.name);
      }

      console.log('📦 MenuService - Creating menu item with data:', Object.fromEntries(formData));
      const response = await api.post('/menu-items', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ MenuService - Menu item created successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error creating menu item:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update a menu item with file upload
  updateMenuItem: async (id: string, menuItem: UpdateMenuItemData, imageFile?: File) => {
    try {
      verifyAuth();
      const formData = new FormData();
      
      // Append all menu item data
      Object.keys(menuItem).forEach(key => {
        const value = menuItem[key as keyof UpdateMenuItemData];
        if (value !== undefined && value !== null) {
          if (key === 'ingredients' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else if (key === 'category' && typeof value === 'object') {
            // Handle category object - extract ID
            formData.append(key, (value as any).id || value);
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
      }

      console.log('📦 MenuService - Updating menu item:', id, 'with data:', Object.fromEntries(formData));
      const response = await api.put(`/menu-items/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ MenuService - Menu item updated successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error updating menu item:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete a menu item
  deleteMenuItem: async (id: string) => {
    try {
      verifyAuth();
      console.log('🗑️ MenuService - Deleting menu item:', id);
      
      const response = await api.delete(`/menu-items/${id}`);
      console.log('✅ MenuService - Menu item deleted successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error deleting menu item:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get categories for the authenticated user's restaurant
  getCategories: async () => {
    try {
      verifyAuth();
      console.log('🔐 MenuService - Fetching categories for authenticated restaurant...');
      
      const response = await api.get('/categories');
      console.log('✅ MenuService - Categories retrieved:', response.data.categories?.length || 0, 'categories');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error fetching categories:', error.response?.data || error.message);
      throw error;
    }
  },

  // Create a new category
  createCategory: async (category: Omit<Category, 'id'>) => {
    try {
      verifyAuth();
      console.log('📦 MenuService - Creating category:', category);
      
      const response = await api.post('/categories', category);
      console.log('✅ MenuService - Category created successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error creating category:', error.response?.data || error.message);
      throw error;
    }
  },
};