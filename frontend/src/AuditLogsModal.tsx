import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, RefreshCw, Search, ChevronLeft, ChevronRight, UserCheck, Database, Clock } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  timestamp: string;
}

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { id: string; email: string; role: string } | null;
  apiBase: string;
  token: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'badge-blue',
  LOGOUT: 'badge-gray',
  CREATE_CASE: 'badge-emerald',
  RENAME_CASE: 'badge-cyan',
  DELETE_CASE: 'badge-rose',
  SEAL_CASE: 'badge-amber',
  BACKUP_DATABASE: 'badge-purple',
  SUBMIT_EVIDENCE: 'badge-emerald',
  TRIGGER_AUTO_AUDIT: 'badge-violet',
};

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  apiBase,
  token,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async (targetPage = page, targetAction = actionFilter, targetSearch = searchQuery) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '15');
      if (targetAction && targetAction !== 'ALL') params.set('action', targetAction);
      if (targetSearch.trim()) params.set('search', targetSearch.trim());

      const res = await fetch(`${apiBase}/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load audit logs: ${res.statusText}`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchLogs(1, actionFilter, searchQuery);
    }
  }, [isOpen, actionFilter]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchLogs(1, actionFilter, searchQuery);
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box audit-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-badge">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="modal-title">Application Audit History</h2>
              <p className="modal-subtitle">
                Chronological application-recorded history of system and forensic actions · {totalCount} events recorded
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="audit-role-banner">
          <UserCheck size={16} />
          <span>
            {isAdmin ? (
              <strong>ADMIN ACCESS: Displaying application audit events across users. Direct database-level edits are outside this view.</strong>
            ) : (
              <strong>INVESTIGATOR VIEW: Displaying personal application-recorded events and activity log.</strong>
            )}
          </span>
          <span className="audit-role-tag">{currentUser?.role || 'INVESTIGATOR'}</span>
        </div>

        <div className="audit-filter-bar">
          <form onSubmit={handleSearchSubmit} className="audit-search-form">
            <Search size={14} className="audit-search-icon" />
            <input
              type="text"
              placeholder="Search by action or resource ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="audit-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="audit-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  void fetchLogs(1, actionFilter, '');
                }}
              >
                ×
              </button>
            )}
          </form>

          <div className="audit-action-pills">
            {['ALL', 'LOGIN', 'CREATE_CASE', 'RENAME_CASE', 'DELETE_CASE', 'SEAL_CASE', 'BACKUP_DATABASE', 'TRIGGER_AUTO_AUDIT'].map((act) => (
              <button
                key={act}
                type="button"
                className={`audit-pill ${actionFilter === act ? 'active' : ''}`}
                onClick={() => {
                  setActionFilter(act);
                  setPage(1);
                }}
              >
                {act === 'ALL' ? 'All Actions' : act.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="audit-refresh-btn"
            onClick={() => void fetchLogs(page, actionFilter, searchQuery)}
            title="Refresh logs"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <div className="audit-table-wrap custom-scrollbar">
          {error && <div className="audit-error-banner">{error}</div>}

          {loading && logs.length === 0 ? (
            <div className="audit-loading-state">
              <RefreshCw size={24} className="spin" />
              <span>Loading database audit trail...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="audit-empty-state">
              <Database size={28} />
              <p>No audit log events match the current filter criteria.</p>
            </div>
          ) : (
            <table className="audit-data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target Resource</th>
                  <th>Log Entry UUID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="audit-time-cell">
                      <Clock size={12} />
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </td>
                    <td>
                      <div className="audit-actor-cell">
                        <span className="audit-actor-email">{entry.user?.email || entry.userId.slice(0, 8)}</span>
                        {entry.user?.role && (
                          <span className={`actor-role-badge role-${entry.user.role.toLowerCase()}`}>
                            {entry.user.role}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`audit-action-tag ${ACTION_COLORS[entry.action] || 'badge-gray'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td>
                      {entry.resourceType ? (
                        <div className="audit-resource-cell">
                          <code>{entry.resourceType}</code>
                          {entry.resourceId && (
                            <span className="audit-res-id" title={entry.resourceId}>
                              {entry.resourceId.length > 18 ? `${entry.resourceId.slice(0, 16)}…` : entry.resourceId}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="audit-dim-text">—</span>
                      )}
                    </td>
                    <td className="audit-id-cell">
                      <code>{entry.id.slice(0, 8)}…</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer audit-modal-footer">
          <div className="audit-pagination-info">
            Showing Page {page} of {totalPages} ({totalCount} total entries)
          </div>
          <div className="audit-pagination-buttons">
            <button
              type="button"
              className="pagination-btn"
              disabled={page <= 1 || loading}
              onClick={() => void fetchLogs(page - 1, actionFilter, searchQuery)}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={page >= totalPages || loading}
              onClick={() => void fetchLogs(page + 1, actionFilter, searchQuery)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
