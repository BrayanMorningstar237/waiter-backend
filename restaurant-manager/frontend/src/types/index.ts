export interface TestResponse {
  message: string;
}

export interface DatabaseTestResponse {
  message: string;
  collections: string[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// Authentication Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  restaurant: Restaurant;
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contact?: {
    phone: string;
    email: string;
  };
  theme?: {
    primaryColor: string;
    secondaryColor: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

// Menu Types
export interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  restaurant: string;
  isPredefined: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string | Category;
  restaurant: string | Restaurant;
  ingredients: string[];
  preparationTime: number;
  isVegetarian: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel: number;
  isAvailable: boolean;
}

export interface Table {
  id: string;
  tableNumber: string;
  restaurant: string;
  capacity: number;
  location: string;
  qrCode?: string;
  isAvailable: boolean;
}
export interface TestResponse {
  message: string;
}

export interface DatabaseTestResponse {
  message: string;
  collections: string[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// Authentication Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  restaurant: Restaurant;
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contact?: {
    phone: string;
    email: string;
  };
  theme?: {
    primaryColor: string;
    secondaryColor: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}