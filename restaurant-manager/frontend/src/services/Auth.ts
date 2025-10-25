// services/Auth.ts
import api from './api'; // Use the consolidated api instance
import type { User, LoginCredentials, AuthResponse } from '../types';


export const authService = {
  // Login user
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      console.log('🔐 AuthService - Logging in with:', credentials.email);
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      
      if (response.data.token) {
        console.log('🔐 AuthService - Token received, storing in localStorage');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('🔐 AuthService - Token stored successfully');
      } else {
        console.warn('⚠️ AuthService - No token in response');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ AuthService - Login error:', error);
      throw error;
    }
  },

  // Logout user
  logout: (): void => {
    console.log('🔐 AuthService - Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('🔐 AuthService - Token and user removed from localStorage');
  },

  // Get current user
  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    console.log('🔐 AuthService - Current user:', user?.name || 'None');
    return user;
  },

  // Get token
  getToken: (): string | null => {
    const token = localStorage.getItem('token');
    console.log('🔐 AuthService - Token:', token ? `Present (${token.length} chars)` : 'None');
    return token;
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('token');
    const isAuth = !!token;
    console.log('🔐 AuthService - Is authenticated:', isAuth);
    return isAuth;
  },

  // Verify token with backend
  // In services/Auth.ts - Update verifyToken method
verifyToken: async (): Promise<User> => {
  try {
    console.log('🔐 AuthService - Verifying token');
    
    // Change this from '/auth/me' to '/users/current'
    const response = await api.get<{ user: User }>('/users/current');
    
    console.log('✅ AuthService - Token verified, user:', response.data.user.name);
    console.log('🔍 AuthService - Restaurant data:', response.data.user.restaurant);
    console.log('🖼️ AuthService - Restaurant logo:', response.data.user.restaurant?.logo);
    
    // Update localStorage with the fresh user data
    localStorage.setItem('user', JSON.stringify(response.data.user));
    console.log('💾 AuthService - Updated user data in localStorage');
    
    return response.data.user;
  } catch (error) {
    console.error('❌ AuthService - Token verification failed:', error);
    throw error;
  }
},
};

export default api;