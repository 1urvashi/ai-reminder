import { useState } from 'react';

// A plain <input type="password"> plus a show/hide eye toggle — used
// anywhere a password is typed (login, register, staff creation, change
// password) so a mistyped password isn't silently submitted.
export default function PasswordInput({ value, onChange, placeholder, minLength, required, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="row" style={{ gap: '0.4rem' }}>
      <input
        className="input"
        style={{ flex: 1 }}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
