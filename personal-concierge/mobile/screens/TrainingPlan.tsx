import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getCurrentTrainingPlan, generateTrainingPlan, getWeekStats } from '../lib/api';
import type { TrainingPlan, WeekStats } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel } from '../theme';

const SESSION_COLORS: Record<string, string> = {
  easy_run: '#22c55e', tempo_run: '#f97316', long_run: '#8b5cf6',
  interval_run: '#ef4444', strength: '#3b82f6', recovery: '#06b6d4',
  cross_train: '#eab308', rest: '#6b7280',
};

const SESSION_ICONS: Record<string, string> = {
  easy_run: '🏃', tempo_run: '⚡', long_run: '🛣️', interval_run: '🔄',
  strength: '🏋️', recovery: '🧘', cross_train: '🚴', rest: '😴',
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: 'Easy Run', tempo_run: 'Tempo', long_run: 'Long Run',
  interval_run: 'Intervals', strength: 'Strength', recovery: 'Recovery',
  cross_train: 'Cross Train', rest: 'Rest',
};

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route?: { params?: { selectedDate?: string } };
}

export default function TrainingPlanScreen({ navigation, route }: Props) {
  const initialDate = route?.params?.selectedDate;
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      getCurrentTrainingPlan().catch(() => null),
      getWeekStats().catch(() => null),
    ]);
    setPlan(p);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleGenerate = async () => {
    Alert.alert(
      'Regenerate Plan',
      'This will replace the current week plan with a freshly generated one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGenerating(true);
            await generateTrainingPlan().catch(() => null);
            await load();
            setGenerating(false);
          },
        },
      ]
    );
  };

  const sessions: any[] = (plan as any)?.planned_sessions || [];

  const getWeekDays = (): Array<{ date: string; label: string; abbr: string }> => {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - d.getDay() + 1);
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return { date: dt.toISOString().split('T')[0], label, abbr: label.slice(0, 1) };
    });
  };

  const weekDays = getWeekDays();
  const selectedSession = selectedDate ? sessions.find((s: any) => s.date === selectedDate) : null;

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Phase & target header */}
      {plan && (
        <View style={styles.phaseCard}>
          <View style={styles.phaseRow}>
            <View>
              <Text style={styles.phaseLabel}>PHASE</Text>
              <Text style={styles.phaseValue}>{((plan as any).phase || 'Base').toUpperCase()}</Text>
            </View>
            {(plan as any).weekly_run_km_target && (
              <View>
                <Text style={styles.phaseLabel}>KM TARGET</Text>
                <Text style={styles.phaseValue}>{(plan as any).weekly_run_km_target} km</Text>
              </View>
            )}
            {(plan as any).weekly_strength_sessions_target && (
              <View>
                <Text style={styles.phaseLabel}>STRENGTH</Text>
                <Text style={styles.phaseValue}>{(plan as any).weekly_strength_sessions_target}× / wk</Text>
              </View>
            )}
          </View>
          {(plan as any).ai_notes && (
            <Text style={styles.aiNotes}>{(plan as any).ai_notes}</Text>
          )}
        </View>
      )}

      {/* Week stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.run_km}</Text>
            <Text style={styles.statLabel}>km done</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.strength_sessions}</Text>
            <Text style={styles.statLabel}>strength</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.workouts_done}</Text>
            <Text style={styles.statLabel}>workouts</Text>
          </View>
        </View>
      )}

      {/* Weekly calendar */}
      <Text style={styles.sectionLabel}>THIS WEEK</Text>
      {sessions.length === 0 ? (
        <View style={[styles.emptyCard, { alignItems: 'center' }]}>
          <Text style={styles.emptyText}>No training plan yet.</Text>
          <Text style={styles.emptySubtext}>Generate one below to get started.</Text>
        </View>
      ) : (
        <View style={styles.calGrid}>
          {weekDays.map(({ date, label }) => {
            const s = sessions.find((s: any) => s.date === date);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const color = s ? (SESSION_COLORS[s.session_type] || colors.primary) : colors.bgCard;
            return (
              <TouchableOpacity
                key={date}
                style={[
                  styles.calCell,
                  isToday && styles.calCellToday,
                  isSelected && styles.calCellSelected,
                  s && { borderTopWidth: 3, borderTopColor: color },
                ]}
                onPress={() => setSelectedDate(date === selectedDate ? null : date)}
                activeOpacity={0.7}
              >
                <Text style={[styles.calLabel, isToday && styles.calLabelToday]}>{label}</Text>
                <Text style={styles.calDate}>{new Date(date + 'T12:00:00').getDate()}</Text>
                {s ? (
                  <>
                    <Text style={styles.calIcon}>{SESSION_ICONS[s.session_type] || '•'}</Text>
                    <Text style={[styles.calType, { color }]} numberOfLines={1}>
                      {SESSION_LABELS[s.session_type] || s.session_type}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.calEmpty}>—</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected day detail */}
      {selectedSession && (
        <>
          <Text style={styles.sectionLabel}>
            {new Date(selectedDate! + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </Text>
          <TouchableOpacity
            style={[styles.sessionCard, { borderLeftColor: SESSION_COLORS[selectedSession.session_type] || colors.primary }]}
            onPress={() => navigation.navigate('WorkoutSession', { workoutId: undefined })}
            activeOpacity={0.85}
          >
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionIcon}>{SESSION_ICONS[selectedSession.session_type] || '💪'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>{selectedSession.title}</Text>
                <Text style={styles.sessionMeta}>
                  {selectedSession.duration_minutes}min
                  {selectedSession.targets?.distance_km ? ` · ${selectedSession.targets.distance_km}km` : ''}
                  {selectedSession.targets?.pace_per_km ? ` · ${selectedSession.targets.pace_per_km}'/km target` : ''}
                </Text>
              </View>
            </View>
            {selectedSession.description && (
              <Text style={styles.sessionDesc}>{selectedSession.description}</Text>
            )}
            {selectedSession.targets?.zones && (
              <View style={styles.zoneRow}>
                <Text style={styles.zoneLabel}>HR Zones: </Text>
                <Text style={styles.zoneValue}>{selectedSession.targets.zones}</Text>
              </View>
            )}
            <Text style={styles.logTap}>Tap to log this session →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* All sessions list (non-rest) */}
      {sessions.filter((s: any) => s.session_type !== 'rest').length > 0 && (
        <>
          <Text style={styles.sectionLabel}>WEEK OVERVIEW</Text>
          {sessions
            .filter((s: any) => s.session_type !== 'rest')
            .map((s: any, i: number) => {
              const color = SESSION_COLORS[s.session_type] || colors.primary;
              const isToday = s.date === today;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.overviewRow, isToday && { borderColor: colors.primaryBorder }]}
                  onPress={() => setSelectedDate(s.date)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.overviewDot, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overviewTitle}>{s.title}</Text>
                    <Text style={styles.overviewMeta}>
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{s.duration_minutes}min
                    </Text>
                  </View>
                  <Text style={[styles.overviewType, { color }]}>{SESSION_LABELS[s.session_type] || s.session_type}</Text>
                </TouchableOpacity>
              );
            })}
        </>
      )}

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.generateBtn, generating && { opacity: 0.6 }]}
        onPress={handleGenerate}
        disabled={generating}
        activeOpacity={0.8}
      >
        {generating
          ? <ActivityIndicator color={colors.primary} />
          : <Text style={styles.generateBtnText}>↻ Regenerate Plan</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },

  phaseCard: { ...cardStyle, marginBottom: spacing.md, backgroundColor: colors.primaryGlow, borderColor: colors.primaryBorder },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  phaseLabel: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold, letterSpacing: 0.8, textAlign: 'center' },
  phaseValue: { fontSize: font.lg, fontWeight: font.bold, color: colors.textAccent, textAlign: 'center', marginTop: 2 },
  aiNotes: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, ...cardStyle, alignItems: 'center', padding: spacing.md },
  statValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.primary },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  emptyCard: { ...cardStyle, padding: spacing.xl, marginBottom: spacing.md },
  emptyText: { fontSize: font.md, color: colors.textSecondary, marginBottom: 4 },
  emptySubtext: { fontSize: font.sm, color: colors.textTertiary },

  calGrid: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  calCell: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.xs, alignItems: 'center', minHeight: 80,
  },
  calCellToday: { backgroundColor: colors.primaryMuted },
  calCellSelected: { borderColor: colors.primary },
  calLabel: { fontSize: 9, color: colors.textTertiary, fontWeight: font.bold, marginBottom: 2 },
  calLabelToday: { color: colors.textAccent },
  calDate: { fontSize: font.sm, color: colors.textPrimary, fontWeight: font.bold, marginBottom: 4 },
  calIcon: { fontSize: 14, marginBottom: 2 },
  calType: { fontSize: 8, fontWeight: font.bold, textAlign: 'center' },
  calEmpty: { fontSize: font.sm, color: colors.textTertiary },

  sessionCard: { ...cardStyle, marginBottom: spacing.md, borderLeftWidth: 3 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sessionIcon: { fontSize: 28 },
  sessionTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  sessionMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  sessionDesc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  zoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  zoneLabel: { fontSize: font.xs, color: colors.textTertiary },
  zoneValue: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold },
  logTap: { fontSize: font.xs, color: colors.primary, fontWeight: font.semibold },

  overviewRow: {
    ...cardStyle, flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md,
  },
  overviewDot: { width: 10, height: 10, borderRadius: 5 },
  overviewTitle: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 2 },
  overviewMeta: { fontSize: font.xs, color: colors.textTertiary },
  overviewType: { fontSize: font.xs, fontWeight: font.bold },

  generateBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.lg, alignItems: 'center', marginTop: spacing.md,
  },
  generateBtnText: { color: colors.textSecondary, fontWeight: font.semibold, fontSize: font.sm },
});
