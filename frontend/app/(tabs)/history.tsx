import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, RefreshControl, Alert, TextInput, SectionList, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GlassCard, Badge, GradientButton, Skeleton } from '../../src/components/ui';
import { fetchMeetings, searchMeetings, ApiMeeting, fetchProjects, ApiProject, createProject, deleteMeeting, semanticSearch, SemanticResult } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { getHistoryStyles } from '../../src/styles/history.styles';
import { Aurora } from '../../src/components/Aurora';
import { LinearGradient } from 'expo-linear-gradient';
import { showError } from '../../src/utils/errors';

const FOLDER_NAME_MAX = 30;
const FOLDER_SUGGESTIONS = ['Work', 'Personal', 'Clients', '1:1s', 'Standups'];

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
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const loadData = async (query?: string, isFirstLoad = false) => {
    if (!query && isFirstLoad) setIsLoading(true);
    try {
      const [projData, meetData] = await Promise.all([
        fetchProjects(),
        (query && query.trim().length > 0) ? searchMeetings(query.trim()) : fetchMeetings()
      ]);
      setProjects(projData);
      setMeetings(meetData);
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') return;
      showError(error, 'Unable to load history', 'Pull to refresh to try again.');
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };

  // Debounce search (keyword + semantic in parallel)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData(searchQuery, meetings.length === 0);
      const q = searchQuery.trim();
      if (q.length > 2) {
        semanticSearch(q).then(r => setSemanticResults(r.results)).catch(() => setSemanticResults([]));
      } else {
        setSemanticResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      if (!searchQuery) {
        loadData(undefined, meetings.length === 0);
      }
    }, [meetings.length, searchQuery])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(searchQuery);
    setRefreshing(false);
  };

  const isDuplicateFolder = useMemo(
    () => projects.some(p => p.name.trim().toLowerCase() === newFolderName.trim().toLowerCase()),
    [projects, newFolderName]
  );
  const canCreateFolder = newFolderName.trim().length > 0 && !isDuplicateFolder && !isCreatingFolder;

  const closeFolderModal = () => {
    setShowCreateFolderModal(false);
    setNewFolderName('');
  };

  const handleCreateFolder = async () => {
    if (!canCreateFolder) return;
    setIsCreatingFolder(true);
    try {
      const proj = await createProject(newFolderName.trim());
      setProjects(prev => [...prev, proj]);
      setSelectedProjectId(proj._id);
      closeFolderModal();
    } catch (error: any) {
      showError(error, 'Folder not created', "We couldn't create that folder. Please try again.");
    } finally {
      setIsCreatingFolder(false);
    }
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

  /**
   * The day label is deliberately NOT a section header. A SectionList header lives
   * inside the scroll view, so it always travels with its cards and needs an opaque
   * band to stay legible while they pass under it. Instead we render the label as a
   * fixed part of the page and drive it from whichever section is currently in view.
   */
  const [visibleSection, setVisibleSection] = useState<string | null>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems.find((v: any) => v.section);
    if (first?.section?.title) setVisibleSection(first.section.title);
  }).current;

  // Fall back to the first group so the label is never blank before the first scroll.
  const activeSection = useMemo(
    () => groupedMeetings.find(s => s.title === visibleSection) ?? groupedMeetings[0],
    [groupedMeetings, visibleSection]
  );

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

  const handleDeleteMeeting = (id: string, title: string) => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteMeeting(id);
              setMeetings(prev => prev.filter(m => m._id !== id));
            } catch (error: any) {
              Alert.alert('Error', 'Could not delete the recording.');
            }
          } 
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: ApiMeeting }) => {
    const processing = item.status === 'processing';
    const errored = item.status === 'error';
    const accent = processing ? themeColors.warning : errored ? themeColors.danger : themeColors.primary;
    return (
    <GlassCard
      style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}
      onPress={() => router.push(`/meeting/${item._id}`)}
      onLongPress={() => handleDeleteMeeting(item._id, item.title)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={processing ? 'loader' : errored ? 'alert-circle' : 'file-text'} size={19} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
            <TouchableOpacity onPress={() => handleDeleteMeeting(item._id, item.title)} style={{ padding: 4 }} hitSlop={6}>
              <Feather name="trash-2" size={15} color={themeColors.danger} opacity={0.6} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateRow}>
            <Feather name="clock" size={10} color={themeColors.textMuted} />
            <Text style={styles.dateText}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {Math.round((item.duration || 0) / 60)} min
            </Text>
            {processing && <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.warning, marginLeft: 6 }}>PROCESSING…</Text>}
            {errored && <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.danger, marginLeft: 6 }}>FAILED</Text>}
          </View>

          {item.status === 'ready' && item.summary && (
            <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
          )}

          <View style={styles.footer}>
            <View style={styles.tagContainer}>
              {item.tags && item.tags.length > 0 ? (
                item.tags.slice(0, 2).map(tag => (
                  <View key={tag} style={styles.tagBadge}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))
              ) : null}
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
        </View>
      </View>
    </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Aurora isDark={isDarkMode} variant="home" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginBottom: 14 }]}>History</Text>

          {/* Gradient stat tiles */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <LinearGradient colors={['#0A84FF', '#5B54E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 18, padding: 14 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{stats.totalMeetings}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sessions</Text>
            </LinearGradient>
            <View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 22, fontWeight: '800' }}>{stats.totalHours}h</Text>
              <Text style={{ color: themeColors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recorded</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 22, fontWeight: '800' }}>{stats.totalTasks}</Text>
              <Text style={{ color: themeColors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color={themeColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search history..."
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5, marginBottom: 5 }} contentContainerStyle={{ gap: 8, paddingVertical: 5 }}>
            <TouchableOpacity 
              onPress={() => setSelectedProjectId(null)}
              style={[
                { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }, 
                !selectedProjectId && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }
              ]}
            >
              <Text style={{ color: !selectedProjectId ? themeColors.primary : themeColors.textPrimary, fontWeight: '700', fontSize: 12 }}>All</Text>
            </TouchableOpacity>

            {projects.map(p => (
              <TouchableOpacity 
                key={p._id} 
                onPress={() => setSelectedProjectId(p._id)}
                style={[
                  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border }, 
                  selectedProjectId === p._id && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }
                ]}
              >
                <Text style={{ color: selectedProjectId === p._id ? themeColors.primary : themeColors.textPrimary, fontWeight: '700', fontSize: 12 }}>{p.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              onPress={() => setShowCreateFolderModal(true)}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: themeColors.bgCard, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="plus" size={16} color={themeColors.primary} />
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 15 }}>
            {[1, 2, 3].map(i => (
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
            ) : (searchQuery && semanticResults.length > 0) ? (
              <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Feather name="zap" size={15} color={themeColors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: themeColors.primary }}>Smart matches</Text>
                  <Text style={{ fontSize: 11, color: themeColors.textMuted }}>· no exact keyword, ranked by meaning</Text>
                </View>
                {semanticResults.map((r) => (
                  <TouchableOpacity key={r.meetingId} onPress={() => router.push(`/meeting/${r.meetingId}`)}>
                    <GlassCard style={{ marginBottom: 10, padding: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: themeColors.textPrimary }}>{r.meetingTitle}</Text>
                        <View style={{ backgroundColor: themeColors.primary + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: themeColors.primary }}>{r.score}%</Text>
                        </View>
                      </View>
                      <Text numberOfLines={2} style={{ fontSize: 12, color: themeColors.textMuted, lineHeight: 18 }}>{r.snippet}</Text>
                    </GlassCard>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
          <>
            {/* Lives on the page, outside the list — so it cannot scroll, and needs
                no background to stay readable. */}
            {activeSection && (
              <View style={styles.dayLabelRow}>
                <Text style={styles.dayLabel}>{activeSection.title}</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{activeSection.data.length}</Text>
                </View>
                <View style={styles.sectionLine} />
              </View>
            )}

            <SectionList
              sections={groupedMeetings}
              keyExtractor={item => item._id}
              renderItem={renderItem}
              renderSectionHeader={() => null}
              stickySectionHeadersEnabled={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
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
          </>
        )}
      </SafeAreaView>

      <Modal visible={showCreateFolderModal} transparent animationType="slide" onRequestClose={closeFolderModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeFolderModal}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <View style={styles.modalIconWrap}>
                  <Feather name="folder-plus" size={24} color={themeColors.primary} />
                </View>

                <Text style={styles.modalTitle}>New Folder</Text>
                <Text style={styles.modalSubtitle}>
                  Group related sessions together. You can move meetings into it at any time.
                </Text>

                <View style={[styles.modalInputWrap, isDuplicateFolder && { borderColor: themeColors.danger }]}>
                  <Feather name="folder" size={18} color={isDuplicateFolder ? themeColors.danger : themeColors.textMuted} />
                  <TextInput
                    style={styles.modalInput}
                    value={newFolderName}
                    onChangeText={t => setNewFolderName(t.slice(0, FOLDER_NAME_MAX))}
                    placeholder="Folder name"
                    placeholderTextColor={themeColors.textMuted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => { if (canCreateFolder) handleCreateFolder(); }}
                  />
                  {newFolderName.length > 0 && (
                    <Text style={styles.modalCounter}>{newFolderName.length}/{FOLDER_NAME_MAX}</Text>
                  )}
                </View>

                {isDuplicateFolder ? (
                  <View style={styles.modalError}>
                    <Feather name="alert-circle" size={12} color={themeColors.danger} />
                    <Text style={styles.modalErrorText}>A folder with this name already exists.</Text>
                  </View>
                ) : (
                  <View style={styles.modalSuggestions}>
                    {FOLDER_SUGGESTIONS.filter(s => !projects.some(p => p.name.toLowerCase() === s.toLowerCase())).map(s => (
                      <TouchableOpacity key={s} style={styles.modalChip} onPress={() => setNewFolderName(s)}>
                        <Text style={styles.modalChipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={closeFolderModal}>
                    <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtnSave, !canCreateFolder && styles.modalBtnSaveDisabled]}
                    onPress={handleCreateFolder}
                    disabled={!canCreateFolder}
                  >
                    {isCreatingFolder
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.modalBtnTextSave}>Create Folder</Text>}
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
