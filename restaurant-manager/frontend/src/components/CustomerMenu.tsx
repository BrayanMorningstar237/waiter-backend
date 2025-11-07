import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: {
    _id: string;
    name: string;
  };
  ingredients: string[];
  preparationTime: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: number;
  rating?: {
    average: number;
    count: number;
  };
  likes?: number;
  nutrition?: {
    calories: number;
  };
  takeaway?: {
    isTakeawayAvailable: boolean;
    packagingFee: number;
    takeawayPrice: number;
    takeawayOrdersCount: number;
  };
  totalTakeawayPrice?: number;
  isTakeawayAvailable?: boolean; // For backward compatibility
}

interface Restaurant {
  _id: string;
  name: string;
  description: string;
  logo?: string;
  contact: {
    phone: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    country: string;
  };
  theme?: {
    primaryColor: string;
    secondaryColor: string;
  };
  rating?: {
    average: number;
    count: number;
  };
}

interface Category {
  _id: string;
  name: string;
  description?: string;
}

const CustomerMenu: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<{[key: string]: { quantity: number; isTakeaway: boolean }}>({});
  const [showCart, setShowCart] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Liked items tracking
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  
  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingItemId, setRatingItemId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  
  // Takeaway modal state
  const [showTakeawayModal, setShowTakeawayModal] = useState(false);
  const [takeawayItemId, setTakeawayItemId] = useState<string | null>(null);
  
  // Restaurant rating state

const [restaurantUserRating, setRestaurantUserRating] = useState(0);
 const [showRestaurantRatingModal, setShowRestaurantRatingModal] = useState(false);
  
 // Item refs for scrolling
  const itemRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  
  // Customer info modal state - only name now
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  // Load restaurant rating on component mount
const loadRestaurantRating = async () => {
  try {
    const customerId = getCustomerId();
    const response = await fetch(
      `https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}/user-rating?sessionId=${customerId}`
    );
    
    if (response.ok) {
      const data = await response.json();
      setRestaurantUserRating(data.userRating || 0);
    }
  } catch (error) {
    console.error('Failed to load restaurant rating:', error);
  }
};
  // Custom toast state for CustomerMenu
  const [customerToast, setCustomerToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Get table number from URL query parameter
  const getTableNumberFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('table') || '';
  };

  // Get category from URL query parameter
  const getCategoryFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('category') || null;
  };

  // Get item ID from URL query parameter
  const getItemIdFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('item') || null;
  };

  const tableNumber = getTableNumberFromUrl();
  const urlCategory = getCategoryFromUrl();
  const urlItemId = getItemIdFromUrl();
  const primaryColor = restaurant?.theme?.primaryColor || '#FF6B6B';

  // Get or create customer ID from localStorage
  const getCustomerId = () => {
    let customerId = localStorage.getItem('customer_id');
    if (!customerId) {
      customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('customer_id', customerId);
    }
    return customerId;
  };

  // Load liked items from localStorage
  useEffect(() => {
    const customerId = getCustomerId();
    const likedKey = `liked_items_${customerId}`;
    const savedLikes = localStorage.getItem(likedKey);
    if (savedLikes) {
      setLikedItems(new Set(JSON.parse(savedLikes)));
    }
  }, []);

  // Save liked items to localStorage
  const saveLikedItems = (likes: Set<string>) => {
    const customerId = getCustomerId();
    const likedKey = `liked_items_${customerId}`;
    localStorage.setItem(likedKey, JSON.stringify(Array.from(likes)));
  };

  // Show custom toast function
  const showCustomerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setCustomerToast({ message, type });
  };

  // Close custom toast function
  const closeCustomerToast = () => {
    setCustomerToast(null);
  };

  useEffect(() => {
    if (restaurantId) {
      loadRestaurantData();
      loadRestaurantRating();
    }
  }, [restaurantId]);


  // Handle URL parameters for category and item highlighting
  useEffect(() => {
    if (!loading && menuItems.length > 0) {
      // Set category from URL if present
      if (urlCategory && categories.some(cat => cat._id === urlCategory)) {
        setSelectedCategory(urlCategory);
      }
      
      // Scroll to item if present in URL
      if (urlItemId && itemRefs.current[urlItemId]) {
        setTimeout(() => {
          itemRefs.current[urlItemId]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Add highlight animation
          itemRefs.current[urlItemId]?.classList.add('highlight-pulse');
          setTimeout(() => {
            itemRefs.current[urlItemId]?.classList.remove('highlight-pulse');
          }, 2000);
        }, 300);
      }
    }
  }, [loading, menuItems, urlCategory, urlItemId, categories]);
