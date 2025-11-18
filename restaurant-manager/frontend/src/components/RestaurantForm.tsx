// components/RestaurantForm.tsx
import React, { useState, useEffect } from 'react';
import type { Restaurant } from '../types/admin';
import { adminService } from '../services/adminService';

interface RestaurantFormProps {
  restaurant?: Restaurant | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const RestaurantForm: React.FC<RestaurantFormProps> = ({ 
  restaurant, 
  onSubmit, 
  onCancel,
  isEditing = false 
}) => {
  const [formData, setFormData] = useState({
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    email: restaurant?.contact?.email || '',
    phone: restaurant?.contact?.phone || '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [changeCredentials, setChangeCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load existing admin data when editing
  useEffect(() => {
    if (restaurant && isEditing) {
      const loadAdminData = async () => {
        try {
          setLoading(true);
          setError('');
          
          console.log('📧 Loading admin data for restaurant:', restaurant._id);
          
          try {
            const adminData = await adminService.getRestaurantAdmin(restaurant._id);
            console.log('📧 Raw admin data response:', adminData);
            
            // Debug: log the exact structure
            console.log('🔍 Admin data structure:', {
              hasAdmin: !!adminData.admin,
              adminKeys: adminData.admin ? Object.keys(adminData.admin) : 'No admin object',
              adminName: adminData.admin?.name,
              adminEmail: adminData.admin?.email
            });
            
            // Set the actual admin data from the response
            setFormData(prev => ({
              ...prev,
              adminName: adminData.admin?.name || '', // Use actual admin name
              adminEmail: adminData.admin?.email || '', // Use actual admin email
              adminPassword: '' // Don't load existing password
            }));
            
          } catch (apiError: any) {
            console.log('⚠️ Admin endpoint failed:', apiError.message);
            console.log('🔄 Cannot load admin data - user must enter manually');
            setError('Could not load admin information. Please enter admin details manually.');
            // Don't set fallback values - let user enter real admin data
          }
        } catch (error: any) {
          console.error('Failed to load admin data:', error);
          setError('Failed to load admin information. Please enter admin details manually.');
        } finally {
          setLoading(false);
        }
      };
      
      loadAdminData();
    }
  }, [restaurant, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      changeCredentials: isEditing ? changeCredentials : true
    };
    
    console.log('📤 Submitting form data:', submitData);
    onSubmit(submitData);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading admin data...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="ri-alert-line text-yellow-400 text-lg"></i>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Notice</h3>
              <div className="mt-1 text-sm text-yellow-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Restaurant Information */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Restaurant Information</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Restaurant Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Restaurant Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Admin Credentials Section */}
        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Account</h3>
          
          {isEditing && (
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={changeCredentials}
                  onChange={(e) => setChangeCredentials(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Change admin credentials
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Check this box to update admin email and password
              </p>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isEditing && !changeCredentials ? 'opacity-50' : ''}`}>
            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-gray-700">
                Admin Name {!isEditing && '*'}
              </label>
              <input
                type="text"
                id="adminName"
                name="adminName"
                required={!isEditing}
                disabled={isEditing && !changeCredentials}
                value={formData.adminName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter admin's actual name"
              />
              {isEditing && !changeCredentials && formData.adminName && (
                <p className="text-xs text-gray-500 mt-1">
                  Current admin: {formData.adminName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                Admin Email {!isEditing && '*'}
              </label>
              <input
                type="email"
                id="adminEmail"
                name="adminEmail"
                required={!isEditing}
                disabled={isEditing && !changeCredentials}
                value={formData.adminEmail}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="admin@example.com"
              />
              {isEditing && !changeCredentials && formData.adminEmail && (
                <p className="text-xs text-gray-500 mt-1">
                  Current: {formData.adminEmail}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                Admin Password {!isEditing && '*'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="adminPassword"
                  name="adminPassword"
                  required={!isEditing}
                  disabled={isEditing && !changeCredentials}
                  value={formData.adminPassword}
                  onChange={handleChange}
                  placeholder={isEditing ? "Enter new password (leave blank to keep current)" : "Enter admin password"}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isEditing && !changeCredentials}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">
                  {changeCredentials 
                    ? "Enter new password or leave blank to keep current password" 
                    : "Check 'Change admin credentials' to update password"
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {restaurant ? 'Update' : 'Create'} Restaurant
        </button>
      </div>
    </form>
  );
};

export default RestaurantForm;