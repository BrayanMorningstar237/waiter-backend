import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import type { LoginCredentials } from '../types';

const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(credentials);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  // Sample login credentials for testing
  const sampleCredentials = [
    { email: 'admin@bellafoodsbuea.com', password: 'pass1', name: 'Bella Foods Buea', color: 'bg-blue-600' },
    { email: 'admin@mountgrill.com', password: 'pass2', name: 'Mount Cameroon Grill', color: 'bg-green-600' },
    { email: 'admin@fakodelights.com', password: 'pass3', name: 'Fako Delights', color: 'bg-purple-600' }
  ];

  const fillSampleCredentials = (index: number) => {
    const sample = sampleCredentials[index];
    setCredentials({
      email: sample.email,
      password: sample.password
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
      <img
        src={logo}
        alt="App Logo"
        className="h-16 w-16 object-cover rounded-full"
      />
    </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Waiter Manager
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage Your Menu From anywhere, Anytime
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <i className="ri-error-warning-line mr-2"></i>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={credentials.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-200"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={credentials.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-200"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition duration-200 transform hover:scale-105"
              >
                {isLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="ri-login-box-line mr-2"></i>
                    Sign in to Dashboard
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Sample credentials for testing */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Test Restaurant Accounts</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {sampleCredentials.map((cred, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => fillSampleCredentials(index)}
                  className="w-full text-left p-4 text-sm rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 group-hover:text-green-600 transition duration-200">
                        {cred.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {cred.email}
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${cred.color}`}></div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Use any test account above to explore the system
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;