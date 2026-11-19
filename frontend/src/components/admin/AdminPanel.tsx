import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, UserX, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { UserProfile } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import { BentoCard, ResponsiveTable, TableColumn, Button, Badge } from '../../design-system';
import JobExecutionLogCard from './JobExecutionLogCard';

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load user directory';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus = user.status === 'active' ? 'expired' : 'active';
    if (!window.confirm(`Set status of ${user.name} to ${nextStatus}?`)) return;
    try {
      await apiClient.updateAdminUserStatus(user.id, nextStatus);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      setError(msg);
    }
  };

  const handleToggleAdminRole = async (user: UserProfile) => {
    const isAdmin = user.roles.includes('admin');
    const action = isAdmin ? 'remove' : 'add';
    if (!window.confirm(`${isAdmin ? 'Revoke admin from' : 'Grant admin to'} ${user.name}?`)) return;
    try {
      await apiClient.updateAdminUserRoles(user.id, 'admin', action);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Role update failed';
      setError(msg);
    }
  };

  const columns: TableColumn<UserProfile>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <div className="flex items-center gap-2">
          {u.picture ? (
            <img src={u.picture} alt="" className="w-6 h-6 rounded-full border border-subtle" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-surface-elevated border border-subtle flex items-center justify-center text-[10px]">
              {u.name.slice(0, 1)}
            </div>
          )}
          <strong className="text-primary font-bold">{u.name}</strong>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (u) => <span className="text-secondary">{u.email}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge variant={u.status === 'active' ? 'active' : 'expired'}>
          {u.status}
        </Badge>
      ),
    },
    {
      key: 'roles',
      header: 'Assigned Roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant={r === 'admin' ? 'accent' : 'neutral'}>
              {r}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Access Controls',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleAdminRole(u)}
          >
            {u.roles.includes('admin') ? 'Demote' : 'Make Admin'}
          </Button>
          <Button
            variant={u.status === 'active' ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => handleToggleStatus(u)}
            icon={u.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
          >
            {u.status === 'active' ? 'Expire' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <BentoCard
        title="Administrative Controls & User Directory"
        subtitle="Tenant authorization, RBAC role assignment, and active session governance"
        icon={<Shield className="w-4 h-4 text-accent-primary" />}
        headerRight={
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            onClick={fetchUsers}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          />
        }
      >
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-semantic-negative/15 border border-semantic-negative/30 flex items-start gap-2 text-xs text-semantic-negative">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <ResponsiveTable<UserProfile>
          columns={columns}
          data={users}
          keyExtractor={(u) => u.id}
          loading={loading}
          emptyMessage="No users found in directory."
        />
      </BentoCard>

      {/* Cloud Run Batch Execution Log Card */}
      <JobExecutionLogCard />
    </div>
  );
};

export default AdminPanel;
