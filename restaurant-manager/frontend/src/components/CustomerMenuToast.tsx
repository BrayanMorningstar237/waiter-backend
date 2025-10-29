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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in
    setIsVisible(true);
    // Slide out after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 400); // wait for animation to end
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
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
        transition-all duration-500 ease-in-out
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}
      `}
    >
      <div 
        className="w-full flex items-center gap-3 px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm bg-white/95 border"
        style={{
          borderColor: primaryColor + '40',
          boxShadow: `0 10px 20px -5px ${primaryColor}25`,
        }}
      >
        <i 
          className={`${config.icon} text-lg`}
          style={{ color: primaryColor }}
        ></i>
        <p className="font-medium text-sm" style={{ color: primaryColor }}>
          {message}
        </p>
      </div>
    </div>
  );
};

export default CustomerMenuToast;
