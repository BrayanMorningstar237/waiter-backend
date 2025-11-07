import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import logo from "../assets/logo.png";
import { useNavigate, useLocation } from 'react-router-dom';

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

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [restaurantsResponse, categoriesResponse] = await Promise.all([
        fetch('https://waiter-backend-j4c4.onrender.com/api/restaurants'),
        fetch('https://waiter-backend-j4c4.onrender.com/api/public/categories'),
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

  const handleCategoryChange = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (categoryName === 'all') {
      const filtered = applySearchFilter(restaurants, searchTerm);
      setFilteredRestaurants(filtered);
      return;
    }

    setFilterLoading(true);
    try {
      const response = await fetch(
        `https://waiter-backend-j4c4.onrender.com/api/public/restaurants/by-category/${encodeURIComponent(categoryName)}`
      );
      const data = await response.json();

      if (response.ok) {
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

  const debouncedSearch = useCallback(
    (term: string) => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      const timeout = setTimeout(async () => {
        await performSearch(term);
      }, 300);

      setSearchTimeout(timeout);
    },
    [searchTimeout, selectedCategory, restaurants]
  );

  const performSearch = async (term: string) => {
    if (selectedCategory === 'all') {
      const filtered = applySearchFilter(restaurants, term);
      setFilteredRestaurants(filtered);
    } else {
      setFilterLoading(true);
      try {
        const response = await fetch(
          `https://waiter-backend-j4c4.onrender.com/api/public/restaurants/by-category/${encodeURIComponent(selectedCategory)}`
        );
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

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
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
    debouncedSearch(term);
  };

  const applySearchFilter = (restaurantList: Restaurant[], searchTerm: string) => {
    if (!searchTerm.trim()) return restaurantList;
    return restaurantList.filter(
      (restaurant) =>
        restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.address.city.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  useEffect(() => {
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
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
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-3 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-4">
              <img src={logo} alt="Waiter Logo" className="w-8 h-8 rounded sm:w-10 sm:h-10 lg:w-14 lg:h-14 object-contain drop-shadow-lg" />
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">Waiter</h1>
                <p className="text-[10px] sm:text-xs lg:text-sm text-white/90 -mt-0.5">
                  Your Favorite Restaurants, All in One Place
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 shadow-lg">
              <i className="ri-restaurant-2-line text-lg text-white"></i>
              <span className="text-base font-bold text-white">{restaurants.length}</span>
              <span className="text-[10px] text-white/90 uppercase">places</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 lg:px-8 py-4 lg:py-8">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl p-3 lg:p-6 shadow-lg border border-slate-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-sm transition-all"
              />
              {filterLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="lg:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-sm bg-white cursor-pointer transition-all"
              >
                <option value="all">🍽️ All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Restaurants */}
        {filteredRestaurants.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-lg border border-slate-200">
            <i className="ri-restaurant-line text-5xl text-slate-300 mb-4"></i>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No restaurants found</h3>
            <p className="text-slate-600 mb-4">Try adjusting your search criteria or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant._id} restaurant={restaurant} selectedCategory={selectedCategory} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ✅ Restaurant Card
interface RestaurantCardProps {
  restaurant: Restaurant;
  selectedCategory: string;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, selectedCategory }) => {
  const [restaurantCategories, setRestaurantCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadRestaurantCategories = async () => {
      setLoadingCategories(true);
      try {
        const response = await fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurant._id}/categories`);
        const data = await response.json();
        if (response.ok) setRestaurantCategories(data.categories || []);
      } catch (error) {
        console.warn('Failed to load restaurant categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadRestaurantCategories();
  }, [restaurant._id]);

  const queryParams = location.search;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group hover:-translate-y-2 flex flex-col h-full">
      <div className="h-40 bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {restaurant.logo ? (
          <img
            src={`https://waiter-backend-j4c4.onrender.com${restaurant.logo}`}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center shadow-xl">
            <i className="ri-restaurant-line text-3xl text-slate-500"></i>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-md">
            Open
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{restaurant.name}</h3>
        <p className="text-slate-600 text-sm mb-3 line-clamp-2">{restaurant.description}</p>

        {loadingCategories ? (
          <div className="flex items-center justify-center py-2 mb-3">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : restaurantCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {restaurantCategories.slice(0, 3).map((category) => (
              <span
                key={category.id}
                className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                  selectedCategory !== 'all' && category.name === selectedCategory
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(`/waiter/restaurant/${restaurant._id}/menu${queryParams}`)}
              className="border-2 border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <i className="ri-eye-line text-sm"></i> Menu
            </button>

            <button
              onClick={() => navigate(`/waiter/restaurant/${restaurant._id}/menu${queryParams}`)}
              className="bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-all duration-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <i className="ri-shopping-cart-line text-sm"></i> Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantList;
