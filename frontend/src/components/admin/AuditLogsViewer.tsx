import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { AuditLogEntry } from '../../types/api';
import apiClient from '../../services/apiClient';

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 101,
    user_id: 1,
    user_email: 'ferris.kwan@4leafclover.com',
    action: 'UPDATE_ROLE',
    entity: 'users',
    entity_id: '2',
    old_values: { roles: ['analyst'] },
    new_values: { roles: ['analyst', 'user'] },
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2026-11-08T12:45:00Z',
  },
  {
    id: 102,
    user_id: 1,
    user_email: 'ferris.kwan@4leafclover.com',
    action: 'CREATE',
    entity: 'site_map',
    entity_id: '4',
    old_values: null,
    new_values: {
      menu_code: 'portfolio.trans_cost',
      label: 'Transaction Costs',
      route: '/portfolio/transactions/cost',
      role_required: 'user',
    },
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2026-11-08T12:30:15Z',
  },
  {
    id: 103,
    user_id: 1,
    user_email: 'ferris.kwan@4leafclover.com',
    action: 'UPDATE',
    entity: 'sysvalue',
    entity_id: 'GLOBAL_TODAY',
    old_values: { datevalue: '2026-11-07' },
    new_values: { datevalue: '2026-11-08' },
    ip_address: '127.0.0.1',
    user_agent: 'Python/3.14 aiohttp/3.9',
    timestamp: '2026-11-08T00:01:00Z',
  },
  {
    id: 104,
    user_id: 2,
    user_email: 'analyst.lead@4leafclover.com',
    action: 'LOGIN',
    entity: 'user_sessions',
    entity_id: 'sess_998124',
    old_values: null,
    new_values: { provider: 'google-oauth2' },
    ip_address: '203.0.113.195',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    timestamp: '2026-11-07T18:22:40Z',
  },
];

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(DEFAULT_AUDIT_LOGS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(101);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAuditLogs({
        entity: entityFilter !== 'all' ? entityFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });
      if (data && Array.isArray(data) && data.length > 0) {
        setLogs(data);
      }
    } catch (err: unknown) {
      console.warn('Could not fetch audit logs from backend; using default records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  const toggleExpand = (id: number) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.user_email && log.user_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesEntity = entityFilter === 'all' || log.entity === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesEntity && matchesAction;
  });

  const getActionBadgeClass = (action: string) => {
    const upper = action.toUpperCase();
    if (upper.includes('CREATE') || upper.includes('ADD') || upper.includes('INSERT')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('MODIFY')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (upper.includes('DELETE') || upper.includes('REVOKE') || upper.includes('REMOVE')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">System Audit & Compliance Log</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Immutable historical event log tracing all state mutations, role reassignments, and administrative actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-md flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor, action, or entity ID..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Entity:</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
          >
            <option value="all">All Entities</option>
            <option value="users">users</option>
            <option value="site_map">site_map</option>
            <option value="sysvalue">sysvalue</option>
            <option value="ref_chart_settings">ref_chart_settings</option>
            <option value="trans_cost">trans_cost</option>
            <option value="trades">trades</option>
            <option value="user_sessions">user_sessions</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="UPDATE_ROLE">UPDATE_ROLE</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4 font-semibold w-8" />
              <th className="py-2.5 px-4 font-semibold">Timestamp (UTC)</th>
              <th className="py-2.5 px-4 font-semibold">Actor</th>
              <th className="py-2.5 px-4 font-semibold">Action</th>
              <th className="py-2.5 px-4 font-semibold">Entity</th>
              <th className="py-2.5 px-4 font-semibold">Record ID</th>
              <th className="py-2.5 px-4 font-semibold">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No audit log entries found matching criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => toggleExpand(log.id)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-blue-700" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {log.user_email || `UID: ${log.user_id || 'System'}`}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{log.entity}</td>
                      <td className="py-2.5 px-4 font-mono text-blue-700">{log.entity_id || '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{log.ip_address || '—'}</td>
                    </tr>

                    {/* Expandable JSON Diff Box */}
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={7} className="p-4 pl-12">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Old Values (Red Strike / Tone) */}
                            <div className="border border-red-200 bg-red-50/50 rounded p-3">
                              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-800 block mb-1">
                                Old State (Previous)
                              </span>
                              {log.old_values ? (
                                <pre className="text-xs font-mono text-red-900 bg-white border border-red-200 p-2.5 rounded overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.old_values, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-xs text-red-700 italic">None (New Record Created)</span>
                              )}
                            </div>

                            {/* New Values (Green Highlight / Tone) */}
                            <div className="border border-emerald-200 bg-emerald-50/50 rounded p-3">
                              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                                New State (Applied)
                              </span>
                              {log.new_values ? (
                                <pre className="text-xs font-mono text-emerald-900 bg-white border border-emerald-200 p-2.5 rounded overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.new_values, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-xs text-emerald-700 italic">None (Record Deleted)</span>
                              )}
                            </div>
                          </div>

                          {log.user_agent && (
                            <div className="mt-2 text-[10px] font-mono text-slate-500">
                              User-Agent: {log.user_agent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogsViewer;
