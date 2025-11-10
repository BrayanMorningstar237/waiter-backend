// services/menu.ts
import api from './api';
import type { Category, CreateMenuItemData, UpdateMenuItemData } from '../types';

// Debug function to verify authentication
const verifyAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('🔐 MenuService - Current token:', token ? `Present (${token.length} chars)` : 'MISSING');
  console.log('🔐 MenuService - Current user:', user ? JSON.parse(user).name : 'None');
  
  if (!token) {
    console.error('❌ MenuService - NO TOKEN FOUND - Authentication will fail');
    throw new Error('Authentication token not found');
  }
  
  return token;
};

export const menuService = {
  // Get all menu items for the authenticated user's restaurant
  getMenuItems: async () => {
    try {
      verifyAuth();
      console.log('🔐 MenuService - Fetching menu items for authenticated restaurant...');
      
      const response = await api.get('/menu-items', {
        timeout: 15000, // Specific timeout for this endpoint
      });
      
      console.log('✅ MenuService - Menu items retrieved:', response.data.menuItems?.length || 0, 'items');
      
      // Process menu items to ensure proper image URLs
      if (response.data.menuItems) {
        response.data.menuItems = response.data.menuItems.map((item: any) => ({
          ...item,
          // Ensure image URLs are properly formatted
          image: item.image?.startsWith('http') ? item.image : undefined
        }));
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error fetching menu items:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
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
      
      // Validate image file if provided
      if (imageFile) {
        if (!imageFile.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }
        if (imageFile.size > 5 * 1024 * 1024) {
          throw new Error('Image size should be less than 5MB');
        }
        console.log('📸 MenuService - Image file validated:', imageFile.name);
      }

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
          } else if (typeof value === 'boolean') {
            formData.append(key, value.toString());
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
        console.log('📦 MenuService - Image file attached for Cloudinary upload');
      }

      console.log('📦 MenuService - Creating menu item with Cloudinary support');
      
      const response = await api.post('/menu-items', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 45000, // Longer timeout for file uploads
      });
      
      console.log('✅ MenuService - Menu item created successfully with Cloudinary');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error creating menu item:', error);
      throw error;
    }
  },

  // Update a menu item with file upload
  updateMenuItem: async (id: string, menuItem: UpdateMenuItemData, imageFile?: File) => {
    try {
      verifyAuth();
      
      // Validate image file if provided
      if (imageFile) {
        if (!imageFile.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }
        if (imageFile.size > 5 * 1024 * 1024) {
          throw new Error('Image size should be less than 5MB');
        }
      }

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
          } else if (typeof value === 'boolean') {
            formData.append(key, value.toString());
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
      }

      console.log('📦 MenuService - Updating menu item with Cloudinary support:', id);
      
      const response = await api.put(`/menu-items/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 45000, // Longer timeout for file uploads
      });
      
      console.log('✅ MenuService - Menu item updated successfully with Cloudinary');
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
      
      const response = await api.get('/categories', {
        timeout: 15000, // Specific timeout for this endpoint
      });
      
      console.log('✅ MenuService - Categories retrieved:', response.data.categories?.length || 0, 'categories');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error fetching categories:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
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

  // Delete a category
  deleteCategory: async (categoryId: string): Promise<any> => {
    try {
      verifyAuth();
      console.log('🗑️ MenuService - Deleting category:', categoryId);
      
      const response = await api.delete(`/categories/${categoryId}`);
      console.log('✅ MenuService - Category deleted successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ MenuService - Error deleting category:', error.response?.data || error.message);
      throw error;
    }
  },
};