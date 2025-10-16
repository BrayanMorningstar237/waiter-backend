import api from './Auth';

export const restaurantService = {
  // Get restaurant data
  getMyRestaurant: async () => {
    const response = await api.get('/my-restaurant');
    return response.data;
  },

  // Get menu items
  getMenuItems: async (restaurantId?: string) => {
    const params = restaurantId ? { restaurantId } : {};
    const response = await api.get('/menu-items', { params });
    return response.data;
  },

  // Get categories
  getCategories: async (restaurantId?: string) => {
    const params = restaurantId ? { restaurantId } : {};
    const response = await api.get('/categories', { params });
    return response.data;
  },

  // Get tables
  getTables: async (restaurantId?: string) => {
    const params = restaurantId ? { restaurantId } : {};
    const response = await api.get('/tables', { params });
    return response.data;
  },
};