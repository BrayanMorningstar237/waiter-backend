// In your CustomerRoutes.tsx
import { Routes, Route } from 'react-router-dom';
import RestaurantList from '../components/CustomerApp';
import RestaurantOrder from '../components/OrderManagement';
// import RestaurantList from '../components/RestaurantsList'; // Add this import

const CustomerRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RestaurantList />} />
      <Route path="/order" element={<RestaurantOrder />} />
      <Route path="/order/:restaurantId" element={<RestaurantOrder />} />
      <Route path="/restaurants" element={<RestaurantList />} /> {/* Add this route */}
    </Routes>
  );
};

export default CustomerRoutes;