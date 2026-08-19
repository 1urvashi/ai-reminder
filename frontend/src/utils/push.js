// Free Web Push subscription helper — no third-party push service, just the
// browser's native PushManager talking to our own backend.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(client) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied');
  }
  const { data } = await client.get('/push/public-key');
  if (!data.publicKey) {
    throw new Error('Push is not configured on the server yet');
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }
  const json = sub.toJSON();
  await client.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return sub;
}

export async function unsubscribeFromPush(client) {
  const sub = await getPushSubscription();
  if (!sub) return;
  await client.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