[{
	"resource": "/c:/Users/ndzod/OneDrive/Desktop/Project waiter 2/waiter/restaurant-manager/frontend/src/components/CustomerMenu.tsx",
	"owner": "typescript",
	"code": "2552",
	"severity": 8,
	"message": "Cannot find name 'setShowRestaurantRatingModal'. Did you mean 'RestaurantRatingModal'?",
	"source": "ts",
	"startLineNumber": 1789,
	"startColumn": 5,
	"endLineNumber": 1789,
	"endColumn": 33,
	"relatedInformation": [
		{
			"startLineNumber": 1006,
			"startColumn": 7,
			"endLineNumber": 1006,
			"endColumn": 28,
			"message": "'RestaurantRatingModal' is declared here.",
			"resource": "/c:/Users/ndzod/OneDrive/Desktop/Project waiter 2/waiter/restaurant-manager/frontend/src/components/CustomerMenu.tsx"
		}
	],
	"origin": "extHost1"
}]
  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      
      const [restaurantResponse, menuResponse, categoriesResponse] = await Promise.all([
        fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}`),
        fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}/menu`),
        fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}/categories`)
      ]);

      if (!restaurantResponse.ok) throw new Error('Failed to load restaurant');
      if (!menuResponse.ok) throw new Error('Failed to load menu');
      
      const restaurantData = await restaurantResponse.json();
      const menuData = await menuResponse.json();
      const categoriesData = categoriesResponse.ok ? await categoriesResponse.json() : { categories: [] };

      setRestaurant(restaurantData.restaurant || restaurantData);
      setMenuItems(menuData.menuItems || []);
      setCategories(categoriesData.categories || []);
    } catch (error: any) {
      showError(`Failed to load restaurant menu: ${error.message}`);
      navigate('/waiter/restaurants');
    } finally {
      setLoading(false);
    }
  };

 

  

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category._id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.ingredients.some(ing => ing.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Get restaurant rating from actual restaurant data instead of menu items
 const getRestaurantRating = () => {
  return restaurant?.rating?.average || 0;
};

const averageRestaurantRating = getRestaurantRating();

  const addToCart = (itemId: string, isTakeaway: boolean = false) => {
  const item = menuItems.find(mi => mi._id === itemId);
  
  // Check if item supports takeaway using the correct property
  const isTakeawayAvailable = item?.takeaway?.isTakeawayAvailable || item?.isTakeawayAvailable;
  
  if (isTakeaway && !isTakeawayAvailable) {
    showCustomerToast('This item is not available for takeaway', 'warning');
    return;
  }

  setCart(prev => {
    const existing = prev[itemId];
    if (existing) {
      return {
        ...prev,
        [itemId]: { 
          quantity: existing.quantity + 1, 
          isTakeaway: existing.isTakeaway 
        }
      };
    } else {
      // If item supports takeaway, ask user for preference
      if (isTakeawayAvailable && !isTakeaway) {
        setTakeawayItemId(itemId);
        setShowTakeawayModal(true);
        return prev; // Don't add yet, wait for user choice
      }
      return {
        ...prev,
        [itemId]: { quantity: 1, isTakeaway }
      };
    }
  });
  
  showCustomerToast('Item added to cart!', 'success');
  setCartAnimation(true);
  setTimeout(() => setCartAnimation(false), 600);
};

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId].quantity > 1) {
        newCart[itemId] = { ...newCart[itemId], quantity: newCart[itemId].quantity - 1 };
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemQuantity = (itemId: string) => {
    return cart[itemId]?.quantity || 0;
  };

  

  const handleCloseCart = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowCart(false);
      setIsClosing(false);
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseCart();
    }
  };

  // Handle like/unlike - Single endpoint version
const handleLike = async (itemId: string, isLiked: boolean) => {
  try {
    const customerId = getCustomerId();
    const action = isLiked ? 'unlike' : 'like';
    
    const response = await fetch(`https://waiter-backend-j4c4.onrender.com/api/public/menu-items/${itemId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: customerId,
        action: action
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to ${action} item`);
    }

    const data = await response.json();
    
    // Update local state
    const newLikedItems = new Set(likedItems);
    if (isLiked) {
      newLikedItems.delete(itemId);
    } else {
      newLikedItems.add(itemId);
    }
    setLikedItems(newLikedItems);
    saveLikedItems(newLikedItems);

    // Update menu items with new like count
    setMenuItems(prev => prev.map(item => 
      item._id === itemId ? { ...item, likes: data.menuItem.likes } : item
    ));

    showCustomerToast(isLiked ? 'Removed from favorites' : 'Added to favorites!', 'success');
  } catch (error: any) {
    console.error('Like error:', error);
    showCustomerToast(`Failed to update: ${error.message}`, 'error');
  }
};

  // Handle rating click
  const handleRatingClick = (itemId: string) => {
    setRatingItemId(itemId);
    setUserRating(0);
    setShowRatingModal(true);
  };

  // Submit rating
// Submit rating
const handleSubmitRating = async () => {
  if (!ratingItemId || userRating === 0) return;

  try {
    const customerId = getCustomerId();

    const response = await fetch(`https://waiter-backend-j4c4.onrender.com/api/public/menu-items/${ratingItemId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating: userRating,
        sessionId: customerId,
        action: 'set'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Failed to submit rating');
    }

    const data = await response.json();
    
    // Update menu items with new rating
    setMenuItems(prev => prev.map(item => 
      item._id === ratingItemId ? { 
        ...item, 
        rating: {
          average: data.menuItem.averageRating,
          count: data.menuItem.ratingCount
        }
      } : item
    ));

    showCustomerToast('Rating submitted successfully!', 'success');
    setShowRatingModal(false);
    setRatingItemId(null);
    setUserRating(0);
  } catch (error: any) {
    console.error('❌ Rating submission error:', error);
    showCustomerToast(`Failed to submit rating: ${error.message}`, 'error');
  }
};

  // Handle takeaway choice
  const handleTakeawayChoice = (isTakeaway: boolean) => {
    if (takeawayItemId) {
      setCart(prev => ({
        ...prev,
        [takeawayItemId]: { quantity: 1, isTakeaway }
      }));
      
      showCustomerToast(
        isTakeaway ? 'Item added for takeaway!' : 'Item added for dine-in!', 
        'success'
      );
      
      setCartAnimation(true);
      setTimeout(() => setCartAnimation(false), 600);
    }
    
    setShowTakeawayModal(false);
    setTakeawayItemId(null);
  };

  // Handle checkout - show customer info modal
  const handleCheckout = () => {
    setShowCustomerModal(true);
  };

  // Handle customer info submission
  // Handle customer info submission
