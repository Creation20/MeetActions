import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Safety check for Expo Go (especially Android SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo || Platform.OS === 'ios') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('Notifications handler could not be initialized:', e);
  }
}

export const requestNotificationPermissions = async () => {
  if (isExpoGo && Platform.OS === 'android') {
    console.warn('Notification permissions are limited in Expo Go on Android SDK 53+');
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    return false;
  }
};

export const scheduleTaskReminder = async (taskId: string, title: string, dueDate: Date) => {
  if (isExpoGo && Platform.OS === 'android') return null;

  try {
    const trigger = new Date(dueDate);
    // Remind 10 minutes before
    trigger.setMinutes(trigger.getMinutes() - 10);

    if (trigger.getTime() < Date.now()) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Reminder',
        body: `Upcoming task: ${title}`,
        data: { taskId },
      },
      trigger: trigger as any,
    });
  } catch (e) {
    console.error('Failed to schedule notification:', e);
    return null;
  }
};

export const cancelReminder = async (notificationId: string) => {
  if (isExpoGo && Platform.OS === 'android') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {}
};
