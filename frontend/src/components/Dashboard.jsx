import React, { useState } from 'react';
import { Activity, CheckCircle, AlertOctagon, Clock, Layers, Copy, Check, Info } from 'lucide-react';

export default function Dashboard({ stats, user, onViewLogsOfApp }) {
  const [copied, setCopied] = useState(false);

  const overview = stats?.overview || {
    totalApps: 0,
    activeApps: 0,
    totalWebhooks: 0,
    successCount: 0,
    failedCount: 0,
    retryingCount: 0,
    avgLatencyMs: 0,
    webhooksLast24h: 0
  };

  const appBreakdown = stats?.appBreakdown || [];
  const trend = stats?.trend || [];

  // Calculate success rate safely
  const successRate = overview.totalWebhooks > 0 
    ? Math.round((overview.successCount / overview.totalWebhooks) * 100) 
    : 0;

  // Custom Chart Data: Find max counts to scale bars
  const maxWebhookCount = Math.max(...appBreakdown.map(app => app.total), 1);
  const maxTrendCount = Math.max(...trend.map(day => day.total), 1);

  const baseWebhookUrl = `${window.location.origin}/webhook/${user.username}`;

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText(baseWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard-view">
      {/* Welcome Banner and URL Info */}
      <div className="card" style={{ marginBottom: '32px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', zIndex: 5, position: 'relative' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px' }}>
              Welcome back, {user.username}!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Here is the traffic summary for your EchoRoute webhook endpoints.
            </p>
          </div>
          
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.25)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-sm)', 
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px', marginBottom: '2px' }}>
                Your Webhook Root URL
              </div>
              <code style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {baseWebhookUrl}/:appType
              </code>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleCopyBaseUrl}
              style={{ padding: '6px 8px', minWidth: '40px', justifyContent: 'center' }}
              title="Copy base URL to clipboard"
            >
              {copied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Proxy Routes</span>
            <div className="stat-card-icon"><Layers size={18} /></div>
          </div>
          <div className="stat-card-value">{overview.activeApps} / {overview.totalApps}</div>
          <div className="stat-card-subtitle">Active vs total apps</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Total Webhooks</span>
            <div className="stat-card-icon"><Activity size={18} /></div>
          </div>
          <div className="stat-card-value">{overview.totalWebhooks}</div>
          <div className="stat-card-subtitle">{overview.webhooksLast24h} in last 24h</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Success Rate</span>
            <div className="stat-card-icon"><CheckCircle size={18} /></div>
          </div>
          <div className="stat-card-value">{successRate}%</div>
          <div className="stat-card-subtitle">{overview.successCount} successful deliveries</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Avg Latency</span>
            <div className="stat-card-icon"><Clock size={18} /></div>
          </div>
          <div className="stat-card-value">{overview.avgLatencyMs}ms</div>
          <div className="stat-card-subtitle">Mean delivery duration</div>
        </div>
      </div>

      {/* 7-Day Traffic Trend Graph */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">
          <span>7-Day Daily Traffic Trend</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span> Success
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }}></span> Failed
            </span>
          </span>
        </div>
        {trend.length === 0 || trend.every(d => d.total === 0) ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <Activity className="empty-state-icon" size={32} />
            <h3>No traffic recorded in the last 7 days</h3>
            <p>Once webhooks hit your endpoints, traffic trend lines will display here.</p>
          </div>
        ) : (
          <div className="chart-container" style={{ height: '220px', paddingLeft: '10px', paddingRight: '10px' }}>
            {trend.map((day, index) => {
              const heightPercentage = Math.max(8, Math.round((day.total / maxTrendCount) * 100));
              const successHeight = day.total > 0 ? Math.round((day.success / day.total) * 100) : 0;
              const failedHeight = day.total > 0 ? Math.round((day.failed / day.total) * 100) : 0;
              
              return (
                <div key={day.date || index} className="chart-bar-wrapper">
                  <div 
                    className="chart-bar-fill" 
                    style={{ 
                      height: `${heightPercentage}%`, 
                      minHeight: '20px',
                      width: '32px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    {/* Success segment */}
                    <div style={{
                      height: `${successHeight}%`,
                      width: '100%',
                      background: 'var(--success-gradient)'
                    }}></div>
                    {/* Failed segment */}
                    <div style={{
                      height: `${failedHeight}%`,
                      width: '100%',
                      background: 'var(--danger-gradient)'
                    }}></div>
                    
                    <div className="chart-tooltip">
                      <strong>{day.label}</strong><br/>
                      Total: {day.total}<br/>
                      <span style={{ color: 'var(--color-success)' }}>Success: {day.success}</span><br/>
                      <span style={{ color: 'var(--color-danger)' }}>Failed: {day.failed}</span>
                    </div>
                  </div>
                  <span className="chart-label" style={{ fontSize: '0.75rem', marginTop: '4px' }}>{day.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Split details layout */}
      <div className="charts-section">
        {/* Webhook Volume Chart */}
        <div className="card">
          <div className="card-title">Webhook Volume by Route</div>
          {appBreakdown.length === 0 ? (
            <div className="empty-state">
              <Activity className="empty-state-icon" size={32} />
              <h3>No traffic data yet</h3>
              <p>Send a webhook to one of your proxy routes to see metrics here.</p>
            </div>
          ) : (
            <div className="chart-container">
              {appBreakdown.map((app, index) => {
                const heightPercentage = Math.max(10, Math.round((app.total / maxWebhookCount) * 100));
                return (
                  <div key={app.applicationId || index} className="chart-bar-wrapper">
                    <div 
                      className="chart-bar-fill" 
                      style={{ 
                        height: `${heightPercentage}%`, 
                        minHeight: '20px' 
                      }}
                    >
                      <div className="chart-tooltip">
                        <strong>{app.name}</strong><br/>
                        {app.total} requests
                      </div>
                    </div>
                    <span className="chart-label">{app.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Route Breakdown List */}
        <div className="card">
          <div className="card-title">Route Health</div>
          {appBreakdown.length === 0 ? (
            <div className="empty-state">
              <CheckCircle className="empty-state-icon" size={32} />
              <h3>All clear</h3>
              <p>Configure applications and routes to view health stats.</p>
            </div>
          ) : (
            <div className="app-breakdown-list">
              {appBreakdown.map((app, index) => (
                <div key={app.applicationId || index} className="app-breakdown-item">
                  <div className="app-breakdown-info">
                    <span className="app-breakdown-name">{app.name}</span>
                    <span className="app-breakdown-slug">/webhook/{user.username}/{app.appType}</span>
                  </div>
                  <div className="app-breakdown-metrics">
                    <span className={`app-breakdown-rate ${app.successRate >= 90 ? 'badge-success' : app.successRate >= 50 ? 'badge-warning' : 'badge-danger'} badge`}>
                      {app.successRate}%
                    </span>
                    <span className="app-breakdown-latency">{app.avgLatencyMs}ms avg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
