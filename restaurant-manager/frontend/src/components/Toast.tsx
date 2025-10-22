import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 5000, onClose }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeConfig = {
    success: {
      icon: 'ri-checkbox-circle-line',
      bgColor: 'bg-green-500',
      textColor: 'text-green-500',
      borderColor: 'border-green-200',
      bgLight: 'bg-green-50'
    },
    error: {
      icon: 'ri-error-warning-line',
      bgColor: 'bg-red-500',
      textColor: 'text-red-500',
      borderColor: 'border-red-200',
      bgLight: 'bg-red-50'
    },
    warning: {
      icon: 'ri-alert-line',
      bgColor: 'bg-yellow-500',
      textColor: 'text-yellow-500',
      borderColor: 'border-yellow-200',
      bgLight: 'bg-yellow-50'
    },
    info: {
      icon: 'ri-information-line',
      bgColor: 'bg-blue-500',
      textColor: 'text-blue-500',
      borderColor: 'border-blue-200',
      bgLight: 'bg-blue-50'
    }
  };

  const config = typeConfig[type];

  return (
    <div className={`
      fixed top-4 right-4 z-[100] min-w-80 max-w-md transform transition-all duration-300
      ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
    `}>
      <div className={`
        rounded-xl shadow-lg border ${config.borderColor} ${config.bgLight}
        backdrop-blur-sm bg-white/95 p-4
      `}>
        <div className="flex items-start space-x-3">
          <i className={`${config.icon} ${config.textColor} text-xl mt-0.5`}></i>
          <div className="flex-1">
            <p className="text-gray-900 font-medium text-sm">{message}</p>
          </div>
          <button
            onClick={() => {
              setIsLeaving(true);
              setTimeout(onClose, 300);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1 mt-3">
          <div
            className={`h-1 rounded-full ${config.bgColor} transition-all duration-${duration}`}
            style={{ 
              width: isLeaving ? '0%' : '100%',
              transition: `width ${duration}ms linear`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Toast;