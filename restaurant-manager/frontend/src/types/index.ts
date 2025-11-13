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
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Restaurant {
  _id: string;
  id: string;
  name: string;
  description?: string;
  logo?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  contact?: {
    phone: string;
    email: string;
    website?: string;
  };
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
  };
  operatingHours?: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  rating?: {
    average: number;
    count: number;
    distribution?: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  };
}

// Settings Types
export interface RestaurantSettings {
  name: string;
  description?: string;
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  operatingHours?: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  logo?: string;
  theme?: RestaurantTheme;
  isActive?: boolean;
}

export interface AdminSettings {
  name?: string;
  email: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface RestaurantTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export const defaultThemes: RestaurantTheme[] = [
  {
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    accentColor: '#10B981'
  },
  {
    primaryColor: '#EF4444',
    secondaryColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    accentColor: '#F59E0B'
  },
  {
    primaryColor: '#8B5CF6',
    secondaryColor: '#7C3AED',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    accentColor: '#EC4899'
  }
];

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

// Menu Types - UPDATED WITH NEW FIELDS
export interface Category {
  id: string;
  name: string;
  description?: string;
  restaurant: string;
  sortOrder: number;
  isPredefined?: boolean;
}

// NEW: Nutrition interface
export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// NEW: Rating interface
export interface Rating {
  average: number;
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// NEW: Takeaway interface
export interface Takeaway {
  isTakeawayAvailable: boolean;
  takeawayPrice: number;
  packagingFee: number;
  takeawayOrdersCount: number;
}

// UPDATED: MenuItemFormData with new fields
export interface MenuItemFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  ingredients: string;
  preparationTime: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: number;
  // NEW FIELDS
  isTakeawayAvailable: boolean;
  takeawayPrice: number;
  packagingFee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// UPDATED: MenuItem interface with new fields
export interface MenuItem {
  id: string;
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: Category | string;
  ingredients: string[];
  preparationTime: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: number;
  isAvailable: boolean;
  restaurant: string | Restaurant;
  // NEW FIELDS
  rating?: Rating;
  nutrition?: Nutrition;
  takeaway?: Takeaway;
  likes?: number;
  popularity?: number;
  viewCount?: number;
  orderCount?: number;
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
  // NEW FIELDS
  isTakeawayAvailable?: boolean;
  takeawayPrice?: number;
  packagingFee?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  ingredients?: string[];
  preparationTime?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
  image?: string;
  isAvailable?: boolean;
  // NEW FIELDS
  isTakeawayAvailable?: boolean;
  takeawayPrice?: number;
  packagingFee?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface Table {
  id: string;
  tableNumber: string;
  restaurant: string | Restaurant;
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

// Order related types
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled';

export type PaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'refunded';

export type OrderType = 
  | 'dine-in' 
  | 'takeaway' 
  | 'delivery';

export interface OrderItem {
  _id?: string;
  menuItem: MenuItem;
  quantity: number;
  price: number;
  specialInstructions?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  restaurant: Restaurant;
  table?: { // Add this optional table property
    _id: string;
    tableNumber: string;
  };
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderType: OrderType;
  customerNotes?: string;
  preparationTime?: number;
  servedAt?: string;
  completedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  _id: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  restaurant: string | Restaurant;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderManagementProps {
  selectedOrderId?: string | null;
  autoScroll?: boolean;
}
