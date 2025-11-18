// components/AnalyticsTab.tsx
import React, { useState, useEffect } from 'react';
import type { RestaurantAnalytics } from '../types/admin';
import { adminService } from '../services/adminService';

const AnalyticsTab: React.FC = () => {
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchAnalytics();
    }
  }, [selectedRestaurant, period]);

  const fetchRestaurants = async () => {
    try {
      const data = await adminService.getRestaurants(1, 100);
      setRestaurants(data.restaurants || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await adminService.getRestaurantAnalytics(selectedRestaurant, period);
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="restaurant-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Restaurant
          </label>
          <select
            id="restaurant-select"
            value={selectedRestaurant}
            onChange={(e) => setSelectedRestaurant(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Choose a restaurant</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant._id} value={restaurant._id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="period-select" className="block text-sm font-medium text-gray-700 mb-2">
            Period
          </label>
          <select
            id="period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
        </div>
      </div>

      {analytics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.overview.totalOrders}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Revenue</div>
              <div className="text-2xl font-bold text-blue-600">
                ${analytics.overview.totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Active Users</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.overview.activeUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Avg Order Value</div>
              <div className="text-2xl font-bold text-gray-900">
                ${analytics.overview.averageOrderValue.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders by Status */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Orders by Status</h3>
              </div>
              <div className="p-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(analytics.ordersByStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{status}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
              </div>
              <div className="p-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.recentOrders.slice(0, 5).map((order: any) => (
                      <tr key={order._id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">${order.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;