import React, { useState } from 'react';
import { LayoutGrid, Table as TableIcon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  mobileHidden?: boolean;
}

export interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  allowViewToggle?: boolean;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  loading = false,
  className,
  allowViewToggle = true,
}: ResponsiveTableProps<T>) {
  // Mobile mode: 'card' or 'table'
  const [mobileView, setMobileView] = useState<'card' | 'table'>('card');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-secondary">
        <Loader2 className="w-6 h-6 animate-spin text-accent-primary mb-2" />
        <span className="text-xs">Loading records...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted border border-subtle/50 rounded-lg bg-surface-elevated/20">
        <span className="text-xs">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={twMerge(clsx('flex flex-col w-full', className))}>
      {allowViewToggle && (
        <div className="sm:hidden flex justify-end mb-2">
          <div className="inline-flex rounded-md p-0.5 bg-surface-elevated border border-subtle">
            <button
              type="button"
              onClick={() => setMobileView('card')}
              className={clsx(
                'p-1.5 rounded text-xs transition-colors',
                mobileView === 'card'
                  ? 'bg-bento-card text-accent-primary shadow'
                  : 'text-muted hover:text-primary'
              )}
              aria-label="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileView('table')}
              className={clsx(
                'p-1.5 rounded text-xs transition-colors',
                mobileView === 'table'
                  ? 'bg-bento-card text-accent-primary shadow'
                  : 'text-muted hover:text-primary'
              )}
              aria-label="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card View (on < 640px if mobileView === 'card') */}
      <div className={clsx('space-y-2.5', mobileView === 'card' ? 'block sm:hidden' : 'hidden')}>
        {data.map((row, rowIdx) => (
          <div
            key={keyExtractor(row, rowIdx)}
            className="bg-bento-card border border-subtle rounded-lg p-3 space-y-2 shadow-sm"
          >
            {columns
              .filter((col) => !col.mobileHidden)
              .map((col) => {
                const content = col.render
                  ? col.render(row, rowIdx)
                  : ((row as Record<string, unknown>)[col.key] as React.ReactNode);

                return (
                  <div key={col.key} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-secondary font-medium">{col.header}</span>
                    <span
                      className={clsx(
                        'font-mono tabular-nums text-primary font-medium text-right',
                        col.className
                      )}
                    >
                      {content}
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* Desktop Monospace Table View (and mobile if toggled) */}
      <div
        className={clsx(
          'overflow-x-auto rounded-lg border border-subtle',
          mobileView === 'table' ? 'block' : 'hidden sm:block'
        )}
      >
        <table className="w-full border-collapse text-left text-xs font-mono tabular-nums">
          <thead className="bg-surface-elevated border-b border-subtle sticky top-0 z-10 select-none">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'py-2.5 px-3 text-[11px] font-bold text-secondary uppercase tracking-wider',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle/60 bg-bento-card">
            {data.map((row, rowIdx) => (
              <tr
                key={keyExtractor(row, rowIdx)}
                className="hover:bg-surface-elevated/40 transition-colors duration-100"
              >
                {columns.map((col) => {
                  const content = col.render
                    ? col.render(row, rowIdx)
                    : ((row as Record<string, unknown>)[col.key] as React.ReactNode);

                  return (
                    <td
                      key={col.key}
                      className={clsx(
                        'py-2.5 px-3 text-table-cell text-primary',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResponsiveTable;
