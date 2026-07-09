import { useState } from 'react';
import { supabase, saveSession } from '../lib/supabase';

interface Props {
  onLogin: (user: any) => void;
  googleError?: string;
}

export default function Login({ onLogin, googleError }: Props) {
  const [identifier, setIdentifier] = useState(''); // mobile number OR email — both are valid login credentials
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── Forgot password state ─────────────────────────────────────────────
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotMsgType, setForgotMsgType] = useState<'ok' | 'err'>('ok');

  const handleGoogleLogin = async () => {
    // Redirects out to Google, then back to the app. App.tsx catches the
    // returning session and checks the email against the salespersons table.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Password is verified INSIDE the database by verify_login (which compares
    // bcrypt hashes) — the browser never downloads the password. On success we
    // get back the account plus a session token to remember the login by.
    const { data, error: dbError } = await supabase.rpc('verify_login', {
      p_identifier: identifier,
      p_password: password,
    });

    const person = Array.isArray(data) ? data[0] : data;

    if (dbError || !person) {
      setError(
        dbError
          ? `Error: ${dbError.message}`
          : 'Invalid credentials. Try again.'
      );
      setLoading(false);
      return;
    }

    saveSession(person.session_token);
    onLogin(person);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg('');

    try {
      const res = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch {
      // Swallow errors here on purpose — we show the same generic message either way,
      // so we never reveal whether a given account exists.
    }

    setForgotMsgType('ok');
    setForgotMsg(
      "If that account exists, we've sent a reset link — check your inbox and spam."
    );
    setForgotLoading(false);
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

        {mode === 'login' ? (
          <>
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
              {/* Mobile or Email */}
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
                  Mobile Number or Email
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
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Mobile number or email"
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      color: '#A5B4FC',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setForgotMsg('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#818CF8',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
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

            {/* Error passed down from App.tsx when a Google email isn't in the team list */}
            {googleError && (
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#FCA5A5',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {googleError}
              </div>
            )}

            {/* OR divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '20px 0',
              }}
            >
              <div style={{ flex: 1, height: 1, background: '#2D2B6B' }} />
              <span style={{ color: '#6366F1', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#2D2B6B' }} />
            </div>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: '1.5px solid #3730A3',
                background: '#0F0D2E',
                color: 'white',
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              Continue with Google
            </button>
          </>
        ) : (
          <>
            <h1
              style={{
                color: 'white',
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Reset password
            </h1>
            <p style={{ color: '#818CF8', fontSize: 13, marginBottom: 28 }}>
              Enter your mobile number or email and we'll send a reset link.
            </p>

            <form onSubmit={handleForgotSubmit}>
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
                  Mobile Number or Email
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
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Mobile number or email"
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

              {forgotMsg && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background:
                      forgotMsgType === 'ok'
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${
                      forgotMsgType === 'ok'
                        ? 'rgba(16,185,129,0.3)'
                        : 'rgba(239,68,68,0.3)'
                    }`,
                    color: forgotMsgType === 'ok' ? '#6EE7B7' : '#FCA5A5',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {forgotMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: forgotLoading ? 'default' : 'pointer',
                  opacity: forgotLoading ? 0.7 : 1,
                }}
              >
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setForgotMsg('');
              }}
              style={{
                marginTop: 16,
                background: 'none',
                border: 'none',
                color: '#818CF8',
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'center',
                padding: 0,
              }}
            >
              ← Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
