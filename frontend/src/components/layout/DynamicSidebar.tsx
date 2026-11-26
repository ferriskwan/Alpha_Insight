import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  BarChart2,
  BarChart3,
  DollarSign,
  Settings,
  Users,
  FileText,
  Globe,
  Activity,
  Database,
  Shield,
  ListTree,
  BookOpen,
  Layers,
  PieChart,
  Folder,
  CreditCard,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { SiteMapNode, UserRoleType } from '../../types/api';
import apiClient from '../../services/apiClient';

// Dynamic icon mapper for Lucide icons stored by name in database
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  BarChart2,
  BarChart3,
  DollarSign,
  Settings,
  Users,
  FileText,
  Globe,
  Activity,
  Database,
  Shield,
  ListTree,
  BookOpen,
  Layers,
  PieChart,
  Folder,
  CreditCard,
  HelpCircle,
  Sparkles,
};

// Fallback seed tree if backend is not yet populated
const DEFAULT_FALLBACK_TREE: SiteMapNode[] = [
  {
    id: 1,
    parent_id: null,
    menu_code: 'portfolio',
    label: 'My Portfolio',
    route: '/portfolio/overview',
    icon: 'Briefcase',
    role_required: 'user',
    order_index: 10,
    is_active: true,
    children: [
      {
        id: 2,
        parent_id: 1,
        menu_code: 'portfolio.overview',
        label: 'Portfolio Overview',
        route: '/portfolio/overview',
        icon: 'PieChart',
        role_required: 'user',
        order_index: 1,
        is_active: true,
      },
      {
        id: 3,
        parent_id: 1,
        menu_code: 'portfolio.transactions',
        label: 'Transactions',
        route: '/portfolio/transactions',
        icon: 'DollarSign',
        role_required: 'user',
        order_index: 2,
        is_active: true,
      },
      {
        id: 7,
        parent_id: 1,
        menu_code: 'portfolio.watchlist',
        label: 'Watch List',
        route: '/portfolio/watchlist',
        icon: 'Activity',
        role_required: 'user',
        order_index: 3,
        is_active: true,
      },
    ],
  },
  {
    id: 8,
    parent_id: null,
    menu_code: 'research',
    label: 'Research',
    route: '/research/committee',
    icon: 'TrendingUp',
    role_required: 'user',
    order_index: 20,
    is_active: true,
    children: [
      {
        id: 204,
        parent_id: 8,
        menu_code: 'research.committee',
        label: 'Stock Analysis',
        route: '/research/committee',
        icon: 'Sparkles',
        role_required: 'user',
        order_index: 1,
        is_active: true,
      },
      {
        id: 10,
        parent_id: 8,
        menu_code: 'research.macro',
        label: 'Macroeconomics',
        route: '/research/macro',
        icon: 'Globe',
        role_required: 'analyst',
        order_index: 2,
        is_active: true,
      },
      {
        id: 205,
        parent_id: 8,
        menu_code: 'research.sectors',
        label: 'By Industry / Sector',
        route: '/research/sectors',
        icon: 'Layers',
        role_required: 'analyst',
        order_index: 3,
        is_active: true,
      },
    ],
  },
  {
    id: 12,
    parent_id: null,
    menu_code: 'notes',
    label: 'Investment Notes',
    route: '/notes',
    icon: 'BookOpen',
    role_required: 'user',
    order_index: 30,
    is_active: true,
  },
  {
    id: 13,
    parent_id: null,
    menu_code: 'admin',
    label: 'Administration',
    route: '/admin/users',
    icon: 'Shield',
    role_required: 'admin',
    order_index: 40,
    is_active: true,
    children: [
      {
        id: 14,
        parent_id: 13,
        menu_code: 'admin.users',
        label: 'User Admin',
        route: '/admin/users',
        icon: 'Users',
        role_required: 'admin',
        order_index: 1,
        is_active: true,
      },
      {
        id: 15,
        parent_id: 13,
        menu_code: 'admin.sitemap',
        label: 'Site Map Admin',
        route: '/admin/sitemap',
        icon: 'ListTree',
        role_required: 'admin',
        order_index: 2,
        is_active: true,
      },
      {
        id: 16,
        parent_id: 13,
        menu_code: 'admin.ref_data',
        label: 'Ref Data Editor',
        route: '/admin/ref-data',
        icon: 'Database',
        role_required: 'admin',
        order_index: 3,
        is_active: true,
      },
      {
        id: 17,
        parent_id: 13,
        menu_code: 'admin.audit_logs',
        label: 'Audit Logs',
        route: '/admin/audit-logs',
        icon: 'FileText',
        role_required: 'admin',
        order_index: 4,
        is_active: true,
      },
    ],
  },
];

