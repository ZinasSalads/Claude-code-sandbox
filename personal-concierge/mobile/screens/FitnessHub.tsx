import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import {
  API_URL,
  getFitnessGoals, getCurrentTrainingPlan, getTodayWorkout,
  getWeekStats, generateTrainingPlan, getWorkoutHistory, deleteWorkout,
} from '../lib/api';
import type { FitnessGoal, TrainingPlan, Workout, WeekStats } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, shadow } from '../theme';
import { useUnits } from '../context/UnitsContext';
import HrZoneRef from '../components/HrZoneRef';

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
    setOptions: (options: Record<string, unknown>) => void;
  };
}

export default function FitnessHub({ navigation }: Props) {
  const { units } = useUnits();
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [recentHistory, setRecentHistory] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const iconScrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const [[g, p, w, s, h], profile] = await Promise.all([
      Promise.all([
        getFitnessGoals(),
        getCurrentTrainingPlan().catch(() => null),
        getTodayWorkout().catch(() => null),
        getWeekStats().catch(() => null),
        getWorkoutHistory(21).catch(() => []),
      ]),
      fetch(`${API_URL}/fitness/profile-settings`, { headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json()).catch(() => ({})),
    ]);
    setGoals(g || []);
    setPlan(p);
    setWorkout(w);
    setStats(s);
    setRecentHistory(h || []);
    if (profile?.max_hr) setMaxHr(profile.max_hr);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('FitnessSettings')}
          style={{ marginRight: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 22, textAlign: 'center' }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const today = new Date().toISOString().split('T')[0];
  const sessions: any[] = (plan as any)?.planned_sessions || [];
  const completedDates = new Set(recentHistory.filter(w => w.completed).map(w => w.date));

  // Auto-scroll icon strip to center today
  useEffect(() => {
    if (!loading && iconScrollRef.current) {
      // scrollDays has 3 weeks; today is in the middle week (index 7-13 of 21)
      const todayIdx = scrollDays.findIndex(d => d.date === today);
      if (todayIdx >= 0) {
        const cellWidth = 48; // iconCell width + margin
        const offset = Math.max(0, todayIdx * cellWidth - 100);
        setTimeout(() => iconScrollRef.current?.scrollTo({ x: offset, animated: false }), 100);
      }
    }
  }, [loading, today]);

  const fmtDist = (km: number) => units === 'imperial' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
  const fmtSpeed = (paceMinPerKm: number) => {
    if (!paceMinPerKm) return null;
    if (units === 'imperial') return `${(60 / (paceMinPerKm * 1.60934)).toFixed(1)} mph`;
    return `${(60 / paceMinPerKm).toFixed(1)} km/h`;
  };
  const kmToMi = (km: number) => (km * 0.621371).toFixed(1); // legacy for weekly goal display

  // Build 3-week scroll strip: prev week + this week + next week
  const scrollDays = get3WeekDays();
  const completedByDate: Record<string, Workout> = {};
  for (const w of recentHistory) { if (w.completed && w.date) completedByDate[w.date] = w; }
  const sessionByDate: Record<string, any> = {};
  for (const s of sessions) { if (s.date) sessionByDate[s.date] = s; }

  // Upcoming = today + next 7 days that have a planned session (not just current week)
  const upcomingDays = scrollDays.filter(({ date: d }) => d >= today && sessionByDate[d] && sessionByDate[d].session_type !== 'rest').slice(0, 7);

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
              {g.target_date && (() => {
                const daysLeft = Math.ceil((new Date(g.target_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
                const dateStr = new Date(g.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <View style={styles.goalMetaRow}>
                    <Text style={styles.goalMeta}>{dateStr}</Text>
                    <Text style={[styles.goalDaysLeft, daysLeft < 30 && { color: colors.warning }, daysLeft < 0 && { color: colors.error }]}>
                      {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Today!' : 'Passed'}
                    </Text>
                  </View>
                );
              })()}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addGoalRow} onPress={() => navigation.navigate('FitnessGoal')}>
            <Text style={styles.addGoalText}>+ Add / Edit Goals</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Week header with inline phase + mileage progress */}
      <View style={styles.weekHeader}>
        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        <View style={{ alignItems: 'flex-end' }}>
          {plan && <Text style={styles.planPhase}>{formatPhase((plan as any).phase)}</Text>}
          {plan && (plan as any).weekly_run_km_target && stats && (
            <Text style={styles.weeklyGoal}>
              Goal: {kmToMi(stats.run_km)}/{kmToMi((plan as any).weekly_run_km_target)} mi
            </Text>
          )}
        </View>
      </View>

      {/* 3-week scrollable icon strip */}
      <ScrollView ref={iconScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow} contentContainerStyle={{ paddingHorizontal: spacing.xs }}>
        {scrollDays.map(({ date: d, dayLabel, dateNum, isThisWeek }) => {
          const session = sessionByDate[d];
          const completedW = completedByDate[d];
          const histW = recentHistory.find(w => w.date === d);
          const isToday = d === today;
          const isPast = d < today;
          const isDone = !!completedW || !!completedDates.has(d);
          const isMissed = isPast && session && session.session_type !== 'rest' && !isDone;
          const isActive = expandedDay === d;
          const color = session ? (isPast && !isDone ? '#6b7280' : SESSION_COLORS[session.session_type] || colors.primary) : colors.border;
          const hasActivity = isDone || (isPast && histW);
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.iconCell,
                isToday && styles.iconCellToday,
                isActive && styles.iconCellActive,
                isPast && !isThisWeek && styles.iconCellPastWeek,
              ]}
              onPress={() => {
                // Past completed days: open workout log view
                if (isPast && isDone && histW) {
                  navigation.navigate('WorkoutSession', { workoutId: histW.id, mode: 'view' });
                  return;
                }
                if (session) { handleDayPress(d); return; }
                if (hasActivity && histW) navigation.navigate('WorkoutSession', { workoutId: histW.id, mode: 'view' });
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.iconDayLabel, isToday && styles.iconDayLabelToday, isPast && !isToday && styles.iconDayLabelPast]}>{dayLabel}</Text>
              <Text style={[styles.iconDateNum, isToday && styles.iconDayLabelToday, isPast && !isToday && styles.iconDayLabelPast]}>{dateNum}</Text>
              {isMissed
                ? <Text style={styles.iconMissed}>✕</Text>
                : isDone
                  ? <Text style={styles.iconDone}>✓</Text>
                  : <Text style={[styles.iconEmoji, isPast && !isToday && { opacity: 0.4 }]}>{session ? (SESSION_ICONS[session.session_type] || '💪') : (isThisWeek ? '😴' : '')}</Text>
              }
              <View style={[styles.iconBar, { backgroundColor: color, opacity: isPast && !isDone ? 0.35 : 1 }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {sessions.length > 0 ? (
        <>
          {/* Upcoming sessions (today + future) */}
          <Text style={styles.sectionLabel}>UPCOMING</Text>
          <View style={styles.weekGrid}>
            {upcomingDays.length === 0 && (
              <Text style={[styles.dayLabel, { padding: spacing.md, color: colors.textSecondary }]}>No more sessions planned this week.</Text>
            )}
            {upcomingDays.map(({ date: d, dayLabel, dateNum }) => {
              const session = sessionByDate[d];
              if (!session) return null;
              const isToday = d === today;
              const isDone = completedDates.has(d);
              const isExpanded = expandedDay === d;
              const color = SESSION_COLORS[session.session_type] || colors.primary;
              return (
                <View key={d}>
                  <TouchableOpacity
                    style={[styles.dayCard, isToday && styles.dayCardToday, isExpanded && styles.dayCardExpanded]}
                    onPress={() => handleDayPress(d)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={styles.dayIcon}>{SESSION_ICONS[session.session_type] || '💪'}</Text>
                        <View>
                          <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{isToday ? 'Today' : `${dayLabel} ${dateNum}`}</Text>
                          <Text style={[styles.dayType, { color }]} numberOfLines={1}>{session.title}</Text>
                        </View>
                      </View>
                      <View style={styles.dayRight}>
                        {isDone && <Text style={styles.doneCheck}>✓</Text>}
                        <Text style={styles.dayDuration}>{session.duration_minutes}m</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.expandedCard}>
                      {session.description && <Text style={styles.expandedDesc}>{session.description}</Text>}
                      <View style={styles.expandedStats}>
                        {session.duration_minutes && (
                          <View style={styles.expandedStat}>
                            <Text style={styles.expandedStatValue}>{session.duration_minutes}</Text>
                            <Text style={styles.expandedStatLabel}>min</Text>
                          </View>
                        )}
                        {session.targets?.distance_km && (
                          <View style={styles.expandedStat}>
                            <Text style={styles.expandedStatValue}>{fmtDist(session.targets.distance_km).split(' ')[0]}</Text>
                            <Text style={styles.expandedStatLabel}>{units === 'imperial' ? 'mi' : 'km'}</Text>
                          </View>
                        )}
                        {session.targets?.pace_per_km && fmtSpeed(session.targets.pace_per_km) && (
                          <View style={styles.expandedStat}>
                            <Text style={styles.expandedStatValue}>{fmtSpeed(session.targets.pace_per_km)!.split(' ')[0]}</Text>
                            <Text style={styles.expandedStatLabel}>{units === 'imperial' ? 'mph' : 'km/h'}</Text>
                          </View>
                        )}
                      </View>
                      {session.targets?.hr_zone && (
                        <HrZoneRef zone={session.targets.hr_zone} maxHr={maxHr} />
                      )}
                      <TouchableOpacity style={styles.logBtn} onPress={() => handleLogSession(session)} activeOpacity={0.8}>
                        <Text style={styles.logBtnText}>{isDone ? 'View Session' : isToday ? 'Log This Session →' : 'Preview'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
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
          { label: 'How I Feel', icon: '🌡️', screen: 'CheckIn' },
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

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function getWeekDays(): Array<{ date: string; dayLabel: string; dateNum: string }> {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { date: dt.toISOString().split('T')[0], dayLabel: d, dateNum: dt.getDate().toString() };
  });
}

function get3WeekDays(): Array<{ date: string; dayLabel: string; dateNum: string; isThisWeek: boolean }> {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const start = new Date(monday);
  start.setDate(monday.getDate() - 7); // start from previous Monday
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result = [];
  for (let w = 0; w < 3; w++) {
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      result.push({
        date: dt.toISOString().split('T')[0],
        dayLabel: days[d],
        dateNum: dt.getDate().toString(),
        isThisWeek: w === 1,
      });
    }
  }
  return result;
}

function formatPhase(phase: string | undefined): string {
  if (!phase) return '';
  const map: Record<string, string> = { base: 'Base Phase', build: 'Build Phase', peak: 'Peak Phase', taper: 'Taper Phase', maintenance: 'Maintenance' };
  return map[phase.toLowerCase()] || phase;
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
  goalMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  goalMeta: { fontSize: font.xs, color: colors.textSecondary },
  goalDaysLeft: { fontSize: font.xs, color: colors.success, fontWeight: font.bold },
  addGoalRow: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
  addGoalText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.sm },

  // Week
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planPhase: { fontSize: font.xs, color: colors.textAccent, fontWeight: font.semibold },
  weeklyGoal: { fontSize: font.xs, color: colors.textTertiary, marginBottom: spacing.md },

  iconRow: { marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  iconCell: { alignItems: 'center', width: 46, marginRight: 2, paddingVertical: spacing.sm, borderRadius: radii.md, paddingHorizontal: 2 },
  iconCellToday: { backgroundColor: colors.primaryMuted },
  iconCellActive: { borderWidth: 1, borderColor: colors.primary },
  iconCellPastWeek: { opacity: 0.7 },
  iconDayLabel: { fontSize: 9, color: colors.textTertiary, fontWeight: font.bold, marginBottom: 1 },
  iconDayLabelToday: { color: colors.textAccent },
  iconDayLabelPast: { color: colors.textTertiary, opacity: 0.6 },
  iconDateNum: { fontSize: 11, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: 2 },
  iconEmoji: { fontSize: 18, marginBottom: 2 },
  iconDone: { fontSize: 14, color: colors.success, fontWeight: font.bold, marginBottom: 2 },
  iconMissed: { fontSize: 14, color: colors.textTertiary, opacity: 0.5, marginBottom: 2 },
  iconBar: { width: 22, height: 3, borderRadius: 1.5 },

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
  expandedStats: {
    flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.bg,
  },
  expandedStat: { alignItems: 'center', flex: 1 },
  expandedStatValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary },
  expandedStatLabel: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.semibold, marginTop: 2 },
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

});
