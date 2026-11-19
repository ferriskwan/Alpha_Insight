import React from 'react';
import { LogOut, User as UserIcon, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types/api';
import { EnvPill } from '../../design-system';

export interface TopCommandBarProps {
  user: UserProfile | null;
  onLogout: () => void;
  env?: string;
  globalToday?: string | null;
  className?: string;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  user,
  onLogout,
  env = 'DEV',
  globalToday,
  className,
}) => {
  return (
    <header className={`h-14 bg-bento-card border-b border-subtle px-4 md:px-6 flex items-center justify-between select-none shrink-0 ${className || ''}`}>
      {/* Brand & Environment */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/15 border border-accent-primary/30 flex items-center justify-center text-accent-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm md:text-base tracking-tight text-primary font-sans">
            Alpha<span className="text-accent-primary">Insight</span>
          </span>
        </div>
        <EnvPill env={env} />
        {globalToday && (
          <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-muted bg-surface-elevated border border-subtle">
            TD: {globalToday}
          </span>
        )}
      </div>

      {/* User Session & Actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2.5">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 rounded-full border border-subtle object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface-elevated border border-subtle flex items-center justify-center text-secondary">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-primary leading-tight truncate max-w-[120px]">
                {user.name}
              </span>
              <span className="text-[10px] text-muted font-mono uppercase">
                {user.roles && user.roles.length > 0 ? user.roles[0] : 'user'}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-secondary hover:text-semantic-negative hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">Guest Session</span>
        )}
      </div>
    </header>
  );
};

export default TopCommandBar;
