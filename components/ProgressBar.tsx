
import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
      <div 
        className="h-full bg-gradient-to-r from-[#58CC02] to-[#7ED957] transition-all duration-500 ease-out rounded-full relative"
        style={{ width: `${Math.max(progress, 2)}%` }}
      >
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full"></div>
      </div>
    </div>
  );
};
