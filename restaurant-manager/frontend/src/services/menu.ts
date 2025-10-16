import api from './Auth';
import type { MenuItem, Category } from '../types';

export const menuService = {
  // Get all menu items for a restaurant
  getMenuItems: async (restaurantId: string) => {
    const response = await api.get(`/menu-items?restaurantId=${restaurantId}`);
    return response.data;
  },

  // Get a single menu item
  getMenuItem: async (id: string) => {
    const response = await api.get(`/menu-items/${id}`);
    return response.data;
  },

  // Create a new menu item
  createMenuItem: async (menuItem: Omit<MenuItem, 'id'>) => {
    const response = await api.post('/menu-items', menuItem);
    return response.data;
  },

  // Update a menu item
  updateMenuItem: async (id: string, menuItem: Partial<MenuItem>) => {
    const response = await api.put(`/menu-items/${id}`, menuItem);
    return response.data;
  },

  // Delete a menu item
  deleteMenuItem: async (id: string) => {
    const response = await api.delete(`/menu-items/${id}`);
    return response.data;
  },

  // Get categories
  getCategories: async (restaurantId: string) => {
    const response = await api.get(`/categories?restaurantId=${restaurantId}`);
    return response.data;
  },

  // Create a new category
  createCategory: async (category: Omit<Category, 'id'>) => {
    const response = await api.post('/categories', category);
    return response.data;
  },
};