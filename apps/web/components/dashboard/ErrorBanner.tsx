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
    <div
      className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" aria-hidden="true" />

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
            focus:ring-2 focus:ring-offset-2 focus:ring-rose-600
            focus:outline-none
          `}
          aria-label="Reintentar"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
            focus:ring-2 focus:ring-offset-2 focus:ring-rose-600
            focus:outline-none
          `}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
