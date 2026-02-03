
import React from 'react';

export const Button: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}> = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => {
  const base = "w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  const variants = {
    primary: "bg-blue-500 text-white shadow-[0_4px_0_0_#2563eb] hover:shadow-[0_2px_0_0_#2563eb] hover:translate-y-[2px]",
    secondary: "bg-white text-blue-500 border-2 border-gray-200 hover:bg-gray-50",
    danger: "bg-red-500 text-white shadow-[0_4px_0_0_#dc2626] hover:shadow-[0_2px_0_0_#dc2626] hover:translate-y-[2px]",
    ghost: "text-gray-500 hover:text-gray-700 font-semibold"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const HeartIcon: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <svg className={`w-6 h-6 ${active ? 'text-red-500 fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 24 24">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

export const XPIcon = () => (
  <div className="bg-yellow-400 text-white font-black px-2 py-0.5 rounded text-xs">XP</div>
);
