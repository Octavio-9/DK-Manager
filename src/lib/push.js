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

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '')
}

// L'app tourne-t-elle en mode installé (écran d'accueil), pas dans un onglet Safari ?
function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
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
  // Sur iPhone/iPad, le push n'est possible que depuis l'app installée sur l'écran d'accueil.
  if (isIos() && !isStandalone()) {
    throw new Error(
      "Sur iPhone : ouvrez l'app depuis son icône sur l'écran d'accueil. " +
      "Si elle n'y est pas, ajoutez-la via Partager → « Sur l'écran d'accueil », puis réessayez.",
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error("Permission refusée. Autorisez les notifications pour cette app.")
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    } catch (err) {
      if (isIos()) {
        throw new Error(
          "iOS a refusé l'abonnement. L'app a probablement été ajoutée à l'écran d'accueil avant " +
          "l'activation des notifications : retirez l'icône, rajoutez l'app (Partager → « Sur l'écran " +
          "d'accueil »), rouvrez-la depuis l'icône, puis réessayez.",
          { cause: err },
        )
      }
      throw new Error(err?.message || "Échec de l'abonnement aux notifications.", { cause: err })
    }
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
