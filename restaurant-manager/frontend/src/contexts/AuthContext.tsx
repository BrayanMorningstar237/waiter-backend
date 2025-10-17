// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/Auth';
import type { User, LoginCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
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
          // Verify token with backend
          const userData = await authService.verifyToken();
          setUser(userData);
          console.log('✅ AuthProvider - Token verified, user authenticated:', userData.name);
        } catch (error) {
          // Token is invalid, clear storage
          console.error('❌ AuthProvider - Token verification failed, clearing storage');
          authService.logout();
          setUser(null);
        }
      } else {
        console.log('🔐 AuthProvider - No valid token or user found');
        setUser(null);
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
    console.log('✅ AuthProvider - Logout complete');
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};