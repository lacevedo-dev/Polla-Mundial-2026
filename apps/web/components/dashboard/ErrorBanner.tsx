import React, { useState } from 'react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  dismissable?: boolean;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  dismissable = true,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />

      <p className="flex-1 text-sm font-medium text-rose-700">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-semibold
            transition-colors duration-200
            flex-shrink-0
          `}
          aria-label="Reintentar"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reintentar</span>
        </button>
      )}

      {dismissable && (
        <button
          onClick={handleDismiss}
          className={`
            p-1.5 rounded-lg hover:bg-rose-100
            text-rose-600 hover:text-rose-700
            transition-colors duration-200
            flex-shrink-0
          `}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
