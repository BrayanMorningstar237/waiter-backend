import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { ToastProvider } from './contexts/ToastContext';

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

  return isAuthenticated ? <Dashboard /> : <Login />;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
    </ToastProvider>
  );
};

export default App;