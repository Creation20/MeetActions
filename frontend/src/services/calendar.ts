import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';

export const requestCalendarPermissions = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === 'granted') {
    if (Platform.OS === 'ios') {
      await Calendar.requestRemindersPermissionsAsync();
    }
    return true;
  }
  return false;
};

const getDefaultCalendarSource = async () => {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return defaultCalendar.id;
};

export const syncTaskToCalendar = async (taskTitle: string, dueDate?: string, notes?: string) => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'MeetActions needs calendar access to sync tasks.');
      return;
    }

    const calendarId = await getDefaultCalendarSource();
    
    // Default to tomorrow if no due date
    const start = dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

    await Calendar.createEventAsync(calendarId, {
      title: `Task: ${taskTitle}`,
      startDate: start,
      endDate: end,
      notes: notes || 'Synced from MeetActions AI',
      timeZone: 'GMT',
    });

    Alert.alert('Synced', 'The task has been added to your calendar.');
  } catch (error) {
    console.error('Calendar Sync Error:', error);
    Alert.alert('Sync Error', 'Could not add the event to your calendar.');
  }
};
