import React from 'react';
import { UserProfile } from '../../types/api';
import TopCommandBar from './TopCommandBar';
import LeftNavRail, { NavTabId } from './LeftNavRail';
import MobileFloatingBar from './MobileFloatingBar';

export interface BentoAppShellProps {
  user: UserProfile | null;
  onLogout: () => void;
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  env?: string;
  globalToday?: string | null;
  children: React.ReactNode;
}

export const BentoAppShell: React.FC<BentoAppShellProps> = ({
  user,
  onLogout,
  activeTab,
  onTabChange,
  env,
  globalToday,
  children,
}) => {
  const isAdmin = Boolean(user?.roles?.includes('admin'));

  return (
    <div className="min-h-screen bg-canvas text-primary flex flex-col font-sans antialiased">
      <TopCommandBar
        user={user}
        onLogout={onLogout}
        env={env}
        globalToday={globalToday}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftNavRail
          activeTab={activeTab}
          onTabChange={onTabChange}
          isAdmin={isAdmin}
        />

        <main className="flex-1 overflow-y-auto p-3.5 md:p-6 pb-24 md:pb-6 focus:outline-none">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>

      <MobileFloatingBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default BentoAppShell;
