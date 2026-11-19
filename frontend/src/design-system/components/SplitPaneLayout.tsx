import React, { useState } from 'react';
import { ArrowLeftRight, X, Layers } from 'lucide-react';

export type SplitLayoutMode = 'single' | 'split-30-70' | 'split-50-50' | 'split-70-30';
export type PaneId = 'left' | 'right';

export interface SplitPaneLayoutProps {
  layoutMode: SplitLayoutMode;
  activeFocusPane: PaneId;
  onFocusPaneChange?: (pane: PaneId) => void;
  onDropOnPane?: (pane: PaneId, menuCode: string, route: string) => void;
  leftTitle?: string;
  rightTitle?: string;
  leftPane: React.ReactNode;
  rightPane?: React.ReactNode;
  onCloseRightPane?: () => void;
  onSwapPanes?: () => void;
  className?: string;
}

export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  layoutMode,
  activeFocusPane,
  onFocusPaneChange,
  onDropOnPane,
  leftTitle = 'Primary Workspace',
  rightTitle = 'Secondary Workspace',
  leftPane,
  rightPane,
  onCloseRightPane,
  onSwapPanes,
  className = '',
}) => {
  const [dragOverLeft, setDragOverLeft] = useState(false);
  const [dragOverRight, setDragOverRight] = useState(false);

  const isSplit = layoutMode !== 'single' && Boolean(rightPane);

  const handleDragOver = (e: React.DragEvent, pane: PaneId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (pane === 'left') setDragOverLeft(true);
    if (pane === 'right') setDragOverRight(true);
  };

  const handleDragLeave = (pane: PaneId) => {
    if (pane === 'left') setDragOverLeft(false);
    if (pane === 'right') setDragOverRight(false);
  };

  const handleDrop = (e: React.DragEvent, pane: PaneId) => {
    e.preventDefault();
    if (pane === 'left') setDragOverLeft(false);
    if (pane === 'right') setDragOverRight(false);

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        const payload = JSON.parse(rawData);
        if (payload.menuCode && payload.route) {
          onDropOnPane?.(pane, payload.menuCode, payload.route);
          return;
        }
      }
    } catch {
      // Fallback for plain text
    }

    const textData = e.dataTransfer.getData('text/plain');
    if (textData) {
      onDropOnPane?.(pane, textData, textData);
    }
  };

  // Width classes based on ratio (desktop only; mobile forces single pane)
  const getPaneWidthClasses = (pane: PaneId): string => {
    if (!isSplit) {
      return pane === 'left' ? 'w-full' : 'hidden';
    }

    switch (layoutMode) {
      case 'split-30-70':
        return pane === 'left' ? 'w-full lg:w-[30%]' : 'w-full lg:w-[70%]';
      case 'split-70-30':
        return pane === 'left' ? 'w-full lg:w-[70%]' : 'w-full lg:w-[30%]';
      case 'split-50-50':
      default:
        return 'w-full lg:w-1/2';
    }
  };

  return (
    <div className={`w-full flex flex-col lg:flex-row gap-4 relative ${className}`}>
      {/* Left / Primary Pane */}
      <section
        aria-label={leftTitle}
        onClick={() => onFocusPaneChange?.('left')}
        onDragOver={(e) => handleDragOver(e, 'left')}
        onDragLeave={() => handleDragLeave('left')}
        onDrop={(e) => handleDrop(e, 'left')}
        className={`flex flex-col min-w-0 transition-all duration-200 relative bg-white border rounded-lg shadow-xs ${
          getPaneWidthClasses('left')
        } ${
          isSplit && activeFocusPane === 'left'
            ? 'border-blue-600 ring-1 ring-blue-600/20'
            : 'border-slate-200'
        }`}
      >
        {/* Pane Sub-Header */}
        {isSplit && (
          <div className="h-9 px-3 border-b border-slate-200 bg-slate-50/75 flex items-center justify-between text-xs select-none rounded-t-lg">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>{leftTitle}</span>
              {activeFocusPane === 'left' && (
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider ml-1">
                  [Active]
                </span>
              )}
            </div>
            {onSwapPanes && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapPanes();
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                title="Swap left and right panes"
                aria-label="Swap panes"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Drag Overlay Cue */}
        {dragOverLeft && (
          <div className="absolute inset-0 bg-blue-50/75 border-2 border-dashed border-blue-600 rounded-lg z-20 flex items-center justify-center pointer-events-none backdrop-blur-xs">
            <span className="px-3 py-1.5 rounded-full bg-blue-600 text-white font-medium text-xs shadow-md">
              Drop to open in Left Pane
            </span>
          </div>
        )}

        {/* Left Pane Content Body */}
        <div className="flex-1 min-w-0 p-3 lg:p-4 overflow-y-auto">{leftPane}</div>
      </section>

      {/* Right / Secondary Pane (Visible only when in split mode on desktop) */}
      {isSplit && (
        <section
          aria-label={rightTitle}
          onClick={() => onFocusPaneChange?.('right')}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={() => handleDragLeave('right')}
          onDrop={(e) => handleDrop(e, 'right')}
          className={`flex flex-col min-w-0 transition-all duration-200 relative bg-white border rounded-lg shadow-xs ${
            getPaneWidthClasses('right')
          } ${
            activeFocusPane === 'right'
              ? 'border-blue-600 ring-1 ring-blue-600/20'
              : 'border-slate-200'
          }`}
        >
          {/* Pane Sub-Header */}
          <div className="h-9 px-3 border-b border-slate-200 bg-slate-50/75 flex items-center justify-between text-xs select-none rounded-t-lg">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>{rightTitle}</span>
              {activeFocusPane === 'right' && (
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider ml-1">
                  [Active]
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onSwapPanes && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwapPanes();
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Swap left and right panes"
                  aria-label="Swap panes"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              )}
              {onCloseRightPane && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseRightPane();
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Close secondary pane"
                  aria-label="Close secondary pane"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Drag Overlay Cue */}
          {dragOverRight && (
            <div className="absolute inset-0 bg-blue-50/75 border-2 border-dashed border-blue-600 rounded-lg z-20 flex items-center justify-center pointer-events-none backdrop-blur-xs">
              <span className="px-3 py-1.5 rounded-full bg-blue-600 text-white font-medium text-xs shadow-md">
                Drop to open in Right Pane
              </span>
            </div>
          )}

          {/* Right Pane Content Body */}
          <div className="flex-1 min-w-0 p-3 lg:p-4 overflow-y-auto">{rightPane}</div>
        </section>
      )}
    </div>
  );
};

export default SplitPaneLayout;
