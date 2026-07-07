import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  token: string;
  onDone: () => void;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function ResetPassword({ token, onDone }: Props) {
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [salespersonId, setSalespersonId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const hash = await sha256Hex(token);
      const { data } = await supabase
        .from('salespersons')
        .select('id, reset_token_expires_at')
        .eq('reset_token_hash', hash)
        .maybeSingle();

      const expiry = data?.reset_token_expires_at
        ? new Date(data.reset_token_expires_at)
        : null;

      if (!data || !expiry || expiry < new Date()) {
        setStatus('invalid');
        return;
      }
      setSalespersonId(data.id);
      setStatus('valid');
    })();
  }, [token]);

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
    if (!salespersonId) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from('salespersons')
      .update({
        password: newPassword,
        reset_token_hash: null,
        reset_token_expires_at: null,
      })
      .eq('id', salespersonId);
    setSaving(false);

    if (updateError) {
      setError('Something went wrong: ' + updateError.message);
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
          'linear-gradient(135deg, #0F0C29 0%, #1E1B4B 50%, #0F0C29 100%)',
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
          background: '#1E1B4B',
          border: '1.5px solid #4338CA',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
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
              color: 'white',
              fontSize: 18,
            }}
          >
            P
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>PropDeck</span>
        </div>
        <p style={{ color: '#A5B4FC', fontSize: 13, marginBottom: 28 }}>
          Sales Enablement for Real Estate
        </p>
        {children}
      </div>
    </div>
  );

  if (status === 'checking') {
    return cardWrapper(
      <p style={{ color: '#A5B4FC', fontSize: 14 }}>Checking your link…</p>
    );
  }

  if (status === 'invalid') {
    return cardWrapper(
      <div>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          Link expired
        </h1>
        <p style={{ color: '#A5B4FC', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          This reset link is invalid or has expired. Links are valid for 1 hour — go back and
          request a new one from the login screen.
        </p>
        <button
          onClick={onDone}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg,#4F46E5,#9333EA)',
            color: 'white',
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

  if (done) {
    return cardWrapper(
      <div>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          Password updated ✓
        </h1>
        <p style={{ color: '#A5B4FC', fontSize: 14, marginBottom: 24 }}>
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
            color: 'white',
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
      <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Set a new password
      </h1>
      <p style={{ color: '#818CF8', fontSize: 13, marginBottom: 28 }}>
        Choose something you'll remember.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', color: '#A5B4FC', fontSize: 12, fontWeight: 500, marginBottom: 8 }}
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
              background: '#0F0D2E',
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
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14, flex: 1 }}
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
            style={{ display: 'block', color: '#A5B4FC', fontSize: 12, fontWeight: 500, marginBottom: 8 }}
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
              background: '#0F0D2E',
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
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14, flex: 1 }}
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
            color: 'white',
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
