import axios from 'axios';
import type { TestResponse, DatabaseTestResponse } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
});

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