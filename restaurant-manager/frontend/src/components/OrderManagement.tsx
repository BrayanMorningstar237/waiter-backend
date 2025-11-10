import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { Order, OrderStatus } from '../types';

interface OrderManagementProps {
  selectedOrderId?: string | null;
  autoScroll?: boolean;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ selectedOrderId, autoScroll = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsTimeRange, setStatsTimeRange] = useState<string>('today');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [recentlyPaidId, setRecentlyPaidId] = useState<string | null>(null);
  const [showRipple, setShowRipple] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Memoized filtered orders for better performance
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesPayment = activeTab === 'paid' 
        ? order.paymentStatus === 'paid' 
        : order.paymentStatus === 'pending';
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const matchesTable = !tableFilter || 
        (order.table && order.table.tableNumber.toLowerCase().includes(tableFilter.toLowerCase()));
      return matchesPayment && matchesStatus && matchesTable;
    });
  }, [orders, activeTab, selectedStatus, tableFilter]);

  const unpaidCount = useMemo(() => 
    orders.filter(o => o.paymentStatus === 'pending').length, 
    [orders]
  );
  
  const paidCount = useMemo(() => 
    orders.filter(o => o.paymentStatus === 'paid').length, 
    [orders]
  );

  // Optimized load function
  const loadOrders = useCallback(async () => {
    if (!user) {
      showError('No user found');
      return;
    }

    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`http://localhost:5000/api/orders?status=all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ Failed to load orders:', error);
        showError(`Failed to load orders: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auto-scroll effect - optimized with dependency array
  useEffect(() => {
    if (selectedOrderId && autoScroll && filteredOrders.length > 0) {
      const timer = setTimeout(() => {
        const orderElement = document.getElementById(`order-${selectedOrderId}`);
        if (orderElement) {
          orderElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          orderElement.classList.add('animate-pulse-green');
          setTimeout(() => {
            orderElement.classList.remove('animate-pulse-green');
          }, 3000);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [selectedOrderId, autoScroll, filteredOrders.length]); // Only depend on length, not the entire array

  // Optimized status update
  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    try {
      // Optimistic update
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, status: newStatus } : order
      ));

      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error(`Failed to update order: ${response.status}`);

      const updatedOrder = await response.json();
      
      // Final update with server data
      setOrders(prev => prev.map(order => 
        order._id === orderId ? updatedOrder.order : order
      ));
      
      showSuccess(`Order updated to ${newStatus}`);
    } catch (error: any) {
      // Revert optimistic update on error
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, status: orders.find(o => o._id === orderId)?.status || 'pending' } : order
      ));
      
      console.error('❌ Failed to update order status:', error);
      showError(`Failed to update order: ${error.message}`);
    }
  }, [showSuccess, showError, orders]);

  // Optimized payment actions with better state transitions
  const markAsPaid = useCallback(async (orderId: string) => {
    try {
      // Optimistic update - immediately move to paid state
      const orderToMove = orders.find(order => order._id === orderId);
      if (!orderToMove) return;

      const updatedOrder = { ...orderToMove, paymentStatus: 'paid' as const };
      
      setOrders(prev => {
        const filtered = prev.filter(order => order._id !== orderId);
        return [updatedOrder, ...filtered];
      });
      
      setRecentlyPaidId(orderId);
      setShowRipple(true);
      
      // Switch to paid tab after a short delay
      setTimeout(() => {
        setShowRipple(false);
        setActiveTab('paid');
      }, 600);
      
      setTimeout(() => setRecentlyPaidId(null), 3000);
      
      // Backend update
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/pay`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Failed to mark as paid: ${response.status}`);

      const serverUpdatedOrder = await response.json();
      
      // Final sync with server data
      setOrders(prev => prev.map(order => 
        order._id === orderId ? serverUpdatedOrder.order : order
      ));
      
      showSuccess('Order marked as paid!');
    } catch (error: any) {
      // Revert optimistic update on error
      setOrders(prev => {
        const orderToRevert = orders.find(order => order._id === orderId);
        if (!orderToRevert) return prev;
        
        return prev.map(order => 
          order._id === orderId ? { ...order, paymentStatus: 'pending' } : order
        );
      });
      
      console.error('❌ Failed to mark order as paid:', error);
      showError(`Failed to mark as paid: ${error.message}`);
    }
  }, [showSuccess, showError, orders]);

  const markAsUnpaid = useCallback(async (orderId: string) => {
    try {
      // Optimistic update
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, paymentStatus: 'pending' } : order
      ));

      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/unpay`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Failed to mark as unpaid: ${response.status}`);

      const updatedOrder = await response.json();
      
      // Final update with server data
      setOrders(prev => prev.map(order => 
        order._id === orderId ? updatedOrder.order : order
      ));
      
      showSuccess('Order marked as unpaid');
    } catch (error: any) {
      // Revert optimistic update
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, paymentStatus: orders.find(o => o._id === orderId)?.paymentStatus || 'pending' } : order
      ));
      
      console.error('❌ Failed to mark order as unpaid:', error);
      showError(`Failed to mark as unpaid: ${error.message}`);
    }
  }, [showSuccess, showError, orders]);

  // Stats functions - memoized to prevent unnecessary recalculations
  const loadStats = useCallback(async (timeRange: string = 'today') => {
    try {
      setStatsLoading(true);
      
      let statsOrders = orders.filter(o => o.paymentStatus === 'paid');
      if (timeRange === 'custom' && showCustomDateRange) {
        const startDate = new Date(customDateRange.start);
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        statsOrders = statsOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });
      } else if (timeRange !== 'all') {
        statsOrders = filterOrdersByTimeRange(statsOrders, timeRange);
      }
      
      const stats = calculateStats(statsOrders);
      setStatsData(stats);
    } catch (error: any) {
      console.error('❌ Failed to load stats:', error);
      showError(`Failed to load statistics: ${error.message}`);
    } finally {
      setStatsLoading(false);
    }
  }, [orders, customDateRange, showCustomDateRange, showError]);

  const filterOrdersByTimeRange = (orders: Order[], timeRange: string): Order[] => {
    const now = new Date();
    
    switch (timeRange) {
      case '6hours':
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        return orders.filter(order => new Date(order.createdAt) >= sixHoursAgo);
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orders.filter(order => new Date(order.createdAt) >= todayStart);
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orders.filter(order => new Date(order.createdAt) >= weekAgo);
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return orders.filter(order => new Date(order.createdAt) >= monthAgo);
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return orders.filter(order => new Date(order.createdAt) >= yearAgo);
      default:
        return orders;
    }
  };

  const calculateStats = (filteredOrders: Order[]) => {
    const paidOrders = filteredOrders.filter(order => order.paymentStatus === 'paid');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    const itemCounts: { [key: string]: { name: string; count: number; revenue: number } } = {};
    paidOrders.forEach(order => {
      order.items.forEach(item => {
        const itemName = item.menuItem?.name || 'Unknown Item';
        if (!itemCounts[itemName]) {
          itemCounts[itemName] = { name: itemName, count: 0, revenue: 0 };
        }
        itemCounts[itemName].count += item.quantity;
        itemCounts[itemName].revenue += item.quantity * item.price;
      });
    });

    const bestSeller = Object.values(itemCounts).sort((a, b) => b.count - a.count)[0];
    const customerSpending: { [key: string]: { name: string; total: number; orders: number } } = {};
    paidOrders.forEach(order => {
      const customerName = order.customerName || 'Anonymous';
      if (!customerSpending[customerName]) {
        customerSpending[customerName] = { name: customerName, total: 0, orders: 0 };
      }
      customerSpending[customerName].total += order.totalAmount;
      customerSpending[customerName].orders += 1;
    });

    const highestPayingCustomer = Object.values(customerSpending).sort((a, b) => b.total - a.total)[0];
    const mostExpensiveOrder = paidOrders.sort((a, b) => b.totalAmount - a.totalAmount)[0];

    return {
      totalRevenue,
      totalOrders: paidOrders.length,
      bestSeller,
      highestPayingCustomer,
      mostExpensiveOrder,
      timeRangeOrders: filteredOrders.length,
      filteredOrders
    };
  };

  const openStatsModal = useCallback(async () => {
    setShowStatsModal(true);
    await loadStats(statsTimeRange);
  }, [loadStats, statsTimeRange]);

  const handleTimeRangeChange = useCallback(async (range: string) => {
    setStatsTimeRange(range);
    if (range === 'custom') {
      setShowCustomDateRange(true);
    } else {
      setShowCustomDateRange(false);
      await loadStats(range);
    }
  }, [loadStats]);

  // Memoized total revenue calculation
  const totalRevenue = useMemo(() => 
    orders
      .filter(order => order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + order.totalAmount, 0),
    [orders]
  );

  // YouTube-style loading component
  if (loading) {
    return <OrderManagementSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
        
        {/* Compact Header */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <i className="ri-restaurant-2-line text-green-600 text-xl"></i>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Orders</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-500">{orders.length} total orders</span>
                <span className="text-lg font-bold bg-gradient-to-r from-green-700 to-green-600 bg-clip-text text-transparent">
                  Revenue: {totalRevenue.toLocaleString()} CFA
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openStatsModal}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1 sm:gap-2 text-sm font-semibold"
              >
                <i className="ri-bar-chart-line"></i>
                <span className="hidden sm:inline">Analytics</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 sm:px-4 py-2 rounded-xl transition-all flex items-center gap-1 sm:gap-2 text-sm font-semibold ${
                  showFilters 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className="ri-filter-3-line"></i>
                <span className="hidden sm:inline">Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Payment Status Tabs */}
        <PaymentTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unpaidCount={unpaidCount}
          paidCount={paidCount}
          showRipple={showRipple}
        />

        {/* Compact Filters */}
        {showFilters && (
          <OrderFilters
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            tableFilter={tableFilter}
            setTableFilter={setTableFilter}
          />
        )}

        {/* Orders Grid */}
        <OrdersGrid
          orders={filteredOrders}
          activeTab={activeTab}
          selectedStatus={selectedStatus}
          tableFilter={tableFilter}
          selectedOrderId={selectedOrderId}
          recentlyPaidId={recentlyPaidId}
          onUpdateStatus={updateOrderStatus}
          onMarkAsPaid={markAsPaid}
          onMarkAsUnpaid={markAsUnpaid}
        />
      </div>

      {/* Statistics Modal */}
      {showStatsModal && (
        <StatsModal
          statsData={statsData}
          loading={statsLoading}
          timeRange={statsTimeRange}
          customDateRange={customDateRange}
          showCustomDateRange={showCustomDateRange}
          onTimeRangeChange={handleTimeRangeChange}
          onCustomDateRangeChange={setCustomDateRange}
          onApplyCustomRange={() => loadStats('custom')}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        
        .animate-fade-in {
          animation: fade-in-up 0.2s ease-out forwards;
        }
        
        @keyframes pulse-green {
          0%, 100% {
            background-color: rgb(240 253 244);
          }
          50% {
            background-color: rgb(220 252 231);
          }
        }
        
        .animate-pulse-green {
          animation: pulse-green 2s ease-in-out;
        }

        @keyframes highlight-blue {
          0%, 100% {
            background-color: rgb(239 246 255);
          }
          50% {
            background-color: rgb(219 234 254);
          }
        }
        
        .animate-highlight-blue {
          animation: highlight-blue 2s ease-in-out;
        }
      `}</style>
    </div>
  );
};

// Memoized Sub-Components to prevent unnecessary re-renders

const OrderManagementSkeleton = memo(() => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white">
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
      {/* Header Skeleton */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-10 w-24 bg-gray-200 rounded-xl animate-pulse"></div>
            <div className="h-10 w-24 bg-gray-200 rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-2">
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
      </div>

      {/* Order Cards Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3 flex-1">
                <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-gray-200 rounded"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex-1 h-10 bg-gray-200 rounded-xl"></div>
              <div className="w-24 h-10 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));

interface PaymentTabsProps {
  activeTab: 'unpaid' | 'paid';
  setActiveTab: (tab: 'unpaid' | 'paid') => void;
  unpaidCount: number;
  paidCount: number;
  showRipple: boolean;
}

const PaymentTabs = memo(({ activeTab, setActiveTab, unpaidCount, paidCount, showRipple }: PaymentTabsProps) => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-2">
    <div className="flex gap-2">
      <button
        onClick={() => setActiveTab('unpaid')}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 
        rounded-xl font-semibold transition-all text-sm sm:text-base whitespace-nowrap
        ${activeTab === 'unpaid'
          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-[1.02]'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
      >
        <i className="ri-time-line"></i>
        <span>Unpaid</span>
        {unpaidCount > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold
            ${activeTab === 'unpaid'
              ? 'bg-white text-orange-500'
              : 'bg-orange-100 text-orange-600'
            }`}
          >
            {unpaidCount}
          </span>
        )}
      </button>
      
      <button
        onClick={() => setActiveTab('paid')}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 
        rounded-xl font-semibold transition-all text-sm sm:text-base whitespace-nowrap
        ${activeTab === 'paid'
          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-[1.02]'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
      >
        {showRipple && (
          <span className="absolute inset-0 rounded-xl bg-green-400 animate-ping opacity-75"></span>
        )}
        <i className="ri-checkbox-circle-line"></i>
        <span>Paid</span>
        {paidCount > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold
            ${activeTab === 'paid'
              ? 'bg-white text-green-500'
              : 'bg-green-100 text-green-600'
            }`}
          >
            {paidCount}
          </span>
        )}
      </button>
    </div>
  </div>
));

interface OrderFiltersProps {
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  tableFilter: string;
  setTableFilter: (filter: string) => void;
}

const OrderFilters = memo(({ selectedStatus, setSelectedStatus, tableFilter, setTableFilter }: OrderFiltersProps) => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 animate-fade-in">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Status Filter */}
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="served">Served</option>
        </select>
      </div>

      {/* Table Filter */}
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">Table Number</label>
        <input
          type="text"
          placeholder="Search table..."
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
        />
      </div>
    </div>
  </div>
));

interface OrdersGridProps {
  orders: Order[];
  activeTab: 'unpaid' | 'paid';
  selectedStatus: string;
  tableFilter: string;
  selectedOrderId?: string | null;
  recentlyPaidId: string | null;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onMarkAsPaid: (orderId: string) => void;
  onMarkAsUnpaid: (orderId: string) => void;
}

const OrdersGrid = memo(({ 
  orders, 
  activeTab, 
  selectedStatus, 
  tableFilter, 
  selectedOrderId, 
  recentlyPaidId, 
  onUpdateStatus, 
  onMarkAsPaid, 
  onMarkAsUnpaid 
}: OrdersGridProps) => {
  if (orders.length === 0) {
    return (
      <div className="col-span-full bg-white rounded-2xl p-8 text-center shadow-md border border-gray-100">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <i className="ri-shopping-bag-line text-4xl text-gray-300"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No {activeTab} orders</h3>
        <p className="text-sm text-gray-500">
          {selectedStatus !== 'all' || tableFilter
            ? 'Try adjusting your filters' 
            : `No ${activeTab} orders available`
          }
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {orders.map((order, index) => (
        <OrderCard
          key={order._id}
          order={order}
          onUpdateStatus={onUpdateStatus}
          onMarkAsPaid={onMarkAsPaid}
          onMarkAsUnpaid={onMarkAsUnpaid}
          isRecentlyPaid={order._id === recentlyPaidId}
          isSelected={order._id === selectedOrderId}
          animationDelay={index * 50}
        />
      ))}
    </div>
  );
});

// Order Card Component (memoized)
interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onMarkAsPaid: (orderId: string) => void;
  onMarkAsUnpaid: (orderId: string) => void;
  isRecentlyPaid?: boolean;
  isSelected?: boolean;
  animationDelay?: number;
}

const OrderCard = memo(({ 
  order, 
  onUpdateStatus, 
  onMarkAsPaid, 
  onMarkAsUnpaid,
  isRecentlyPaid = false,
  isSelected = false,
  animationDelay = 0
}: OrderCardProps) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [isExpanded, setIsExpanded] = useState(false);

  const statusOptions: OrderStatus[] = [
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'
  ];

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-orange-100 text-orange-800',
      ready: 'bg-green-100 text-green-800',
      served: 'bg-teal-100 text-teal-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<OrderStatus, string> = {
      pending: 'ri-time-line',
      confirmed: 'ri-checkbox-circle-line',
      preparing: 'ri-restaurant-line',
      ready: 'ri-check-double-line',
      served: 'ri-user-line',
      completed: 'ri-check-line',
      cancelled: 'ri-close-circle-line'
    };
    return icons[status] || 'ri-question-line';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStatusChange = (newStatus: string) => {
    const typedStatus = newStatus as OrderStatus;
    setSelectedStatus(typedStatus);
    onUpdateStatus(order._id, typedStatus);
  };

  return (
    <div 
      id={`order-${order._id}`}
      className={`bg-white rounded-2xl shadow-md border-2 transition-all overflow-hidden animate-fade-in-up ${
        isRecentlyPaid 
          ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 animate-pulse-green' 
          : isSelected
          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 animate-highlight-blue'
          : 'border-gray-100 hover:shadow-lg hover:border-gray-200'
      }`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      
      {/* Status Badges */}
      {(isRecentlyPaid || isSelected) && (
        <div className={`px-4 py-2 flex items-center justify-center space-x-2 text-sm font-bold ${
          isRecentlyPaid 
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
        }`}>
          <i className={`${isRecentlyPaid ? 'ri-checkbox-circle-fill animate-bounce' : 'ri-arrow-right-line animate-pulse'}`}></i>
          <span>{isRecentlyPaid ? 'Just Paid!' : 'Selected Order'}</span>
          <i className={`${isRecentlyPaid ? 'ri-checkbox-circle-fill animate-bounce' : 'ri-arrow-left-line animate-pulse'}`}></i>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`p-2.5 rounded-xl ${getStatusColor(order.status)}`}>
              <i className={`${getStatusIcon(order.status)} text-lg`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-base">#{order.orderNumber}</h3>
              <p className="text-xs text-gray-500">{formatTime(order.createdAt)}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                {order.table && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {order.table.tableNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              {order.totalAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">CFA</div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex items-center space-x-2 text-sm">
            <i className="ri-user-line text-gray-400"></i>
            <span className="font-medium text-gray-700">{order.customerName || 'Walk-in'}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 capitalize">{order.orderType}</span>
          </div>
        </div>

        {/* Items Preview */}
        <div className="space-y-2 mb-3">
          {order.items.slice(0, isExpanded ? undefined : 2).map((item: any) => (
            <div key={item._id} className="flex items-center space-x-3 p-2 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
              {/* Item Image */}
              <div className="flex-shrink-0">
                {item.menuItem?.image ? (
                  <img
                    src={`${item.menuItem.image}`}
                    alt={item.menuItem.name}
                    className="w-12 h-12 object-cover rounded-lg shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-lg flex items-center justify-center shadow-md">
                    <i className="ri-restaurant-line text-orange-600 text-lg"></i>
                  </div>
                )}
              </div>
              
              {/* Item Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {item.menuItem?.name}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-orange-600">{item.quantity}x</span> @ {item.price.toLocaleString()} CFA
                </p>
                {item.specialInstructions && (
                  <p className="text-xs text-blue-600 italic mt-0.5 line-clamp-1">
                    <i className="ri-takeaway-line"></i> {item.specialInstructions}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">
                  {(item.quantity * (item.price)).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">CFA</p>
              </div>
            </div>
          ))}
          
          {order.items.length > 2 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-2 text-xs font-medium text-yellow-600 hover:text-yellow-700 transition-colors flex items-center justify-center space-x-1"
            >
              <span>{isExpanded ? 'Show Less' : `Show ${order.items.length - 2} More Items`}</span>
              <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
          <select
            value={selectedStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          {order.paymentStatus === 'pending' && order.status !== 'cancelled' && (
            <button
              onClick={() => onMarkAsPaid(order._id)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-1 text-sm"
            >
              <i className="ri-checkbox-circle-line"></i>
              <span>Mark Paid</span>
            </button>
          )}
          
          {order.paymentStatus === 'paid' && (
            <button
              onClick={() => onMarkAsUnpaid(order._id)}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-1 text-sm"
            >
              <i className="ri-close-circle-line"></i>
              <span>Mark Unpaid</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Stats Modal Component
interface StatsModalProps {
  statsData: any;
  loading: boolean;
  timeRange: string;
  customDateRange: {start: string, end: string};
  showCustomDateRange: boolean;
  onTimeRangeChange: (range: string) => void;
  onCustomDateRangeChange: (range: {start: string, end: string}) => void;
  onApplyCustomRange: () => void;
  onClose: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({
  statsData,
  loading,
  timeRange,
  customDateRange,
  showCustomDateRange,
  onTimeRangeChange,
  onCustomDateRangeChange,
  onApplyCustomRange,
  onClose
}) => {
  const timeRangeOptions = [
    { value: '6hours', label: '6 Hours' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 p-4 sm:p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <i className="ri-bar-chart-line text-white text-xl"></i>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Analytics Dashboard</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-xl transition-all flex items-center justify-center"
            >
              <i className="ri-close-line text-white text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Time Range Selector */}
          <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1">
            {timeRangeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => onTimeRangeChange(option.value)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all whitespace-nowrap text-sm ${
                  timeRange === option.value
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {showCustomDateRange && (
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
              <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                <i className="ri-calendar-line mr-2 text-orange-500"></i>
                Custom Date Range
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => onCustomDateRangeChange({...customDateRange, start: e.target.value})}
                    className="w-full px-3 py-2 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => onCustomDateRangeChange({...customDateRange, end: e.target.value})}
                    className="w-full px-3 py-2 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-sm"
                  />
                </div>
                <button
                  onClick={onApplyCustomRange}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all text-sm h-10"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="flex space-x-2 justify-center items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <p className="text-gray-600 mt-4">Loading analytics...</p>
              </div>
            </div>
          ) : statsData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Revenue Card */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <i className="ri-money-dollar-circle-line text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Total Revenue</p>
                    <p className="text-2xl sm:text-3xl font-bold">{statsData.totalRevenue?.toLocaleString()}</p>
                    <p className="text-xs opacity-75">CFA</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white border-opacity-20">
                  <p className="text-sm opacity-90">{statsData.totalOrders} paid orders</p>
                </div>
              </div>

              {/* Orders Card */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <i className="ri-shopping-bag-line text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Total Orders</p>
                    <p className="text-2xl sm:text-3xl font-bold">{statsData.timeRangeOrders}</p>
                    <p className="text-xs opacity-75">orders</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white border-opacity-20">
                  <p className="text-sm opacity-90">All orders in period</p>
                </div>
              </div>

              {/* Best Seller */}
              {statsData.bestSeller && (
                <div className="bg-white rounded-2xl p-5 border-2 border-yellow-200 shadow-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <i className="ri-trophy-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Best Seller</h3>
                      <p className="text-xs text-gray-500">Top performing item</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-gray-900">{statsData.bestSeller.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">{statsData.bestSeller.count} sold</span>
                      <span className="text-sm font-semibold text-orange-600">
                        {statsData.bestSeller.revenue.toLocaleString()} CFA
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Customer */}
              {statsData.highestPayingCustomer && (
                <div className="bg-white rounded-2xl p-5 border-2 border-purple-200 shadow-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <i className="ri-user-star-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Top Customer</h3>
                      <p className="text-xs text-gray-500">Highest spending</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-gray-900">{statsData.highestPayingCustomer.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">{statsData.highestPayingCustomer.orders} orders</span>
                      <span className="text-sm font-semibold text-purple-600">
                        {statsData.highestPayingCustomer.total.toLocaleString()} CFA
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Most Expensive Order */}
              {statsData.mostExpensiveOrder && (
                <div className="bg-white rounded-2xl p-5 border-2 border-orange-200 shadow-lg sm:col-span-2">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                      <i className="ri-vip-crown-line text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Most Expensive Order</h3>
                      <p className="text-xs text-gray-500">Highest value order</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          Order #{statsData.mostExpensiveOrder.orderNumber}
                        </p>
                        <p className="text-sm text-gray-600">
                          {statsData.mostExpensiveOrder.customerName} • {statsData.mostExpensiveOrder.items.length} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {statsData.mostExpensiveOrder.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">CFA</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-bar-chart-line text-4xl text-gray-300"></i>
              </div>
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderManagement;