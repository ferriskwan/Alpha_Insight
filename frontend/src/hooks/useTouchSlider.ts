import { useState, useCallback, useRef } from 'react';

export interface UseTouchSliderOptions {
  totalCount: number;
  initialStartIdx?: number;
  initialEndIdx?: number;
  onRangeCommit?: (startIdx: number, endIdx: number) => void;
}

export function useTouchSlider({
  totalCount,
  initialStartIdx = 0,
  initialEndIdx = 0,
  onRangeCommit,
}: UseTouchSliderOptions) {
  const [startIndex, setStartIndex] = useState<number>(initialStartIdx);
  const [endIndex, setEndIndex] = useState<number>(initialEndIdx || Math.max(0, totalCount - 1));
  const sliderRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<'start' | 'end' | null>(null);

  const getRelativePosition = useCallback((clientX: number) => {
    if (!sliderRef.current || totalCount <= 1) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * (totalCount - 1));
  }, [totalCount]);

  const handlePointerDown = useCallback((type: 'start' | 'end', clientX: number) => {
    activeDragRef.current = type;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!activeDragRef.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const newIdx = getRelativePosition(currentX);

      if (activeDragRef.current === 'start') {
        setStartIndex((prev) => Math.min(newIdx, endIndex));
      } else {
        setEndIndex((prev) => Math.max(newIdx, startIndex));
      }
    };

    const handlePointerUp = () => {
      activeDragRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);

      setStartIndex((finalStart) => {
        setEndIndex((finalEnd) => {
          if (onRangeCommit) {
            onRangeCommit(finalStart, finalEnd);
          }
          return finalEnd;
        });
        return finalStart;
      });
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  }, [getRelativePosition, startIndex, endIndex, onRangeCommit]);

  const onMouseDownHandle = useCallback((type: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePointerDown(type, e.clientX);
  }, [handlePointerDown]);

  const onTouchStartHandle = useCallback((type: 'start' | 'end') => (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      e.stopPropagation();
      handlePointerDown(type, e.touches[0].clientX);
    }
  }, [handlePointerDown]);

  return {
    sliderRef,
    startIndex,
    setStartIndex,
    endIndex,
    setEndIndex,
    onMouseDownHandle,
    onTouchStartHandle,
  };
}

export default useTouchSlider;
