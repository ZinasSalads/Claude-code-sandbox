import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import {
  getFitnessGoals, getCurrentTrainingPlan, getTodayWorkout,
  getWeekStats, generateTrainingPlan, getWorkoutHistory,
} from '../lib/api';
import type { FitnessGoal, TrainingPlan, Workout, WeekStats } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, shadow } from '../theme';

const SESSION_COLORS: Record<string, string> = {
  easy_run: '#22c55e', tempo_run: '#f97316', long_run: '#8b5cf6',
  interval_run: '#ef4444', strength: '#3b82f6', recovery: '#06b6d4',
  cross_train: '#eab308', rest: '#6b7280',
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
  const [recentHistory, setRecentHistory] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [g, p, w, s, h] = await Promise.all([
      getFitnessGoals(),
      getCurrentTrainingPlan().catch(() => null),
      getTodayWorkout().catch(() => null),
      getWeekStats().catch(() => null),
      getWorkoutHistory(14).catch(() => []),
    ]);
    setGoals(g || []);
    setPlan(p);
    setWorkout(w);
    setStats(s);
    setRecentHistory(h || []);
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
  const sessions: any[] = (plan as any)?.planned_sessions || [];
  const completedDates = new Set(recentHistory.filter(w => w.completed).map(w => w.date));
  const weekDays = getWeekDays();

  const handleDayPress = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  const handleLogSession = (session: any) => {
    navigation.navigate('WorkoutSession', {
      plannedSession: session,
      workoutId: session.date === today ? workout?.id : undefined,
    });
  };

  const handleGenerate = async () => {
    Alert.alert('Generate Training Plan', 'Create a new weekly plan based on your goals?', [
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
    ]);
  };

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

      {/* Quick Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.run_km}</Text>
            <Text style={styles.statUnit}>km</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.strength_sessions}</Text>
            <Text style={styles.statUnit}>strength</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.workouts_done}</Text>
            <Text style={styles.statUnit}>done</Text>
          </View>
        </View>
      )}

      {/* Week Calendar — Merged view with dates, completion, expandable */}
      <View style={styles.weekHeader}>
        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        {plan && (
          <Text style={styles.planPhase}>
            {((plan as any).phase || 'base').toUpperCase()}
            {(plan as any).weekly_run_km_target ? ` · ${(plan as any).weekly_run_km_target}km` : ''}
          </Text>
        )}
      </View>

      {sessions.length > 0 ? (
        <View style={styles.weekGrid}>
          {weekDays.map(({ date: d, dayLabel, dateNum }) => {
            const session = sessions.find((s: any) => s.date === d);
            const isToday = d === today;
            const isDone = completedDates.has(d);
            const isPast = d < today;
            const isExpanded = expandedDay === d;
            const color = session ? (SESSION_COLORS[session.session_type] || colors.primary) : colors.border;

            return (
              <View key={d}>
                <TouchableOpacity
                  style={[
                    styles.dayCard,
                    isToday && styles.dayCardToday,
                    isExpanded && styles.dayCardExpanded,
                  ]}
                  onPress={() => session && handleDayPress(d)}
                  activeOpacity={session ? 0.7 : 1}
                >
                  <View style={styles.dayTopRow}>
                    <View>
                      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel}</Text>
                      <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>{dateNum}</Text>
                    </View>
                    <View style={styles.dayRight}>
                      {isDone && <Text style={styles.doneCheck}>✓</Text>}
                      {session && !isDone && isPast && <Text style={styles.missedMark}>—</Text>}
                      <View style={[styles.dayDot, { backgroundColor: color }]} />
                    </View>
                  </View>
                  {session && (
                    <View style={styles.dayBottom}>
                      <Text style={styles.dayIcon}>{SESSION_ICONS[session.session_type] || '💪'}</Text>
                      <Text style={[styles.dayType, { color }]} numberOfLines={1}>
                        {session.title || session.session_type.replace('_', ' ')}
                      </Text>
                      <Text style={styles.dayDuration}>{session.duration_minutes}m</Text>
                    </View>
                  )}
                  {!session && (
                    <Text style={styles.dayRestLabel}>Rest</Text>
                  )}
                </TouchableOpacity>

                {/* Expanded session detail */}
                {isExpanded && session && (
                  <View style={styles.expandedCard}>
                    <Text style={styles.expandedTitle}>{session.title}</Text>
                    {session.description && (
                      <Text style={styles.expandedDesc}>{session.description}</Text>
                    )}
                    <View style={styles.expandedMeta}>
                      {session.duration_minutes && (
                        <Text style={styles.expandedMetaItem}>{session.duration_minutes} min</Text>
                      )}
                      {session.targets?.distance_km && (
                        <Text style={styles.expandedMetaItem}>{session.targets.distance_km} km</Text>
                      )}
                      {session.targets?.pace_per_km && (
                        <Text style={styles.expandedMetaItem}>{session.targets.pace_per_km}'/km</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.logBtn}
                      onPress={() => handleLogSession(session)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.logBtnText}>
                        {isDone ? 'View Session' : isToday ? 'Log This Session →' : isPast ? 'Log Retroactively' : 'Preview'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyPlanCard}>
          <Text style={styles.emptyPlanText}>No training plan yet.</Text>
          <TouchableOpacity
            style={[styles.generateBtn, generating && { opacity: 0.6 }]}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.8}
          >
            {generating
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.generateBtnText}>Generate Training Plan</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Regenerate button if plan exists */}
      {sessions.length > 0 && (
        <TouchableOpacity
          style={[styles.regenRow, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.7}
        >
          {generating
            ? <ActivityIndicator color={colors.textSecondary} size="small" />
            : <Text style={styles.regenText}>↻ Regenerate Plan</Text>
          }
        </TouchableOpacity>
      )}

      {/* Today's Workout — quick action */}
      {workout && !workout.completed && (
        <>
          <Text style={styles.sectionLabel}>TODAY'S WORKOUT</Text>
          <TouchableOpacity
            style={styles.todayCard}
            onPress={() => {
              const todaySession = sessions.find((s: any) => s.date === today);
              navigation.navigate('WorkoutSession', {
                workoutId: workout.id,
                plannedSession: todaySession || undefined,
              });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.todayHeader}>
              <Text style={styles.todayIcon}>💪</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayTitle}>{workout.title}</Text>
                <Text style={styles.todayMeta}>{workout.duration_minutes}min · {workout.intensity}</Text>
              </View>
            </View>
            <Text style={styles.tapToLog}>Tap to log this session →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Quick log (manual) */}
      <TouchableOpacity
        style={styles.manualLogRow}
        onPress={() => navigation.navigate('WorkoutSession', { mode: 'manual' })}
        activeOpacity={0.7}
      >
        <Text style={styles.manualLogText}>+ Log a workout manually</Text>
      </TouchableOpacity>

      {/* Tools */}
      <Text style={styles.sectionLabel}>TOOLS</Text>
      <View style={styles.toolsGrid}>
        {[
          { label: 'Progress', icon: '📈', screen: 'ExerciseProgress' },
          { label: 'History', icon: '📋', screen: 'WorkoutSession', params: { mode: 'history' } },
          { label: 'Equipment', icon: '🏋️', screen: 'EquipmentSetup' },
        ].map(tool => (
          <TouchableOpacity
            key={tool.label}
            style={styles.toolCard}
            onPress={() => navigation.navigate(tool.screen, tool.params || {})}
            activeOpacity={0.7}
          >
            <Text style={styles.toolIcon}>{tool.icon}</Text>
            <Text style={styles.toolLabel}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent completed workouts */}
      {recentHistory.filter(w => w.completed).length > 0 && (
        <>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          {recentHistory.filter(w => w.completed).slice(0, 3).map(w => (
            <TouchableOpacity
              key={w.id}
              style={styles.historyCard}
              onPress={() => navigation.navigate('WorkoutSession', { workoutId: w.id, mode: 'view' })}
              activeOpacity={0.7}
            >
              <View style={styles.historyRow}>
                <Text style={styles.historyDate}>
                  {new Date((w.date || '') + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.historyDone}><Text style={styles.historyDoneText}>Done</Text></View>
              </View>
              <Text style={styles.historyTitle}>{w.title}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function getWeekDays(): Array<{ date: string; dayLabel: string; dateNum: string }> {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      date: dt.toISOString().split('T')[0],
      dayLabel: d,
      dateNum: dt.getDate().toString(),
    };
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },

  // Goals
  noGoalCard: {
    ...cardStyle, alignItems: 'center', padding: spacing['2xl'],
    marginBottom: spacing.lg, borderStyle: 'dashed', borderWidth: 1.5,
    borderColor: colors.primary, backgroundColor: colors.primaryGlow,
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

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, ...cardStyle, alignItems: 'center', padding: spacing.md },
  statValue: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.primary },
  statUnit: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  // Week
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planPhase: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.semibold, marginBottom: spacing.md },

  weekGrid: { gap: spacing.xs, marginBottom: spacing.sm },
  dayCard: {
    backgroundColor: colors.bgCard, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  dayCardToday: { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1.5 },
  dayCardExpanded: { borderColor: colors.primaryBorder },
  dayTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayLabel: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold },
  dayLabelToday: { color: colors.textAccent },
  dayDate: { fontSize: font.lg, color: colors.textPrimary, fontWeight: font.bold },
  dayDateToday: { color: colors.textAccent },
  dayRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneCheck: { fontSize: font.md, color: colors.success, fontWeight: font.bold },
  missedMark: { fontSize: font.md, color: colors.textTertiary },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  dayBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  dayIcon: { fontSize: 16 },
  dayType: { fontSize: font.sm, fontWeight: font.semibold, flex: 1 },
  dayDuration: { fontSize: font.xs, color: colors.textTertiary },
  dayRestLabel: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },

  expandedCard: {
    backgroundColor: colors.bgCard, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.primaryBorder,
    padding: spacing.lg, marginTop: -1, borderTopWidth: 0,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  expandedTitle: { fontSize: font.md, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  expandedDesc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  expandedMeta: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  expandedMetaItem: { fontSize: font.sm, color: colors.textAccent, fontWeight: font.semibold },
  logBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
  logBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.sm },

  emptyPlanCard: { ...cardStyle, alignItems: 'center', padding: spacing.xl, marginBottom: spacing.md },
  emptyPlanText: { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing.lg },
  generateBtn: { backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary },
  generateBtnText: { color: colors.textAccent, fontWeight: font.bold, fontSize: font.md },

  regenRow: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.md },
  regenText: { color: colors.textTertiary, fontWeight: font.semibold, fontSize: font.sm },

  // Today
  todayCard: { ...cardStyle, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  todayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  todayIcon: { fontSize: 28 },
  todayTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  todayMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  tapToLog: { fontSize: font.xs, color: colors.primary, fontWeight: font.semibold },

  manualLogRow: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
  manualLogText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.sm },

  // Tools
  toolsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toolCard: {
    flex: 1, ...cardStyle, alignItems: 'center', padding: spacing.lg, gap: spacing.xs,
  },
  toolIcon: { fontSize: 26 },
  toolLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semibold, textAlign: 'center' },

  // History
  historyCard: { ...cardStyle, marginBottom: spacing.sm },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyDate: { fontSize: font.xs, color: colors.textTertiary },
  historyTitle: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary },
  historyDone: { backgroundColor: colors.successMuted, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  historyDoneText: { fontSize: font.xs, color: colors.success, fontWeight: font.bold },
});
