// src/components/CustomerMenuToast.tsx
import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CustomerMenuToastProps {
  message: string;
  type: ToastType;
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
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
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
    <div className={`
      fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] 
      min-w-80 max-w-md transition-all duration-300
      ${isLeaving ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
    `}>
      <div 
        className="rounded-2xl shadow-2xl border-2 backdrop-blur-sm bg-white/95 p-6 text-center"
        style={{ 
          borderColor: primaryColor + '40',
          boxShadow: `0 20px 25px -5px ${primaryColor}20, 0 10px 10px -5px ${primaryColor}10`
        }}
      >
        <div className="flex flex-col items-center space-y-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryColor + '20' }}
          >
            <i 
              className={`${config.icon} text-xl`}
              style={{ color: primaryColor }}
            ></i>
          </div>
          <p 
            className="font-semibold text-lg"
            style={{ color: primaryColor }}
          >
            {message}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ 
              width: isLeaving ? '0%' : '100%',
              backgroundColor: primaryColor,
              transition: `width ${duration}ms linear`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerMenuToast;