import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { GlassCard, PillTabs } from '../src/components/ui';
import { useTheme } from '../src/context/ThemeContext';
import {
  fetchEntities, fetchEntityTimeline, fetchCommitments, fetchDecisionDrift,
  MemoryEntity, EntityTimelineItem, Commitment, DecisionDrift,
} from '../src/services/api';

const ENTITY_ICON: Record<string, string> = { person: 'user', project: 'box', company: 'briefcase', concept: 'zap' };

export default function MemoryScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [entities, setEntities] = useState<MemoryEntity[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [broken, setBroken] = useState<Commitment[]>([]);
  const [stats, setStats] = useState({ total: 0, overdue: 0, stale: 0 });
  const [drifts, setDrifts] = useState<DecisionDrift[]>([]);

  // Entity timeline modal
  const [timeline, setTimeline] = useState<{ name: string; type: string; items: EntityTimelineItem[] } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, cm, d] = await Promise.all([
        fetchEntities().catch(() => []),
        fetchCommitments().catch(() => ({ commitments: [], brokenPromises: [], stats: { total: 0, overdue: 0, stale: 0 } })),
        fetchDecisionDrift().catch(() => ({ drifts: [], analyzed: 0 })),
      ]);
      setEntities(e);
      setCommitments(cm.commitments);
      setBroken(cm.brokenPromises);
      setStats(cm.stats);
      setDrifts(d.drifts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openTimeline = async (name: string) => {
    setTimelineLoading(true);
    setTimeline({ name, type: '', items: [] });
    try {
      const res = await fetchEntityTimeline(name);
      setTimeline({ name: res.name, type: res.type, items: res.timeline });
    } catch {
      setTimeline(null);
    } finally {
      setTimelineLoading(false);
    }
  };

  const StatChip = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={{ flex: 1, backgroundColor: c.bgCard, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 28, fontWeight: '800', color: c.textPrimary }}>Memory</Text>
      </View>
      <Text style={{ fontSize: 14, color: c.textMuted, marginBottom: 16 }}>
        What your meetings remember — across every session.
      </Text>
      <PillTabs tabs={['Knowledge', 'Commitments', 'Drift']} active={tab} onChange={setTab} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {renderHeader()}
        <ActivityIndicator style={{ marginTop: 60 }} color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* ── Knowledge base ── */}
      {tab === 0 && (
        <FlatList
          data={entities}
          keyExtractor={(e) => e.name}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
          columnWrapperStyle={{ paddingHorizontal: 20, gap: 10 }}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.textMuted, marginTop: 40 }}>No entities tracked yet. Record a few meetings to build your knowledge base.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => openTimeline(item.name)}>
              <View style={{ backgroundColor: c.bgCard, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={(ENTITY_ICON[item.type] || 'tag') as any} size={15} color={c.primary} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase' }}>{item.type}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.textPrimary }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>{item.mentionCount} mention{item.mentionCount === 1 ? '' : 's'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Commitments / broken promises ── */}
      {tab === 1 && (
        <FlatList
          data={commitments}
          keyExtractor={(t) => t.taskId}
          ListHeaderComponent={
            <View>
              {renderHeader()}
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
                <StatChip label="Open" value={stats.total} color={c.primary} />
                <StatChip label="Overdue" value={stats.overdue} color={c.danger} />
                <StatChip label="Stale 14d+" value={stats.stale} color={c.warning} />
              </View>
              {broken.length > 0 && (
                <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="alert-triangle" size={14} color={c.danger} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: c.danger }}>{broken.length} likely-broken promise{broken.length === 1 ? '' : 's'}</Text>
                  </View>
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.textMuted, marginTop: 40 }}>No open commitments. You're all caught up. 🎉</Text>}
          renderItem={({ item }) => {
            const isBroken = (item.overdue || item.ageDays >= 14) && !item.likelyResolved;
            return (
              <TouchableOpacity onPress={() => router.push(`/meeting/${item.meetingId}`)}>
                <GlassCard style={{ borderLeftWidth: 3, borderLeftColor: isBroken ? c.danger : item.likelyResolved ? c.success : c.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: c.textPrimary }}>{item.title}</Text>
                      <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                        <Feather name="user" size={11} color={c.textMuted} /> {item.owner} · from "{item.meetingTitle}"
                      </Text>
                      {!!item.followUpNote && item.likelyResolved && (
                        <Text style={{ fontSize: 12, color: c.success, marginTop: 6, fontStyle: 'italic' }}>✓ {item.followUpNote}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={{ backgroundColor: (item.overdue ? c.danger : item.ageDays >= 14 ? c.warning : c.textMuted) + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: item.overdue ? c.danger : item.ageDays >= 14 ? c.warning : c.textMuted }}>
                          {item.overdue ? 'OVERDUE' : `${item.ageDays}d`}
                        </Text>
                      </View>
                      {item.likelyResolved && <Text style={{ fontSize: 10, color: c.success, fontWeight: '700' }}>likely done</Text>}
                    </View>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Decision drift ── */}
      {tab === 2 && (
        <FlatList
          data={drifts}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30 }}>
              <Feather name="git-merge" size={40} color={c.textMuted} />
              <Text style={{ textAlign: 'center', color: c.textMuted, marginTop: 12 }}>No decision drift detected. Your decisions have stayed consistent across meetings.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <View style={{ backgroundColor: c.warning + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: c.warning, textTransform: 'uppercase' }}>{item.type}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: c.textPrimary, flex: 1 }}>{item.topic}</Text>
              </View>
              <View style={{ gap: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: '700' }}>EARLIER · {item.earlierMeeting}</Text>
                <Text style={{ fontSize: 13, color: c.textSecondary }}>{item.earlier}</Text>
              </View>
              <View style={{ alignItems: 'center', marginVertical: 2 }}><Feather name="arrow-down" size={16} color={c.warning} /></View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, color: c.primary, fontWeight: '700' }}>LATER · {item.laterMeeting}</Text>
                <Text style={{ fontSize: 13, color: c.textPrimary, fontWeight: '600' }}>{item.later}</Text>
              </View>
            </GlassCard>
          )}
        />
      )}

      {/* ── Entity timeline modal ── */}
      <Modal visible={!!timeline} transparent animationType="slide" onRequestClose={() => setTimeline(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingTop: 8 }}>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={(ENTITY_ICON[timeline?.type || ''] || 'tag') as any} size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: c.textPrimary }}>{timeline?.name}</Text>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>Mention timeline</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setTimeline(null)} hitSlop={12}><Feather name="x" size={22} color={c.textMuted} /></TouchableOpacity>
            </View>
            {timelineLoading ? (
              <ActivityIndicator style={{ marginVertical: 40 }} color={c.primary} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
                {timeline?.items.map((it, i) => (
                  <TouchableOpacity key={i} onPress={() => { setTimeline(null); router.push(`/meeting/${it.meetingId}`); }} style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 4 }} />
                      {i < (timeline.items.length - 1) && <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginVertical: 2 }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 20 }}>
                      <Text style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}>{new Date(it.date).toDateString()} · {it.meetingTitle}</Text>
                      <Text style={{ fontSize: 14, color: c.textPrimary, lineHeight: 20 }}>{it.context}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
