import React, { useState } from 'react';
import { Layout, Key, User, Mail, ShieldAlert } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form inputs
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setUsername('');
    setEmail('');
    setUsernameOrEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isLogin ? '/webhook/api/auth/login' : '/webhook/api/auth/signup';
    const payload = isLogin 
      ? { usernameOrEmail: usernameOrEmail.trim(), password }
      : { username: username.trim(), email: email.trim(), password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Visual background blobs */}
      <div className="glow-blob glow-blob-1" style={{ width: '400px', height: '400px' }}></div>
      <div className="glow-blob glow-blob-2" style={{ width: '400px', height: '400px' }}></div>

      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '36px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div className="brand-icon" style={{ marginBottom: '12px', width: '48px', height: '48px' }}>
            <Layout size={24} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>EchoRoute</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {isLogin ? 'Sign in to manage your webhook routes' : 'Register for your free proxy account'}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isLogin ? (
            /* Login Fields */
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter your username or email"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                  required
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              </div>
            </div>
          ) : (
            /* Signup Fields */
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Alphanumeric slug, e.g. john"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingLeft: '36px' }}
                    required
                  />
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: '36px' }}
                    required
                  />
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '36px' }}
                required
              />
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            type="button" 
            onClick={toggleMode}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              outline: 'none'
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
