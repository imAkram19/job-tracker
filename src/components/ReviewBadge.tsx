import React from 'react';
import { Bookmark } from 'lucide-react';

interface ReviewBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const ReviewBadge: React.FC<ReviewBadgeProps> = ({ 
  className = '',
  size = 'xs'
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center font-normal rounded-md bg-[#fffbeb] text-[#92400e] border border-[rgba(217,119,6,0.2)] ${sizeClasses[size]} ${className}`}
      title="Job marked for review"
    >
      <Bookmark className={`${iconSizes[size]} text-[#d97706] shrink-0`} />
      <span>Review</span>
    </span>
  );
};
