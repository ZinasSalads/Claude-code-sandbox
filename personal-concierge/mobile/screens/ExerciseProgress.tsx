import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { getExerciseProgress, getLoggedExercises, getRunningSummary } from '../lib/api';
import type { WorkoutSet } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle } from '../theme';

interface Props {
  navigation: object;
}

interface ExerciseDay {
  date: string;
  sets: WorkoutSet[];
  maxWeight: number | null;
}

function groupSetsByDate(sets: WorkoutSet[]): ExerciseDay[] {
  const map: Record<string, WorkoutSet[]> = {};
  for (const s of sets) {
    const d = s.date || 'unknown';
    if (!map[d]) map[d] = [];
    map[d].push(s);
  }
  return Object.entries(map)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, daySets]) => ({
      date,
      sets: daySets.sort((a, b) => a.set_number - b.set_number),
      maxWeight: daySets.reduce((max, s) => (s.weight_kg != null && s.weight_kg > (max ?? -1) ? s.weight_kg : max), null as number | null),
    }));
}

export default function ExerciseProgress({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [knownExercises, setKnownExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [days, setDays] = useState<ExerciseDay[]>([]);
  const [runWeeks, setRunWeeks] = useState<Array<{ week: string; km: number; runs: number }>>([]);
  const [tab, setTab] = useState<'strength' | 'running'>('running');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    Promise.all([
      getLoggedExercises().catch(() => [] as string[]),
      getRunningSummary(8).catch(() => null),
    ]).then(([exercises, running]) => {
      setKnownExercises(exercises);
      setRunWeeks(running?.weekly || []);
      setLoadingList(false);
    });
  }, []);

  const loadExercise = useCallback(async (name: string) => {
    setSelectedExercise(name);
    setSearch(name);
    setLoading(true);
    const sets = await getExerciseProgress(name, 90).catch(() => [] as WorkoutSet[]);
    setDays(groupSetsByDate(sets));
    setLoading(false);
  }, []);

  const filteredExercises = knownExercises.filter(e =>
    e.toLowerCase().includes(search.toLowerCase())
  );

  const overallMax = days.reduce((max, d) => (d.maxWeight != null && d.maxWeight > max ? d.maxWeight : max), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'strength' && styles.tabActive]} onPress={() => setTab('strength')}>
          <Text style={[styles.tabText, tab === 'strength' && styles.tabTextActive]}>Strength</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'running' && styles.tabActive]} onPress={() => setTab('running')}>
          <Text style={[styles.tabText, tab === 'running' && styles.tabTextActive]}>Running</Text>
        </TouchableOpacity>
      </View>

      {tab === 'strength' && (
        <>
          <TextInput
            style={[inputStyle, { color: colors.textPrimary, marginBottom: spacing.sm }]}
            value={search}
            onChangeText={v => { setSearch(v); if (selectedExercise) setSelectedExercise(null); }}
            placeholder="Search exercise (e.g. Bench Press)"
            placeholderTextColor={colors.textTertiary}
          />

          {/* Autocomplete suggestions */}
          {search.length > 0 && !selectedExercise && filteredExercises.length > 0 && (
            <View style={styles.suggestBox}>
              {filteredExercises.slice(0, 6).map(ex => (
                <TouchableOpacity key={ex} style={styles.suggestRow} onPress={() => loadExercise(ex)}>
                  <Text style={styles.suggestText}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Grid of known exercises when nothing typed */}
          {!selectedExercise && search.length === 0 && (
            <>
              {loadingList
                ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                : knownExercises.length === 0
                  ? <Text style={styles.empty}>No exercises logged yet. Complete a workout to see progress here.</Text>
                  : (
                    <>
                      <Text style={styles.sectionLabel}>LOGGED EXERCISES</Text>
                      <View style={styles.exerciseGrid}>
                        {knownExercises.map(ex => (
                          <TouchableOpacity key={ex} style={styles.exerciseChip} onPress={() => loadExercise(ex)}>
                            <Text style={styles.exerciseChipText}>{ex}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )
              }
            </>
          )}

          {/* Detail view for selected exercise */}
          {selectedExercise && (
            <>
              <TouchableOpacity onPress={() => { setSelectedExercise(null); setSearch(''); setDays([]); }} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← All Exercises</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>{selectedExercise.toUpperCase()}</Text>

              {loading
                ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                : days.length === 0
                  ? <Text style={styles.empty}>No data for this exercise yet.</Text>
                  : (
                    <>
                      {/* Summary row */}
                      <View style={styles.prCard}>
                        <View style={styles.prItem}>
                          <Text style={styles.prValue}>{overallMax > 0 ? `${overallMax}kg` : '—'}</Text>
                          <Text style={styles.prLabel}>Max Weight</Text>
                        </View>
                        <View style={styles.prItem}>
                          <Text style={styles.prValue}>{days.length}</Text>
                          <Text style={styles.prLabel}>Sessions</Text>
                        </View>
                        <View style={styles.prItem}>
                          <Text style={styles.prValue}>{days.reduce((s, d) => s + d.sets.length, 0)}</Text>
                          <Text style={styles.prLabel}>Total Sets</Text>
                        </View>
                      </View>

                      {/* Bar chart (max weight per session) */}
                      <View style={styles.trendCard}>
                        <Text style={styles.trendTitle}>MAX WEIGHT TREND</Text>
                        <View style={styles.trendBar}>
                          {[...days].reverse().slice(-10).map((d, i) => {
                            const barH = overallMax > 0 ? Math.max(4, ((d.maxWeight || 0) / overallMax) * 48) : 4;
                            return (
                              <View key={i} style={styles.trendColWrapper}>
                                <View style={[styles.trendCol, { height: barH }]} />
                                <Text style={styles.trendDate} numberOfLines={1}>
                                  {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {/* Per-session history */}
                      {days.map((entry, i) => (
                        <View key={i} style={styles.histCard}>
                          <View style={styles.histHeader}>
                            <Text style={styles.histDate}>
                              {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            {entry.maxWeight != null && (
                              <Text style={styles.histMax}>{entry.maxWeight}kg max</Text>
                            )}
                          </View>
                          <View style={styles.setTableHeader}>
                            {['Set', 'Weight', 'Reps', 'RPE'].map(h => (
                              <Text key={h} style={styles.setHeaderCell}>{h}</Text>
                            ))}
                          </View>
                          {entry.sets.map((s, si) => (
                            <View key={si} style={styles.setRow}>
                              <Text style={styles.setCell}>{s.set_number}</Text>
                              <Text style={styles.setCell}>{s.weight_kg != null ? `${s.weight_kg}kg` : '—'}</Text>
                              <Text style={styles.setCell}>{s.reps_completed ?? '—'}</Text>
                              <Text style={styles.setCell}>{s.rpe ?? '—'}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </>
                  )
              }
            </>
          )}
        </>
      )}

      {tab === 'running' && (
        <>
          <Text style={styles.sectionLabel}>RUNNING — LAST 8 WEEKS</Text>
          {runWeeks.length === 0
            ? <Text style={styles.empty}>No runs logged yet. Complete a run session to see data here.</Text>
            : [...runWeeks].reverse().map((week, i) => (
              <View key={i} style={styles.runWeekCard}>
                <View style={styles.runWeekHeader}>
                  <Text style={styles.runWeekLabel}>Week of {week.week}</Text>
                  <Text style={styles.runWeekKm}>{((week.km ?? 0) * 0.621371).toFixed(1)} mi</Text>
                </View>
                <View style={styles.runWeekStats}>
                  <View>
                    <Text style={styles.runStatValue}>{week.runs ?? 0}</Text>
                    <Text style={styles.runStatLabel}>Runs</Text>
                  </View>
                  <View>
                    <Text style={styles.runStatValue}>{week.km > 0 && week.runs > 0 ? `${(week.km * 0.621371 / week.runs).toFixed(1)}` : '—'}</Text>
                    <Text style={styles.runStatLabel}>Avg mi/run</Text>
                  </View>
                </View>
              </View>
            ))
          }
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40, fontSize: font.sm, lineHeight: 20 },

  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  tabText: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textSecondary },
  tabTextActive: { color: colors.textAccent },

  suggestBox: { ...cardStyle, marginBottom: spacing.sm, padding: 0, overflow: 'hidden' },
  suggestRow: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestText: { fontSize: font.md, color: colors.textPrimary },

  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exerciseChip: {
    backgroundColor: colors.bgCard, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  exerciseChipText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.medium },

  backBtn: { marginBottom: spacing.md },
  backBtnText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.sm },

  prCard: { ...cardStyle, flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  prItem: { alignItems: 'center' },
  prValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.primary },
  prLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  trendCard: { ...cardStyle, marginBottom: spacing.md },
  trendTitle: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold, letterSpacing: 0.8, marginBottom: spacing.md },
  trendBar: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 3 },
  trendColWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 60 },
  trendCol: { width: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  trendDate: { fontSize: 7, color: colors.textTertiary, marginTop: 2, textAlign: 'center' },

  histCard: { ...cardStyle, marginBottom: spacing.sm },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  histDate: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary },
  histMax: { fontSize: font.sm, color: colors.primary, fontWeight: font.bold },
  setTableHeader: { flexDirection: 'row', marginBottom: spacing.xs, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  setHeaderCell: { flex: 1, fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold, textAlign: 'center' },
  setRow: { flexDirection: 'row', paddingVertical: 3 },
  setCell: { flex: 1, fontSize: font.sm, color: colors.textSecondary, textAlign: 'center' },

  runWeekCard: { ...cardStyle, marginBottom: spacing.sm },
  runWeekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  runWeekLabel: { fontSize: font.sm, color: colors.textSecondary },
  runWeekKm: { fontSize: font.xl, fontWeight: font.bold, color: colors.primary },
  runWeekStats: { flexDirection: 'row', gap: spacing.xl },
  runStatValue: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  runStatLabel: { fontSize: font.xs, color: colors.textTertiary },
});
