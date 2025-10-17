import api from './api';
import type { Category, CreateMenuItemData, UpdateMenuItemData } from '../types';

export const menuService = {
  // Get all menu items for a restaurant
  getMenuItems: async (restaurantId: string) => {
    try {
      console.log('Fetching menu items for restaurant:', restaurantId);
      const response = await api.get(`/menu-items?restaurant=${restaurantId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  },

  // Get a single menu item
  getMenuItem: async (id: string) => {
    try {
      const response = await api.get(`/menu-items/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching menu item:', error);
      throw error;
    }
  },

  // Create a new menu item with file upload
  createMenuItem: async (menuItem: CreateMenuItemData, imageFile?: File) => {
    try {
      const formData = new FormData();
      
      // Append all menu item data
      Object.keys(menuItem).forEach(key => {
        const value = menuItem[key as keyof CreateMenuItemData];
        if (value !== undefined && value !== null) {
          if (key === 'ingredients' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await api.post('/menu-items', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating menu item:', error);
      throw error;
    }
  },

  // Update a menu item with file upload
  updateMenuItem: async (id: string, menuItem: UpdateMenuItemData, imageFile?: File) => {
    try {
      const formData = new FormData();
      
      // Append all menu item data
      Object.keys(menuItem).forEach(key => {
        const value = menuItem[key as keyof UpdateMenuItemData];
        if (value !== undefined && value !== null) {
          if (key === 'ingredients' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });
      
      // Append image file if provided
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await api.put(`/menu-items/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating menu item:', error);
      throw error;
    }
  },

  // Delete a menu item
  deleteMenuItem: async (id: string) => {
    try {
      const response = await api.delete(`/menu-items/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting menu item:', error);
      throw error;
    }
  },

  // Get categories
  getCategories: async (restaurantId: string) => {
    try {
      const response = await api.get(`/categories?restaurant=${restaurantId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  // Create a new category
  createCategory: async (category: Omit<Category, 'id'>) => {
    try {
      const response = await api.post('/categories', category);
      return response.data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
};