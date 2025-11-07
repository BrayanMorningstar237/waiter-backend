// services/api.ts
import axios from 'axios';
import type { TestResponse, DatabaseTestResponse } from '../types';

const API_URL = 'https://waiter-backend-j4c4.onrender.com/api';

// Create axios instance with authentication interceptor
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Add authentication interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔐 API Interceptor - Token found:', token ? 'Yes' : 'No');
    console.log('🔐 API Interceptor - Request to:', config.url);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 API Interceptor - Authorization header set');
    } else {
      console.warn('⚠️ API Interceptor - No token found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ API Interceptor - Request error:', error);
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Interceptor - Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ API Interceptor - Response error:', error.response?.status, error.config?.url);
    
    if (error.response?.status === 401) {
      console.log('🔐 API Interceptor - 401 Unauthorized, clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login page
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export const testApi = {
  testBackend: async (): Promise<TestResponse> => {
    const response = await api.get<TestResponse>('/test');
    return response.data;
  },
  
  testDatabase: async (): Promise<DatabaseTestResponse> => {
    const response = await api.get<DatabaseTestResponse>('/test-db');
    return response.data;
  },
};

export default api;