import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  getFitnessGoals, getCurrentTrainingPlan, getTodayWorkout,
  getWeekStats,
} from '../lib/api';
import type { FitnessGoal, TrainingPlan, Workout, WeekStats } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, shadow } from '../theme';

const SESSION_COLORS: Record<string, string> = {
  easy_run: '#22c55e',
  tempo_run: '#f97316',
  long_run: '#8b5cf6',
  interval_run: '#ef4444',
  strength: '#3b82f6',
  recovery: '#06b6d4',
  cross_train: '#eab308',
  rest: '#6b7280',
};

const SESSION_ICONS: Record<string, string> = {
  easy_run: '🏃', tempo_run: '⚡', long_run: '🛣️', interval_run: '🔄',
  strength: '🏋️', recovery: '🧘', cross_train: '🚴', rest: '😴',
};

const VERDICT_COLOR: Record<string, string> = {
  realistic: '#22c55e', ambitious: '#f97316',
  very_ambitious: '#ef4444', unrealistic: '#dc2626', unknown: '#6b7280',
};

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    addListener: (event: string, callback: () => void) => () => void;
  };
}

export default function FitnessHub({ navigation }: Props) {
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [g, p, w, s] = await Promise.all([
      getFitnessGoals(),
      getCurrentTrainingPlan().catch(() => null),
      getTodayWorkout().catch(() => null),
      getWeekStats().catch(() => null),
    ]);
    setGoals(g || []);
    setPlan(p);
    setWorkout(w);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const today = new Date().toISOString().split('T')[0];
  const sessions = (plan as any)?.planned_sessions || [];
  const todaySession = sessions.find((s: any) => s.date === today);

  const weekDays = getWeekDays();

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading fitness...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Goals Section */}
      {goals.length === 0 ? (
        <TouchableOpacity
          style={styles.noGoalCard}
          onPress={() => navigation.navigate('FitnessGoal')}
          activeOpacity={0.8}
        >
          <Text style={styles.noGoalEmoji}>🎯</Text>
          <Text style={styles.noGoalTitle}>Set Your First Goal</Text>
          <Text style={styles.noGoalSub}>Get a personalized training plan built around what you're working toward</Text>
          <View style={styles.noGoalBtn}><Text style={styles.noGoalBtnText}>Set Goal →</Text></View>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.sectionLabel}>YOUR GOALS</Text>
          {goals.slice(0, 2).map(g => (
            <TouchableOpacity
              key={g.id}
              style={styles.goalCard}
              onPress={() => navigation.navigate('FitnessGoal', { goalId: g.id })}
              activeOpacity={0.8}
            >
              <View style={styles.goalHeader}>
                <View style={[styles.priorityBadge, { backgroundColor: g.priority === 'primary' ? colors.primaryMuted : colors.bgCard }]}>
                  <Text style={[styles.priorityText, { color: g.priority === 'primary' ? colors.textAccent : colors.textSecondary }]}>
                    {g.priority.toUpperCase()}
                  </Text>
                </View>
                {g.ai_feasibility?.verdict && (
                  <View style={[styles.verdictBadge, { backgroundColor: (VERDICT_COLOR[g.ai_feasibility.verdict] || '#6b7280') + '20' }]}>
                    <Text style={[styles.verdictText, { color: VERDICT_COLOR[g.ai_feasibility.verdict] || '#6b7280' }]}>
                      {g.ai_feasibility.verdict.replace('_', ' ')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.goalTarget}>{g.target_description}</Text>
              {g.target_date && (
                <Text style={styles.goalMeta}>
                  Target: {new Date(g.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addGoalRow} onPress={() => navigation.navigate('FitnessGoal')}>
            <Text style={styles.addGoalText}>+ Add / Edit Goals</Text>
          </TouchableOpacity>
        </>
      )}

      {/* This Week */}
      {sessions.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <View style={styles.weekRow}>
            {weekDays.map(({ date: d, dayAbbr }) => {
              const s = sessions.find((s: any) => s.date === d);
              const isToday = d === today;
              const color = s ? (SESSION_COLORS[s.session_type] || colors.primary) : colors.border;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayCell, isToday && styles.dayCellToday]}
                  onPress={() => s && navigation.navigate('TrainingPlan', { selectedDate: d })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayAbbr, isToday && styles.dayAbbrToday]}>{dayAbbr}</Text>
                  <View style={[styles.dayDot, { backgroundColor: color }]} />
                  {s && <Text style={styles.dayIcon}>{SESSION_ICONS[s.session_type] || '•'}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          {plan && <Text style={styles.planMeta}>{(plan as any).phase?.toUpperCase()} PHASE · {(plan as any).weekly_run_km_target ? `${(plan as any).weekly_run_km_target}km target` : ''}</Text>}
        </>
      )}

      {/* Today's Session */}
      <Text style={styles.sectionLabel}>TODAY</Text>
      {todaySession ? (
        <TouchableOpacity
          style={styles.todayCard}
          onPress={() => navigation.navigate('WorkoutSession', { workoutId: workout?.id })}
          activeOpacity={0.8}
        >
          <View style={styles.todayHeader}>
            <Text style={styles.todayIcon}>{SESSION_ICONS[todaySession.session_type] || '💪'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayTitle}>{todaySession.title}</Text>
              <Text style={styles.todayMeta}>
                {todaySession.duration_minutes}min
                {todaySession.targets?.distance_km ? ` · ${todaySession.targets.distance_km}km` : ''}
              </Text>
            </View>
            <View style={[styles.sessionTypeBadge, { backgroundColor: (SESSION_COLORS[todaySession.session_type] || colors.primary) + '20' }]}>
              <Text style={[styles.sessionTypeText, { color: SESSION_COLORS[todaySession.session_type] || colors.primary }]}>
                {todaySession.session_type.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {todaySession.description && (
            <Text style={styles.todayDesc} numberOfLines={2}>{todaySession.description}</Text>
          )}
          <Text style={styles.tapToLog}>Tap to log this session →</Text>
        </TouchableOpacity>
      ) : workout ? (
        <TouchableOpacity
          style={styles.todayCard}
          onPress={() => navigation.navigate('WorkoutSession', { workoutId: workout.id })}
          activeOpacity={0.8}
        >
          <View style={styles.todayHeader}>
            <Text style={styles.todayIcon}>💪</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayTitle}>{workout.title}</Text>
              <Text style={styles.todayMeta}>{workout.duration_minutes}min · {workout.intensity}</Text>
            </View>
          </View>
          <Text style={styles.todayDesc} numberOfLines={2}>{workout.ai_reasoning}</Text>
          <Text style={styles.tapToLog}>Tap to log this session →</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.todayCard, { alignItems: 'center' }]}>
          <Text style={styles.todayDesc}>No workout generated yet. Pull to refresh.</Text>
        </View>
      )}

      {/* Quick Stats */}
      {stats && (
        <>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <View style={styles.statsRow}>
            <StatBox label="KM RUN" value={`${stats.run_km}`} unit="km" />
            <StatBox label="STRENGTH" value={`${stats.strength_sessions}`} unit="sessions" />
            <StatBox label="DONE" value={`${stats.workouts_done}`} unit="workouts" />
          </View>
        </>
      )}

      {/* Navigation Tools */}
      <Text style={styles.sectionLabel}>TOOLS</Text>
      <View style={styles.toolsGrid}>
        {[
          { label: 'Training Plan', icon: '📅', screen: 'TrainingPlan' },
          { label: 'Progress', icon: '📈', screen: 'ExerciseProgress' },
          { label: 'History', icon: '📋', screen: null, onPress: () => navigation.navigate('WorkoutSession', { mode: 'history' }) },
          { label: 'Equipment', icon: '🏋️', screen: 'EquipmentSetup' },
        ].map(tool => (
          <TouchableOpacity
            key={tool.label}
            style={styles.toolCard}
            onPress={() => tool.screen ? navigation.navigate(tool.screen) : tool.onPress?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.toolIcon}>{tool.icon}</Text>
            <Text style={styles.toolLabel}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getWeekDays(): Array<{ date: string; dayAbbr: string }> {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { date: dt.toISOString().split('T')[0], dayAbbr: d };
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },

  noGoalCard: {
    ...cardStyle,
    alignItems: 'center',
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryGlow,
  },
  noGoalEmoji: { fontSize: 40, marginBottom: spacing.md },
  noGoalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  noGoalSub: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  noGoalBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  noGoalBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.md },

  goalCard: { ...cardStyle, marginBottom: spacing.sm },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  priorityBadge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  priorityText: { fontSize: font.xs, fontWeight: font.bold, letterSpacing: 0.5 },
  verdictBadge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  verdictText: { fontSize: font.xs, fontWeight: font.semibold },
  goalTarget: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 2 },
  goalMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  addGoalRow: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
  addGoalText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.sm },

  weekRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  dayCell: {
    flex: 1, alignItems: 'center', padding: spacing.xs,
    borderRadius: radii.sm, backgroundColor: colors.bgCard,
  },
  dayCellToday: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.primary },
  dayAbbr: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: 2 },
  dayAbbrToday: { color: colors.textAccent },
  dayDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  dayIcon: { fontSize: 10 },
  planMeta: { fontSize: font.xs, color: colors.textTertiary, marginBottom: spacing.md, textAlign: 'center' },

  todayCard: { ...cardStyle, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  todayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  todayIcon: { fontSize: 28 },
  todayTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  todayMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  sessionTypeBadge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  sessionTypeText: { fontSize: font.xs, fontWeight: font.semibold },
  todayDesc: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 20 },
  tapToLog: { fontSize: font.xs, color: colors.primary, fontWeight: font.semibold },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: {
    flex: 1, ...cardStyle, alignItems: 'center', padding: spacing.lg,
  },
  statValue: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.primary },
  statUnit: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4, fontWeight: font.semibold, letterSpacing: 0.5 },

  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolCard: {
    width: '47%', ...cardStyle, alignItems: 'center', padding: spacing.lg, gap: spacing.xs,
  },
  toolIcon: { fontSize: 26 },
  toolLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semibold, textAlign: 'center' },
});
