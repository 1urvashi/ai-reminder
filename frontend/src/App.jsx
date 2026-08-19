import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import Reminders from './pages/Reminders';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import Kanban from './pages/Kanban';
import Staff from './pages/Staff';
import Habits from './pages/Habits';
import Notifications from './pages/Notifications';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import NotificationCenter from './components/NotificationCenter';
import IncomingCallOverlay from './components/IncomingCallOverlay';
import LocationWatcher from './components/LocationWatcher';
import { NotificationsProvider } from './context/NotificationsContext';

function Protected({ children, wide }) {
  return (
    <PrivateRoute>
      <AppLayout wide={wide}>{children}</AppLayout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <NotificationsProvider>
      <NotificationCenter />
      <IncomingCallOverlay />
      <LocationWatcher />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/chat" element={<Protected wide><Chat /></Protected>} />
        <Route path="/reminders" element={<Protected><Reminders /></Protected>} />
        <Route path="/calendar" element={<Protected wide><CalendarPage /></Protected>} />
        <Route path="/kanban" element={<Protected wide><Kanban /></Protected>} />
        <Route path="/staff" element={<Protected><Staff /></Protected>} />
        <Route path="/habits" element={<Protected><Habits /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
      </Routes>
    </NotificationsProvider>
  );
}
