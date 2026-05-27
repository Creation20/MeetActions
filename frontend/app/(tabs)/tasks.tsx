import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GlassCard, Badge, PillTabs } from '../../src/components/ui';
import { fetchMeetings, ApiMeeting, ApiTask, updateTaskStatus } from '../../src/services/api';
import { syncTaskToCalendar } from '../../src/services/calendar';
import { useTheme } from '../../src/context/ThemeContext';
import { getTasksStyles } from '../../src/styles/tasks.styles';

type FilterType = 'All' | 'Pending' | 'Completed';
const FILTERS: FilterType[] = ['All', 'Pending', 'Completed'];

interface ExtendedTask extends ApiTask {
  meetingId: string;
  meetingTitle: string;
}

export default function TasksScreen() {
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getTasksStyles(isDarkMode), [isDarkMode]);
  const [filter, setFilter] = useState<FilterType>('All');
  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchMeetings();
      setMeetings(data);
    } catch (error: any) {
      Alert.alert('Unable to Load Tasks', error.message || 'Something went wrong.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const allTasks = useMemo(() => {
    let tasks: ExtendedTask[] = [];
    meetings.forEach(m => {
      if (m.tasks) {
        m.tasks.forEach(t => {
          tasks.push({ ...t, meetingId: m._id, meetingTitle: m.title });
        });
      }
    });
    return tasks.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return 0;
    });
  }, [meetings]);

  const filteredTasks = useMemo(() => {
    if (filter === 'All') return allTasks;
    if (filter === 'Pending') return allTasks.filter(t => t.status !== 'completed');
    if (filter === 'Completed') return allTasks.filter(t => t.status === 'completed');
    return allTasks;
  }, [allTasks, filter]);

  const toggleTaskStatus = async (taskId: string, meetingId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setMeetings(prev => prev.map(m => {
      if (m._id === meetingId && m.tasks) {
        return {
          ...m,
          tasks: m.tasks.map(t => t._id === taskId ? { ...t, status: newStatus as any } : t)
        };
      }
      return m;
    }));
    await updateTaskStatus(meetingId, taskId, newStatus);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return themeColors.danger;
      case 'medium': return themeColors.warning;
      case 'low': return themeColors.success;
      default: return themeColors.textMuted;
    }
  };

  const renderTask = ({ item }: { item: ExtendedTask }) => (
    <GlassCard style={styles.taskCard}>
      <View style={styles.taskMain}>
        <TouchableOpacity 
          style={styles.checkbox} 
          onPress={() => toggleTaskStatus(item._id, item.meetingId, item.status)}
        >
          {item.status === 'completed' ? (
            <Feather name="check-circle" size={22} color={themeColors.primary} />
          ) : (
            <Feather name="circle" size={22} color={themeColors.textMuted} />
          )}
        </TouchableOpacity>
        <View style={styles.taskContent}>
          <Text style={[styles.taskTitle, item.status === 'completed' && styles.taskCompleted]}>
            {item.title}
          </Text>
          <Text style={styles.meetingRef}>Ref: {item.meetingTitle}</Text>
        </View>
      </View>

      <View style={styles.taskFooter}>
        <View style={styles.chipRow}>
          {item.owner && (
            <View style={styles.chip}>
              <Feather name="user" size={12} color={themeColors.textMuted} />
              <Text style={styles.chipText}>{item.owner}</Text>
            </View>
          )}
          {item.dueDate && (
            <View style={styles.chip}>
              <Feather name="calendar" size={12} color={themeColors.textMuted} />
              <Text style={styles.chipText}>
                {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity 
            onPress={() => syncTaskToCalendar(item.title, item.dueDate, `Ref: ${item.meetingTitle}`)}
            style={{ padding: 4 }}
          >
            <Feather name="calendar" size={18} color={themeColors.primaryLight} />
          </TouchableOpacity>
          <Badge 
            label={item.priority} 
            color={getPriorityColor(item.priority)} 
            bg={getPriorityColor(item.priority) + '15'} 
          />
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Action Items</Text>
          <View style={styles.tabsContainer}>
            <PillTabs 
              tabs={FILTERS} 
              active={FILTERS.indexOf(filter)} 
              onChange={(index) => setFilter(FILTERS[index])} 
            />
          </View>
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderTask}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={56} color={themeColors.textMuted} />
              <Text style={styles.emptyTitle}>All tasks completed</Text>
              <Text style={styles.emptySubtitle}>Check back after your next recording.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}
