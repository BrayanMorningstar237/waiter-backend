// services/adminService.ts
import type { Restaurant, SystemAnalytics, RestaurantAnalytics, CreateRestaurantData, ApiResponse } from '../types/admin';

const API_BASE = 'http://localhost:5000/api/admin';

class AdminService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('adminToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse(response: Response) {
    console.log('🔐 AdminService - Response status:', response.status);
    console.log('🔐 AdminService - Response URL:', response.url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔐 AdminService - Error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }
      
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🔐 AdminService - Success response received');
    return data;
  }

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    console.log('🔐 AdminService - Attempting login for:', email);
    
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await this.handleResponse(response);
    
    // Store the token
    if (data.token) {
      localStorage.setItem('adminToken', data.token);
      console.log('🔐 AdminService - Token stored in localStorage');
    } else {
      console.error('❌ AdminService - No token in response!');
      throw new Error('No authentication token received');
    }
    
    return data;
  }

  async getRestaurants(page: number = 1, limit: number = 10, search: string = ''): Promise<ApiResponse<Restaurant>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });

    const response = await fetch(`${API_BASE}/restaurants?${params}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createRestaurant(restaurantData: CreateRestaurantData): Promise<any> {
    const response = await fetch(`${API_BASE}/restaurants`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(restaurantData),
    });

    return this.handleResponse(response);
  }

  async updateRestaurant(id: string, restaurantData: Partial<Restaurant>): Promise<any> {
    const response = await fetch(`${API_BASE}/restaurants/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(restaurantData),
    });

    return this.handleResponse(response);
  }

  async toggleRestaurantStatus(id: string): Promise<any> {
    const response = await fetch(`${API_BASE}/restaurants/${id}/toggle-active`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async resetPassword(id: string, newPassword: string): Promise<any> {
    const response = await fetch(`${API_BASE}/restaurants/${id}/reset-password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ newPassword }),
    });

    return this.handleResponse(response);
  }

  async getSystemAnalytics(): Promise<SystemAnalytics> {
    const response = await fetch(`${API_BASE}/analytics/overview`, {
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse(response);
    return data.analytics;
  }

  async getRestaurantAnalytics(id: string, period: string = '30d'): Promise<{ restaurant: Restaurant; analytics: RestaurantAnalytics }> {
    const response = await fetch(`${API_BASE}/restaurants/${id}/analytics?period=${period}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // New Settings Methods
  async getProfile(): Promise<any> {
    const response = await fetch(`${API_BASE}/profile`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateProfile(profileData: { name?: string; email?: string }): Promise<any> {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(profileData),
    });

    return this.handleResponse(response);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    const response = await fetch(`${API_BASE}/change-password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    return this.handleResponse(response);
  }

  async getStats(): Promise<any> {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    console.log('🔐 AdminService - Logged out, token removed');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('adminToken');
    const isAuth = !!token;
    console.log('🔐 AdminService - Authentication check:', isAuth ? 'Authenticated' : 'Not authenticated');
    return isAuth;
  }

  // Utility method to check token validity
  async validateToken(): Promise<boolean> {
    try {
      await this.getProfile();
      return true;
    } catch (error) {
      console.log('🔐 AdminService - Token validation failed');
      return false;
    }
  }

// Get restaurant admin user
async getRestaurantAdmin(restaurantId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/restaurants/${restaurantId}/admin`, {
    headers: this.getAuthHeaders(),
  });

  return this.handleResponse(response);
}

// Update restaurant admin credentials
async updateRestaurantAdmin(
  restaurantId: string, 
  adminData: { 
    name?: string; 
    email?: string; 
    password?: string 
  }
): Promise<any> {
  const response = await fetch(`${API_BASE}/restaurants/${restaurantId}/admin`, {
    method: 'PUT',
    headers: this.getAuthHeaders(),
    body: JSON.stringify(adminData),
  });

  return this.handleResponse(response);
}
  // Method to clear all admin data
  clearAllData(): void {
    localStorage.removeItem('adminToken');
    console.log('🔐 AdminService - All admin data cleared');
  }
}

export const adminService = new AdminService();