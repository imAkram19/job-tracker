import React from 'react';
import { BookmarkCheck } from 'lucide-react';

interface ReviewBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const ReviewBadge: React.FC<ReviewBadgeProps> = ({ 
  className = '',
  size = 'xs'
}) => {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-0.5 text-[11px] gap-1.5',
    md: 'px-3 py-1 text-xs gap-1.5',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs tracking-wide uppercase ${sizeClasses[size]} ${className}`}
      title="Job marked for review"
    >
      <BookmarkCheck className={`${iconSizes[size]} text-indigo-600 shrink-0`} />
      <span>Review</span>
    </span>
  );
};
