import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Shield,
  ShieldAlert,
  UserCheck,
  RefreshCw,
  MoreVertical,
  Plus,
  Lock,
  UserCog,
  Check,
} from 'lucide-react';
import { ModalDialog } from '../../design-system';
import { UserSummary, UserRoleType } from '../../types/api';
import apiClient from '../../services/apiClient';

const INITIAL_FALLBACK_USERS: UserSummary[] = [
  {
    id: 1,
    email: 'ferris.kwan@4leafclover.com',
    name: 'Ferris Kwan',
    picture: null,
    roles: ['admin', 'analyst', 'user'],
    status: 'active',
    created_at: '2026-06-18T08:30:00Z',
  },
  {
    id: 2,
    email: 'analyst.lead@4leafclover.com',
    name: 'Analyst Lead',
    picture: null,
    roles: ['analyst', 'user'],
    status: 'active',
    created_at: '2026-08-10T11:15:00Z',
  },
  {
    id: 3,
    email: 'guest.investor@4leafclover.com',
    name: 'Guest Investor',
    picture: null,
    roles: ['user'],
    status: 'suspended',
    created_at: '2026-09-01T14:00:00Z',
  },
];

export const UserAdmin: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>(INITIAL_FALLBACK_USERS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Role Configuration Modal State
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<UserRoleType[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const handleOpenRoleModal = (u: UserSummary) => {
    setEditingUser(u);
    // Ensure 'user' role is always present per minimum role invariant
    const initialRoles = u.roles.includes('user') ? [...u.roles] : [...u.roles, 'user' as UserRoleType];
    setSelectedRoles(initialRoles);
  };

  const handleToggleRole = (role: UserRoleType) => {
    if (!editingUser) return;
    const isSuperAdmin = editingUser.id === 1 || editingUser.email.toLowerCase() === 'ferriskwan@gmail.com';
    if (isSuperAdmin && role === 'admin') {
      return; // Root super-admin role is permanently locked
    }
    if (role === 'user') {
      return; // Base user role is the required minimum and cannot be unchecked
    }
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;
    setSavingRoles(true);
    try {
      const currentRoles = editingUser.roles;
      const rolesToAdd = selectedRoles.filter((r) => !currentRoles.includes(r));
      const rolesToRemove = currentRoles.filter((r) => !selectedRoles.includes(r));

      for (const r of rolesToAdd) {
        await apiClient.updateUserRole(editingUser.id, r, 'add');
      }
      for (const r of rolesToRemove) {
        await apiClient.updateUserRole(editingUser.id, r, 'remove');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, roles: selectedRoles } : u))
      );
      showToast('success', `Roles updated for ${editingUser.name || editingUser.email}`);
      setEditingUser(null);
    } catch (err: unknown) {
      showToast('error', `Failed to update roles: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingRoles(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      if (data && Array.isArray(data) && data.length > 0) {
        setUsers(data);
      }
    } catch (err: unknown) {
      console.warn('Could not load users from backend; using default records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRoleChange = async (userId: number, newRole: UserRoleType) => {
    try {
      await apiClient.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const hasRole = u.roles.includes(newRole);
            const updatedRoles = hasRole ? u.roles : [...u.roles, newRole];
            return { ...u, roles: updatedRoles };
          }
          return u;
        })
      );
      showToast('success', `Role '${newRole}' updated for user ID ${userId}`);
    } catch (err: unknown) {
      showToast('error', `Failed to update role: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: string) => {
    const targetStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await apiClient.updateUserStatus(userId, targetStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: targetStatus } : u))
      );
      showToast('success', `User ID ${userId} status changed to ${targetStatus}`);
    } catch (err: unknown) {
      showToast('error', `Failed to update status: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole =
        roleFilter === 'all' || u.roles.includes(roleFilter as UserRoleType);

      const matchesStatus =
        statusFilter === 'all' || u.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">User Administration & RBAC</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Audit access rights, assign role entitlements, and manage account statuses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadUsers}
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

      {/* Control Filter Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-md flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="user">User</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Clean Paper Data Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4 font-semibold">User</th>
              <th className="py-2.5 px-4 font-semibold">Email</th>
              <th className="py-2.5 px-4 font-semibold">Roles</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Registered</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isSuperAdmin = user.id === 1 || user.email.toLowerCase() === 'ferriskwan@gmail.com';
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-xs text-blue-700">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">
                            {user.name || 'Unnamed User'}
                          </span>
                          {isSuperAdmin && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-0.5"
                              title="Root Super-Admin & Application Owner"
                            >
                              <Shield className="w-2.5 h-2.5" />
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">{user.email}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => {
                          const isPermanentAdmin = isSuperAdmin && role === 'admin';
                          return (
                            <span
                              key={role}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${
                                role === 'admin'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : role === 'analyst'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                              title={isPermanentAdmin ? 'Permanent Root Admin Role (Unremovable)' : undefined}
                            >
                              <span>{role}</span>
                              {isPermanentAdmin && <Lock className="w-2.5 h-2.5 text-red-600" />}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-medium border ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-emerald-700' : 'bg-red-700'
                          }`}
                        />
                        {user.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenRoleModal(user)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                          title={`Configure roles for ${user.name || user.email}`}
                          aria-label={`Configure roles for ${user.name || user.email}`}
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span>Configure Roles</span>
                        </button>

                        {isSuperAdmin ? (
                          <span
                            className="px-2 py-1 rounded border border-slate-200 text-[11px] font-mono text-slate-400 bg-slate-50 cursor-not-allowed inline-flex items-center gap-1"
                            title="Root super-admin account cannot be suspended or deactivated"
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Permanent</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(user.id, user.status)}
                            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                              user.status === 'active'
                                ? 'border-red-200 text-red-700 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {user.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog for Configuring User Roles */}
      {editingUser && (
        <ModalDialog
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title={`Configure Roles: ${editingUser.name || editingUser.email}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRoles}
                onClick={handleSaveRoles}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingRoles && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Save Roles</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            {/* User Details Banner */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-300 flex items-center justify-center font-bold text-sm text-blue-700 shadow-2xs">
                {editingUser.name ? editingUser.name.charAt(0).toUpperCase() : editingUser.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 truncate">{editingUser.name || 'Unnamed User'}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase font-semibold border ${
                      editingUser.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {editingUser.status}
                  </span>
                </div>
                <div className="font-mono text-slate-500 text-[11px] truncate">{editingUser.email}</div>
              </div>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              Select or deselect role entitlements for this user. Every active account must maintain at least the base <strong>User</strong> role.
            </p>

            {/* Role Entitlements List */}
            <div className="space-y-2 border border-slate-200 rounded p-2 bg-white">
              {/* Admin Role */}
              {(() => {
                const isSuperAdmin = editingUser.id === 1 || editingUser.email.toLowerCase() === 'ferriskwan@gmail.com';
                const hasAdmin = selectedRoles.includes('admin');
                return (
                  <label
                    htmlFor="role-checkbox-admin"
                    className={`flex items-start gap-3 p-2.5 rounded border transition-colors ${
                      hasAdmin ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                    } ${isSuperAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                  >
                    <input
                      id="role-checkbox-admin"
                      type="checkbox"
                      checked={hasAdmin}
                      disabled={isSuperAdmin}
                      onChange={() => handleToggleRole('admin')}
                      className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">Admin</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-red-100 text-red-800">
                          Administrative Access
                        </span>
                        {isSuperAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono bg-blue-100 text-blue-800">
                            <Lock className="w-2.5 h-2.5" /> Permanent Owner
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Full administrative access to manage users, roles, reference data, sitemap navigation, and audit logs.
                      </p>
                    </div>
                  </label>
                );
              })()}

              {/* Analyst Role */}
              {(() => {
                const hasAnalyst = selectedRoles.includes('analyst');
                return (
                  <label
                    htmlFor="role-checkbox-analyst"
                    className={`flex items-start gap-3 p-2.5 rounded border transition-colors cursor-pointer ${
                      hasAnalyst ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      id="role-checkbox-analyst"
                      type="checkbox"
                      checked={hasAnalyst}
                      onChange={() => handleToggleRole('analyst')}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">Analyst</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-blue-100 text-blue-800">
                          Research & Tools
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Access to research tools, stock analysis, macroeconomics, industry/sector analytics, and Agentic Analyst.
                      </p>
                    </div>
                  </label>
                );
              })()}

              {/* User Role (Baseline, Minimum Required) */}
              {(() => {
                const hasUser = selectedRoles.includes('user');
                return (
                  <label
                    htmlFor="role-checkbox-user"
                    className="flex items-start gap-3 p-2.5 rounded border border-slate-200 bg-slate-50/70 cursor-not-allowed opacity-90"
                    title="User role is the minimum required baseline role for all accounts"
                  >
                    <input
                      id="role-checkbox-user"
                      type="checkbox"
                      checked={hasUser}
                      disabled={true}
                      readOnly
                      className="mt-0.5 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">User</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-slate-200 text-slate-700">
                          Baseline Role (Required)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Standard baseline portfolio access to view executed transactions, capital ledger, and watchlist.
                      </p>
                    </div>
                  </label>
                );
              })()}
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
};

export default UserAdmin;
