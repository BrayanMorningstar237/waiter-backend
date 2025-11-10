// hooks/useMenu.ts - QUICK FIX
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Define MenuItem locally
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  isAvailable: boolean;
}

export const useMenu = () => {
  const { restaurant, updateRestaurantSettings } = useAuth();
  
  // Access menuItems with type assertion
  const menuItems = (restaurant as any)?.menuItems || [];

  const addMenuItem = useCallback(async (newItem: MenuItem) => {
    if (!restaurant) throw new Error('No restaurant data available');
    
    const updatedMenuItems = [...menuItems, newItem];
    await updateRestaurantSettings({ 
      menuItems: updatedMenuItems 
    } as any);
  }, [restaurant, updateRestaurantSettings, menuItems]);

  const updateMenuItem = useCallback(async (itemId: string, updates: Partial<MenuItem>) => {
    if (!restaurant) throw new Error('No restaurant data available');
    
    const updatedMenuItems = menuItems.map((item: MenuItem) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    
    await updateRestaurantSettings({ 
      menuItems: updatedMenuItems 
    } as any);
  }, [restaurant, updateRestaurantSettings, menuItems]);

  const deleteMenuItem = useCallback(async (itemId: string) => {
    if (!restaurant) throw new Error('No restaurant data available');
    
    const updatedMenuItems = menuItems.filter((item: MenuItem) => item.id !== itemId);
    await updateRestaurantSettings({ 
      menuItems: updatedMenuItems 
    } as any);
  }, [restaurant, updateRestaurantSettings, menuItems]);

  return {
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    hasMenu: menuItems.length > 0
  };
};