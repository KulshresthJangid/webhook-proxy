import React from 'react';
import { Activity, CheckCircle, AlertOctagon, Clock, Layers } from 'lucide-react';

export default function Dashboard({ stats, onViewLogsOfApp }) {
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

  // Calculate success rate safely
  const successRate = overview.totalWebhooks > 0 
    ? Math.round((overview.successCount / overview.totalWebhooks) * 100) 
    : 0;

  // Custom Chart Data: Find max count to scale the bars
  const maxWebhookCount = Math.max(...appBreakdown.map(app => app.total), 1);

  return (
    <div className="dashboard-view">
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

      {/* Main Stats Charts & Breakdown Section */}
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
                    <span className="app-breakdown-slug">/webhook/{app.appType}</span>
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
