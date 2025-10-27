// src/routes/CustomerRoutes.tsx
import { Routes, Route } from 'react-router-dom';
import RestaurantList from '../components/CustomerApp';
import RestaurantOrder from '../components/OrderManagement';
import CustomerMenu from '../components/CustomerMenu';

const CustomerRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RestaurantList />} />
      <Route path="/restaurants" element={<RestaurantList />} />
      <Route path="/restaurant/:restaurantId/menu" element={<CustomerMenu />} />
      <Route path="/order" element={<RestaurantOrder />} />
      <Route path="/order/:restaurantId" element={<RestaurantOrder />} />
    </Routes>
  );
};

export default CustomerRoutes;