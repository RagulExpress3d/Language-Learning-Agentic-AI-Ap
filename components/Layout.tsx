
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = "" }) => {
  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl overflow-hidden relative ${className}`}>
      {children}
    </div>
  );
};
