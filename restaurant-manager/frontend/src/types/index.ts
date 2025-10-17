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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMenuItemData {
  name: string;
  description: string;
  price: number;
  category: string;
  restaurant: string;
  ingredients: string[];
  preparationTime: number;
  isVegetarian: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel: number;
  image?: string;
  isAvailable?: boolean;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  category?: string; // Only string, not Category object
  ingredients?: string[];
  preparationTime?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
  image?: string;
  isAvailable?: boolean;
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

// API Response Types
export interface MenuItemsResponse {
  message: string;
  menuItems: MenuItem[];
}

export interface MenuItemResponse {
  message: string;
  menuItem: MenuItem;
}

export interface CategoriesResponse {
  message: string;
  categories: Category[];
}

export interface CategoryResponse {
  message: string;
  category: Category;
}

export interface TablesResponse {
  message: string;
  tables: Table[];
}

export interface TableResponse {
  message: string;
  table: Table;
}

export interface RestaurantResponse {
  message: string;
  restaurant: Restaurant;
}

export interface RestaurantsResponse {
  message: string;
  restaurants: Restaurant[];
}

// Database Info Types
export interface DatabaseInfo {
  message: string;
  counts: {
    restaurants: number;
    users: number;
    categories: number;
    menuItems: number;
    tables: number;
  };
  restaurants: Array<{
    name: string;
    email: string;
    logo?: string;
  }>;
  users: Array<{
    name: string;
    email: string;
    restaurant?: string;
  }>;
}

// Restaurant Data Types
export interface RestaurantDataResponse {
  message: string;
  restaurant: Restaurant;
  categories: Category[];
  menuItems: MenuItem[];
  tables: Table[];
}

// Route Information
export interface ApiRoute {
  method: string;
  path: string;
  description: string;
}

export interface ApiRoutesResponse {
  message: string;
  routes: ApiRoute[];
}