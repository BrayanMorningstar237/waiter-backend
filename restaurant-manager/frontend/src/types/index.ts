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
  phone?: string; // Added phone field
  isActive?: boolean; // Added isActive field
  createdAt?: string;
  updatedAt?: string;
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
    country?: string; // Added country field
  };
  contact?: {
    phone: string;
    email: string;
    website?: string; // Added website field
  };
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor?: string; // Added for theme settings
    textColor?: string; // Added for theme settings
    accentColor?: string; // Added for theme settings
  };
  operatingHours?: { // Added operating hours
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  isActive?: boolean; // Added isActive field
  createdAt?: string;
  updatedAt?: string;
}

// Settings Types - ADD THESE NEW INTERFACES
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

// Menu Types
export interface Category {
  id: string;
  name: string;
  description?: string;
  restaurant: string;
  sortOrder: number;
  isPredefined?: boolean;
}

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
}

export interface MenuItem {
  id: string;
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string; // Make sure this exists
  category: Category | string;
  ingredients: string[];
  preparationTime: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: number;
  isAvailable: boolean;
  restaurant: string | Restaurant;
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
  category?: string;
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
// Add to your types.ts file
export interface OrderItem {
  _id?: string;
  menuItem: MenuItem; // This now includes image
  quantity: number;
  price: number;
  specialInstructions?: string;
}
export interface OrderManagementProps {
  selectedOrderId?: string | null;
  autoScroll?: boolean;
}
export interface Order {
  _id: string;
  orderNumber: string;
  restaurant: Restaurant;
  table?: {
    _id: string;
    tableNumber: string;
  };
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  customerNotes?: string;
  preparationTime?: number;
  servedAt?: string;
  completedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
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

// If you want more specific typing for table, you can also add:
export interface Table {
  _id: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  restaurant: string | Restaurant;
  createdAt?: string;
  updatedAt?: string;
}