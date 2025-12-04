import React, { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CORRECT_PASSWORD = '61783115';

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setPassword('');
      setError('');
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password === CORRECT_PASSWORD) {
      setIsVisible(false);
      setTimeout(() => {
        onSuccess();
        setPassword('');
      }, 300);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`
          relative bg-[#0f0f10] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full
          transition-all duration-300 transform
          ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-rose-500/20 p-4 rounded-full">
              <Lock className="w-10 h-10 text-rose-500" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">
              Enter Password
            </h2>
            <p className="text-zinc-400">
              This view is protected. Please enter the password to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-center text-lg tracking-wider"
                autoFocus
                autoComplete="off"
              />
              {error && (
                <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
              )}
            </div>

            {/* Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!password.trim()}
                className="w-full px-6 py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-rose-500/20"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


