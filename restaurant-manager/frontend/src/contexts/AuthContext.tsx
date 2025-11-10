// contexts/AuthContext.tsx - FULLY OPTIMIZED VERSION
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/Auth';
import api from '../services/Auth';
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
    const initAuth = async () => {
      console.log('🔐 AuthProvider - Initializing authentication...');
      const token = authService.getToken();
      const savedUser = authService.getCurrentUser();
      
      console.log('🔐 AuthProvider - Token found:', !!token);
      console.log('🔐 AuthProvider - Saved user found:', !!savedUser);
      
      if (token && savedUser) {
        try {
          console.log('🔐 AuthProvider - Verifying token with backend...');
          const userData = await authService.verifyToken();
          
          console.log('✅ AuthProvider - Full userData:', userData);
          console.log('✅ AuthProvider - Restaurant in userData:', userData.restaurant);
          console.log('🔍 Restaurant keys:', userData.restaurant ? Object.keys(userData.restaurant) : 'No restaurant');
          console.log('🖼️ Logo in restaurant:', userData.restaurant?.logo);
          
          setUser(userData);
          
          if (userData.restaurant) {
            setRestaurant(userData.restaurant);
            console.log('✅ AuthProvider - Restaurant state set:', userData.restaurant);
          }
          
        } catch (error) {
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
    };

    initAuth();
  }, []);

  // All functions wrapped with useCallback for stable references
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      console.log('🔐 AuthProvider - Starting login process...');
      const response = await authService.login(credentials);
      setUser(response.user);
      
      if (response.user.restaurant) {
        setRestaurant(response.user.restaurant);
        console.log('✅ AuthProvider - Restaurant data loaded:', response.user.restaurant.name);
      }
      
      console.log('✅ AuthProvider - Login successful, user set:', response.user.name);
    } catch (error) {
      console.error('❌ AuthProvider - Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    console.log('🔐 AuthProvider - Logging out...');
    authService.logout();
    setUser(null);
    setRestaurant(null);
    console.log('✅ AuthProvider - Logout complete');
  }, []);

  const updateRestaurantSettings = useCallback(async (settings: Partial<RestaurantSettings>) => {
    try {
      console.log('🔐 AuthProvider - Updating restaurant settings...');
      setIsLoading(true);
      
      const response = await api.put('/restaurants/current', settings);
      
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
  }, []);

  const updateAdminSettings = useCallback(async (settings: AdminSettings) => {
    try {
      console.log('🔐 AuthProvider - Updating admin settings...');
      setIsLoading(true);
      
      const response = await api.put('/users/current', settings);
      
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
  }, []);

  const updateRestaurantLogo = useCallback(async (file: File) => {
    try {
      console.log('🔐 AuthProvider - Updating restaurant logo...');
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('logo', file);

      const response = await api.put('/restaurants/current/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('✅ AuthProvider - Logo upload response:', response.data);
      
      if (response.data.restaurant) {
        setRestaurant(response.data.restaurant);
        console.log('✅ AuthProvider - Restaurant logo updated in state:', response.data.restaurant.logo);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ AuthProvider - Failed to update restaurant logo:', error);
      throw new Error(error.response?.data?.error || 'Failed to update restaurant logo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRestaurantData = useCallback(async () => {
    try {
      console.log('🔐 AuthProvider - Refreshing restaurant data...');
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
  }, []);

  // THE KEY OPTIMIZATION: Memoized context value
  const contextValue = useMemo((): AuthContextType => {
    return {
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
  }, [
    user,
    restaurant, 
    isLoading,
    login,
    logout,
    updateRestaurantSettings,
    updateAdminSettings,
    updateRestaurantLogo,
    refreshRestaurantData
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};