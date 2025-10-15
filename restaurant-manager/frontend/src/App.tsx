import React, { useState } from 'react';
import { testApi } from './services/api';
import type { TestResponse, DatabaseTestResponse, ApiError } from './types';

type TestResult = 
  | { type: 'backend'; data: TestResponse | ApiError }
  | { type: 'database'; data: DatabaseTestResponse | ApiError }
  | null;

function App() {
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [loading, setLoading] = useState<'backend' | 'database' | null>(null);

  const testBackend = async () => {
    setLoading('backend');
    try {
      const data = await testApi.testBackend();
      setTestResult({ type: 'backend', data });
    } catch (error: any) {
      setTestResult({ 
        type: 'backend', 
        data: { error: error.message } 
      });
    }
    setLoading(null);
  };

  const testDatabase = async () => {
    setLoading('database');
    try {
      const data = await testApi.testDatabase();
      setTestResult({ type: 'database', data });
    } catch (error: any) {
      setTestResult({ 
        type: 'database', 
        data: { error: error.message } 
      });
    }
    setLoading(null);
  };

  const getResultStyles = (type: string) => {
    return type === 'backend' 
      ? 'bg-blue-50 border-blue-200 text-blue-800'
      : 'bg-green-50 border-green-200 text-green-800';
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center mb-6">
          <i className="ri-restaurant-2-line text-4xl text-blue-500 mb-4"></i>
          <h1 className="text-2xl font-bold text-gray-800">Restaurant Manager</h1>
          <p className="text-gray-600">Vite + React + TypeScript</p>
        </div>
        
        <div className="space-y-4 mb-6">
          <button 
            onClick={testBackend}
            disabled={!!loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300 transition duration-200 flex items-center justify-center"
          >
            {loading === 'backend' ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                Testing...
              </>
            ) : (
              <>
                <i className="ri-server-line mr-2"></i>
                Test Backend
              </>
            )}
          </button>
          
          <button 
            onClick={testDatabase}
            disabled={!!loading}
            className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-green-300 transition duration-200 flex items-center justify-center"
          >
            {loading === 'database' ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                Testing...
              </>
            ) : (
              <>
                <i className="ri-database-2-line mr-2"></i>
                Test Database
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded border ${getResultStyles(testResult.type)}`}>
            <h3 className="font-semibold mb-2 flex items-center">
              <i className={`ri-${testResult.type === 'backend' ? 'server' : 'database'}-line mr-2`}></i>
              {testResult.type === 'backend' ? 'Backend' : 'Database'} Test Result:
            </h3>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;