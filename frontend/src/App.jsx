import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Activity, Layers, ServerCrash, LogOut, User as UserIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AppConfig from './components/AppConfig';
import Logs from './components/Logs';
import Alert from './components/Alert';
import Login from './components/Login';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth States
  const [token, setToken] = useState(() => localStorage.getItem('webhook_proxy_token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('webhook_proxy_user');
    return saved ? JSON.parse(saved) : null;
  });
  
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

  const handleLogout = useCallback(() => {
    setToken('');
    setUser(null);
    localStorage.removeItem('webhook_proxy_token');
    localStorage.removeItem('webhook_proxy_user');
    setApps([]);
    setStats(null);
    setLogs([]);
  }, []);

  // Helper function for API requests
  const apiRequest = useCallback(async (path, options = {}) => {
    const url = `/webhook/api${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        handleLogout();
        showAlert('error', 'Session expired or unauthorized. Please log in again.');
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
  }, [token, handleLogout, showAlert]);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('webhook_proxy_token', newToken);
    localStorage.setItem('webhook_proxy_user', JSON.stringify(newUser));
    showAlert('success', `Logged in successfully as ${newUser.username}!`);
    setActiveTab('dashboard');
  };

  // Fetch applications
  const fetchApps = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest('/apps');
      setApps(data);
    } catch (err) {
      // Handled by apiRequest
    }
  }, [token, apiRequest]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest('/stats');
      setStats(data);
    } catch (err) {
      // Handled by apiRequest
    }
  }, [token, apiRequest]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!token) return;
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
  }, [token, apiRequest, logPage, selectedApp, selectedStatus]);

  // Refresh active tab data
  const refreshData = useCallback(() => {
    if (!token) return;
    fetchApps();
    if (activeTab === 'dashboard') {
      fetchStats();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [token, activeTab, fetchApps, fetchStats, fetchLogs]);

  // Fetch initial data and setup polling
  useEffect(() => {
    if (!token) return;
    refreshData();
    
    const interval = setInterval(() => {
      refreshData();
    }, 5000);

    return () => clearInterval(interval);
  }, [token, refreshData]);

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

  // If not logged in, render the login/signup portal
  if (!token || !user) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        <Alert alert={alert} onClose={() => setAlert(null)} />
      </>
    );
  }

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

        {/* User Account Info and Logout */}
        <div className="auth-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {user.username.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.username}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user.email}
              </div>
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '8px' }}
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && stats && (
          <Dashboard 
            stats={stats} 
            user={user}
            onViewLogsOfApp={(appId) => {
              setSelectedApp(appId);
              setActiveTab('logs');
            }}
          />
        )}

        {activeTab === 'routes' && (
          <AppConfig 
            apps={apps}
            user={user}
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
