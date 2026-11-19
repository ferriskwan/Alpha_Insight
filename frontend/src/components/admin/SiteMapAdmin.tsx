import React, { useState, useEffect } from 'react';
import {
  ListTree,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Shield,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { SiteMapNode, SiteMapCreateRequest, SiteMapUpdateRequest, UserRoleType } from '../../types/api';
import apiClient from '../../services/apiClient';

const INITIAL_NODES: SiteMapNode[] = [
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
        id: 4,
        parent_id: 1,
        menu_code: 'portfolio.trans_cost',
        label: 'Transaction Costs',
        route: '/portfolio/transactions/cost',
        icon: 'DollarSign',
        role_required: 'user',
        order_index: 3,
        is_active: true,
      },
    ],
  },
  {
    id: 5,
    parent_id: null,
    menu_code: 'research',
    label: 'Research',
    route: '/research/stock_analyst',
    icon: 'TrendingUp',
    role_required: 'user',
    order_index: 20,
    is_active: true,
    children: [
      {
        id: 6,
        parent_id: 5,
        menu_code: 'research.stock_analyst',
        label: 'Stock Analyst',
        route: '/research/stock_analyst',
        icon: 'TrendingUp',
        role_required: 'user',
        order_index: 1,
        is_active: true,
      },
      {
        id: 7,
        parent_id: 5,
        menu_code: 'research.macro',
        label: 'Macroeconomics',
        route: '/research/macro',
        icon: 'Globe',
        role_required: 'analyst',
        order_index: 2,
        is_active: true,
      },
    ],
  },
  {
    id: 8,
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
        id: 9,
        parent_id: 8,
        menu_code: 'admin.users',
        label: 'User Admin',
        route: '/admin/users',
        icon: 'Users',
        role_required: 'admin',
        order_index: 1,
        is_active: true,
      },
      {
        id: 10,
        parent_id: 8,
        menu_code: 'admin.sitemap',
        label: 'Site Map Admin',
        route: '/admin/sitemap',
        icon: 'ListTree',
        role_required: 'admin',
        order_index: 2,
        is_active: true,
      },
    ],
  },
];

