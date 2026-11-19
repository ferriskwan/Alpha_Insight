import React, { useState, useEffect } from 'react';
import { Terminal, Play, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { JobExecutionLogItem } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import { BentoCard, ResponsiveTable, TableColumn, Button, Badge } from '../../design-system';

export interface JobExecutionLogCardProps {
  className?: string;
}

export const JobExecutionLogCard: React.FC<JobExecutionLogCardProps> = ({ className }) => {
  const [logs, setLogs] = useState<JobExecutionLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningJob, setRunningJob] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAdminJobs();
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTriggerJob = async () => {
    setRunningJob(true);
    setStatusMsg(null);
    try {
      const res = await apiClient.triggerAdminJob('daily_pipeline');
      const jobId = res.job_id ?? (res as unknown as { job_log_id?: number }).job_log_id;
      setStatusMsg(`Job triggered (${res.status})! Job ID: #${jobId ?? 'N/A'}`);
      fetchLogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Job trigger failed';
      setStatusMsg(`Error: ${msg}`);
    } finally {
      setRunningJob(false);
    }
  };

  const columns: TableColumn<JobExecutionLogItem>[] = [
    {
      key: 'id',
      header: 'Job ID',
      render: (l) => <span className="font-mono text-muted">#{l.id}</span>,
    },
    {
      key: 'job_name',
      header: 'Job Name',
      render: (l) => <strong className="text-primary font-bold">{l.job_name}</strong>,
    },
    {
      key: 'trigger_source',
      header: 'Source',
      render: (l) => <Badge variant="neutral">{l.trigger_source}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => {
        const isSuccess = l.status === 'SUCCESS' || l.status === 'COMPLETED';
        const isRunning = l.status === 'RUNNING';
        return (
          <Badge variant={isSuccess ? 'positive' : isRunning ? 'warning' : 'negative'}>
            {l.status}
          </Badge>
        );
      },
    },
    {
      key: 'started_at',
      header: 'Started At',
      render: (l) => <span className="text-secondary">{l.started_at ? l.started_at.slice(0, 19).replace('T', ' ') : ''}</span>,
    },
    {
      key: 'completed_at',
      header: 'Completed At',
      render: (l) => <span className="text-secondary">{l.completed_at ? l.completed_at.slice(0, 19).replace('T', ' ') : '—'}</span>,
    },
    {
      key: 'error_message',
      header: 'Message / Details',
      render: (l) => (
        <span className={l.error_message ? 'text-semantic-negative text-xs' : 'text-muted text-xs'}>
          {l.error_message || 'OK'}
        </span>
      ),
    },
  ];

  return (
    <BentoCard
      title="Cloud Run Batch Pipeline & Job Telemetry"
      subtitle="Execution history and automated job monitoring from public.job_execution_log"
      icon={<Terminal className="w-4 h-4 text-accent-primary" />}
      headerRight={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={runningJob}
            onClick={handleTriggerJob}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            Run Daily Pipeline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            onClick={fetchLogs}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          />
        </div>
      }
      className={className}
    >
      {statusMsg && (
        <div className="mb-3 p-2.5 rounded-lg bg-surface-elevated border border-subtle text-xs font-mono text-accent-primary">
          {statusMsg}
        </div>
      )}

      <ResponsiveTable<JobExecutionLogItem>
        columns={columns}
        data={logs}
        keyExtractor={(l) => l.id}
        loading={loading}
        emptyMessage="No job executions recorded in job_execution_log."
      />
    </BentoCard>
  );
};

export default JobExecutionLogCard;
