import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Activity, Layers, ServerCrash, Key } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AppConfig from './components/AppConfig';
import Logs from './components/Logs';
import Alert from './components/Alert';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('webhook_proxy_api_key') || '');
  
  // Data States
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  
  // Filter States for Logs
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [logPage, setLogPage] = useState(1);
  
  // App/system states
  const [alert, setAlert] = useState(null);
  const [retryingLogIds, setRetryingLogIds] = useState([]);

  const showAlert = useCallback((type, message) => {
    setAlert({ type, message });
  }, []);

  // Helper function for API requests
  const apiRequest = useCallback(async (path, options = {}) => {
    const url = `/webhook/api${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        showAlert('error', 'Unauthorized: Invalid or missing API key. Configure it in the sidebar.');
        throw new Error('Unauthorized');
      }
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (error) {
      console.error(`API Error on ${path}:`, error);
      throw error;
    }
  }, [apiKey, showAlert]);

  // Save API key
  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('webhook_proxy_api_key', val);
  };

  // Fetch applications
  const fetchApps = useCallback(async () => {
    try {
      const data = await apiRequest('/apps');
      setApps(data);
    } catch (err) {
      // Handled by apiRequest
    }
  }, [apiRequest]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiRequest('/stats');
      setStats(data);
    } catch (err) {
      // Handled by apiRequest
    }
  }, [apiRequest]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      let query = `?page=${logPage}&limit=15`;
      if (selectedApp) query += `&applicationId=${selectedApp}`;
      if (selectedStatus) query += `&status=${selectedStatus}`;
      
      const data = await apiRequest(`/logs${query}`);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      // Handled by apiRequest
    }
  }, [apiRequest, logPage, selectedApp, selectedStatus]);

  // Refresh active tab data
  const refreshData = useCallback(() => {
    fetchApps();
    if (activeTab === 'dashboard') {
      fetchStats();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchApps, fetchStats, fetchLogs]);

  // Fetch initial data and setup polling
  useEffect(() => {
    refreshData();
    
    // Setup background polling (every 5 seconds) to keep dashboard/logs fresh
    const interval = setInterval(() => {
      refreshData();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // CRUD Actions
  const handleSaveApp = async (id, appData) => {
    try {
      if (id) {
        // Edit Mode
        const updated = await apiRequest(`/apps/${id}`, {
          method: 'PUT',
          body: JSON.stringify(appData)
        });
        showAlert('success', `Route "${updated.name}" updated successfully`);
      } else {
        // Create Mode
        const created = await apiRequest('/apps', {
          method: 'POST',
          body: JSON.stringify(appData)
        });
        showAlert('success', `Route "${created.name}" registered successfully`);
      }
      fetchApps();
      fetchStats();
    } catch (err) {
      showAlert('error', err.message || 'Failed to save application');
    }
  };

  const handleDeleteApp = async (id) => {
    try {
      const response = await apiRequest(`/apps/${id}`, {
        method: 'DELETE'
      });
      showAlert('success', response.message);
      fetchApps();
      fetchStats();
      if (selectedApp === id) setSelectedApp('');
    } catch (err) {
      showAlert('error', err.message || 'Failed to delete application');
    }
  };

  // Manual Retry Log
  const handleRetryLog = async (logId) => {
    setRetryingLogIds(prev => [...prev, logId]);
    try {
      await apiRequest(`/logs/${logId}/retry`, {
        method: 'POST'
      });
      showAlert('success', 'Manual retry executed successfully');
      fetchLogs();
      fetchStats();
    } catch (err) {
      showAlert('error', err.message || 'Failed to retry webhook delivery');
    } finally {
      setRetryingLogIds(prev => prev.filter(id => id !== logId));
    }
  };

  // Log filter handlers
  const handleFilterChange = (type, value) => {
    if (type === 'reset') {
      setSelectedApp('');
      setSelectedStatus('');
      setLogPage(1);
    } else {
      if (type === 'app') setSelectedApp(value);
      if (type === 'status') setSelectedStatus(value);
      setLogPage(1); // Reset to first page
    }
  };

  return (
    <div className="app-container">
      {/* Decorative blobs */}
      <div className="glow-blob glow-blob-1"></div>
      <div className="glow-blob glow-blob-2"></div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Layout size={20} />
          </div>
          <span className="brand-name">EchoRoute</span>
        </div>

        <ul className="sidebar-menu">
          <li 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity size={18} />
            <span>Dashboard</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveTab('routes')}
          >
            <Layers size={18} />
            <span>Proxy Routes</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <ServerCrash size={18} />
            <span>Delivery Logs</span>
          </li>
        </ul>

        {/* API Key Panel (For authorization) */}
        <div className="auth-panel">
          <div className="auth-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={12} />
              <span>Admin Security</span>
            </div>
          </div>
          <div className="auth-input-container">
            <input 
              type="password" 
              className="auth-input" 
              placeholder="Enter API Key..."
              value={apiKey}
              onChange={handleApiKeyChange}
              title="Enter matching ADMIN_API_KEY if configured in backend"
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && stats && (
          <Dashboard 
            stats={stats} 
            onViewLogsOfApp={(appId) => {
              setSelectedApp(appId);
              setActiveTab('logs');
            }}
          />
        )}

        {activeTab === 'routes' && (
          <AppConfig 
            apps={apps}
            onSave={handleSaveApp}
            onDelete={handleDeleteApp}
            onShowAlert={showAlert}
          />
        )}

        {activeTab === 'logs' && (
          <Logs 
            logs={logs}
            pagination={pagination}
            apps={apps}
            selectedApp={selectedApp}
            selectedStatus={selectedStatus}
            page={logPage}
            onFilterChange={handleFilterChange}
            onPageChange={setLogPage}
            onRetry={handleRetryLog}
            retryingLogIds={retryingLogIds}
          />
        )}
      </main>

      {/* Alert Banner / Toast notifications */}
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
