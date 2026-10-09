import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "lesson-reminders";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function configureChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Lesson reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function requestReminderPermission() {
  if (Platform.OS === "web") return false;
  await configureChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelLessonReminders(bookingId: string) {
  if (Platform.OS === "web") return;
  await Promise.all(
    [24, 1].map((hours) =>
      Notifications.cancelScheduledNotificationAsync(
        `lesson-${bookingId}-${hours}h`,
      ).catch(() => undefined),
    ),
  );
}

export async function scheduleLessonReminders(
  booking: { _id: string; subject: string; startsAt: string },
  requestPermission = false,
) {
  if (Platform.OS === "web") return false;
  const allowed = requestPermission
    ? await requestReminderPermission()
    : (await Notifications.getPermissionsAsync()).granted;
  if (!allowed) return false;
  await configureChannel();
  await cancelLessonReminders(booking._id);

  const startsAt = new Date(booking.startsAt).getTime();
  const reminders = [
    { hours: 24, label: "tomorrow" },
    { hours: 1, label: "in one hour" },
  ];

  for (const reminder of reminders) {
    const date = new Date(startsAt - reminder.hours * 60 * 60 * 1000);
    if (date.getTime() <= Date.now() + 30_000) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `lesson-${booking._id}-${reminder.hours}h`,
      content: {
        title: "Lesson reminder",
        body: `${booking.subject} starts ${reminder.label}.`,
        sound: true,
        data: { route: `/session/${booking._id}`, bookingId: booking._id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
  return true;
}
