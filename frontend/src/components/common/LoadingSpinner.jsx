import React from 'react';

export const LoadingSpinner = ({ size = 'md', text = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-4',
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-current border-t-transparent rounded-full animate-spin`}
      />
      {text && <span className="text-sm font-medium">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
