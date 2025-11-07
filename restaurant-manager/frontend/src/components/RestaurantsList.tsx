// src/components/RestaurantsList.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Restaurant {
  _id: string;
  id?: string;
  name: string;
  description: string;
  logo?: string;
  contact?: {
    phone: string;
    email: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  openingHours?: {
    open: string;
    close: string;
  };
  cuisineType?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  rating?: number;
  reviewCount?: number;
  isActive?: boolean;
  theme?: any;
}

interface RestaurantsListProps {
  onRestaurantSelect?: (restaurant: Restaurant) => void;
}

const RestaurantsList: React.FC<RestaurantsListProps> = ({ onRestaurantSelect }) => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCuisine, setFilterCuisine] = useState('all');
  const [filterPrice, setFilterPrice] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching restaurants from API...');
      
      const response = await fetch('https://waiter-backend-j4c4.onrender.com/api/restaurants', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ API Response:', data);
      
      // Handle different response formats
      let restaurantsArray: any[] = [];
      
      if (data.restaurants && Array.isArray(data.restaurants)) {
        restaurantsArray = data.restaurants;
      } else if (Array.isArray(data)) {
        restaurantsArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        restaurantsArray = data.data;
      } else {
        throw new Error('Invalid response format: could not find restaurants array');
      }
      
      // Transform the data to ensure consistent structure
      const transformedRestaurants = restaurantsArray.map((restaurant: any) => ({
        id: restaurant._id || restaurant.id,
        _id: restaurant._id || restaurant.id,
        name: restaurant.name || 'Unnamed Restaurant',
        description: restaurant.description || 'No description available',
        logo: restaurant.logo,
        contact: restaurant.contact || {
          phone: restaurant.phone || '',
          email: restaurant.email || ''
        },
        address: restaurant.address || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        openingHours: restaurant.openingHours || {
          open: '09:00',
          close: '22:00'
        },
        cuisineType: restaurant.cuisineType || restaurant.category || 'Various',
        priceRange: restaurant.priceRange || '$$',
        rating: restaurant.rating || Math.random() * 2 + 3, // Random rating between 3-5 for demo
        reviewCount: restaurant.reviewCount || Math.floor(Math.random() * 100),
        isActive: restaurant.isActive !== false,
        theme: restaurant.theme
      }));
      
      console.log('📊 Transformed restaurants:', transformedRestaurants);
      setRestaurants(transformedRestaurants);
      
    } catch (error: any) {
      console.error('❌ Failed to load restaurants:', error);
      setError(`Failed to load restaurants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    if (onRestaurantSelect) {
      onRestaurantSelect(restaurant);
    } else {
      // Default behavior: navigate to order page
      navigate(`/waiter/order/${restaurant.id}`);
    }
  };

  // Get unique cuisine types for filter
  const cuisineTypes = [...new Set(restaurants.map(r => r.cuisineType).filter(Boolean))] as string[];

  // Filter and sort restaurants
  const filteredRestaurants = restaurants
    .filter(restaurant => {
      const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          restaurant.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (restaurant.cuisineType && restaurant.cuisineType.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCuisine = filterCuisine === 'all' || restaurant.cuisineType === filterCuisine;
      const matchesPrice = filterPrice === 'all' || restaurant.priceRange === filterPrice;
      
      return matchesSearch && matchesCuisine && matchesPrice && restaurant.isActive !== false;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'reviewCount':
          return (b.reviewCount || 0) - (a.reviewCount || 0);
        case 'priceLow':
          return (a.priceRange?.length || 0) - (b.priceRange?.length || 0);
        case 'priceHigh':
          return (b.priceRange?.length || 0) - (a.priceRange?.length || 0);
        default:
          return 0;
      }
    });

  const getPriceRangeText = (priceRange: string = '$$') => {
    const priceMap: { [key: string]: string } = {
      '$': 'Budget',
      '$$': 'Moderate',
      '$$$': 'Expensive',
      '$$$$': 'Luxury'
    };
    return priceMap[priceRange] || priceRange;
  };

  const renderStars = (rating: number = 4) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <i
            key={star}
            className={`ri-star-${star <= rating ? 'fill' : 'line'} ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            } text-sm`}
          ></i>
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-green-500 animate-spin mb-4"></i>
          <p className="text-gray-600">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to load restaurants</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadRestaurants}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl sm:rounded-3xl overflow-hidden mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 lg:p-12">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              Discover Restaurants
            </h1>
            <p className="text-blue-100 text-lg">
              Explore amazing dining experiences near you
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-white">
            <div className="text-2xl sm:text-3xl font-bold">{restaurants.length}</div>
            <div className="text-sm opacity-90">Total Restaurants</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative group">
              <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 text-lg transition-colors"></i>
              <input
                type="text"
                placeholder="Search restaurants by name, description, or cuisine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 hover:border-gray-300"
              />
            </div>
          </div>

          {/* Cuisine Filter */}
          <div>
            <select
              value={filterCuisine}
              onChange={(e) => setFilterCuisine(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white hover:border-gray-300"
            >
              <option value="all">All Cuisines</option>
              {cuisineTypes.map(cuisine => (
                <option key={cuisine} value={cuisine}>{cuisine}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white hover:border-gray-300"
            >
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
              <option value="reviewCount">Sort by Reviews</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Price Range Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterPrice('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filterPrice === 'all'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Prices
          </button>
          {['$', '$$', '$$$', '$$$$'].map(price => (
            <button
              key={price}
              onClick={() => setFilterPrice(price)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filterPrice === price
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getPriceRangeText(price)}
            </button>
          ))}
        </div>

        {/* Search Results Info */}
        {(searchTerm || filterCuisine !== 'all' || filterPrice !== 'all') && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2 text-blue-800">
                <i className="ri-information-line text-xl"></i>
                <span className="font-bold">Search Results</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {searchTerm && (
                  <span className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 font-medium">
                    Search: "{searchTerm}"
                  </span>
                )}
                {filterCuisine !== 'all' && (
                  <span className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 font-medium">
                    Cuisine: {filterCuisine}
                  </span>
                )}
                {filterPrice !== 'all' && (
                  <span className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 font-medium">
                    Price: {getPriceRangeText(filterPrice)}
                  </span>
                )}
                <span className="bg-blue-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
                  {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restaurants Grid */}
      {filteredRestaurants.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-200/50">
          <i className="ri-restaurant-line text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">No restaurants found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterCuisine !== 'all' || filterPrice !== 'all'
              ? 'Try adjusting your search criteria'
              : 'No restaurants are currently available'
            }
          </p>
          {(searchTerm || filterCuisine !== 'all' || filterPrice !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterCuisine('all');
                setFilterPrice('all');
              }}
              className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRestaurants.map(restaurant => (
            <div
              key={restaurant.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer"
              onClick={() => handleRestaurantClick(restaurant)}
            >
              {/* Restaurant Image/Logo */}
              <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                {restaurant.logo ? (
                  <img
                    src={`https://waiter-backend-j4c4.onrender.com${restaurant.logo}`}
                    alt={restaurant.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ri-restaurant-line text-4xl text-gray-400"></i>
                  </div>
                )}
                
                {/* Price Range Badge */}
                <div className="absolute top-3 right-3">
                  <span className="bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm">
                    {restaurant.priceRange || '$$'}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm ${
                    restaurant.isActive !== false
                      ? 'bg-green-500/90 text-white'
                      : 'bg-gray-500/90 text-white'
                  }`}>
                    {restaurant.isActive !== false ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>

              {/* Restaurant Info */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900 text-lg line-clamp-2 flex-1 pr-2">
                    {restaurant.name}
                  </h3>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                  {restaurant.description}
                </p>

                {/* Cuisine Type */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {restaurant.cuisineType}
                  </span>
                  <div className="text-xs text-gray-500">
                    {restaurant.openingHours?.open} - {restaurant.openingHours?.close}
                  </div>
                </div>

                {/* Rating and Reviews */}
                <div className="flex items-center justify-between mb-4">
                  {renderStars(restaurant.rating)}
                  <span className="text-sm text-gray-600">
                    {restaurant.reviewCount} review{restaurant.reviewCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <i className="ri-map-pin-line text-blue-500"></i>
                    <span className="line-clamp-1">
                      {restaurant.address?.city}, {restaurant.address?.state}
                    </span>
                  </div>
                  {restaurant.contact?.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <i className="ri-phone-line text-green-500"></i>
                      <span>{restaurant.contact.phone}</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-center pt-4 mt-4 border-t border-gray-100">
                  <button className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200 flex items-center justify-center space-x-2 group-hover:scale-105">
                    <i className="ri-arrow-right-line"></i>
                    <span>View Menu & Order</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-200/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{restaurants.length}</div>
            <div className="text-gray-600 text-sm">Total Restaurants</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {restaurants.filter(r => r.isActive !== false).length}
            </div>
            <div className="text-gray-600 text-sm">Currently Open</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{cuisineTypes.length}</div>
            <div className="text-gray-600 text-sm">Cuisine Types</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {restaurants.length > 0 
                ? (restaurants.reduce((acc, r) => acc + (r.rating || 0), 0) / restaurants.length).toFixed(1)
                : '0.0'
              }
            </div>
            <div className="text-gray-600 text-sm">Average Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantsList;