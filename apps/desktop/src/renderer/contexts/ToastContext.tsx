import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id' | 'createdAt'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id, createdAt: Date.now() };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Toast Container Component
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Individual Toast Component
interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000);

  useEffect(() => {
    if (duration <= 0) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - toast.createdAt;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [toast.createdAt, duration]);

  const config: Record<ToastType, {
    icon: React.ReactNode;
    bg: string;
    iconBg: string;
    progressColor: string;
  }> = {
    success: {
      icon: <Check className="w-4 h-4 text-white" strokeWidth={3} />,
      bg: 'bg-white dark:bg-gray-800',
      iconBg: 'bg-emerald-500',
      progressColor: 'bg-emerald-500',
    },
    error: {
      icon: <X className="w-4 h-4 text-white" strokeWidth={3} />,
      bg: 'bg-white dark:bg-gray-800',
      iconBg: 'bg-red-500',
      progressColor: 'bg-red-500',
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.5} />,
      bg: 'bg-white dark:bg-gray-800',
      iconBg: 'bg-amber-500',
      progressColor: 'bg-amber-500',
    },
    info: {
      icon: <Info className="w-4 h-4 text-white" strokeWidth={2.5} />,
      bg: 'bg-white dark:bg-gray-800',
      iconBg: 'bg-blue-500',
      progressColor: 'bg-blue-500',
    },
  };

  const { icon, bg, iconBg, progressColor } = config[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-start gap-3 px-4 py-3 min-w-[280px] max-w-[380px]
        ${bg} rounded-xl shadow-lg shadow-black/10 dark:shadow-black/30
        border border-gray-100 dark:border-gray-700
        animate-slide-up
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-6 h-6 ${iconBg} rounded-full flex items-center justify-center mt-0.5`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {toast.message}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 -mr-1 -mt-0.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
