import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing } from '../../src/constants/theme';
import { GlassCard, Badge, PillTabs } from '../../src/components/ui';
import { fetchMeetings, ApiMeeting, ApiTask, updateTaskStatus, addTask, deleteTask } from '../../src/services/api';
import { syncTaskToCalendar } from '../../src/services/calendar';
import { useTheme } from '../../src/context/ThemeContext';
import { getTasksStyles } from '../../src/styles/tasks.styles';
import { Aurora } from '../../src/components/Aurora';
import { LinearGradient } from 'expo-linear-gradient';
import { showError } from '../../src/utils/errors';

const LANE_META: Record<string, { color: string; icon: string }> = {
  pending: { color: '#8E8E93', icon: 'circle' },
  in_progress: { color: '#0A84FF', icon: 'loader' },
  completed: { color: '#32D74B', icon: 'check-circle' },
};

type LaneType = 'pending' | 'in_progress' | 'completed';

interface ExtendedTask extends ApiTask {
  meetingId: string;
  meetingTitle: string;
}
export default function TasksScreen() {
  const router = useRouter();
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getTasksStyles(isDarkMode), [isDarkMode]);

  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Task Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async (isFirstLoad = false) => {
    try {
      const data = await fetchMeetings();
      setMeetings(data);
      if (data.length > 0 && !selectedMeetingId) {
        setSelectedMeetingId(data[0]._id);
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') return;
      showError(error, 'Unable to load tasks', 'Pull to refresh to try again.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(meetings.length === 0);
    }, [meetings.length])
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
    let result = allTasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.meetingTitle.toLowerCase().includes(q));
    }
    return result;
  }, [allTasks, searchQuery]);

  const laneData = useMemo(() => {
    return {
      pending: filteredTasks.filter(t => t.status === 'pending'),
      in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
      completed: filteredTasks.filter(t => t.status === 'completed'),
    };
  }, [filteredTasks]);

  const completionStats = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, rate };
  }, [allTasks]);

  const handleMoveTask = async (taskId: string, meetingId: string, newStatus: LaneType) => {
    // Optimistic Update
    setMeetings(prev => prev.map(m => {
      if (m._id === meetingId && m.tasks) {
        return {
          ...m,
          tasks: m.tasks.map(t => t._id === taskId ? { ...t, status: newStatus as any } : t)
        };
      }
      return m;
    }));

    try {
      await updateTaskStatus(meetingId, taskId, newStatus);
    } catch (e) {
      Alert.alert('Error', 'Could not sync task movement.');
      loadData(); // Revert on failure
    }
  };

  const handleDeleteTask = (taskId: string, meetingId: string) => {
    Alert.alert('Delete Task', 'Remove this action item permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const snapshot = meetings;
          setMeetings(prev => prev.map(m => m._id === meetingId ? { ...m, tasks: m.tasks?.filter(t => t._id !== taskId) } : m));
          try {
            await deleteTask(meetingId, taskId);
          } catch (e) {
            setMeetings(snapshot);
            Alert.alert('Error', 'Could not delete the task.');
          }
        }
      }
    ]);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedMeetingId) return;
    setIsCreating(true);
    try {
      const updatedMeeting = await addTask(selectedMeetingId, { title: newTaskTitle.trim(), priority: 'medium' });
      setMeetings(prev => prev.map(m => m._id === selectedMeetingId ? updatedMeeting : m));
      setNewTaskTitle('');
      setShowCreateModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not create task.');
    } finally {
      setIsCreating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return themeColors.danger;
      case 'medium': return themeColors.warning;
      case 'low': return themeColors.success;
      default: return themeColors.textMuted;
    }
  };

  const renderTaskCard = ({ item }: { item: ExtendedTask }) => (
    <GlassCard style={[styles.taskCard, { borderLeftWidth: 3, borderLeftColor: item.status === 'completed' ? themeColors.success : getPriorityColor(item.priority) }]}>
      <View style={styles.taskMain}>
        <View style={styles.taskTopRow}>
          <View style={styles.taskContent}>
            <Text style={[styles.taskTitle, item.status === 'completed' && styles.taskCompleted]}>
              {item.title}
            </Text>
            <TouchableOpacity onPress={() => router.push(`/meeting/${item.meetingId}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Feather name="link" size={10} color={themeColors.primaryLight} />
              <Text style={styles.meetingRef} numberOfLines={1}>{item.meetingTitle}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: getPriorityColor(item.priority) + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: getPriorityColor(item.priority), textTransform: 'uppercase' }}>{item.priority}</Text>
          </View>
        </View>
        {!!item.owner && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Feather name="user" size={11} color={themeColors.textMuted} />
            <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '600' }}>{item.owner}</Text>
          </View>
        )}

        <View style={styles.taskFooter}>
          <View style={styles.chipRow}>
             {item.dueDate && (
              <View style={styles.chip}>
                <Feather name="calendar" size={11} color={themeColors.textMuted} />
                <Text style={styles.chipText}>
                  {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={() => syncTaskToCalendar(item.title, item.dueDate, `Ref: ${item.meetingTitle}`)} hitSlop={6}>
              <Feather name="external-link" size={13} color={themeColors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteTask(item._id, item.meetingId)} hitSlop={6}>
              <Feather name="trash-2" size={13} color={themeColors.danger} />
            </TouchableOpacity>
          </View>

          <View style={styles.moveActions}>
            {item.status !== 'pending' && (
              <TouchableOpacity 
                style={styles.moveBtn} 
                onPress={() => handleMoveTask(item._id, item.meetingId, item.status === 'completed' ? 'in_progress' : 'pending')}
              >
                <Feather name="chevron-left" size={16} color={themeColors.textPrimary} />
              </TouchableOpacity>
            )}
            {item.status !== 'completed' && (
              <TouchableOpacity 
                style={[styles.moveBtn, { backgroundColor: themeColors.primary + '20' }]} 
                onPress={() => handleMoveTask(item._id, item.meetingId, item.status === 'pending' ? 'in_progress' : 'completed')}
              >
                <Feather name="chevron-right" size={16} color={themeColors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </GlassCard>
  );

  const Lane = ({ title, tasks, type }: { title: string, tasks: ExtendedTask[], type: LaneType }) => (
    <View style={styles.lane}>
      <View style={[styles.laneHeader, { alignItems: 'center' }]}>
        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: LANE_META[type].color, marginRight: 8 }} />
        <Text style={styles.laneTitle}>{title}</Text>
        <View style={[styles.laneBadge, { backgroundColor: LANE_META[type].color + '20' }]}>
          <Text style={[styles.laneBadgeText, { color: LANE_META[type].color }]}>{tasks.length}</Text>
        </View>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={item => item._id}
        renderItem={renderTaskCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Tasks</Text>
            <Text style={styles.emptySubtitle}>All clear in this section.</Text>
          </View>
        }
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Aurora isDark={isDarkMode} variant="home" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginBottom: 14 }]}>Action Pipeline</Text>

          {/* Progress hero */}
          <LinearGradient colors={['#0A84FF', '#5B54E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>OVERALL PROGRESS</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2 }}>{completionStats.completed}<Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}> / {completionStats.total} done</Text></Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{completionStats.rate}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
              <View style={{ width: `${completionStats.rate}%`, height: '100%', backgroundColor: '#fff', borderRadius: 3 }} />
            </View>
          </LinearGradient>

          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color={themeColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search actions or meetings..."
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView 
          horizontal 
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10 }}
          snapToInterval={320}
          decelerationRate="fast"
        >
          <Lane title="To Do" tasks={laneData.pending} type="pending" />
          <Lane title="In Progress" tasks={laneData.in_progress} type="in_progress" />
          <Lane title="Completed" tasks={laneData.completed} type="completed" />
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Create Task Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>New Action Item</Text>
                
                <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Action Detail</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={newTaskTitle} 
                  onChangeText={setNewTaskTitle} 
                  placeholder="What needs to be done?" 
                  placeholderTextColor={themeColors.textMuted}
                  autoFocus 
                />

                <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Link to Meeting</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }} contentContainerStyle={{ gap: 10 }}>
                  {meetings.slice(0, 5).map(m => (
                    <TouchableOpacity 
                      key={m._id} 
                      onPress={() => setSelectedMeetingId(m._id)}
                      style={[{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }, selectedMeetingId === m._id && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                    >
                      <Text style={{ color: selectedMeetingId === m._id ? '#fff' : themeColors.textPrimary, fontWeight: '700', fontSize: 12 }}>{m.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCreateModal(false)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleCreateTask} disabled={isCreating}>
                    {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTextSave}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
