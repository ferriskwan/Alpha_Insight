import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SwipeableKpiStripProps {
  children: React.ReactNode;
  className?: string;
  columns?: number;
}

export const SwipeableKpiStrip: React.FC<SwipeableKpiStripProps> = ({
  children,
  className,
  columns = 5,
}) => {
  const columnClasses: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'flex overflow-x-auto pb-2 -mx-3 px-3 md:mx-0 md:px-0 md:pb-0 gap-3 snap-x snap-mandatory scroll-smooth no-scrollbar md:grid',
          columnClasses[columns] || 'md:grid-cols-5',
          className
        )
      )}
    >
      {React.Children.map(children, (child) => (
        <div className="snap-start shrink-0 w-[200px] md:w-auto">{child}</div>
      ))}
    </div>
  );
};

export default SwipeableKpiStrip;
