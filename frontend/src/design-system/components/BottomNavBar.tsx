import React from 'react';
import { TrendingUp, Bookmark, LineChart, Menu as MenuIcon } from 'lucide-react';

export interface BottomNavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  route?: string;
  isDrawerTrigger?: boolean;
}

export interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tabId: string, route?: string) => void;
  onOpenMenuDrawer: () => void;
  className?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenMenuDrawer,
  className = '',
}) => {
  const tabs: BottomNavTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <TrendingUp className="w-5 h-5" />,
      route: '/portfolio/overview',
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      icon: <Bookmark className="w-5 h-5" />,
      route: '/portfolio/watchlist',
    },
    {
      id: 'analyst',
      label: 'Analyst',
      icon: <LineChart className="w-5 h-5" />,
      route: '/research/stock-analyst',
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: <MenuIcon className="w-5 h-5" />,
      isDrawerTrigger: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 flex items-center justify-around lg:hidden select-none shadow-xs ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.isDrawerTrigger) {
                onOpenMenuDrawer();
              } else {
                onTabChange(tab.id, tab.route);
              }
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-[11px] font-medium transition-colors relative ${
              isActive
                ? 'text-blue-700 font-semibold'
                : 'text-slate-500 hover:text-slate-900 active:text-blue-600'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Top Indicator bar for active tab */}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-700 rounded-full" />
            )}
            <span className="relative">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