const handleCustomerInfoSubmit = async () => {
  if (!customerName.trim()) {
    showCustomerToast('Please enter your name', 'error');
    return;
  }

  // Save customer name to localStorage for future ratings
  localStorage.setItem('customer_name', customerName.trim());

  try {
    // First, find or create the table
    let tableId = null;
    if (tableNumber) {
      // Try to find existing table
      const tablesResponse = await fetch(`https://waiter-backend-j4c4.onrender.com/api/tables?restaurant=${restaurantId}&tableNumber=${tableNumber}`);
      if (tablesResponse.ok) {
        const tablesData = await tablesResponse.json();
        if (tablesData.tables && tablesData.tables.length > 0) {
          tableId = tablesData.tables[0]._id;
        } else {
          // Create new table if doesn't exist
          const createTableResponse = await fetch('https://waiter-backend-j4c4.onrender.com/api/tables', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              restaurant: restaurantId,
              tableNumber: parseInt(tableNumber),
              capacity: 4, // Default capacity
              status: 'occupied'
            })
          });
          
          if (createTableResponse.ok) {
            const tableData = await createTableResponse.json();
            tableId = tableData.table._id;
          }
        }
      }
    }

    // Create order with customer info and table
    const orderData = {
      restaurant: restaurantId,
      customerName: customerName.trim(),
      table: tableId, // Include table reference if available
      items: Object.entries(cart).map(([itemId, cartItem]) => {
        const item = menuItems.find(mi => mi._id === itemId);
        
        // Calculate price based on takeaway status
        let price = item?.price || 0;
        let specialInstructions = "";
        
        if (cartItem.isTakeaway && item?.takeaway?.isTakeawayAvailable) {
          // For takeaway: takeawayPrice + packagingFee PER ITEM
          const takeawayPrice = item.takeaway.takeawayPrice || item.price;
          const packagingFee = item.takeaway.packagingFee || 0;
          price = takeawayPrice + packagingFee;
          specialInstructions = "Takeaway";
        }
        
        return {
          menuItem: itemId,
          quantity: cartItem.quantity,
          price: price, // This is the unit price including packaging fee for takeaway
          specialInstructions: specialInstructions
        };
      }),
      totalAmount: Object.entries(cart).reduce((sum, [itemId, cartItem]) => {
        const item = menuItems.find(mi => mi._id === itemId);
        let price = item?.price || 0;
        
        if (cartItem.isTakeaway && item?.takeaway?.isTakeawayAvailable) {
          // For takeaway: (takeawayPrice + packagingFee) * quantity
          const takeawayPrice = item.takeaway.takeawayPrice || item.price;
          const packagingFee = item.takeaway.packagingFee || 0;
          price = takeawayPrice + packagingFee;
        }
        
        return sum + (price * cartItem.quantity);
      }, 0),
      orderType: tableNumber ? 'dine-in' : 'takeaway'
    };

    console.log('📦 Sending order data:', orderData);

    const response = await fetch('https://waiter-backend-j4c4.onrender.com/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Failed to create order');
    }

    await response.json();
    
    // Show success message with order number
    const tableInfo = tableNumber ? ` for Table ${tableNumber}` : '';
    showCustomerToast(`Order placed successfully!${tableInfo}`, 'success');
    
    // Clear cart and close modals
    setCart({});
    setShowCustomerModal(false);
    setShowCart(false);
    setCustomerName('');
    
  } catch (error: any) {
    console.error('❌ Order creation error:', error);
    showCustomerToast(`Failed to place order: ${error.message}`, 'error');
  }
};

  // Close customer modal
  const handleCloseCustomerModal = () => {
    setShowCustomerModal(false);
    setCustomerName('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 text-base font-medium">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <i className="ri-restaurant-line text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Restaurant not found</h3>
          <button
            onClick={() => navigate('/waiter/restaurants')}
            className="text-white px-8 py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            Back to Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes highlight-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${primaryColor}40; }
          50% { box-shadow: 0 0 0 12px ${primaryColor}00; }
        }
        .highlight-pulse {
          animation: highlight-pulse 1s ease-in-out 2;
          border: 2px solid ${primaryColor};
        }
      `}</style>

      {/* Header */}
      <div className="w-full shadow-sm sticky top-0 z-50 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => {
                  const searchParams = new URLSearchParams(location.search);
                  navigate(`/waiter/restaurants?${searchParams.toString()}`);
                }}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all flex-shrink-0"
              >
                <i className="ri-arrow-left-line text-lg sm:text-xl text-gray-700"></i>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{restaurant.name}</h1>
                {tableNumber && (
                  <p className="text-gray-600 text-xs font-medium mt-1">
                    Table: {tableNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Enhanced Cart Button with Animation on Every Add */}
            <button
              onClick={() => setShowCart(true)}
              className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ml-2 sm:ml-3 shadow-lg ${
                cartAnimation ? 'scale-110' : 'scale-100'
              }`}
              style={{ backgroundColor: primaryColor }}
            >
              <i className="ri-shopping-cart-2-line text-xl sm:text-2xl text-white"></i>
              {getCartItemCount() > 0 && (
                <span className={`absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-md transition-all ${
                  cartAnimation ? 'scale-125' : 'scale-100'
                }`}>
                  {getCartItemCount()}
                </span>
              )}
              
              {/* Ripple Effect on Every Add */}
              {cartAnimation && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-300 animate-ping" style={{ animationDelay: '100ms' }}></div>
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-200 animate-ping" style={{ animationDelay: '200ms' }}></div>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start gap-3 sm:gap-6">
            
            {/* Restaurant Logo */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-sm border border-orange-100 overflow-hidden flex items-center justify-center hover:shadow-md transition-shadow">
                {restaurant.logo ? (
                  <img
                    src={`https://waiter-backend-j4c4.onrender.com${restaurant.logo}`}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <i className="ri-restaurant-2-line text-orange-400 text-xl sm:text-3xl"></i>
                )}
              </div>
            </div>

            {/* Restaurant Info - Horizontal Layout */}
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
              
              {/* Left Section: Name & Details */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-1.5 truncate">
                  {restaurant.name}
                </h1>
                
                {/* Horizontal Info Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                  {restaurant.address?.city && (
                    <div className="flex items-center gap-1.5">
                      <i className="ri-map-pin-2-line text-red-500"></i>
                      <span className="truncate max-w-[200px]">
                        {restaurant.address.city}{restaurant.address.country && `, ${restaurant.address.country}`}
                      </span>
                    </div>
                  )}
                  
                  {restaurant.contact?.phone && (
                    <div className="flex items-center gap-1.5">
                      <i className="ri-phone-line text-green-500"></i>
                      <span>{restaurant.contact.phone}</span>
                    </div>
                  )}
                  
                  {/* Mobile: Table and Rating on same line */}
                  <div className="flex items-center gap-2 sm:contents">
                    {tableNumber && (
                      <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full">
                        <i className="ri-table-line text-blue-500 text-xs"></i>
                        <span className="text-blue-700 font-medium text-xs">Table {tableNumber}</span>
                      </div>
                    )}
                    
                    {/* Rating - Inline on mobile - Compact */}
<div className="flex sm:hidden items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full px-3 py-1 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors" 
     onClick={() => setShowRestaurantRatingModal(true)}>
  <i className="ri-star-fill text-amber-500 text-sm"></i>
  <span className="text-amber-900 font-bold text-sm">
    {averageRestaurantRating > 0 ? averageRestaurantRating.toFixed(1) : 'Rate'}
  </span>
  {restaurantUserRating > 0 && (
    <span className="text-amber-700 text-xs">Your: {restaurantUserRating}★</span>
  )}
  {averageRestaurantRating === 0 && restaurantUserRating === 0 && (
    <span className="text-amber-600 text-xs">Click</span>
  )}
</div>
                  </div>
                </div>
              </div>

              {/* Right Section: Rating - Desktop Only - Compact Horizontal */}
<div className="hidden sm:flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full px-4 py-2 shadow-sm hover:shadow transition-shadow flex-shrink-0 cursor-pointer hover:bg-amber-100"
     onClick={() => setShowRestaurantRatingModal(true)}>
  <i className="ri-star-fill text-amber-500 text-lg"></i>
  <div className="flex items-center gap-2">
    <span className="text-amber-900 font-bold text-lg">
      {averageRestaurantRating > 0 ? averageRestaurantRating.toFixed(1) : 'Rate Us'}
    </span>
    {averageRestaurantRating > 0 && (
      <span className="text-amber-600 text-xs font-medium border-l border-amber-200 pl-2">
        {averageRestaurantRating >= 4.5 ? 'Excellent' : 
         averageRestaurantRating >= 3.5 ? 'Good' : 'Fair'}
      </span>
    )}
    {restaurantUserRating > 0 && (
      <span className="text-amber-700 text-xs font-medium border-l border-amber-200 pl-2">
        Your: {restaurantUserRating} ★
      </span>
    )}
    {averageRestaurantRating === 0 && restaurantUserRating === 0 && (
      <span className="text-amber-600 text-xs">Click to rate</span>
    )}
  </div>
</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="max-w-7xl mx-auto lg:px-6 lg:py-4 pb-6">
        <div className="bg-white rounded-b-3xl rounded-t-none lg:rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg sm:text-xl"></i>
                <input
                  type="text"
                  placeholder="Search Menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-4 sm:pr-5 py-3 sm:py-4 bg-gray-50 border-0 rounded-2xl text-sm sm:text-base transition-all placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Horizontally Scrollable Category Tags */}
          <div className="mt-4 sm:mt-5">
            <div
              className="overflow-x-auto scrollbar-hide -mx-3 px-3"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className="
                  flex gap-2 flex-nowrap
                  w-max sm:w-full
                  justify-start lg:justify-center
                "
              >
                {/* All Button */}
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                    selectedCategory === "all"
                      ? "text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={selectedCategory === "all" ? { backgroundColor: primaryColor } : {}}
                >
                  All
                </button>

                {/* Dynamic Categories */}
                {categories.map((category) => (
                  <button
                    key={category._id}
                    onClick={() => setSelectedCategory(category._id)}
                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                      selectedCategory === category._id
                        ? "text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={
                      selectedCategory === category._id
                        ? { backgroundColor: primaryColor }
                        : {}
                    }
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(searchTerm || selectedCategory !== 'all') && (
            <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-gray-50 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <i className="ri-search-eye-line text-base"></i>
                    <span>
                      Found <span className="font-bold text-gray-900">{filteredItems.length}</span> items
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {searchTerm && (
                      <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-sm">
                        <i className="ri-search-line text-gray-400"></i>
                        <span className="text-gray-700">"{searchTerm}"</span>
                        <button
                          onClick={() => setSearchTerm('')}
                          className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        >
                          <i className="ri-close-line text-xs text-gray-500"></i>
                        </button>
                      </span>
                    )}
                    
                    {selectedCategory !== 'all' && (
                      <span 
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium"
                        style={{ 
                          borderColor: primaryColor + '40',
                          backgroundColor: primaryColor + '10',
                          color: primaryColor
                        }}
                      >
                        <i className="ri-price-tag-3-line"></i>
                        {categories.find(cat => cat._id === selectedCategory)?.name || 'Selected Category'}
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                          style={{ backgroundColor: primaryColor + '20' }}
                        >
                          <i className="ri-close-line text-xs" style={{ color: primaryColor }}></i>
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                
                {(searchTerm || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                    className="text-sm font-medium hover:underline flex justify-center items-center gap-2 text-left sm:text-right px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                    style={{ color: primaryColor }}
                  >
                    <i className="ri-close-line hidden lg:inline"></i>
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 sm:p-12 text-center shadow-sm border border-gray-100">
            <i className="ri-restaurant-line text-4xl sm:text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">No items found</h3>
            <p className="text-gray-500 text-sm sm:text-base mb-4 sm:mb-6">Try adjusting your search criteria</p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="text-white px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-md text-sm sm:text-base"
                style={{ backgroundColor: primaryColor }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredItems.map(item => (
              <div 
                key={item._id} 
                ref={(el) => { itemRefs.current[item._id] = el; }}
              >
                <MenuItemCard
                  item={item}
                  quantity={getItemQuantity(item._id)}
                  onAddToCart={() => addToCart(item._id)}
                  onRemoveFromCart={() => removeFromCart(item._id)}
                  primaryColor={primaryColor}
                  isLiked={likedItems.has(item._id)}
                  onLike={() => handleLike(item._id, likedItems.has(item._id))}
                  onRate={() => handleRatingClick(item._id)}
                  isTakeaway={cart[item._id]?.isTakeaway}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Toast */}
      {customerToast && (
        <CustomerMenuToast
          message={customerToast.message}
          type={customerToast.type}
          onClose={closeCustomerToast}
          primaryColor={primaryColor}
        />
      )}

      {/* Enhanced Cart Modal with Smooth Slide Animation */}
      {showCart && (
        <div 
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${
            isClosing 
              ? 'bg-black/0 backdrop-blur-0' 
              : 'bg-black/50 backdrop-blur-sm'
          } transition-all duration-300 ease-out`}
          onClick={handleBackdropClick}
        >
          <div 
            className={`bg-white w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col ${
              isClosing 
                ? 'translate-y-full sm:translate-y-4 sm:scale-95 sm:opacity-0 rounded-t-3xl' 
                : 'translate-y-0 sm:scale-100 sm:opacity-100 rounded-t-3xl sm:rounded-3xl'
            } transition-all duration-300 ease-out`}
          >
            <CartModalContent
              cart={cart}
              menuItems={menuItems}
              onUpdateCart={setCart}
              onClose={handleCloseCart}
              onCheckout={handleCheckout}
              restaurant={restaurant}
              primaryColor={primaryColor}
            />
          </div>
        </div>
      )}

      {/* Customer Info Modal */}
      {showCustomerModal && (
        <CustomerInfoModal
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          onSubmit={handleCustomerInfoSubmit}
          onClose={handleCloseCustomerModal}
          primaryColor={primaryColor}
          cartItems={Object.entries(cart).map(([itemId, cartItem]) => {
            const item = menuItems.find(mi => mi._id === itemId);
            return item ? { ...item, quantity: cartItem.quantity, isTakeaway: cartItem.isTakeaway } : null;
          }).filter(Boolean) as (MenuItem & { quantity: number; isTakeaway: boolean })[]}
          total={Object.entries(cart).reduce((sum, [itemId, cartItem]) => {
            const item = menuItems.find(mi => mi._id === itemId);
            const price = cartItem.isTakeaway && item?.totalTakeawayPrice 
              ? item.totalTakeawayPrice 
              : item?.price || 0;
            return sum + (price * cartItem.quantity);
          }, 0)}
          tableNumber={tableNumber}
        />
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <RatingModal
          itemId={ratingItemId}
          menuItems={menuItems}
          userRating={userRating}
          onRatingChange={setUserRating}
          onSubmit={handleSubmitRating}
          onClose={() => {
            setShowRatingModal(false);
            setRatingItemId(null);
            setUserRating(0);
          }}
          primaryColor={primaryColor}
        />
      )}

      {/* Restaurant Rating Modal */}
{showRestaurantRatingModal && (
  <RestaurantRatingModal 
    onClose={() => setShowRestaurantRatingModal(false)}
    userRating={restaurantUserRating}
    onRatingUpdate={(newRating) => setRestaurantUserRating(newRating)}
  />
)}
      {/* Takeaway Modal */}
      {showTakeawayModal && (
        <TakeawayModal
          itemId={takeawayItemId}
          menuItems={menuItems}
          onChoice={handleTakeawayChoice}
          onClose={() => {
            setShowTakeawayModal(false);
            setTakeawayItemId(null);
          }}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
};

// Restaurant Rating Modal Component
interface RestaurantRatingModalProps {
  onClose: () => void;
  userRating: number;
  onRatingUpdate: (newRating: number) => void;
}

const RestaurantRatingModal: React.FC<RestaurantRatingModalProps> = ({ 
  onClose, 
  userRating, 
  onRatingUpdate 
}) => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tempRating, setTempRating] = useState(userRating); // Initialize with user's current rating
  const [loading, setLoading] = useState(false);

  const primaryColor = restaurant?.theme?.primaryColor || '#FF6B6B';

  // Get or create customer ID from localStorage
  const getCustomerId = () => {
    let customerId = localStorage.getItem('customer_id');
    if (!customerId) {
      customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('customer_id', customerId);
    }
    return customerId;
  };

  // Custom toast function for this component
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    // You can implement a toast here or use the existing one
    console.log(`${type}: ${message}`);
  };

  useEffect(() => {
    if (restaurantId) {
      loadRestaurantData();
    }
  }, [restaurantId]);

  // Update tempRating when userRating prop changes
  useEffect(() => {
    setTempRating(userRating);
  }, [userRating]);

  const loadRestaurantData = async () => {
    try {
      const response = await fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setRestaurant(data.restaurant || data);
      }
    } catch (error) {
      console.error('Failed to load restaurant data:', error);
    }
  };

  const handleSubmit = async () => {
    if (tempRating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setLoading(true);
    try {
      const customerId = getCustomerId();
      const response = await fetch(`https://waiter-backend-j4c4.onrender.com/api/public/restaurants/${restaurantId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: tempRating,
          sessionId: customerId,
          action: 'set'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to submit restaurant rating');
      }

      const data = await response.json();
      
      // Update the restaurant data with new rating
      setRestaurant((prev: any) => ({
        ...prev,
        rating: data.restaurant.rating
      }));
      
      // Notify parent component about the rating update
      onRatingUpdate(tempRating);
      
      showToast('Restaurant rating submitted successfully!', 'success');
      
      // Close modal
      onClose();
      
    } catch (error: any) {
      console.error('❌ Restaurant rating submission error:', error);
      showToast(`Failed to submit rating: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!restaurant) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-md overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {userRating > 0 ? 'Update Your Rating for' : 'Rate'} {restaurant?.name}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-lg text-gray-700"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Restaurant Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
              {restaurant.logo ? (
                <img
                  src={`https://waiter-backend-j4c4.onrender.com${restaurant.logo}`}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="ri-restaurant-line text-2xl text-gray-400"></i>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
              <p className="text-sm text-gray-500">
                Current: {restaurant.rating?.average ? restaurant.rating.average.toFixed(1) : 'No ratings yet'}
                {restaurant.rating?.count ? ` (${restaurant.rating.count} reviews)` : ''}
              </p>
              {userRating > 0 && (
                <p className="text-sm text-amber-600 font-medium mt-1">
                  Your current rating: {userRating} ★
                </p>
              )}
            </div>
          </div>

          {/* Star Rating */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-gray-700 mb-4">
              {userRating > 0 ? 'Update your rating for:' : 'How would you rate this restaurant?'}
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setTempRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <i 
                    className={`${star <= tempRating ? 'ri-star-fill' : 'ri-star-line'} text-4xl`}
                    style={{ color: star <= tempRating ? '#FCD34D' : '#D1D5DB' }}
                  ></i>
                </button>
              ))}
            </div>
            {tempRating > 0 && (
              <p className="mt-3 text-sm font-medium" style={{ color: primaryColor }}>
                {tempRating === 1 && 'Poor'}
                {tempRating === 2 && 'Fair'}
                {tempRating === 3 && 'Good'}
                {tempRating === 4 && 'Very Good'}
                {tempRating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={tempRating === 0 || loading}
            className="w-full text-white py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'Submitting...' : userRating > 0 ? 'Update Rating' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ... (keep all the existing component code below - MenuItemCard, CartModalContent, CustomerInfoModal, RatingModal, CustomerMenuToast, TakeawayModal)

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  primaryColor: string;
  isLiked: boolean;
  onLike: () => void;
  onRate: () => void;
  isTakeaway?: boolean;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ 
  item, 
  quantity, 
  onAddToCart, 
  onRemoveFromCart,
  primaryColor,
  isLiked,
  onLike,
  onRate,
  isTakeaway,
}) => {
  // Get takeaway availability from the correct property
  const isTakeawayAvailable = item.takeaway?.isTakeawayAvailable || item.isTakeawayAvailable;
  const takeawayPrice = item.takeaway?.takeawayPrice || item.totalTakeawayPrice;
  const displayPrice = isTakeaway && takeawayPrice ? takeawayPrice : item.price;
  
  // Function to handle add to cart with takeaway check
  const handleAddToCart = () => {
    // If item supports takeaway and it's the first time adding, show modal for choice
    if (isTakeawayAvailable && quantity === 0) {
      onAddToCart(); // This will trigger the takeaway modal
    } else {
      // For existing items or non-takeaway items, add directly
      onAddToCart();
    }
  };
  
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-36 sm:h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4">
        {item.image ? (
          <img
            src={`https://waiter-backend-j4c4.onrender.com${item.image}`}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="ri-restaurant-line text-3xl sm:text-5xl text-gray-300"></i>
          </div>
        )}
        
        <button 
          onClick={onLike}
          className="absolute top-2 right-2 w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
        >
          <i className={`${isLiked ? 'ri-heart-fill' : 'ri-heart-line'} text-sm sm:text-lg`} style={{ color: isLiked ? primaryColor : '#6b7280' }}></i>
        </button>

        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-white transition-colors" onClick={onRate}>
          <i className="ri-star-fill text-yellow-400 text-xs sm:text-sm"></i>
          <span className="text-xs sm:text-sm font-bold text-gray-900">
            {item.rating?.average ? item.rating.average.toFixed(1) : '0.0'}
          </span>
          {item.rating?.count ? (
            <span className="text-xs text-gray-500">({item.rating.count})</span>
          ) : null}
        </div>

        {item.likes && item.likes > 0 ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm">
            <i className="ri-heart-fill text-xs" style={{ color: primaryColor }}></i>
            <span className="text-xs font-semibold text-gray-900">{item.likes}</span>
          </div>
        ) : null}

        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {item.isVegetarian && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
              Veg
            </span>
          )}
          {item.isVegan && (
            <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
              Vegan
            </span>
          )}
          {/* Show takeaway badge if item supports takeaway */}
          {isTakeawayAvailable && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
              Takeaway
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1 line-clamp-1">{item.name}</h3>
          <p className="text-gray-500 text-xs sm:text-sm leading-relaxed line-clamp-2">{item.description}</p>
          
          {/* Show takeaway price info if available */}
          {isTakeawayAvailable && takeawayPrice && takeawayPrice !== item.price && (
            <div className="mt-1 text-xs text-blue-600 font-medium">
              Takeaway: {takeawayPrice.toLocaleString()} CFA
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <i className="ri-time-line"></i>
            {item.preparationTime} min
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-fire-line text-orange-500"></i>
            {item.nutrition?.calories || Math.floor(Math.random() * 200 + 150)} Kcal
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 sm:pt-2">
          <div>
            <span className="text-lg sm:text-2xl font-bold text-gray-900">
              {displayPrice.toLocaleString()}
            </span>
            <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">CFA</span>
            {isTakeaway && takeawayPrice && takeawayPrice !== item.price && (
              <div className="text-xs text-gray-400 line-through">
                {item.price.toLocaleString()} CFA
              </div>
            )}
          </div>
          
          {quantity === 0 ? (
            <button
              onClick={handleAddToCart}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-105 transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <i className="ri-add-line text-lg sm:text-2xl"></i>
            </button>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 rounded-full p-1">
              <button
                onClick={onRemoveFromCart}
                className="w-7 h-7 sm:w-9 sm:h-9 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all"
              >
                <i className="ri-subtract-line text-gray-700 text-sm"></i>
              </button>
              <span className="text-base sm:text-lg font-bold text-gray-900 min-w-6 sm:min-w-8 text-center">
                {quantity}
              </span>
              <button
                onClick={handleAddToCart}
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white shadow-sm hover:shadow-md transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                <i className="ri-add-line text-sm"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CartModalContentProps {
  cart: {[key: string]: { quantity: number; isTakeaway: boolean }};
  menuItems: MenuItem[];
  onUpdateCart: (cart: {[key: string]: { quantity: number; isTakeaway: boolean }}) => void;
  onClose: () => void;
  onCheckout: () => void;
  restaurant: Restaurant;
  primaryColor: string;
}

const CartModalContent: React.FC<CartModalContentProps> = ({ 
  cart, 
  menuItems, 
  onUpdateCart, 
  onClose, 
  onCheckout,
  restaurant,
  primaryColor,
}) => {
  const cartItems = Object.entries(cart)
    .map(([itemId, cartItem]) => {
      const item = menuItems.find(mi => mi._id === itemId);
      if (!item) return null;
      
      // Calculate display price including packaging fee for takeaway
      let displayPrice = item.price;
      if (cartItem.isTakeaway && item.takeaway?.isTakeawayAvailable) {
        const takeawayPrice = item.takeaway.takeawayPrice || item.price;
        const packagingFee = item.takeaway.packagingFee || 0;
        displayPrice = takeawayPrice + packagingFee;
      }
      
      return { 
        ...item, 
        quantity: cartItem.quantity, 
        isTakeaway: cartItem.isTakeaway,
        displayPrice: displayPrice
      };
    })
    .filter(Boolean) as (MenuItem & { quantity: number; isTakeaway: boolean; displayPrice: number })[];

  const total = cartItems.reduce((sum, item) => {
    return sum + (item.displayPrice * item.quantity);
  }, 0);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      const newCart = { ...cart };
      delete newCart[itemId];
      onUpdateCart(newCart);
    } else {
      onUpdateCart({ ...cart, [itemId]: { ...cart[itemId], quantity: newQuantity } });
    }
  };

  const clearCart = () => {
    onUpdateCart({});
  };

  return (
    <>
      <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Cart</h2>
            <p className="text-gray-500 text-sm mt-1">{restaurant.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
          >
            <i className="ri-close-line text-lg sm:text-xl text-gray-700"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {cartItems.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <i className="ri-shopping-cart-line text-4xl sm:text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-600 font-medium text-base sm:text-lg">Your cart is empty</p>
            <p className="text-gray-500 text-sm mt-2">Add Some Items!</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {cartItems.map(item => {
              const displayPrice = item.isTakeaway && item.totalTakeawayPrice ? item.totalTakeawayPrice : item.price;
              
              return (
                <div key={item._id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={`https://waiter-backend-j4c4.onrender.com${item.image}`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-restaurant-line text-lg sm:text-2xl text-gray-400"></i>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{item.name}</h3>
                    {item.isTakeaway && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">
                        Takeaway
                      </span>
                    )}
                    <p className="font-bold text-sm sm:text-base mt-1" style={{ color: primaryColor }}>
                      {displayPrice.toLocaleString()} CFA
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity - 1)}
                      className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all"
                    >
                      <i className="ri-subtract-line text-gray-700 text-xs"></i>
                    </button>
                    <span className="font-bold text-gray-900 min-w-4 sm:min-w-6 text-center text-sm sm:text-base">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity + 1)}
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white shadow-sm hover:shadow-md transition-all"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <i className="ri-add-line text-xs"></i>
                    </button>
                  </div>
                  
                  <div className="text-right min-w-16 sm:min-w-20">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">
                      {(displayPrice * item.quantity).toLocaleString()} CFA
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 sm:p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg sm:text-xl font-semibold text-gray-900">Total:</span>
            <span className="text-2xl sm:text-3xl font-bold text-gray-900">{total.toLocaleString()} CFA</span>
          </div>
          
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={clearCart}
              className="flex-1 bg-gray-200 text-gray-700 py-3 sm:py-4 rounded-full font-semibold hover:bg-gray-300 transition-all text-sm sm:text-base"
            >
              Clear Cart
            </button>
            <button
              onClick={onCheckout}
              className="flex-1 text-white py-3 sm:py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg text-sm sm:text-base"
              style={{ backgroundColor: primaryColor }}
            >
              Place Order
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Customer Info Modal Component
interface CustomerInfoModalProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  primaryColor: string;
  cartItems: (MenuItem & { quantity: number; isTakeaway: boolean })[];
  total: number;
  tableNumber: string;
}

const CustomerInfoModal: React.FC<CustomerInfoModalProps> = ({
  customerName,
  onCustomerNameChange,
  onSubmit,
  onClose,
  primaryColor,
  cartItems,
  total,
  tableNumber
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Complete Your Order</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-lg text-gray-700"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Order Summary */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            {tableNumber && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-blue-800 text-sm font-medium">
                  Table: {tableNumber}
                </p>
              </div>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cartItems.map(item => {
                const displayPrice = item.isTakeaway && item.totalTakeawayPrice ? item.totalTakeawayPrice : item.price;
                return (
                  <div key={item._id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {item.quantity}x {item.name}
                      {item.isTakeaway && <span className="text-blue-600 ml-1">(Takeaway)</span>}
                    </span>
                    <span className="font-medium text-gray-900">
                      {(displayPrice * item.quantity).toLocaleString()} CFA
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 mt-3 pt-3">
              <div className="flex justify-between items-center font-semibold">
                <span>Total:</span>
                <span>{total.toLocaleString()} CFA</span>
              </div>
            </div>
          </div>

          {/* Customer Information Form - Only Name */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Your Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm transition-all placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white focus:border-red-300"
                autoFocus
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-6 flex-shrink-0">
          <button
            onClick={onSubmit}
            disabled={!customerName.trim()}
            className="w-full text-white py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
};

// Rating Modal Component
interface RatingModalProps {
  itemId: string | null;
  menuItems: MenuItem[];
  userRating: number;
  onRatingChange: (rating: number) => void;
  onSubmit: () => void;
  onClose: () => void;
  primaryColor: string;
}

const RatingModal: React.FC<RatingModalProps> = ({
  itemId,
  menuItems,
  userRating,
  onRatingChange,
  onSubmit,
  onClose,
  primaryColor
}) => {
  const item = menuItems.find(mi => mi._id === itemId);
  
  if (!item) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-md overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Rate this Item</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-lg text-gray-700"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Item Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
              {item.image ? (
                <img
                  src={`https://waiter-backend-j4c4.onrender.com${item.image}`}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="ri-restaurant-line text-2xl text-gray-400"></i>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{item.name}</h3>
              <p className="text-sm text-gray-500">
                Current: {item.rating?.average ? item.rating.average.toFixed(1) : 'No ratings yet'}
                {item.rating?.count ? ` (${item.rating.count} reviews)` : ''}
              </p>
            </div>
          </div>

          {/* Star Rating */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-gray-700 mb-4">How would you rate this item?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRatingChange(star)}
                  className="transition-transform hover:scale-110"
                >
                  <i 
                    className={`${star <= userRating ? 'ri-star-fill' : 'ri-star-line'} text-4xl`}
                    style={{ color: star <= userRating ? '#FCD34D' : '#D1D5DB' }}
                  ></i>
                </button>
              ))}
            </div>
            {userRating > 0 && (
              <p className="mt-3 text-sm font-medium" style={{ color: primaryColor }}>
                {userRating === 1 && 'Poor'}
                {userRating === 2 && 'Fair'}
                {userRating === 3 && 'Good'}
                {userRating === 4 && 'Very Good'}
                {userRating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={onSubmit}
            disabled={userRating === 0}
            className="w-full text-white py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            Submit Rating
          </button>
        </div>
      </div>
    </div>
  );
};

// Updated CustomerMenuToast Component with Slide Animation
interface CustomerMenuToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
  primaryColor: string;
}

const CustomerMenuToast: React.FC<CustomerMenuToastProps> = ({ 
  message, 
  type, 
  duration = 3000, 
  onClose,
  primaryColor 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in
    setIsVisible(true);
    // Slide out after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 400); // wait for animation to end
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeConfig = {
    success: { icon: 'ri-checkbox-circle-line' },
    error: { icon: 'ri-error-warning-line' },
    warning: { icon: 'ri-alert-line' },
    info: { icon: 'ri-information-line' }
  };

  const config = typeConfig[type];

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
        transition-all duration-500 ease-in-out
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}
      `}
    >
      <div 
        className="flex items-center gap-3 px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm bg-white/95 border"
        style={{
          borderColor: primaryColor + '40',
          boxShadow: `0 10px 20px -5px ${primaryColor}25`,
        }}
      >
        <i 
          className={`${config.icon} text-lg`}
          style={{ color: primaryColor }}
        ></i>
        <p className="font-medium text-sm" style={{ color: primaryColor }}>
          {message}
        </p>
      </div>
    </div>
  );
};

// Takeaway Modal Component
interface TakeawayModalProps {
  itemId: string | null;
  menuItems: MenuItem[];
  onChoice: (isTakeaway: boolean) => void;
  onClose: () => void;
  primaryColor: string;
}

const TakeawayModal: React.FC<TakeawayModalProps> = ({
  itemId,
  menuItems,
  onChoice,
  onClose,
  primaryColor
}) => {
  const item = menuItems.find(mi => mi._id === itemId);
  
  if (!item) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-md overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Choose Dining Option</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-lg text-gray-700"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Item Info */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-2xl">
            <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
              {item.image ? (
                <img
                  src={`https://waiter-backend-j4c4.onrender.com${item.image}`}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="ri-restaurant-line text-2xl text-gray-400"></i>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{item.name}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose how you'd like to enjoy this item
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Dine-in Option */}
            <button
              onClick={() => onChoice(false)}
              className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <i className="ri-restaurant-line text-green-600 text-2xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Dine In</h4>
                    <p className="text-sm text-gray-500">Enjoy at the restaurant</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: primaryColor }}>
                    {item.price.toLocaleString()} CFA
                  </p>
                </div>
              </div>
            </button>

            {/* Takeaway Option */}
            <button
              onClick={() => onChoice(true)}
              className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <i className="ri-shopping-bag-line text-blue-600 text-2xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Takeaway</h4>
                    <p className="text-sm text-gray-500">Take it to go</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-blue-600">
                    {item.totalTakeawayPrice?.toLocaleString() || item.price.toLocaleString()} CFA
                  </p>
                 {item.takeaway && (
  <p className="text-xs sm:text-sm text-gray-500 truncate">
    {`${item.takeaway.takeawayPrice.toLocaleString()} CFA + ${item.takeaway.packagingFee.toLocaleString()} CFA`}
  </p>
)}

                </div>
              </div>
            </button>
          </div>

          {item.totalTakeawayPrice && item.totalTakeawayPrice !== item.price && (
            <div className="mt-4 p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-800 text-center">
                <i className="ri-information-line mr-1"></i>
                Takeaway includes packaging charges
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerMenu;