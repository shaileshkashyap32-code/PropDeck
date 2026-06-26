import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: Props) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: dbError } = await supabase
      .from('salespersons')
      .select('*')
      .eq('mobile_number', mobile)
      .eq('password', password)
      .maybeSingle();

    if (dbError || !data) {
      setError(
        dbError
          ? `Error: ${dbError.message}`
          : 'Invalid credentials. Try again.'
      );
      setLoading(false);
      return;
    }

    onLogin(data);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #0F0C29 0%, #1E1B4B 50%, #0F0C29 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow orbs */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          right: '25%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: '#7C3AED',
          opacity: 0.15,
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '25%',
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: '#4338CA',
          opacity: 0.12,
          filter: 'blur(80px)',
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 420,
          margin: '0 16px',
          borderRadius: 20,
          padding: 40,
          background: '#1E1B4B',
          border: '1.5px solid #4338CA',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: 'white',
              fontSize: 18,
            }}
          >
            P
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>
            PropDeck
          </span>
        </div>
        <p style={{ color: '#A5B4FC', fontSize: 13, marginBottom: 28 }}>
          Sales Enablement for Real Estate
        </p>

        <h1
          style={{
            color: 'white',
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Welcome back
        </h1>
        <p style={{ color: '#818CF8', fontSize: 13, marginBottom: 28 }}>
          Log in to your workspace
        </p>

        <form onSubmit={handleLogin}>
          {/* Mobile */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                color: '#A5B4FC',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Mobile Number
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 14px',
                height: 48,
                borderRadius: 12,
                background: '#0F0D2E',
                border: '1.5px solid #3730A3',
              }}
            >
              <span>📱</span>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter 10-digit number"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 14,
                  flex: 1,
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 22 }}>
            <label
              style={{
                display: 'block',
                color: '#A5B4FC',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 14px',
                height: 48,
                borderRadius: 12,
                background: '#0F0D2E',
                border: '1.5px solid #3730A3',
              }}
            >
              <span>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 14,
                  flex: 1,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
              color: 'white',
              fontWeight: 600,
              fontSize: 15,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in...' : 'Login →'}
          </button>
        </form>

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid #2D2B6B',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#6366F1', fontSize: 12 }}>
            Need access? Contact your admin.
          </p>
        </div>
      </div>
    </div>
  );
}
