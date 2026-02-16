
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = "" }) => {
  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl overflow-x-hidden overflow-y-hidden relative ${className}`}>
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        {children}
      </div>
      <footer className="shrink-0 py-1.5 px-3 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
        AI app by Ragul Puhazhendi — for testing purposes only.
      </footer>
    </div>
  );
};
