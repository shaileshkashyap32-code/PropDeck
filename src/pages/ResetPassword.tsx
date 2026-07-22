import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  token: string;
  onDone: () => void;
}

export default function ResetPassword({ token, onDone }: Props) {
  // We no longer pre-check the token against the database from the browser
  // (the salespersons table is private now). We show the form straight away and
  // let confirm_password_reset validate the token when the new password is set.
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    // The database hashes the token, checks it hasn't expired, and stores the
    // new password as a bcrypt hash — all server-side. Returns false if the
    // link is bad or expired.
    const { data, error: rpcError } = await supabase.rpc('confirm_password_reset', {
      p_token: token,
      p_new_password: newPassword,
    });
    setSaving(false);

    if (rpcError) {
      setError('Something went wrong: ' + rpcError.message);
      return;
    }
    if (data !== true) {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    setDone(true);
  };

  const cardWrapper = (children: React.ReactNode) => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, var(--bg-from) 0%, var(--bg-to) 50%, var(--bg-from) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 420,
          margin: '0 16px',
          borderRadius: 20,
          padding: 40,
          background: 'var(--bg-raised)',
          border: '1.5px solid #4338CA',
          boxShadow: '0 25px 60px var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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
              color: '#FFFFFF',
              fontSize: 18,
            }}
          >
            P
          </div>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>PropDeck</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
          Sales Enablement for Real Estate
        </p>
        {children}
      </div>
    </div>
  );

  if (done) {
    return cardWrapper(
      <div>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          Password updated ✓
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          You can now log in with your new password.
        </p>
        <button
          onClick={onDone}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return cardWrapper(
    <div>
      <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Set a new password
      </h1>
      <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 28 }}>
        Choose something you'll remember.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}
          >
            New Password
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
              height: 48,
              borderRadius: 12,
              background: 'var(--bg-inset)',
              border: '1.5px solid #3730A3',
            }}
          >
            <span>🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label
            style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}
          >
            Confirm Password
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
              height: 48,
              borderRadius: 12,
              background: 'var(--bg-inset)',
              border: '1.5px solid #3730A3',
            }}
          >
            <span>🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, flex: 1 }}
            />
          </div>
        </div>

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

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 15,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Set New Password'}
        </button>
      </form>
    </div>
  );
}
