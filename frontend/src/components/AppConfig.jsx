import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Copy, Check, ExternalLink, X, Settings } from 'lucide-react';

export default function AppConfig({ apps, user, onSave, onDelete, onShowAlert }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [appType, setAppType] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [headers, setHeaders] = useState([]);
  const [maxRetries, setMaxRetries] = useState(3);
  const [delaySeconds, setDelaySeconds] = useState(5);

  const openCreateModal = () => {
    setEditingApp(null);
    setName('');
    setAppType('');
    setTargetUrl('');
    setIsActive(true);
    setHeaders([]);
    setMaxRetries(3);
    setDelaySeconds(5);
    setIsModalOpen(true);
  };

  const openEditModal = (app) => {
    setEditingApp(app);
    setName(app.name);
    setAppType(app.appType);
    setTargetUrl(app.targetUrl);
    setIsActive(app.isActive);
    setHeaders(app.headers ? [...app.headers] : []);
    setMaxRetries(app.retryConfig?.maxRetries ?? 3);
    setDelaySeconds(app.retryConfig?.delaySeconds ?? 5);
    setIsModalOpen(true);
  };

  const handleHeaderChange = (index, field, value) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const addHeaderField = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeaderField = (index) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleCopyEndpoint = (slug, id) => {
    const fullUrl = `${window.location.origin}/webhook/${user.username}/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    onShowAlert('success', 'Webhook URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!name.trim() || !appType.trim() || !targetUrl.trim()) {
      onShowAlert('error', 'Please fill in all required fields');
      return;
    }

    if (!/^[a-z0-9-_]+$/.test(appType)) {
      onShowAlert('error', 'Route Slug must contain only lowercase letters, numbers, dashes, and underscores');
      return;
    }

    // Filter out empty headers
    const filteredHeaders = headers.filter(h => h.key.trim() && h.value.trim());

    const appData = {
      name,
      appType: appType.toLowerCase().trim(),
      targetUrl: targetUrl.trim(),
      isActive,
      headers: filteredHeaders,
      retryConfig: {
        maxRetries: Number(maxRetries),
        delaySeconds: Number(delaySeconds)
      }
    };

    onSave(editingApp?._id, appData);
    setIsModalOpen(false);
  };

  return (
    <div className="app-config-view">
      <div className="header">
        <div className="header-title">
          <h1>Webhook Routes</h1>
          <p>Configure and manage webhook proxy endpoints</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          Create Route
        </button>
      </div>

      <div className="card">
        {apps.length === 0 ? (
          <div className="empty-state">
            <Settings className="empty-state-icon" size={48} />
            <h3>No proxy routes configured</h3>
            <p>Click "Create Route" to register your first application proxy.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Application Name</th>
                  <th>Route Endpoint</th>
                  <th>Target Destination</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-warning" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          /webhook/{user.username}/{app.appType}
                        </span>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleCopyEndpoint(app.appType, app._id)}
                          title="Copy proxy endpoint URL"
                        >
                          {copiedId === app._id ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{app.targetUrl}</span>
                        <a href={app.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${app.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {app.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {app.retryConfig?.maxRetries ?? 3}x ({app.retryConfig?.delaySeconds ?? 5}s)
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(app)} title="Edit configuration">
                          <Edit3 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${app.name}"? This will also remove all its logs.`)) {
                            onDelete(app._id);
                          }
                        }} title="Delete route">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingApp ? 'Edit Webhook Route' : 'Create Webhook Route'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Application Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Slack Notifications"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Route Slug *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. slack-notify"
                    value={appType}
                    onChange={(e) => setAppType(e.target.value)}
                    disabled={!!editingApp}
                    required
                  />
                  <span className="form-helper">This defines the URL path: /webhook/{user.username}/&lt;slug&gt;</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Destination URL *</label>
                <input 
                  type="url" 
                  className="form-control" 
                  placeholder="https://api.slack.com/services/..."
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                />
                <span className="form-helper">The destination endpoint where proxy webhooks are routed</span>
              </div>

              {/* Retry configuration */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Max Retries</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min="0" 
                    max="10"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Retry Interval (seconds)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min="1" 
                    max="60"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(e.target.value)}
                  />
                </div>
              </div>

              {/* Custom Headers */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Forwarded Headers (Optional)</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addHeaderField}>
                    + Add Header
                  </button>
                </div>
                {headers.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    No custom headers configured. Incoming webhook headers are forwarded automatically.
                  </div>
                ) : (
                  headers.map((header, idx) => (
                    <div key={idx} className="headers-input-row">
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Header Name (e.g. Authorization)"
                        value={header.key}
                        onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                      />
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Header Value"
                        value={header.value}
                        onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                      />
                      <button type="button" className="btn btn-danger btn-sm" style={{ padding: '0 12px' }} onClick={() => removeHeaderField(idx)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Active Toggle */}
              <div className="form-group">
                <div className="switch-container" onClick={() => setIsActive(!isActive)}>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      onChange={() => {}} // Controlled by parent div click
                    />
                    <span className="slider"></span>
                  </label>
                  <span>Route Active (incoming webhooks will be proxied)</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingApp ? 'Save Changes' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
