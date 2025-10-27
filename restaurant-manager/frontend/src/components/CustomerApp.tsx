// src/components/RestaurantList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import logo from "../assets/logo.png";
import { useNavigate } from 'react-router-dom';
interface Restaurant {
  _id: string;
  name: string;
  description: string;
  logo?: string;
  contact: {
    email: string;
    phone: string;
  };
  address: {
    city: string;
    country: string;
  };
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  isPredefined: boolean;
}

const RestaurantList: React.FC = () => {
  const { showError } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLoading, setFilterLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load initial restaurants and categories
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const [restaurantsResponse, categoriesResponse] = await Promise.all([
        fetch('http://localhost:5000/api/restaurants'),
        fetch('http://localhost:5000/api/public/categories')
      ]);

      const restaurantsData = await restaurantsResponse.json();
      const categoriesData = await categoriesResponse.json();

      if (restaurantsResponse.ok) {
        const activeRestaurants = (restaurantsData.restaurants || []).filter((r: Restaurant) => r.isActive);
        setRestaurants(activeRestaurants);
        setFilteredRestaurants(activeRestaurants);
      } else {
        showError(`Failed to load restaurants: ${restaurantsData.error}`);
      }

      if (categoriesResponse.ok) {
        setCategories(categoriesData.categories || []);
      } else {
        console.warn('Could not load categories:', categoriesData.error);
      }
    } catch (error: any) {
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle category filter change
  const handleCategoryChange = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    
    if (categoryName === 'all') {
      // Show all active restaurants with current search term
      const filtered = applySearchFilter(restaurants, searchTerm);
      setFilteredRestaurants(filtered);
      return;
    }

    setFilterLoading(true);
    
    try {
      const response = await fetch(`http://localhost:5000/api/public/restaurants/by-category/${encodeURIComponent(categoryName)}`);
      const data = await response.json();
      
      if (response.ok) {
        // Apply search filter to the category results
        const categoryRestaurants = data.restaurants || [];
        const filtered = applySearchFilter(categoryRestaurants, searchTerm);
        setFilteredRestaurants(filtered);
      } else {
        showError(`Failed to filter by category: ${data.error}`);
        setFilteredRestaurants([]);
      }
    } catch (error: any) {
      showError(`Failed to filter restaurants: ${error.message}`);
      setFilteredRestaurants([]);
    } finally {
      setFilterLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback((term: string) => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      await performSearch(term);
    }, 300); // 300ms delay

    setSearchTimeout(timeout);
  }, [searchTimeout, selectedCategory, restaurants]);

  // Actual search function
  const performSearch = async (term: string) => {
    if (selectedCategory === 'all') {
      // Apply search filter to all restaurants locally (no API call needed)
      const filtered = applySearchFilter(restaurants, term);
      setFilteredRestaurants(filtered);
    } else {
      // We need to re-filter the category results with the new search term
      setFilterLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/public/restaurants/by-category/${encodeURIComponent(selectedCategory)}`);
        const data = await response.json();
        
        if (response.ok) {
          const categoryRestaurants = data.restaurants || [];
          const filtered = applySearchFilter(categoryRestaurants, term);
          setFilteredRestaurants(filtered);
        }
      } catch (error: any) {
        showError(`Failed to filter restaurants: ${error.message}`);
      } finally {
        setFilterLoading(false);
      }
    }
  };

  // Handle search term change - instant UI update with debounced filtering
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    
    // If search is empty, show results immediately
    if (!term.trim()) {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      if (selectedCategory === 'all') {
        setFilteredRestaurants(restaurants);
      } else {
        debouncedSearch(term);
      }
      return;
    }

    // For non-empty search, use debouncing
    debouncedSearch(term);
  };

  // Helper function to apply search filter locally
  const applySearchFilter = (restaurantList: Restaurant[], searchTerm: string) => {
    if (!searchTerm.trim()) return restaurantList;
    
    return restaurantList.filter(restaurant =>
      restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.address.city.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 text-sm font-medium">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Enhanced Header - Full Width */}
      <div className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-3 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between">
            {/* Logo & Name */}
            <div className="flex items-center gap-2 lg:gap-4">
              <img 
                src={logo} 
                alt="Waiter Logo" 
                className="w-8 h-8 rounded sm:w-10 sm:h-10 lg:w-14 lg:h-14 object-contain drop-shadow-lg"
              />
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  Waiter
                </h1>
                <p className="text-[10px] sm:text-xs lg:text-sm text-white/90 -mt-0.5">
                  Your Favorite Restaurants, All in One Place
                </p>
              </div>
            </div>

            {/* Count Badge */}
            <div className="flex items-center gap-1.5 lg:gap-2.5 bg-white/20 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 lg:px-6 lg:py-3 rounded-full border border-white/30 shadow-lg">
              <i className="ri-restaurant-2-line text-lg lg:text-2xl text-white"></i>
              <span className="text-base sm:text-lg lg:text-2xl font-bold text-white">{restaurants.length}</span>
              <span className="text-[10px] sm:text-xs lg:text-sm text-white/90 uppercase tracking-wide">places</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-3 lg:px-8 py-4 lg:py-8">
        {/* Search & Filter Section - Desktop Optimized */}
        <div className="bg-white rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg border border-slate-200 mb-4 lg:mb-8">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-6 items-stretch">
            
            {/* Search Input - Larger on desktop */}
            <div className="flex-1 lg:flex-[2]">
              <div className="relative">
                <i className="ri-search-line absolute left-3 lg:left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg lg:text-xl"></i>
                <input
                  type="text"
                  placeholder="Search restaurants by name, location..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 lg:pl-12 pr-10 lg:pr-12 py-2.5 lg:py-3.5 border-2 border-slate-200 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-sm lg:text-base transition-all placeholder-slate-400 hover:border-slate-300"
                />
                {filterLoading && (
                  <div className="absolute right-3 lg:right-4 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Filter - Fixed width on desktop */}
            <div className="lg:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3.5 border-2 border-slate-200 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-sm lg:text-base bg-white cursor-pointer transition-all hover:border-slate-300"
                disabled={filterLoading}
              >
                <option value="all">🍽️ All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Results Info - Better spacing on desktop */}
          {(searchTerm || selectedCategory !== 'all' || filterLoading) && (
            <div className="mt-3 lg:mt-5 p-2.5 lg:p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg lg:rounded-xl">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm lg:text-base">
                  {searchTerm && (
                    <span className="bg-white px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-md lg:rounded-lg border border-green-200 text-green-700 font-medium shadow-sm">
                      <i className="ri-search-line mr-1"></i>
                      "{searchTerm}"
                    </span>
                  )}
                  {selectedCategory !== 'all' && (
                    <span className="bg-white px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-md lg:rounded-lg border border-green-200 text-green-700 font-medium shadow-sm">
                      <i className="ri-filter-line mr-1"></i>
                      {selectedCategory}
                    </span>
                  )}
                </div>
                {filterLoading ? (
                  <span className="bg-green-600 text-white px-3 lg:px-4 py-1 lg:py-1.5 rounded-md lg:rounded-lg font-semibold text-xs sm:text-sm lg:text-base flex items-center gap-2 shadow-md">
                    <div className="w-3 h-3 lg:w-3.5 lg:h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </span>
                ) : (
                  <span className="bg-green-600 text-white px-3 lg:px-4 py-1 lg:py-1.5 rounded-md lg:rounded-lg font-semibold text-xs sm:text-sm lg:text-base whitespace-nowrap shadow-md">
                    {filteredRestaurants.length} found
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Restaurants Grid - Better desktop layout */}
        {filterLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="inline-block w-12 h-12 lg:w-16 lg:h-16 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 text-sm lg:text-base font-medium">Searching restaurants...</p>
            </div>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="bg-white rounded-xl lg:rounded-2xl p-8 lg:p-16 text-center shadow-lg border border-slate-200">
            <i className="ri-restaurant-line text-5xl lg:text-7xl text-slate-300 mb-4 lg:mb-6"></i>
            <h3 className="text-xl lg:text-3xl font-bold text-slate-900 mb-2 lg:mb-4">
              {searchTerm || selectedCategory !== 'all' ? 'No restaurants found' : 'No restaurants available'}
            </h3>
            <p className="text-slate-600 mb-6 lg:mb-8 text-sm lg:text-lg max-w-md mx-auto">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search criteria or category filter' 
                : 'There are currently no restaurants in the directory'
              }
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  handleCategoryChange('all');
                }}
                className="bg-green-600 text-white px-6 lg:px-8 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-semibold hover:bg-green-700 active:bg-green-800 transition-all duration-200 shadow-lg hover:shadow-xl text-sm lg:text-base"
              >
                <i className="ri-close-circle-line mr-2"></i>
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard 
                key={restaurant._id} 
                restaurant={restaurant} 
                selectedCategory={selectedCategory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Restaurant Card Component - Desktop Optimized
interface RestaurantCardProps {
  restaurant: Restaurant;
  selectedCategory: string;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, selectedCategory }) => {
  const [restaurantCategories, setRestaurantCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const loadRestaurantCategories = async () => {
      setLoadingCategories(true);
      try {
        const response = await fetch(`http://localhost:5000/api/public/restaurants/${restaurant._id}/categories`);
        const data = await response.json();
        if (response.ok) {
          setRestaurantCategories(data.categories || []);
        }
      } catch (error) {
        console.warn('Failed to load restaurant categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadRestaurantCategories();
  }, [restaurant._id]);

  return (
  <div className="bg-white border border-slate-200 rounded-xl lg:rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group hover:-translate-y-2 flex flex-col h-full">
    {/* Restaurant Image/Logo - Fixed height */}
    <div className="h-40 lg:h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative flex-shrink-0">
      {restaurant.logo ? (
        <img
          src={`http://localhost:5000${restaurant.logo}`}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      ) : (
        <div className="w-14 h-14 lg:w-20 lg:h-20 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl">
          <i className="ri-restaurant-line text-3xl lg:text-4xl text-slate-500"></i>
        </div>
      )}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4">
        <span className="px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full text-xs lg:text-sm font-semibold backdrop-blur-sm bg-green-500/90 text-white border border-green-400/50 shadow-lg">
          Open
        </span>
      </div>
    </div>

    {/* Restaurant Info - Flex column that grows to fill space */}
    <div className="p-4 lg:p-5 flex flex-col flex-1">
      {/* Title and description - This section can vary in height */}
      <div className="flex-1">
        <h3 className="text-lg lg:text-xl font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-green-600 transition-colors">
          {restaurant.name}
        </h3>

        <p className="text-slate-600 text-xs lg:text-sm leading-relaxed mb-3 lg:mb-4 line-clamp-2">
          {restaurant.description}
        </p>

        {/* Restaurant Categories */}
        {loadingCategories ? (
          <div className="flex items-center justify-center py-2 mb-3 lg:mb-4">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : restaurantCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 lg:mb-4">
            {restaurantCategories.slice(0, 3).map(category => (
              <span 
                key={category.id}
                className={`text-[10px] lg:text-xs font-semibold px-2 py-1 rounded-full transition-all ${
                  selectedCategory !== 'all' && category.name === selectedCategory
                    ? 'bg-green-100 text-green-700 border border-green-300 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {category.name}
              </span>
            ))}
            {restaurantCategories.length > 3 && (
              <span className="text-[10px] lg:text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                +{restaurantCategories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-1.5 lg:space-y-2">
          {restaurant.contact.phone && (
            <div className="flex items-center gap-2 text-xs lg:text-sm">
              <i className="ri-phone-line text-green-600 text-sm lg:text-base flex-shrink-0"></i>
              <span className="text-slate-700 truncate">{restaurant.contact.phone}</span>
            </div>
          )}
          {restaurant.address.city && (
            <div className="flex items-center gap-2 text-xs lg:text-sm">
              <i className="ri-map-pin-line text-green-600 text-sm lg:text-base flex-shrink-0"></i>
              <span className="text-slate-700 truncate">
                {restaurant.address.city}
                {restaurant.address.country && `, ${restaurant.address.country}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - Always at the bottom */}
      <div className="mt-auto pt-3 lg:pt-4 border-t border-slate-100">
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
  <button 
    onClick={() => navigate(`/waiter/restaurant/${restaurant._id}/menu`)}
    className="border-2 border-slate-300 text-slate-700 py-2 lg:py-2.5 rounded-lg lg:rounded-xl hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all duration-200 text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 lg:gap-2"
  >
    <i className="ri-eye-line text-sm lg:text-base"></i>
    <span className="hidden sm:inline">View</span> Menu
  </button>
  <button className="bg-green-600 text-white py-2 lg:py-2.5 rounded-lg lg:rounded-xl hover:bg-green-700 active:bg-green-800 transition-all duration-200 text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 lg:gap-2 shadow-md hover:shadow-lg">
    <i className="ri-shopping-cart-line text-sm lg:text-base"></i>
    Order
  </button>
</div>
      </div>
    </div>
  </div>
);
};

export default RestaurantList;