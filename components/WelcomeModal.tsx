import React, { useEffect, useState } from 'react';
import { Heart, X, Video } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in after mount
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Wait for animation
  };

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
          relative bg-[#0f0f10] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full
          transition-all duration-300 transform
          ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
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
            <div className="bg-purple-500/20 p-4 rounded-full">
              <Heart className="w-10 h-10 text-purple-500 fill-current" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">
              Celebrate Naia! 🎓
            </h2>
            
            <div className="space-y-3 text-zinc-300 leading-relaxed">
              <p>
                Naia is graduating from <strong>Georgia Tech</strong> on <strong>December 11th at 4 PM</strong>!
              </p>
              <p>
                We're collecting video messages to surprise her at her graduation dinner. Please record a short video sharing your congratulations, a favorite memory, or your best advice for her next chapter.
              </p>
              <p className="text-rose-400/90 font-medium">
                Let's make her graduation celebration unforgettable!
              </p>
            </div>

            {/* CTA */}
            <div className="pt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Video className="w-4 h-4" />
              <span>Click the upload button above to add your message</span>
            </div>
          </div>

          {/* Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-rose-500/20"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