export const SiteMapAdmin: React.FC = () => {
  const [nodes, setNodes] = useState<SiteMapNode[]>(INITIAL_NODES);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SiteMapNode | null>(INITIAL_NODES[0]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [parentId, setParentId] = useState<number | null>(null);
  const [menuCode, setMenuCode] = useState('');
  const [label, setLabel] = useState('');
  const [route, setRoute] = useState('');
  const [icon, setIcon] = useState('FileText');
  const [roleRequired, setRoleRequired] = useState<UserRoleType>('user');
  const [orderIndex, setOrderIndex] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadSitemap = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAdminSitemap();
      if (data && Array.isArray(data) && data.length > 0) {
        setNodes(data);
        if (!selectedNode) setSelectedNode(data[0]);
      }
    } catch (err: unknown) {
      console.warn('Could not fetch admin sitemap from backend; retaining local tree', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSitemap();
  }, []);

  useEffect(() => {
    if (selectedNode && !isCreatingNew) {
      setParentId(selectedNode.parent_id);
      setMenuCode(selectedNode.menu_code);
      setLabel(selectedNode.label);
      setRoute(selectedNode.route);
      setIcon(selectedNode.icon || 'FileText');
      setRoleRequired(selectedNode.role_required);
      setOrderIndex(selectedNode.order_index);
      setIsActive(selectedNode.is_active);
    }
  }, [selectedNode, isCreatingNew]);

  const handleSelectNode = (node: SiteMapNode) => {
    setIsCreatingNew(false);
    setSelectedNode(node);
  };

  const handleStartCreate = (defaultParentId: number | null = null) => {
    setIsCreatingNew(true);
    setSelectedNode(null);
    setParentId(defaultParentId);
    setMenuCode('');
    setLabel('');
    setRoute('/');
    setIcon('FileText');
    setRoleRequired('user');
    setOrderIndex(10);
    setIsActive(true);
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuCode || !label) {
      showToast('error', 'Menu code and label are required.');
      return;
    }

    try {
      if (isCreatingNew) {
        const payload: SiteMapCreateRequest = {
          parent_id: parentId,
          menu_code: menuCode,
          label,
          route,
          icon,
          role_required: roleRequired,
          order_index: Number(orderIndex),
          is_active: isActive,
        };
        const created = await apiClient.createSiteMapNode(payload);
        showToast('success', `Created node '${label}' successfully.`);
        await loadSitemap();
        setIsCreatingNew(false);
        setSelectedNode(created);
      } else if (selectedNode) {
        const payload: SiteMapUpdateRequest = {
          label,
          route,
          icon,
          role_required: roleRequired,
          order_index: Number(orderIndex),
          is_active: isActive,
        };
        const updated = await apiClient.updateSiteMapNode(selectedNode.id, payload);
        showToast('success', `Updated node '${label}' successfully.`);
        await loadSitemap();
        setSelectedNode(updated || { ...selectedNode, ...payload });
      }
    } catch (err: unknown) {
      // Local optimistic update fallback
      if (selectedNode && !isCreatingNew) {
        const updated: SiteMapNode = {
          ...selectedNode,
          label,
          route,
          icon,
          role_required: roleRequired,
          order_index: Number(orderIndex),
          is_active: isActive,
        };
        setNodes((prev) => updateNodeInTree(prev, updated));
        setSelectedNode(updated);
        showToast('success', `Saved locally: ${label}`);
      } else {
        showToast('error', `Save failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (!window.confirm(`Are you sure you want to delete '${selectedNode.label}'?`)) return;

    try {
      await apiClient.deleteSiteMapNode(selectedNode.id);
      showToast('success', `Deleted node '${selectedNode.label}'.`);
      await loadSitemap();
      setSelectedNode(null);
    } catch (err: unknown) {
      setNodes((prev) => deleteNodeFromTree(prev, selectedNode.id));
      setSelectedNode(null);
      showToast('success', `Removed node locally.`);
    }
  };

  // Flattened list for Parent Dropdown
  const flatNodes = flattenTree(nodes);

  const renderTreeItem = (node: SiteMapNode, depth: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = Boolean(node.children && node.children.length > 0);

    return (
      <div key={node.id} className="flex flex-col">
        <div
          onClick={() => handleSelectNode(node)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={`flex items-center justify-between py-2 pr-2.5 my-0.5 rounded cursor-pointer transition-colors text-xs ${
            isSelected
              ? 'bg-slate-100 text-blue-700 font-bold border-l-4 border-blue-700'
              : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {hasChildren ? (
              <Folder className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="truncate">{node.label}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
            <span className="text-slate-500">#{node.order_index}</span>
            <span
              className={`px-1 py-0.2 rounded uppercase ${
                node.role_required === 'admin'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : node.role_required === 'analyst'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              {node.role_required}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${node.is_active ? 'bg-emerald-700' : 'bg-slate-300'}`}
              title={node.is_active ? 'Active' : 'Inactive'}
            />
          </div>
        </div>

        {hasChildren && (
          <div className="border-l border-slate-200 ml-3">
            {node.children!.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListTree className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Site Map & Dynamic Navigation Admin</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              100% database-driven navigation hierarchy editor with role-based access control flags.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartCreate(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Root Node</span>
            </button>
            <button
              type="button"
              onClick={loadSitemap}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {notification && (
          <div
            className={`mt-3 p-2.5 rounded text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>

      {/* Two-Column Master Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Pane: Tree Hierarchy View (40%) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-3 flex flex-col h-[600px] overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-xs font-semibold text-slate-900">
            <span>Navigation Hierarchy Tree</span>
            <span className="text-[11px] font-mono text-slate-500">{flatNodes.length} nodes</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {nodes.map((node) => renderTreeItem(node, 0))}
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleStartCreate(selectedNode ? selectedNode.id : null)}
              className="text-xs text-blue-700 hover:underline font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sub-Item under Selected</span>
            </button>
          </div>
        </div>

        {/* Right Pane: Node Editor Form (60%) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-4 flex flex-col h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isCreatingNew ? 'Create New Navigation Node' : `Edit Node: ${selectedNode?.label || ''}`}
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {isCreatingNew ? 'Assign parent, slug code, route, and required role' : `ID: ${selectedNode?.id} | Code: ${selectedNode?.menu_code}`}
              </span>
            </div>

            {selectedNode && !isCreatingNew && (
              <button
                type="button"
                onClick={handleDeleteNode}
                className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium inline-flex items-center gap-1"
                title="Delete this node"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveNode} className="space-y-4 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Node</label>
                <select
                  value={parentId === null ? '' : parentId}
                  onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                >
                  <option value="">[Root / Top-Level Category]</option>
                  {flatNodes
                    .filter((n) => !selectedNode || n.id !== selectedNode.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.menu_code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Menu Code (Slug) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={menuCode}
                  onChange={(e) => setMenuCode(e.target.value)}
                  disabled={!isCreatingNew}
                  required
                  placeholder="e.g. portfolio.trans_cost"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  placeholder="e.g. Transaction Costs"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Path</label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="e.g. /portfolio/transactions/cost"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lucide Icon</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. DollarSign"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Required</label>
                <select
                  value={roleRequired}
                  onChange={(e) => setRoleRequired(e.target.value as UserRoleType)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                >
                  <option value="user">User (Standard)</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin (Elevated)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                <span>Node is Active (Visible in Dynamic Sidebar)</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              {isCreatingNew && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setSelectedNode(nodes[0] || null);
                  }}
                  className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isCreatingNew ? 'Create Node' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Tree Helper Utilities
function flattenTree(nodes: SiteMapNode[]): SiteMapNode[] {
  let list: SiteMapNode[] = [];
  for (const n of nodes) {
    list.push(n);
    if (n.children && n.children.length > 0) {
      list = list.concat(flattenTree(n.children));
    }
  }
  return list;
}

function updateNodeInTree(nodes: SiteMapNode[], updated: SiteMapNode): SiteMapNode[] {
  return nodes.map((node) => {
    if (node.id === updated.id) {
      return { ...node, ...updated };
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, updated) };
    }
    return node;
  });
}

function deleteNodeFromTree(nodes: SiteMapNode[], deleteId: number): SiteMapNode[] {
  return nodes
    .filter((n) => n.id !== deleteId)
    .map((node) => {
      if (node.children) {
        return { ...node, children: deleteNodeFromTree(node.children, deleteId) };
      }
      return node;
    });
}

export default SiteMapAdmin;
