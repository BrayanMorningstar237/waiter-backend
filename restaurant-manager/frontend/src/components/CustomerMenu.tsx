import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  isTakeawayAvailable?: boolean;
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

// Order History Interfaces
interface OrderItem {
  menuItem: string;
  name: string;
  quantity: number;
  price: number;
  isTakeaway: boolean;
  specialInstructions?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  restaurant: {
    _id: string;
    name: string;
    logo?: string;
  };
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  orderType: 'dine-in' | 'takeaway';
  table?: {
    tableNumber: string;
  };
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  // Add this field to store the actual backend ID
  backendId?: string;
}

interface OrderHistoryState {
  orders: Order[];
  loading: boolean;
  filters: {
    status: string;
    dateRange: string;
  };
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
  
  // Customer info modal state - with name persistence
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [tempCustomerName, setTempCustomerName] = useState('');
  
  // Order submission loading state
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  // Order History state
  const [showOrderHistory, setShowOrderHistory] = useState(false);

  // Scroll position and category persistence
  const scrollPositionRef = useRef(0);
  const selectedCategoryRef = useRef(selectedCategory);
  const searchTermRef = useRef(searchTerm);

  // Update refs when state changes
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  // Save scroll position before any re-renders
  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.scrollY;
  }, []);

  // Restore scroll position after re-render
  const restoreScrollPosition = useCallback(() => {
    if (scrollPositionRef.current > 0) {
      setTimeout(() => {
        window.scrollTo(0, scrollPositionRef.current);
      }, 100);
    }
  }, []);

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

  // Load customer name from localStorage
  const loadCustomerName = () => {
    try {
      const customerId = getCustomerId();
      const customerNameKey = `customer_name_${customerId}`;
      const savedName = localStorage.getItem(customerNameKey);
      if (savedName) {
        setCustomerName(savedName);
      }
    } catch (error) {
      console.error('Failed to load customer name:', error);
    }
  };

  // Save customer name to localStorage
  const saveCustomerName = (name: string) => {
    try {
      const customerId = getCustomerId();
      const customerNameKey = `customer_name_${customerId}`;
      localStorage.setItem(customerNameKey, name);
      setCustomerName(name);
    } catch (error) {
      console.error('Failed to save customer name:', error);
    }
  };

  // Load liked items from localStorage
  useEffect(() => {
    const customerId = getCustomerId();
    const likedKey = `liked_items_${customerId}`;
    const savedLikes = localStorage.getItem(likedKey);
    if (savedLikes) {
      setLikedItems(new Set(JSON.parse(savedLikes)));
    }
    
    // Load customer name
    loadCustomerName();
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

  // Move the loadRestaurantRating function definition here
const loadRestaurantRating = async () => {
  try {
    const customerId = getCustomerId();
    const response = await fetch(
      `http://localhost:5000/api/public/restaurants/${restaurantId}/user-rating?sessionId=${customerId}`
    );
    
    if (response.ok) {
      const data = await response.json();
      setRestaurantUserRating(data.userRating || 0);
    }
  } catch (error) {
    console.error('Failed to load restaurant rating:', error);
  }
};

// Then the useEffect
useEffect(() => {
  if (restaurantId) {
    loadRestaurantData();
    loadRestaurantRating(); // ✅ Now this will work
  }
}, [restaurantId]);

  // Handle URL parameters for category and item highlighting
  useEffect(() => {
    if (!loading && menuItems.length > 0) {
      if (urlCategory && categories.some(cat => cat._id === urlCategory)) {
        setSelectedCategory(urlCategory);
      }
      
      if (urlItemId && itemRefs.current[urlItemId]) {
        setTimeout(() => {
          itemRefs.current[urlItemId]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          itemRefs.current[urlItemId]?.classList.add('highlight-pulse');
          setTimeout(() => {
            itemRefs.current[urlItemId]?.classList.remove('highlight-pulse');
          }, 2000);
        }, 300);
      }
    }
  }, [loading, menuItems, urlCategory, urlItemId, categories]);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      
      // Save current state before loading new data
      const currentCategory = selectedCategoryRef.current;
      const currentSearchTerm = searchTermRef.current;
      saveScrollPosition();
      
      const [restaurantResponse, menuResponse, categoriesResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/public/restaurants/${restaurantId}`),
        fetch(`http://localhost:5000/api/public/restaurants/${restaurantId}/menu`),
        fetch(`http://localhost:5000/api/public/restaurants/${restaurantId}/categories`)
      ]);

      if (!restaurantResponse.ok) throw new Error('Failed to load restaurant');
      if (!menuResponse.ok) throw new Error('Failed to load menu');
      
      const restaurantData = await restaurantResponse.json();
      const menuData = await menuResponse.json();
      const categoriesData = categoriesResponse.ok ? await categoriesResponse.json() : { categories: [] };

      setRestaurant(restaurantData.restaurant || restaurantData);
      setMenuItems(menuData.menuItems || []);
      setCategories(categoriesData.categories || []);
      
      // Restore the category and search term after data loads
      setSelectedCategory(currentCategory);
      setSearchTerm(currentSearchTerm);
      
      // Restore scroll position after a brief delay to ensure DOM is updated
      setTimeout(() => {
        restoreScrollPosition();
      }, 200);
      
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

  const getRestaurantRating = () => {
    return restaurant?.rating?.average || 0;
  };

  const averageRestaurantRating = getRestaurantRating();

  const addToCart = (itemId: string, isTakeaway: boolean = false) => {
    const item = menuItems.find(mi => mi._id === itemId);
    
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
        if (isTakeawayAvailable && !isTakeaway) {
          setTakeawayItemId(itemId);
          setShowTakeawayModal(true);
          return prev;
        }
        showCustomerToast('Item added to cart!', 'success');
        return {
          ...prev,
          [itemId]: { quantity: 1, isTakeaway }
        };
      }
    }); 
    
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

  // Handle like/unlike
  const handleLike = async (itemId: string, isLiked: boolean) => {
    try {
      const customerId = getCustomerId();
      const action = isLiked ? 'unlike' : 'like';
      
      const response = await fetch(`http://localhost:5000/api/public/menu-items/${itemId}/like`, {
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
      
      const newLikedItems = new Set(likedItems);
      if (isLiked) {
        newLikedItems.delete(itemId);
      } else {
        newLikedItems.add(itemId);
      }
      setLikedItems(newLikedItems);
      saveLikedItems(newLikedItems);

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
  const handleSubmitRating = async () => {
    if (!ratingItemId || userRating === 0) return;

    try {
      const customerId = getCustomerId();

      const response = await fetch(`http://localhost:5000/api/public/menu-items/${ratingItemId}/rate`, {
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

  // Save order to history function
const saveOrderToHistory = (orderData: any) => {
  try {
    const customerId = getCustomerId();
    const ordersKey = `customer_orders_${customerId}`;
    
    const existingOrders = localStorage.getItem(ordersKey);
    const orders = existingOrders ? JSON.parse(existingOrders) : [];
    
    const newOrder = {
      ...orderData,
      _id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      // Store the actual backend ID for status updates
      backendId: orderData._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.unshift(newOrder);
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    
    console.log('✅ Order saved to history:', newOrder.orderNumber);
  } catch (error) {
    console.error('❌ Failed to save order to history:', error);
  }
};
  // Handle customer info submission with loading state
  const handleCustomerInfoSubmit = async () => {
    if (isSubmittingOrder) {
      return;
    }

    if (!customerName.trim()) {
      showCustomerToast('Please enter your name', 'error');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      let tableId = null;
      if (tableNumber) {
        const tablesResponse = await fetch(`http://localhost:5000/api/tables?restaurant=${restaurantId}&tableNumber=${tableNumber}`);
        if (tablesResponse.ok) {
          const tablesData = await tablesResponse.json();
          if (tablesData.tables && tablesData.tables.length > 0) {
            tableId = tablesData.tables[0]._id;
          } else {
            const createTableResponse = await fetch('http://localhost:5000/api/tables', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                restaurant: restaurantId,
                tableNumber: parseInt(tableNumber),
                capacity: 4,
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

      const orderData = {
        restaurant: restaurantId,
        customerName: customerName.trim(),
        table: tableId,
        items: Object.entries(cart).map(([itemId, cartItem]) => {
          const item = menuItems.find(mi => mi._id === itemId);
          
          let price = item?.price || 0;
          let specialInstructions = "";
          
          if (cartItem.isTakeaway && item?.takeaway?.isTakeawayAvailable) {
            const takeawayPrice = item.takeaway.takeawayPrice || item.price;
            const packagingFee = item.takeaway.packagingFee || 0;
            price = takeawayPrice + packagingFee;
            specialInstructions = "Takeaway";
          }
          
          return {
            menuItem: itemId,
            quantity: cartItem.quantity,
            price: price,
            specialInstructions: specialInstructions
          };
        }),
        totalAmount: Object.entries(cart).reduce((sum, [itemId, cartItem]) => {
          const item = menuItems.find(mi => mi._id === itemId);
          let price = item?.price || 0;
          
          if (cartItem.isTakeaway && item?.takeaway?.isTakeawayAvailable) {
            const takeawayPrice = item.takeaway.takeawayPrice || item.price;
            const packagingFee = item.takeaway.packagingFee || 0;
            price = takeawayPrice + packagingFee;
          }
          
          return sum + (price * cartItem.quantity);
        }, 0),
        orderType: tableNumber ? 'dine-in' : 'takeaway'
      };

      console.log('📦 Sending order data:', orderData);

      const response = await fetch('http://localhost:5000/api/orders', {
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

      const orderResponse = await response.json();

// Save order to history
saveOrderToHistory({
  ...orderResponse.order,
  restaurant: {
    _id: restaurantId,
    name: restaurant?.name,
    logo: restaurant?.logo
  }
});

      // Save customer name for future orders
      saveCustomerName(customerName.trim());
      
      const tableInfo = tableNumber ? ` for Table ${tableNumber}` : '';
      showCustomerToast(`Order placed successfully!${tableInfo}`, 'success');
      
      setCart({});
      setShowCustomerModal(false);
      setShowCart(false);
      
    } catch (error: any) {
      console.error('❌ Order creation error:', error);
      showCustomerToast(`Failed to place order: ${error.message}`, 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Close customer modal
  const handleCloseCustomerModal = () => {
    setShowCustomerModal(false);
  };

  // Handle name edit
  const handleEditName = () => {
    setTempCustomerName(customerName);
    setShowNameEditModal(true);
  };

  // Handle save edited name
  const handleSaveName = () => {
    if (tempCustomerName.trim()) {
      saveCustomerName(tempCustomerName.trim());
      setShowNameEditModal(false);
      showCustomerToast('Name updated successfully!', 'success');
    } else {
      showCustomerToast('Please enter a valid name', 'error');
    }
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
              {/* Conditionally render back arrow based on URL parameters */}
              {!tableNumber && (
                <button
                  onClick={() => {
                    const searchParams = new URLSearchParams(location.search);
                    navigate(`/waiter/restaurants?${searchParams.toString()}`);
                  }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <i className="ri-arrow-left-line text-lg sm:text-xl text-gray-700"></i>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{restaurant.name}</h1>
                {tableNumber && (
                  <p className="text-gray-600 text-xs font-medium mt-1">
                    Table: {tableNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Order History Button */}
            <button
              onClick={() => setShowOrderHistory(true)}
              className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all flex-shrink-0 ml-2 sm:ml-3"
            >
              <i className="ri-history-line text-xl sm:text-2xl text-gray-700"></i>
            </button>

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
                    src={`${restaurant.logo}`}
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
          onEditName={handleEditName}
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
          isSubmitting={isSubmittingOrder}
        />
      )}

      {/* Name Edit Modal */}
      {showNameEditModal && (
        <NameEditModal
          customerName={tempCustomerName}
          onCustomerNameChange={setTempCustomerName}
          onSave={handleSaveName}
          onClose={() => setShowNameEditModal(false)}
          primaryColor={primaryColor}
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

      {/* Order History Modal */}
      {showOrderHistory && (
        <OrderHistory
          primaryColor={primaryColor}
          onClose={() => setShowOrderHistory(false)}
        />
      )}
    </div>
  );
};

// Name Edit Modal Component
interface NameEditModalProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
  primaryColor: string;
}

const NameEditModal: React.FC<NameEditModalProps> = ({
  customerName,
  onCustomerNameChange,
  onSave,
  onClose,
  primaryColor
}) => {
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
            <h2 className="text-xl font-bold text-gray-900">Edit Your Name</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-lg text-gray-700"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
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
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-full font-semibold hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!customerName.trim()}
              className="flex-1 text-white py-3 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              Save Name
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Updated CustomerInfoModal with Name Edit Option
interface CustomerInfoModalProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onEditName: () => void;
  primaryColor: string;
  cartItems: (MenuItem & { quantity: number; isTakeaway: boolean })[];
  total: number;
  tableNumber: string;
  isSubmitting?: boolean;
}

const CustomerInfoModal: React.FC<CustomerInfoModalProps> = ({
  customerName,
  onCustomerNameChange,
  onSubmit,
  onClose,
  onEditName,
  primaryColor,
  cartItems,
  total,
  tableNumber,
  isSubmitting = false
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
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
            <h2 className="text-xl font-bold text-gray-900">
              {isSubmitting ? 'Placing Order...' : 'Complete Your Order'}
            </h2>
            {!isSubmitting && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
              >
                <i className="ri-close-line text-lg text-gray-700"></i>
              </button>
            )}
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
          {!isSubmitting && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Your Information</h3>
                {customerName && (
                  <button
                    onClick={onEditName}
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                    style={{ color: primaryColor }}
                  >
                    <i className="ri-edit-line text-xs"></i>
                    Edit
                  </button>
                )}
              </div>
              
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
                  disabled={isSubmitting}
                />
                {customerName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Your name will be saved for future orders
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isSubmitting && (
            <div className="text-center py-8">
              <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Processing your order...</p>
              <p className="text-gray-500 text-sm mt-2">Please wait</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-6 flex-shrink-0">
          <button
            onClick={onSubmit}
            disabled={!customerName.trim() || isSubmitting}
            className="w-full text-white py-4 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? (
              <>
                <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing Order...
              </>
            ) : (
              'Confirm Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Order History Component
interface OrderHistoryProps {
  primaryColor: string;
  onClose: () => void;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ primaryColor, onClose }) => {
  const [state, setState] = useState<OrderHistoryState>({
    orders: [],
    loading: true,
    filters: {
      status: 'all',
      dateRange: 'all'
    }
  });

  // Load orders from localStorage on component mount
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = () => {
    try {
      const customerId = getCustomerId();
      const ordersKey = `customer_orders_${customerId}`;
      const savedOrders = localStorage.getItem(ordersKey);
      
      if (savedOrders) {
        const orders = JSON.parse(savedOrders);
        setState(prev => ({
          ...prev,
          orders: orders.sort((a: Order, b: Order) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
          loading: false
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const getCustomerId = () => {
    let customerId = localStorage.getItem('customer_id');
    if (!customerId) {
      customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('customer_id', customerId);
    }
    return customerId;
  };

  const updateOrderStatus = async (orderId: string) => {
  try {
    const customerId = getCustomerId();
    const ordersKey = `customer_orders_${customerId}`;
    const savedOrders = localStorage.getItem(ordersKey);
    
    if (!savedOrders) return;

    const orders = JSON.parse(savedOrders);
    const order = orders.find((o: Order) => o._id === orderId);
    
    if (!order) return;

    // If we have a backend ID, use it. Otherwise, try to find by order number.
    let apiUrl = '';
    if (order.backendId) {
      apiUrl = `http://localhost:5000/api/public/orders/${order.backendId}`;
    } else if (order.orderNumber) {
      // Try to find by order number as fallback
      apiUrl = `http://localhost:5000/api/public/orders/by-number/${order.orderNumber}`;
    } else {
      console.warn('⚠️ No valid identifier found for order status check');
      alert('Cannot check status for this order. Please contact the restaurant.');
      return;
    }

    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const orderData = await response.json();
      const updatedOrders = orders.map((o: Order) => 
        o._id === orderId ? { 
          ...o, 
          ...orderData.order,
          // Ensure we store the backend ID if we didn't have it before
          backendId: orderData.order._id || o.backendId
        } : o
      );
      
      localStorage.setItem(ordersKey, JSON.stringify(updatedOrders));
      loadOrders();
      console.log('✅ Order status updated successfully');
    } else if (response.status === 404) {
      console.warn('⚠️ Order not found on server');
      alert('Order not found on server. It may have been deleted or there might be a connection issue.');
    } else {
      console.error('❌ Server error when fetching order status');
      alert('Failed to check order status. Please try again later.');
    }
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    alert('Network error. Please check your connection and try again.');
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'ri-time-line';
      case 'confirmed': return 'ri-checkbox-circle-line';
      case 'preparing': return 'ri-restaurant-line';
      case 'ready': return 'ri-check-double-line';
      case 'served': return 'ri-checkbox-circle-line';
      case 'completed': return 'ri-checkbox-circle-line';
      case 'cancelled': return 'ri-close-circle-line';
      default: return 'ri-question-line';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filterOrders = () => {
    let filtered = state.orders;

    if (state.filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === state.filters.status);
    }

    if (state.filters.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (state.filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
      }
    }

    return filtered;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupOrdersByDate = (orders: Order[]) => {
    const groups: { [key: string]: Order[] } = {};
    
    orders.forEach(order => {
      const date = new Date(order.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(order);
    });
    
    return groups;
  };

  const filteredOrders = filterOrders();
  const groupedOrders = groupOrdersByDate(filteredOrders);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (state.loading) {
    return (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out" onClick={handleBackdropClick}>
        <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading your orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ease-out" onClick={handleBackdropClick}>
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
              <p className="text-gray-500 text-sm mt-1">View and track your orders</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
            >
              <i className="ri-close-line text-xl text-gray-700"></i>
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={state.filters.status}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  filters: { ...prev.filters, status: e.target.value }
                }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="served">Served</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={state.filters.dateRange}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  filters: { ...prev.filters, dateRange: e.target.value }
                }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-shopping-bag-line text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-600 font-medium text-lg">No orders found</p>
              <p className="text-gray-500 text-sm mt-2">
                {state.orders.length === 0 
                  ? "You haven't placed any orders yet" 
                  : "No orders match your current filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedOrders).map(([date, orders]) => (
                <div key={date} className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  
                  {orders.map((order) => (
                    <div key={order._id} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      {/* Order Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">Order #{order.orderNumber}</h4>
                          <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            <i className={`${getStatusIcon(order.status)} mr-1`}></i>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                            {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Items</h5>
                          <div className="space-y-2">
                            {order.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  {item.quantity}x {item.name}
                                  {item.isTakeaway && <span className="text-blue-600 ml-1">(Takeaway)</span>}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {(item.price * item.quantity).toLocaleString()} CFA
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Order Info</h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Restaurant:</span>
                              <span className="font-medium">{order.restaurant.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Order Type:</span>
                              <span className="font-medium capitalize">{order.orderType}</span>
                            </div>
                            {order.table && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Table:</span>
                                <span className="font-medium">#{order.table.tableNumber}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total:</span>
                              <span className="font-bold" style={{ color: primaryColor }}>
                                {order.totalAmount.toLocaleString()} CFA
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => updateOrderStatus(order._id)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-full font-medium hover:bg-gray-300 transition-colors text-sm"
                        >
                          <i className="ri-refresh-line mr-2"></i>
                          Check Status
                        </button>
                        <button
                          onClick={() => {
                            // Add reorder functionality here
                            console.log('Reorder:', order._id);
                          }}
                          className="px-4 py-2 rounded-full font-medium text-white hover:opacity-90 transition-all text-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <i className="ri-shopping-cart-2-line mr-2"></i>
                          Reorder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  const [tempRating, setTempRating] = useState(userRating);
  const [loading, setLoading] = useState(false);

  const primaryColor = restaurant?.theme?.primaryColor || '#FF6B6B';

  const getCustomerId = () => {
    let customerId = localStorage.getItem('customer_id');
    if (!customerId) {
      customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('customer_id', customerId);
    }
    return customerId;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    console.log(`${type}: ${message}`);
  };

  useEffect(() => {
    if (restaurantId) {
      loadRestaurantData();
    }
  }, [restaurantId]);

  useEffect(() => {
    setTempRating(userRating);
  }, [userRating]);

  const loadRestaurantData = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/public/restaurants/${restaurantId}`);
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
      const response = await fetch(`http://localhost:5000/api/public/restaurants/${restaurantId}/rate`, {
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
      
      setRestaurant((prev: any) => ({
        ...prev,
        rating: data.restaurant.rating
      }));
      
      onRatingUpdate(tempRating);
      
      showToast('Restaurant rating submitted successfully!', 'success');
      
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
                  src={`${restaurant.logo}`}
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

// ... (Keep all the existing component code below - MenuItemCard, CartModalContent, RatingModal, CustomerMenuToast, TakeawayModal)

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
  const isTakeawayAvailable = item.takeaway?.isTakeawayAvailable || item.isTakeawayAvailable;
  const takeawayPrice = item.takeaway?.takeawayPrice || item.totalTakeawayPrice;
  const displayPrice = isTakeaway && takeawayPrice ? takeawayPrice : item.price;
  
  const handleAddToCart = () => {
    if (isTakeawayAvailable && quantity === 0) {
      onAddToCart();
    } else {
      onAddToCart();
    }
  };
  
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-36 sm:h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4">
        {item.image ? (
          <img
            src={`${item.image}`}
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
                        src={`${item.image}`}
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
                  src={`${item.image}`}
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
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 400);
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
                  src={`${item.image}`}
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
                Takeaway includes {`${item.takeaway?.packagingFee.toLocaleString()} CFA`} packaging charges
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerMenu;