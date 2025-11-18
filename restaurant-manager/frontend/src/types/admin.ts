// types/admin.ts
export interface Restaurant {
  _id: string;
  name: string;
  description?: string;
  contact: {
    email: string;
    phone?: string;
    website?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  isActive: boolean;
  userCount: number;
  menuItemCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemAnalytics {
  totalRestaurants: number;
  activeRestaurants: number;
  inactiveRestaurants: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  recentRegistrations: Restaurant[];
}

export interface RestaurantAnalytics {
  overview: {
    totalOrders: number;
    totalRevenue: number;
    activeUsers: number;
    menuItems: number;
    averageOrderValue: number;
  };
  ordersByStatus: Record<string, number>;
  revenueTrend: Array<{
    _id: string;
    revenue: number;
    orders: number;
  }>;
  recentOrders: any[];
  period: {
    start: string;
    end: string;
    label: string;
  };
}

export interface CreateRestaurantData {
  name: string;
  description?: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  adminName: string;
  adminPassword: string;
}

export interface ApiResponse<T> {
  message: string;
  data?: T;
  restaurants?: T[];
  analytics?: T;
  totalPages?: number;
  currentPage?: number;
  total?: number;
}