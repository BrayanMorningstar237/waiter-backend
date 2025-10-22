export interface MenuItem {
  _id: string;
  name: string;
  description: string;
  image?: string;
  price: number;
  ingredients: string[];
}

export interface Table {
  _id: string;
  tableNumber: string;
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  price: number;
  specialInstructions?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  restaurant: string;
  table?: Table;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  customerNotes?: string;
  preparationTime: number;
  servedAt?: string;
  completedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  today: number;
  total: number;
  byStatus: Array<{
    _id: string;
    count: number;
    totalAmount: number;
  }>;
}