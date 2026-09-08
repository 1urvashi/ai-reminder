import { useState } from 'react';

// A plain <input type="password"> with a show/hide eye icon docked INSIDE
// the field (not a separate button beside it) — used anywhere a password is
// typed (login, register, staff creation, change password).
export default function PasswordInput({ value, onChange, placeholder, minLength, required, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        style={{ paddingRight: '2.4rem', width: '100%' }}
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
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
