// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CustomerRoutes from './routes/CustomerRoutes';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Restaurant Manager...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Customer-facing routes */}
      <Route path="/waiter/*" element={<CustomerRoutes />} />

      {/* Authenticated dashboard routes */}
      {isAuthenticated ? (
        <Route path="/*" element={<Dashboard />} />
      ) : (
        <Route path="/*" element={<Login />} />
      )}
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;
