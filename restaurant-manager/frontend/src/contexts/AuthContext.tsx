// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/Auth';
import api from '../services/Auth'; // Import the default api export
import type { 
  User, 
  LoginCredentials, 
  Restaurant, 
  RestaurantSettings, 
  AdminSettings 
} from '../types';

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  updateRestaurantSettings: (settings: Partial<RestaurantSettings>) => Promise<void>;
  updateAdminSettings: (settings: AdminSettings) => Promise<void>;
  updateRestaurantLogo: (file: File) => Promise<void>;
  refreshRestaurantData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const initAuth = async () => {
      console.log('🔐 AuthProvider - Initializing authentication...');
      const token = authService.getToken();
      const savedUser = authService.getCurrentUser();
      
      console.log('🔐 AuthProvider - Token found:', !!token);
      console.log('🔐 AuthProvider - Saved user found:', !!savedUser);
      
      if (token && savedUser) {
        try {
          console.log('🔐 AuthProvider - Verifying token with backend...');
          // Verify token with backend and get user data with restaurant
          const userData = await authService.verifyToken();
          setUser(userData);
          
          // If user data includes restaurant, set it
          if (userData.restaurant) {
            setRestaurant(userData.restaurant);
            console.log('✅ AuthProvider - Restaurant data loaded:', userData.restaurant.name);
          }
          
          console.log('✅ AuthProvider - Token verified, user authenticated:', userData.name);
        } catch (error) {
          // Token is invalid, clear storage
          console.error('❌ AuthProvider - Token verification failed, clearing storage');
          authService.logout();
          setUser(null);
          setRestaurant(null);
        }
      } else {
        console.log('🔐 AuthProvider - No valid token or user found');
        setUser(null);
        setRestaurant(null);
      }
      
      setIsLoading(false);
      console.log('🔐 AuthProvider - Authentication initialization complete');
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      console.log('🔐 AuthProvider - Starting login process...');
      const response = await authService.login(credentials);
      setUser(response.user);
      
      // Set restaurant data after login
      if (response.user.restaurant) {
        setRestaurant(response.user.restaurant);
        console.log('✅ AuthProvider - Restaurant data loaded:', response.user.restaurant.name);
      }
      
      console.log('✅ AuthProvider - Login successful, user set:', response.user.name);
    } catch (error) {
      console.error('❌ AuthProvider - Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🔐 AuthProvider - Logging out...');
    authService.logout();
    setUser(null);
    setRestaurant(null);
    console.log('✅ AuthProvider - Logout complete');
  };

  const updateRestaurantSettings = async (settings: Partial<RestaurantSettings>) => {
    try {
      console.log('🔐 AuthProvider - Updating restaurant settings...');
      setIsLoading(true);
      
      // Fixed: Added /api prefix
      const response = await api.put('/restaurants/current', settings);
      
      // Update local state
      if (response.data.restaurant) {
        setRestaurant(response.data.restaurant);
        console.log('✅ AuthProvider - Restaurant settings updated');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to update restaurant settings:', error);
      throw new Error(error.response?.data?.error || 'Failed to update restaurant settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAdminSettings = async (settings: AdminSettings) => {
    try {
      console.log('🔐 AuthProvider - Updating admin settings...');
      setIsLoading(true);
      
      // Fixed: Added /api prefix and corrected endpoint
      const response = await api.put('/users/current', settings);
      
      // Update local state
      if (response.data.user) {
        setUser(response.data.user);
        console.log('✅ AuthProvider - Admin settings updated');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to update admin settings:', error);
      throw new Error(error.response?.data?.error || 'Failed to update admin settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRestaurantLogo = async (file: File) => {
    try {
      console.log('🔐 AuthProvider - Updating restaurant logo...');
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('logo', file);

      // Fixed: Added /api prefix
      const response = await api.put('/restaurants/current/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Update local state
      if (response.data.restaurant) {
        setRestaurant(response.data.restaurant);
        console.log('✅ AuthProvider - Restaurant logo updated');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to update restaurant logo:', error);
      throw new Error(error.response?.data?.error || 'Failed to update restaurant logo');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRestaurantData = async () => {
    try {
      console.log('🔐 AuthProvider - Refreshing restaurant data...');
      // Fixed: Added /api prefix
      const response = await api.get('/restaurants/current');
      
      if (response.data.restaurant) {
        setRestaurant(response.data.restaurant);
        console.log('✅ AuthProvider - Restaurant data refreshed');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to refresh restaurant data:', error);
      throw new Error(error.response?.data?.error || 'Failed to refresh restaurant data');
    }
  };

  const refreshUserData = async () => {
    try {
      console.log('🔐 AuthProvider - Refreshing user data...');
      // Fixed: Added /api prefix
      const response = await api.get('/users/current');
      
      if (response.data.user) {
        setUser(response.data.user);
        console.log('✅ AuthProvider - User data refreshed');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to refresh user data:', error);
      throw new Error(error.response?.data?.error || 'Failed to refresh user data');
    }
  };

  const value: AuthContextType = {
    user,
    restaurant,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    updateRestaurantSettings,
    updateAdminSettings,
    updateRestaurantLogo,
    refreshRestaurantData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};