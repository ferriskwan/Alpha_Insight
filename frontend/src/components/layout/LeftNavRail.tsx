import React from 'react';
import { TrendingUp, PieChart, Database, Shield, HelpCircle } from 'lucide-react';

export type NavTabId = 'analyst' | 'portfolio' | 'editor' | 'admin' | 'faq';

export interface NavItemDef {
  id: NavTabId;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export interface LeftNavRailProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  isAdmin?: boolean;
  className?: string;
}

export const LeftNavRail: React.FC<LeftNavRailProps> = ({
  activeTab,
  onTabChange,
  isAdmin = false,
  className,
}) => {
  const navItems: NavItemDef[] = [
    { id: 'analyst', label: 'Stock Analyst', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'portfolio', label: 'Portfolio', icon: <PieChart className="w-5 h-5" /> },
    { id: 'editor', label: 'Editor', icon: <Database className="w-5 h-5" /> },
    { id: 'admin', label: 'Admin', icon: <Shield className="w-5 h-5" />, adminOnly: true },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-5 h-5" /> },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-16 lg:w-48 bg-bento-card border-r border-subtle shrink-0 select-none py-4 ${
        className || ''
      }`}
    >
      <nav className="flex-1 flex flex-col gap-1.5 px-2">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-surface-elevated text-accent-primary shadow-sm border border-border-active/30'
                    : 'text-secondary hover:text-primary hover:bg-surface-elevated/60'
                }`}
                title={item.label}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="hidden lg:inline-block truncate">{item.label}</span>
              </button>
            );
          })}
      </nav>
    </aside>
  );
};

export default LeftNavRail;
