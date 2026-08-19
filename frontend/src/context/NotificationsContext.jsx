import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const NotificationsContext = createContext(null);

// Wraps the polling hook once so multiple UI pieces (toast stack, incoming-call
// overlay) share a single interval instead of each polling the backend.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const value = useNotifications(Boolean(user));
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used within NotificationsProvider');
  return ctx;
}
