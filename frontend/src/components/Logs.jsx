import React, { useState } from 'react';
import { Calendar, RefreshCw, ChevronDown, ChevronUp, Search, Eye, Filter } from 'lucide-react';

export default function Logs({ logs, pagination, apps, selectedApp, selectedStatus, page, onFilterChange, onPageChange, onRetry, retryingLogIds }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  const formatJSON = (val) => {
    if (!val) return 'None';
    if (typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return String(val);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleString();
  };

  return (
    <div className="logs-view">
      <div className="header">
        <div className="header-title">
          <h1>Delivery Logs</h1>
          <p>Inspect incoming webhook payloads, proxy deliveries, and retries</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filters:</span>
          </div>

          <div style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select 
              className="form-control" 
              style={{ maxWidth: '200px', padding: '8px 12px' }}
              value={selectedApp}
              onChange={(e) => onFilterChange('app', e.target.value)}
            >
              <option value="">All Applications</option>
              {apps.map(app => (
                <option key={app._id} value={app._id}>{app.name}</option>
              ))}
            </select>

            <select 
              className="form-control" 
              style={{ maxWidth: '200px', padding: '8px 12px' }}
              value={selectedStatus}
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="retrying">Retrying</option>
            </select>
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onFilterChange('reset')}
            style={{ display: 'flex', gap: '6px' }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <div className="empty-state">
            <Search className="empty-state-icon" size={48} />
            <h3>No logs matched your criteria</h3>
            <p>Wait for webhooks to be received by the proxy or adjust your filters.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Timestamp</th>
                  <th>Application</th>
                  <th>Webhook Endpoint</th>
                  <th>Method</th>
                  <th>Response</th>
                  <th>Latency</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedId === log._id;
                  const isRetryingNow = retryingLogIds.includes(log._id);
                  const appName = log.applicationId?.name || 'Deleted Application';
                  const appType = log.applicationId?.appType || 'deleted';
                  
                  return (
                    <React.Fragment key={log._id}>
                      <tr 
                        className={isExpanded ? 'log-row-expanded' : ''} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleExpand(log._id)}
                      >
                        <td>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                            <span>{formatDate(log.timestamp)}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{appName}</div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            /webhook/{appType}{log.url !== '/' ? log.url : ''}
                          </span>
                        </td>
                        <td>
                          <span className="badge btn-secondary btn-sm" style={{ fontWeight: 700, padding: '2px 8px' }}>
                            {log.method}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            {log.responseStatus || 'Connection Fail'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{log.latencyMs}ms</span>
                        </td>
                        <td>
                          <span className={`badge ${log.deliveryStatus === 'success' ? 'badge-success' : log.deliveryStatus === 'retrying' ? 'badge-warning' : 'badge-danger'}`}>
                            {log.deliveryStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 10px', display: 'inline-flex', gap: '6px' }}
                            onClick={() => onRetry(log._id)}
                            disabled={isRetryingNow}
                            title="Manually retry forwarding this payload"
                          >
                            <RefreshCw size={12} className={isRetryingNow ? 'spin' : ''} />
                            {isRetryingNow ? 'Retrying...' : 'Retry'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="log-row-expanded">
                          <td colSpan="9" style={{ padding: 0, borderBottom: '1px solid var(--border-color)' }}>
                            <div className="log-details-grid">
                              {/* Request details */}
                              <div className="log-detail-section">
                                <h4>Incoming Webhook Details</h4>
                                <div style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
                                  <strong>Request Headers:</strong>
                                  <pre className="code-block" style={{ color: '#93c5fd' }}>{formatJSON(log.headers)}</pre>
                                </div>
                                {log.queryParams && Object.keys(log.queryParams).length > 0 && (
                                  <div style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
                                    <strong>Query Parameters:</strong>
                                    <pre className="code-block" style={{ color: '#fcd34d' }}>{formatJSON(log.queryParams)}</pre>
                                  </div>
                                )}
                                <div style={{ fontSize: '0.85rem' }}>
                                  <strong>Request Payload:</strong>
                                  <pre className="code-block">{formatJSON(log.body)}</pre>
                                </div>
                              </div>

                              {/* Response and attempts details */}
                              <div className="log-detail-section">
                                <h4>Proxy Delivery Response</h4>
                                <div style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
                                  <strong>Response Headers:</strong>
                                  <pre className="code-block" style={{ color: '#93c5fd' }}>{formatJSON(log.responseHeaders)}</pre>
                                </div>
                                <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                                  <strong>Response Payload:</strong>
                                  <pre className="code-block" style={{ color: log.responseStatus >= 200 && log.responseStatus < 300 ? '#a7f3d0' : '#fecdd3' }}>
                                    {formatJSON(log.responseBody)}
                                  </pre>
                                </div>

                                <h4>Delivery Log (Attempts: {log.attempts?.length || 0})</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                  {log.attempts?.map((attempt, index) => (
                                    <div 
                                      key={index} 
                                      style={{ 
                                        padding: '8px 12px', 
                                        background: 'rgba(0,0,0,0.15)', 
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: `3px solid ${attempt.responseStatus >= 200 && attempt.responseStatus < 300 ? 'var(--color-success)' : 'var(--color-danger)'}`,
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <strong>Attempt #{index + 1}</strong>
                                        <span style={{ color: 'var(--text-muted)' }}>{formatDate(attempt.timestamp)}</span>
                                      </div>
                                      <div>
                                        Status: <span style={{ fontFamily: 'var(--font-mono)' }}>{attempt.responseStatus || 'Failed (Network error)'}</span>
                                        {attempt.latencyMs && ` | Latency: ${attempt.latencyMs}ms`}
                                      </div>
                                      {attempt.error && (
                                        <div style={{ color: 'var(--color-danger)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                          Error: {attempt.error}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              &lt;
            </button>
            <span className="pagination-info">
              Page {page} of {pagination.pages} ({pagination.total} logs total)
            </span>
            <button 
              className="pagination-btn" 
              onClick={() => onPageChange(page + 1)}
              disabled={page === pagination.pages}
            >
              &gt;
            </button>
          </div>
        )}
      </div>
      
      {/* Dynamic spinning keyframes style for the retry icons */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
