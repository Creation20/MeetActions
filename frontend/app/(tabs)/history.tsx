import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, RefreshControl, Alert, TextInput, SectionList, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GlassCard, Badge, GradientButton, Skeleton } from '../../src/components/ui';
import { fetchMeetings, searchMeetings, ApiMeeting, fetchProjects, ApiProject, createProject } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { getHistoryStyles } from '../../src/styles/history.styles';

export default function HistoryScreen() {
  const router = useRouter();
  const { isDarkMode, colors: themeColors } = useTheme();
  const styles = useMemo(() => getHistoryStyles(isDarkMode), [isDarkMode]);
  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const loadData = async (query?: string) => {
    if (!query) setIsLoading(true);
    try {
      const [projData, meetData] = await Promise.all([
        fetchProjects(),
        (query && query.trim().length > 0) ? searchMeetings(query.trim()) : fetchMeetings()
      ]);
      setProjects(projData);
      setMeetings(meetData);
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') return;
      Alert.alert('Unable to Load History', error.message || 'Something went wrong.');
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData(searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      if (!searchQuery) {
        loadData();
      }
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(searchQuery);
    setRefreshing(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const proj = await createProject(newFolderName.trim());
      setProjects(prev => [...prev, proj]);
      setNewFolderName('');
      setShowCreateFolderModal(false);
    } catch (error: any) { Alert.alert('Error', 'Could not create folder.'); }
    setIsCreatingFolder(false);
  };

  const filteredMeetings = useMemo(() => {
    if (!selectedProjectId) return meetings;
    return meetings.filter(m => m.projectId === selectedProjectId);
  }, [meetings, selectedProjectId]);

  const groupedMeetings = useMemo(() => {
    if (filteredMeetings.length === 0) return [];
    
    const sections: { title: string; data: ApiMeeting[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayData: ApiMeeting[] = [];
    const yesterdayData: ApiMeeting[] = [];
    const earlierData: ApiMeeting[] = [];

    filteredMeetings.forEach(m => {
      const mDate = new Date(m.date);
      const mDay = new Date(mDate.getFullYear(), mDate.getMonth(), mDate.getDate());

      if (mDay.getTime() === today.getTime()) {
        todayData.push(m);
      } else if (mDay.getTime() === yesterday.getTime()) {
        yesterdayData.push(m);
      } else {
        earlierData.push(m);
      }
    });

    if (todayData.length > 0) sections.push({ title: 'Today', data: todayData });
    if (yesterdayData.length > 0) sections.push({ title: 'Yesterday', data: yesterdayData });
    if (earlierData.length > 0) sections.push({ title: 'Earlier', data: earlierData });

    return sections;
  }, [filteredMeetings]);

  const stats = useMemo(() => {
    const totalMeetings = meetings.length;
    const totalTasks = meetings.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);
    const totalHours = meetings.reduce((acc, m) => acc + (m.duration || 0), 0) / 3600;
    
    return {
      totalMeetings,
      totalTasks,
      totalHours: totalHours.toFixed(1)
    };
  }, [meetings]);

  const renderItem = ({ item }: { item: ApiMeeting }) => (
    <GlassCard 
      style={styles.card}
      onPress={() => router.push(`/meeting/${item._id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        {item.status === 'processing' && (
          <Badge label="Processing" color={themeColors.warning} bg={themeColors.warning + '15'} />
        )}
      </View>
      <View style={styles.dateRow}>
        <Feather name="clock" size={10} color={themeColors.textMuted} />
        <Text style={styles.dateText}>
          {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {Math.round((item.duration || 0) / 60)} min
        </Text>
      </View>
      
      {item.status === 'ready' && item.summary && (
        <Text style={styles.summary} numberOfLines={2}>
          {item.summary}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={styles.tagContainer}>
          {item.tags && item.tags.length > 0 ? (
            item.tags.slice(0, 3).map(tag => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))
          ) : (
            <Badge label="No tags" color={themeColors.textMuted} bg={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
          )}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="check-square" size={12} color={themeColors.textMuted} />
            <Text style={styles.statText}>{item.tasks?.length || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Feather name="zap" size={12} color={themeColors.textMuted} />
            <Text style={styles.statText}>{item.decisions?.length || 0}</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalMeetings}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={{ width: 1, backgroundColor: themeColors.border, height: '60%' }} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalHours}h</Text>
              <Text style={styles.statLabel}>Recorded</Text>
            </View>
            <View style={{ width: 1, backgroundColor: themeColors.border, height: '60%' }} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color={themeColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transcripts, summaries..."
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}>
            <TouchableOpacity 
              onPress={() => setSelectedProjectId(null)}
              style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }, !selectedProjectId && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }]}
            >
              <Text style={{ color: !selectedProjectId ? themeColors.primary : themeColors.textPrimary, fontWeight: '700', fontSize: 13 }}>All Sessions</Text>
            </TouchableOpacity>

            {projects.map(p => (
              <TouchableOpacity 
                key={p._id} 
                onPress={() => setSelectedProjectId(p._id)}
                style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }, selectedProjectId === p._id && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }]}
              >
                <Text style={{ color: selectedProjectId === p._id ? themeColors.primary : themeColors.textPrimary, fontWeight: '700', fontSize: 13 }}>{p.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              onPress={() => setShowCreateFolderModal(true)}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="plus" size={18} color={themeColors.primary} />
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 15 }}>
            {[1, 2, 3, 4].map(i => (
              <GlassCard key={i} style={{ padding: 16 }}>
                <Skeleton width="60%" height={20} style={{ marginBottom: 10 }} />
                <Skeleton width="40%" height={14} style={{ marginBottom: 20 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Skeleton width="30%" height={20} radius={10} />
                  <Skeleton width="15%" height={20} radius={10} />
                </View>
              </GlassCard>
            ))}
          </View>
        ) : filteredMeetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            {isSearching ? (
              <>
                <ActivityIndicator color={themeColors.primary} size="large" />
                <Text style={[styles.emptyText, { marginTop: 20 }]}>Searching archives...</Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIconWrap}>
                  <Feather name="archive" size={40} color={themeColors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No Recordings Found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? "We couldn't find any sessions matching your search." 
                    : (selectedProjectId ? "No sessions in this folder yet." : "Your meeting history will appear here once you've finished your first recording.")}
                </Text>
                {!searchQuery && !selectedProjectId && (
                  <GradientButton 
                    label="Start Recording" 
                    onPress={() => router.push('/record')}
                    size="md"
                    style={{ width: 200 }}
                  />
                )}
              </>
            )}
          </View>
        ) : (
          <SectionList
            sections={groupedMeetings}
            keyExtractor={item => item._id}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeader}>{title}</Text>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor={themeColors.primary} 
              />
            }
          />
        )}
      </SafeAreaView>

      <Modal visible={showCreateFolderModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreateFolderModal(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>New Folder</Text>
                <Text style={styles.modalSubtitle}>Create a project to organize your meeting sessions.</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={newFolderName} 
                  onChangeText={setNewFolderName} 
                  placeholder="e.g. Work, School, Client X" 
                  placeholderTextColor={themeColors.textMuted}
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCreateFolderModal(false)}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleCreateFolder} disabled={isCreatingFolder}>
                    {isCreatingFolder ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTextSave}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
