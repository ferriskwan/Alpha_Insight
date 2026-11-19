import React from 'react';
import { TrendingUp, PieChart, Database, Shield, HelpCircle } from 'lucide-react';
import { NavTabId } from './LeftNavRail';

export interface MobileFloatingBarProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  isAdmin?: boolean;
  className?: string;
}

export const MobileFloatingBar: React.FC<MobileFloatingBarProps> = ({
  activeTab,
  onTabChange,
  isAdmin = false,
  className,
}) => {
  const items: { id: NavTabId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'analyst', label: 'Analyst', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'portfolio', label: 'Portfolio', icon: <PieChart className="w-5 h-5" /> },
    { id: 'editor', label: 'Editor', icon: <Database className="w-5 h-5" /> },
    { id: 'admin', label: 'Admin', icon: <Shield className="w-5 h-5" />, adminOnly: true },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-5 h-5" /> },
  ];

  return (
    <nav
      className={`fixed bottom-3 inset-x-3 z-50 md:hidden bg-surface-elevated/95 backdrop-blur-md border border-subtle rounded-2xl shadow-2xl p-1 flex items-center justify-around select-none ${
        className || ''
      }`}
    >
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-bento-card text-accent-primary shadow-sm border border-border-active/40'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="mt-0.5 leading-none">{item.label}</span>
            </button>
          );
        })}
    </nav>
  );
};

export default MobileFloatingBar;
