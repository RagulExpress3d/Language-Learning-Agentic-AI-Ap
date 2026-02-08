
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = "" }) => {
  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl overflow-x-hidden overflow-y-hidden relative ${className}`}>
      {children}
    </div>
  );
};
