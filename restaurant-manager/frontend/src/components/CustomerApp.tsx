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

// Slideshow slides data
const slides = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop",
    title: "Delicious Food Awaits",
    subtitle: "Discover amazing restaurants near you",
    badge: "Special Offer",
    color: "from-orange-500 to-red-500"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=400&fit=crop",
    title: "Fast & Fresh Delivery",
    subtitle: "Get your favorite meals delivered hot",
    badge: "Quick Service",
    color: "from-green-500 to-emerald-500"
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=400&fit=crop",
    title: "100% For You",
    subtitle: "Find the best restaurants in one place",
    badge: "Premium Quality",
    color: "from-purple-500 to-pink-500"
  }
];

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [restaurantsResponse, categoriesResponse] = await Promise.all([
        fetch('http://localhost:5000/api/restaurants'),
        fetch('http://localhost:5000/api/public/categories'),
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
    setShowFilterModal(false);
    
    if (categoryName === 'all') {
      const filtered = applySearchFilter(restaurants, searchTerm);
      setFilteredRestaurants(filtered);
      return;
    }

    setFilterLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/public/restaurants/by-category/${encodeURIComponent(categoryName)}`
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
          `http://localhost:5000/api/public/restaurants/by-category/${encodeURIComponent(selectedCategory)}`
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        {/* Header Skeleton */}
        <div className="bg-white sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 lg:px-6 lg:py-5">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-2xl bg-slate-200 animate-pulse"></div>
                <div>
                  <div className="w-20 h-5 lg:w-24 lg:h-6 bg-slate-200 rounded animate-pulse mb-1"></div>
                  <div className="w-16 h-3 lg:w-20 lg:h-3 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="w-16 h-8 lg:w-20 lg:h-10 bg-slate-200 rounded-full animate-pulse"></div>
            </div>
            <div className="w-full h-12 lg:h-14 bg-slate-200 rounded-full animate-pulse"></div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
          {/* Banner Skeleton */}
          <div className="mb-5 lg:mb-6 h-48 sm:h-56 md:h-64 lg:h-72 xl:h-80 bg-slate-200 rounded-2xl lg:rounded-3xl animate-pulse"></div>

          {/* Categories Skeleton */}
          <div className="mb-5 lg:mb-6">
            <div className="w-24 h-5 lg:h-6 bg-slate-200 rounded animate-pulse mb-3 lg:mb-4"></div>
            <div className="flex gap-2 lg:gap-3 overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-20 h-10 lg:w-28 lg:h-12 bg-slate-200 rounded-full animate-pulse flex-shrink-0"></div>
              ))}
            </div>
          </div>

          {/* Results Header Skeleton */}
          <div className="w-32 h-5 lg:h-6 bg-slate-200 rounded animate-pulse mb-3 lg:mb-4"></div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl lg:rounded-3xl shadow-sm overflow-hidden">
                <div className="h-40 sm:h-44 lg:h-48 bg-slate-200 animate-pulse"></div>
                <div className="p-3 lg:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-32 h-5 bg-slate-200 rounded animate-pulse"></div>
                    <div className="w-12 h-6 bg-slate-200 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="w-full h-4 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="w-3/4 h-4 bg-slate-200 rounded animate-pulse mb-3"></div>
                  <div className="w-40 h-3 bg-slate-200 rounded animate-pulse mb-3"></div>
                  <div className="flex gap-2 mb-4">
                    <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse"></div>
                    <div className="w-20 h-6 bg-slate-200 rounded-full animate-pulse"></div>
                  </div>
                  <div className="w-full h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 lg:px-6 lg:py-5">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center gap-2 lg:gap-3">
              <img 
                src={logo} 
                alt="Waiter" 
                className="w-9 h-9 lg:w-12 lg:h-12 rounded-2xl object-contain shadow-sm" 
              />
              <div>
                <h1 className="text-lg lg:text-2xl font-bold text-slate-900">
                  Waiter
                </h1>
                <span className="text-[10px] lg:text-xs text-slate-600 font-medium">Wait no More</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-3">
              <span className="px-2.5 py-1.5 lg:px-3 lg:py-2 text-xs lg:text-sm text-white font-bold rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                {filteredRestaurants.length} {filteredRestaurants.length === 1 ? 'place' : 'places'}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <i className="ri-search-line absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base lg:text-lg"></i>
            <input
              type="text"
              placeholder="Search restaurants, cuisine, location..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 lg:pl-12 pr-10 lg:pr-12 py-3 lg:py-3.5 bg-slate-100 rounded-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all"
            />
            {filterLoading ? (
              <div className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
              </div>
            ) : searchTerm ? (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <i className="ri-close-circle-fill text-lg lg:text-xl"></i>
              </button>
            ) : (
              <button 
                onClick={() => setShowFilterModal(true)}
                className="absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 w-7 h-7 lg:w-8 lg:h-8 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors"
              >
                <i className="ri-equalizer-line text-sm lg:text-base text-slate-600"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        {/* Slideshow Banner */}
        {selectedCategory === 'all' && !searchTerm && (
          <div className="mb-5 lg:mb-6 relative rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl">
            {/* Slides */}
            <div className="relative h-48 sm:h-56 md:h-64 lg:h-72 xl:h-80">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    index === currentSlide
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-105'
                  }`}
                >
                  {/* Background Image */}
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Gradient Overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${slide.color} opacity-80`}></div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-48 h-48 lg:w-80 lg:h-80 bg-white/10 rounded-full -mr-24 lg:-mr-40 -mt-24 lg:-mt-40"></div>
                  <div className="absolute bottom-0 left-0 w-40 h-40 lg:w-64 lg:h-64 bg-white/10 rounded-full -ml-20 lg:-ml-32 -mb-20 lg:-mb-32"></div>
                  
                  {/* Content */}
                  <div className="absolute inset-0 flex items-center justify-center lg:justify-start">
                    <div className="w-full px-5 sm:px-6 lg:px-10 xl:px-12 text-center lg:text-left">
                      <div className={`transform transition-all duration-700 delay-100 ${
                        index === currentSlide
                          ? 'translate-y-0 opacity-100'
                          : 'translate-y-4 opacity-0'
                      }`}>
                        {/* Badge */}
                        <div className="inline-block px-3 py-1 lg:px-4 lg:py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-xs lg:text-sm font-bold text-white mb-2 lg:mb-3 border border-white/30">
                          {slide.badge}
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white mb-1.5 lg:mb-2 drop-shadow-lg leading-tight">
                          {slide.title}
                        </h3>
                        
                        {/* Subtitle */}
                        <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-white/95 mb-4 lg:mb-6 max-w-md lg:max-w-xl font-medium drop-shadow-md mx-auto lg:mx-0">
                          {slide.subtitle}
                        </p>
                        
                        {/* CTA Button */}
                        <button className="inline-flex items-center gap-2 px-5 py-2.5 lg:px-7 lg:py-3.5 bg-white text-slate-900 rounded-full text-sm lg:text-base font-bold hover:bg-slate-50 transition-all shadow-2xl hover:scale-105 transform">
                          <span>Order Now</span>
                          <i className="ri-arrow-right-line text-base lg:text-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide Indicators */}
            <div className="absolute bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 lg:gap-2.5 z-10">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentSlide
                      ? 'w-8 lg:w-10 h-2 lg:h-2.5 bg-white'
                      : 'w-2 lg:w-2.5 h-2 lg:h-2.5 bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                ></button>
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              className="hidden lg:flex absolute left-4 xl:left-6 top-1/2 -translate-y-1/2 w-10 h-10 xl:w-12 xl:h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full items-center justify-center text-white transition-all border border-white/30 hover:scale-110 z-10"
              aria-label="Previous slide"
            >
              <i className="ri-arrow-left-line text-xl xl:text-2xl"></i>
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              className="hidden lg:flex absolute right-4 xl:right-6 top-1/2 -translate-y-1/2 w-10 h-10 xl:w-12 xl:h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full items-center justify-center text-white transition-all border border-white/30 hover:scale-110 z-10"
              aria-label="Next slide"
            >
              <i className="ri-arrow-right-line text-xl xl:text-2xl"></i>
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="mb-5 lg:mb-6">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-base lg:text-lg font-bold text-slate-900">Categories</h2>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => handleCategoryChange('all')}
                className="text-xs lg:text-sm font-semibold text-green-600 hover:text-green-700"
              >
                See All
              </button>
            )}
          </div>
          
          <div className="flex gap-2 lg:gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`flex-shrink-0 px-4 py-2 lg:px-6 lg:py-3 rounded-full font-semibold text-xs lg:text-sm transition-all ${
                selectedCategory === 'all'
                  ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.name)}
                className={`flex-shrink-0 px-4 py-2 lg:px-6 lg:py-3 rounded-full font-semibold text-xs lg:text-sm transition-all ${
                  selectedCategory === category.name
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h2 className="text-base lg:text-lg font-bold text-slate-900">
            {selectedCategory !== 'all' ? selectedCategory : 'All Restaurants'}
          </h2>
        </div>

        {/* Restaurants Grid */}
        {filteredRestaurants.length === 0 ? (
          <div className="bg-white rounded-2xl lg:rounded-3xl p-8 lg:p-12 text-center shadow-sm">
            <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto mb-3 lg:mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <i className="ri-restaurant-line text-3xl lg:text-4xl text-slate-400"></i>
            </div>
            <h3 className="text-lg lg:text-xl font-bold text-slate-900 mb-2">No restaurants found</h3>
            <p className="text-sm lg:text-base text-slate-600 mb-4 lg:mb-6">Try adjusting your filters or search terms</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setFilteredRestaurants(restaurants);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-green-600 text-white rounded-full text-sm lg:text-base font-semibold hover:bg-green-700 transition-all"
            >
              <i className="ri-refresh-line"></i>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 auto-rows-fr">
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

      {/* Filter Modal */}
      {showFilterModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-4"
          onClick={() => setShowFilterModal(false)}
        >
          <div 
            className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-lg font-bold text-slate-900">Filter by Category</h3>
              <button 
                onClick={() => setShowFilterModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <i className="ri-close-line text-xl text-slate-600"></i>
              </button>
            </div>
            
            <div className="p-5">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm mb-2 transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>All Categories</span>
                  {selectedCategory === 'all' && <i className="ri-check-line text-lg"></i>}
                </div>
              </button>
              
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.name)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm mb-2 transition-all ${
                    selectedCategory === category.name
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{category.name}</span>
                    {selectedCategory === category.name && <i className="ri-check-line text-lg"></i>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Restaurant Card Component
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
        const response = await fetch(`http://localhost:5000/api/public/restaurants/${restaurant._id}/categories`);
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
    <div className="bg-white rounded-2xl lg:rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
      {/* Image */}
      <div 
        className="relative h-40 sm:h-44 lg:h-48 bg-gradient-to-br from-slate-100 to-slate-200 cursor-pointer overflow-hidden flex-shrink-0"
        onClick={() => navigate(`/waiter/restaurant/${restaurant._id}/menu${queryParams}`)}
      >
        {restaurant.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <i className="ri-restaurant-line text-2xl lg:text-3xl text-slate-400"></i>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 lg:top-3 left-2 lg:left-3">
          <div className="flex items-center gap-1 lg:gap-1.5 px-2 py-1 lg:px-3 lg:py-1.5 bg-green-500 rounded-full shadow-lg">
            <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-[10px] lg:text-xs font-bold text-white">Open</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 lg:p-4 flex flex-col flex-grow">
        <div className="flex items-start justify-between mb-1.5 lg:mb-2">
          <h3 className="text-base lg:text-lg font-bold text-slate-900 line-clamp-1 flex-1 pr-2">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-0.5 lg:gap-1 bg-green-50 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-lg flex-shrink-0">
            <i className="ri-star-fill text-green-600 text-xs lg:text-sm"></i>
            <span className="text-xs lg:text-sm font-bold text-green-700">4.8</span>
          </div>
        </div>

        <p className="text-slate-600 text-xs lg:text-sm mb-2 lg:mb-3 line-clamp-2">
          {restaurant.description}
        </p>

        {/* Location */}
        <div className="flex items-center gap-1 lg:gap-1.5 text-slate-500 text-[10px] lg:text-xs mb-2 lg:mb-3">
          <i className="ri-map-pin-line text-xs lg:text-sm"></i>
          <span className="line-clamp-1">{restaurant.address.city}, {restaurant.address.country}</span>
        </div>

        {/* Categories */}
        {loadingCategories ? (
          <div className="flex items-center justify-center py-2 mb-2 lg:mb-3">
            <div className="w-3 h-3 lg:w-4 lg:h-4 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : restaurantCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-auto">
            {restaurantCategories.slice(0, 3).map((category) => (
              <span
                key={category.id}
                className={`text-[10px] lg:text-xs font-semibold px-2 py-0.5 lg:px-3 lg:py-1 rounded-full transition-all ${
                  selectedCategory !== 'all' && category.name === selectedCategory
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {category.name}
              </span>
            ))}
            {restaurantCategories.length > 3 && (
              <span className="text-[10px] lg:text-xs font-semibold px-2 py-0.5 lg:px-3 lg:py-1 rounded-full bg-slate-100 text-slate-500">
                +{restaurantCategories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Spacer to push button to bottom */}
        <div className="flex-grow"></div>

        {/* Action Button */}
        <button
          onClick={() => navigate(`/waiter/restaurant/${restaurant._id}/menu${queryParams}`)}
          className="w-full py-2.5 lg:py-3 bg-slate-900 text-white rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 lg:gap-2 group/btn mt-3 lg:mt-4"
        >
          <span>View Menu & Order</span>
          <i className="ri-arrow-right-line text-sm lg:text-base group-hover/btn:translate-x-1 transition-transform"></i>
        </button>
      </div>
    </div>
  );
};

export default RestaurantList;