export interface DynamicSidebarProps {
  currentPath: string;
  onNavigate: (route: string) => void;
  activeRole: UserRoleType;
  className?: string;
}

export const DynamicSidebar: React.FC<DynamicSidebarProps> = ({
  currentPath,
  onNavigate,
  activeRole,
  className = '',
}) => {
  const [tree, setTree] = useState<SiteMapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<number, boolean>>({});

  // Fetch role-tailored sitemap from backend
  useEffect(() => {
    let isMounted = true;
    const fetchSitemap = async () => {
      setLoading(true);
      try {
        const nodes = await apiClient.getSitemap(activeRole);
        if (isMounted) {
          if (nodes && Array.isArray(nodes) && nodes.length > 0) {
            setTree(nodes);
          } else {
            // Apply role filtering to fallback tree
            const filtered = filterTreeByRole(DEFAULT_FALLBACK_TREE, activeRole);
            setTree(filtered);
          }
        }
      } catch (err) {
        if (isMounted) {
          const filtered = filterTreeByRole(DEFAULT_FALLBACK_TREE, activeRole);
          setTree(filtered);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSitemap();
    return () => {
      isMounted = false;
    };
  }, [activeRole]);

  const toggleCollapse = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const renderIcon = (iconName: string | null | undefined, hasChildren: boolean) => {
    if (iconName && ICON_MAP[iconName]) {
      const IconComp = ICON_MAP[iconName];
      return <IconComp className="w-4 h-4 shrink-0" />;
    }
    if (hasChildren) {
      return <Folder className="w-4 h-4 shrink-0" />;
    }
    return <FileText className="w-4 h-4 shrink-0" />;
  };

  const renderNode = (node: SiteMapNode, depth: number = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isCollapsed = Boolean(collapsedNodes[node.id]);
    const isActive = currentPath === node.route;

    return (
      <div key={node.id} className="flex flex-col">
        <div
          onClick={() => {
            if (node.route) {
              onNavigate(node.route);
            } else if (hasChildren) {
              setCollapsedNodes((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
            }
          }}
          draggable={Boolean(node.route)}
          onDragStart={(e) => {
            if (node.route) {
              e.dataTransfer.setData('text/plain', node.route);
              e.dataTransfer.setData('application/json', JSON.stringify({ route: node.route, label: node.label }));
              e.dataTransfer.effectAllowed = 'copyMove';
            }
          }}
          style={{ paddingLeft: `${Math.max(12, depth * 16 + 12)}px` }}
          className={`group flex items-center justify-between py-2 pr-3 my-0.5 rounded cursor-pointer transition-all duration-150 text-xs ${
            isActive
              ? 'bg-slate-100 text-blue-700 font-semibold border-l-4 border-blue-700'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title={node.label}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className={isActive ? 'text-blue-700' : 'text-slate-500 group-hover:text-slate-900'}>
              {renderIcon(node.icon, hasChildren)}
            </span>
            <span className="truncate">{node.label}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {node.role_required === 'admin' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-red-50 text-red-700 border border-red-200">
                ADM
              </span>
            )}
            {node.role_required === 'analyst' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-blue-50 text-blue-700 border border-blue-200">
                ANA
              </span>
            )}
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => toggleCollapse(node.id, e)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="flex flex-col border-l border-slate-200 ml-4">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto ${className}`}
    >
      <div className="p-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-900">Navigation</span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-blue-700" />}
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {tree.map((node) => renderNode(node, 0))}
      </nav>

      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Role Scope:</span>
        <span className="font-mono font-semibold uppercase px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900">
          {activeRole}
        </span>
      </div>
    </aside>
  );
};

// Helper to filter static tree when backend offline
function filterTreeByRole(nodes: SiteMapNode[], role: UserRoleType): SiteMapNode[] {
  const roleWeights: Record<UserRoleType, number> = {
    user: 1,
    analyst: 2,
    admin: 3,
  };
  const currentWeight = roleWeights[role] || 1;

  const result: SiteMapNode[] = [];
  for (const node of nodes) {
    const requiredWeight = roleWeights[node.role_required] || 1;
    if (requiredWeight <= currentWeight) {
      const cloned = { ...node };
      if (cloned.children) {
        cloned.children = filterTreeByRole(cloned.children, role);
      }
      result.push(cloned);
    }
  }
  return result;
}

export default DynamicSidebar;
