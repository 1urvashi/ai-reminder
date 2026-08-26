import { useEffect, useRef } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { distanceMeters } from '../utils/geo';
import { createRingtone } from '../utils/ringtone';

const ringtone = createRingtone();
const POLL_MS = 2 * 60 * 1000;

// Free, client-side geofencing: while the app is open (or installed as a
// PWA and in the foreground), watches the browser's location and alerts
// when the user enters the radius of a location-tagged reminder. No maps
// API, no background/lock-screen support — that would need a native app.
export default function LocationWatcher() {
  const { user } = useAuth();
  const remindersRef = useRef([]);
  const insideRef = useRef(new Set());

  useEffect(() => {
    if (!user) return undefined;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    function loadReminders() {
      client
        .get('/reminders')
        .then((res) => {
          remindersRef.current = res.data.reminders.filter(
            (r) => r.location && r.location.lat !== null && !r.completed
          );
        })
        .catch(() => {});
    }
    loadReminders();
    const pollId = setInterval(loadReminders, POLL_MS);

    function alertFor(reminder) {
      const body = `📍 ${reminder.location.label || 'Nearby'}: ${reminder.title}`;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('RemindAI', { body, icon: '/favicon.svg' });
      }
      ringtone.start();
      setTimeout(ringtone.stop, 2500);
      if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(body));
      }
    }

    function onPosition(pos) {
      const { latitude, longitude } = pos.coords;
      for (const reminder of remindersRef.current) {
        const dist = distanceMeters(latitude, longitude, reminder.location.lat, reminder.location.lng);
        const isInside = dist <= reminder.location.radiusMeters;
        const wasInside = insideRef.current.has(reminder.id);
        if (isInside && !wasInside) {
          insideRef.current.add(reminder.id);
          alertFor(reminder);
        } else if (!isInside && wasInside) {
          insideRef.current.delete(reminder.id);
        }
      }
    }

    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(onPosition, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 20000,
      });
    }

    return () => {
      clearInterval(pollId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  return null;
}
