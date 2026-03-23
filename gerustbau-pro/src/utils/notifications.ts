/**
 * Local deadline-reminder notifications.
 *
 * Two notifications are scheduled per project when a `termin` date is set:
 *   • 7 days before  (reminder)
 *   • 1 day before   (last warning)
 *
 * Notification IDs are deterministic so re-setting a termin cancels the old
 * notifications and creates new ones.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Channel setup (Android) ────────────────────────────────────────────────

export async function richteNotificationKanalEin() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('termine', {
      name: 'Terminbenachrichtigungen',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1565C0',
    });
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Permission request ──────────────────────────────────────────────────────

export async function berechtigungAnfordern(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notifId(projektId: string, tageVorher: number) {
  return `termin_${projektId}_${tageVorher}d`;
}

function terminDate(isoDate: string, tageVorher: number): Date | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(isoDate + 'T08:00:00');
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - tageVorher);
  return d;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function scheduleTerminNotifications(
  projektId: string,
  projektName: string,
  terminIso: string | null | undefined,
) {
  // Cancel existing notifications for this project first
  await cancelTerminNotifications(projektId);

  if (!terminIso) return;

  const berechtigt = await berechtigungAnfordern();
  if (!berechtigt) return;

  const jetzt = Date.now();

  const erinnerungen: Array<{ tage: number; titel: string; body: string }> = [
    {
      tage: 7,
      titel: '📅 Termin in 7 Tagen',
      body: `Gerüstprojekt „${projektName}" ist in einer Woche fällig.`,
    },
    {
      tage: 1,
      titel: '⚠️ Termin morgen!',
      body: `Gerüstprojekt „${projektName}" ist morgen fällig. Alles erledigt?`,
    },
  ];

  for (const { tage, titel, body } of erinnerungen) {
    const datum = terminDate(terminIso, tage);
    if (!datum || datum.getTime() <= jetzt) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: notifId(projektId, tage),
      content: {
        title: titel,
        body,
        data: { projektId },
        ...(Platform.OS === 'android' && { channelId: 'termine' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: datum,
      },
    });
  }
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelTerminNotifications(projektId: string) {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(notifId(projektId, 7)).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(notifId(projektId, 1)).catch(() => {}),
  ]);
}
