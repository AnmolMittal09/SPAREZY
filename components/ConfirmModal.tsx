import React from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false
}) => {
  if (!isOpen) return null;

  const themes = {
    danger: {
      icon: <AlertTriangle className="text-rose-500" size={24} />,
      bg: 'bg-rose-50',
      button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
    },
    warning: {
      icon: <AlertTriangle className="text-amber-500" size={24} />,
      bg: 'bg-amber-50',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
    },
    primary: {
      icon: <CheckCircle2 className="text-brand-600" size={24} />,
      bg: 'bg-brand-50',
      button: 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'
    }
  };

  const theme = themes[variant];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-slide-up border border-slate-100">
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className={`p-4 ${theme.bg} rounded-2xl shadow-inner`}>
              {theme.icon}
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {title}
          </h3>
          <p className="text-slate-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-6 bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-[1.5] px-6 py-4 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${theme.button}`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;