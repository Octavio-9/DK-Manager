import { supabase } from './supabase'

// Clé VAPID publique (publique par nature — sert à identifier notre serveur d'envoi).
// La clé privée correspondante est un secret de l'Edge Function `send-push`.
const VAPID_PUBLIC_KEY = 'BBiEVv3khfSEScXjOi86SIEwrjzuRMfTh3jmNZ5wC7McFkrt7n4o-WLoSdSyW3KtMwlNwnLCNw02ahWM6bD_j0Y'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// 'granted' | 'denied' | 'default' | 'unsupported'
export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// Demande la permission, abonne l'appareil et enregistre l'abonnement en base.
export async function enablePush(userId) {
  if (!isPushSupported()) {
    throw new Error("Les notifications push ne sont pas supportées sur cet appareil/navigateur.")
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error("Permission refusée. Autorisez les notifications pour cette app.")
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('PushSubscription').upsert(
    {
      userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return true
}

// Désabonne l'appareil courant et retire l'abonnement de la base.
export async function disablePush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await supabase.from('PushSubscription').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  }
}
