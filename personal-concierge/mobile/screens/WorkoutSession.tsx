import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import {
  getTodayWorkout, completeWorkout, logWorkoutSets, logRunResult,
  getWorkoutSets, getRunResult, getWorkoutHistory,
  getTodayAppleWatchWorkouts, linkAppleWatchWorkout,
} from '../lib/api';
import type { Workout, WorkoutSet, RunLog, AppleWatchWorkout } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle } from '../theme';

interface Props {
  navigation: {
    goBack: () => void;
  };
  route?: { params?: { workoutId?: string; mode?: string; plannedSession?: any } };
}

interface SetRow {
  set_number: number;
  weight_kg: string;
  reps_completed: string;
  rpe: string;
}

const DEFAULT_SET: SetRow = { set_number: 1, weight_kg: '', reps_completed: '', rpe: '' };

export default function WorkoutSession({ navigation, route }: Props) {
  const workoutId = route?.params?.workoutId;
  const mode = route?.params?.mode;
  const plannedSession = route?.params?.plannedSession;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  // Sets logging
  const [exerciseSets, setExerciseSets] = useState<Record<string, SetRow[]>>({});

  // Run logging
  const [runData, setRunData] = useState({
    distance_km: '', duration_minutes: '', avg_hr: '', max_hr: '',
    zone2_pct: '', run_type: '', rpe: '', notes: '',
  });

  // Apple Watch
  const [awWorkouts, setAwWorkouts] = useState<AppleWatchWorkout[]>([]);
  const [linkedAW, setLinkedAW] = useState<AppleWatchWorkout | null>(null);

  // View mode state
  const [viewSets, setViewSets] = useState<WorkoutSet[]>([]);
  const [viewRun, setViewRun] = useState<RunLog | null>(null);

  // History mode
  const [history, setHistory] = useState<Workout[]>([]);

  const isRunWorkout = useCallback((w: Workout | null) => {
    if (!w) return false;
    const t = w.workout_type || w.title || '';
    return /run|cardio|tempo|interval|treadmill/i.test(t);
  }, []);

  const load = useCallback(async () => {
    if (mode === 'history') {
      const h = await getWorkoutHistory(30).catch(() => []);
      setHistory(h);
      setLoading(false);
      return;
    }

    if (mode === 'view' && workoutId) {
      const h = await getWorkoutHistory(30).catch(() => []);
      const found = h.find((x: Workout) => x.id === workoutId) || null;
      setWorkout(found);
      if (found?.id) {
        const [sets, run] = await Promise.all([
          getWorkoutSets(found.id).catch(() => []),
          getRunResult(found.id).catch(() => null),
        ]);
        setViewSets(sets);
        setViewRun(run);
      }
      setLoading(false);
      return;
    }

    // For plannedSession mode: show planned session as the workout structure
    if (plannedSession && !workoutId) {
      // Build a synthetic workout from the planned session
      const exercises = (plannedSession.targets?.exercises || []).map((ex: any) => ({
        name: ex.name,
        sets: ex.sets || 3,
        reps: ex.reps || '8-12',
        notes: ex.notes || '',
        suggested_weight_kg: null,
      }));
      const synthetic: Workout = {
        id: undefined,
        workout_type: plannedSession.session_type,
        title: plannedSession.title,
        intensity: 'moderate',
        duration_minutes: plannedSession.duration_minutes,
        ai_reasoning: plannedSession.description || '',
        exercises,
        completed: false,
      };
      if (exercises.length > 0) {
        const init: Record<string, SetRow[]> = {};
        for (const ex of exercises) {
          init[ex.name] = Array.from({ length: ex.sets }, (_, i) => ({
            set_number: i + 1, weight_kg: '', reps_completed: ex.reps, rpe: '',
          }));
        }
        setExerciseSets(init);
      }
      setWorkout(synthetic);
      setLoading(false);
      return;
    }

    // Manual mode or no workoutId: load today's AI workout
    const w = await getTodayWorkout().catch(() => null);
    setWorkout(w);

    if (w) {
      const existingSets = await getWorkoutSets(w.id).catch(() => []);
      if (existingSets.length > 0) {
        const byExercise: Record<string, SetRow[]> = {};
        for (const s of existingSets) {
          if (!byExercise[s.exercise_name]) byExercise[s.exercise_name] = [];
          byExercise[s.exercise_name].push({
            set_number: s.set_number,
            weight_kg: s.weight_kg?.toString() || '',
            reps_completed: s.reps_completed?.toString() || '',
            rpe: s.rpe?.toString() || '',
          });
        }
        setExerciseSets(byExercise);
      } else if (w.exercises?.length > 0 && mode !== 'manual') {
        const init: Record<string, SetRow[]> = {};
        for (const ex of w.exercises) {
          const name = ex.name || (ex as any).exercise_name || '';
          if (!name) continue;
          init[name] = Array.from({ length: ex.sets || 3 }, (_, i) => ({
            set_number: i + 1,
            weight_kg: (ex as any).suggested_weight_kg?.toString() || '',
            reps_completed: ex.reps?.toString() || '',
            rpe: '',
          }));
        }
        setExerciseSets(init);
      }
      const existingRun = await getRunResult(w.id).catch(() => null);
      if (existingRun) {
        setRunData({
          distance_km: existingRun.distance_km?.toString() || '',
          duration_minutes: existingRun.duration_minutes?.toString() || '',
          avg_hr: existingRun.avg_hr?.toString() || '',
          max_hr: existingRun.max_hr?.toString() || '',
          zone2_pct: existingRun.zone2_pct?.toString() || '',
          run_type: existingRun.run_type || '',
          rpe: existingRun.rpe?.toString() || '',
          notes: existingRun.notes || '',
        });
      }
      if (Platform.OS === 'ios') {
        const today = new Date().toISOString().split('T')[0];
        const aw = await getTodayAppleWatchWorkouts(today).catch(() => []);
        setAwWorkouts(aw);
      }
    }

    setLoading(false);
  }, [workoutId, mode, plannedSession]);

  useEffect(() => { load(); }, [load]);

  const handleLinkAW = async (aw: AppleWatchWorkout) => {
    if (!workout) return;
    setLinkedAW(aw);
    // Auto-fill run data from Apple Watch
    setRunData(prev => ({
      ...prev,
      duration_minutes: aw.duration_minutes?.toString() || prev.duration_minutes,
      distance_km: aw.distance_km?.toString() || prev.distance_km,
      avg_hr: aw.avg_hr?.toString() || prev.avg_hr,
    }));
    if (aw.id && workout.id) {
      await linkAppleWatchWorkout(aw.id, workout.id).catch(() => null);
    }
  };

  const addSetRow = (exercise: string) => {
    setExerciseSets(prev => {
      const rows = prev[exercise] || [];
      return {
        ...prev,
        [exercise]: [...rows, { ...DEFAULT_SET, set_number: rows.length + 1 }],
      };
    });
  };

  const updateSetRow = (exercise: string, idx: number, field: keyof SetRow, val: string) => {
    setExerciseSets(prev => {
      const rows = [...(prev[exercise] || [])];
      rows[idx] = { ...rows[idx], [field]: val };
      return { ...prev, [exercise]: rows };
    });
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // For plannedSession without workoutId, or manual mode: use today's workout as anchor
      let wid = workout?.id;
      if (!wid) {
        const tw = await getTodayWorkout().catch(() => null);
        wid = tw?.id;
      }
      if (!wid) { Alert.alert('Error', 'No workout found to log against.'); setSaving(false); return; }

      const allSets: WorkoutSet[] = [];
      for (const [exName, rows] of Object.entries(exerciseSets)) {
        for (const row of rows) {
          if (!row.weight_kg && !row.reps_completed) continue;
          allSets.push({
            exercise_name: exName,
            set_number: row.set_number,
            weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
            reps_completed: row.reps_completed ? parseInt(row.reps_completed) : null,
            rpe: row.rpe ? parseFloat(row.rpe) : null,
            notes: null,
          } as WorkoutSet);
        }
      }
      if (allSets.length > 0) await logWorkoutSets(wid, allSets);

      if (runData.distance_km || runData.duration_minutes) {
        await logRunResult(wid, {
          distance_km: runData.distance_km ? parseFloat(runData.distance_km) : undefined,
          duration_minutes: runData.duration_minutes ? parseFloat(runData.duration_minutes) : undefined,
          avg_hr: runData.avg_hr ? parseInt(runData.avg_hr) : undefined,
          max_hr: runData.max_hr ? parseInt(runData.max_hr) : undefined,
          zone2_pct: runData.zone2_pct ? parseFloat(runData.zone2_pct) : undefined,
          run_type: runData.run_type || undefined,
          rpe: runData.rpe ? parseInt(runData.rpe) : undefined,
          notes: runData.notes || undefined,
          source: linkedAW ? 'apple_watch' : 'manual',
        });
      }

      await completeWorkout(notes, wid);
      Alert.alert('Session logged!', 'Great work.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', 'Could not save session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  // History mode
  if (mode === 'history') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>WORKOUT HISTORY</Text>
        {history.length === 0 && <Text style={styles.empty}>No workouts logged yet.</Text>}
        {history.map(w => (
          <View key={w.id} style={[styles.histCard, w.completed && styles.histCardDone]}>
            <View style={styles.histRow}>
              <Text style={styles.histDate}>{new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
              {w.completed && <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Done</Text></View>}
            </View>
            <Text style={styles.histTitle}>{w.title}</Text>
            <Text style={styles.histMeta}>{w.duration_minutes}min · {w.intensity}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // View mode: read-only completed workout
  if (mode === 'view') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {workout && (
          <View style={[styles.header, { borderLeftColor: colors.success }]}>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
            <Text style={styles.workoutMeta}>
              {workout.date ? new Date(workout.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''} · {workout.duration_minutes}min
            </Text>
          </View>
        )}
        {viewSets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>SETS LOGGED</Text>
            {Object.entries(
              viewSets.reduce((acc: Record<string, WorkoutSet[]>, s) => {
                if (!acc[s.exercise_name]) acc[s.exercise_name] = [];
                acc[s.exercise_name].push(s);
                return acc;
              }, {})
            ).map(([ex, sets]) => (
              <View key={ex} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{ex}</Text>
                {sets.map((s, i) => (
                  <Text key={i} style={styles.exerciseNotes}>
                    Set {s.set_number}: {s.weight_kg != null ? `${s.weight_kg}kg` : ''} × {s.reps_completed ?? '—'} reps{s.rpe ? ` · RPE ${s.rpe}` : ''}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
        {viewRun && (
          <>
            <Text style={styles.sectionLabel}>RUN DATA</Text>
            <View style={styles.runCard}>
              <View style={styles.runGrid}>
                {viewRun.distance_km != null && <View style={styles.runField}><Text style={styles.runLabel}>Distance</Text><Text style={[styles.runInput, { textAlign: 'center', color: colors.textPrimary, paddingTop: 8 }]}>{(viewRun.distance_km * 0.621371).toFixed(1)} mi</Text></View>}
                {viewRun.duration_minutes != null && <View style={styles.runField}><Text style={styles.runLabel}>Duration</Text><Text style={[styles.runInput, { textAlign: 'center', color: colors.textPrimary, paddingTop: 8 }]}>{viewRun.duration_minutes} min</Text></View>}
                {viewRun.avg_hr != null && <View style={styles.runField}><Text style={styles.runLabel}>Avg HR</Text><Text style={[styles.runInput, { textAlign: 'center', color: colors.textPrimary, paddingTop: 8 }]}>{viewRun.avg_hr} bpm</Text></View>}
              </View>
            </View>
          </>
        )}
        {viewSets.length === 0 && !viewRun && (
          <Text style={styles.empty}>No detailed data logged for this session.</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Manual mode: show empty exercise picker
  if (mode === 'manual' && !workout) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>LOG A WORKOUT</Text>
        <ManualExercisePicker exerciseSets={exerciseSets} setExerciseSets={setExerciseSets} />
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          style={[inputStyle, { color: colors.textPrimary, height: 80, textAlignVertical: 'top', paddingTop: spacing.md, marginBottom: spacing.lg }]}
          value={notes} onChangeText={setNotes}
          placeholder="How did it feel?" placeholderTextColor={colors.textTertiary} multiline
        />
        <TouchableOpacity style={[styles.completeBtn, saving && { opacity: 0.6 }]} onPress={handleComplete} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.completeBtnText}>Save Workout ✓</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (!workout) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No workout available. Go back and pull to refresh.</Text>
      </View>
    );
  }

  const isPlannedRun = plannedSession && /run|cardio|tempo|interval/i.test(plannedSession.session_type || '');
  const showRunSection = isRunWorkout(workout) || (workout as any).run_targets || isPlannedRun;
  const hasExercises = workout.exercises && workout.exercises.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.workoutTitle}>{workout.title}</Text>
        <Text style={styles.workoutMeta}>{workout.duration_minutes}min · {workout.intensity}</Text>
        {workout.ai_reasoning && (
          <Text style={styles.aiReasoning} numberOfLines={3}>{workout.ai_reasoning}</Text>
        )}
      </View>

      {/* Apple Watch Import Banner */}
      {Platform.OS === 'ios' && awWorkouts.length > 0 && !linkedAW && (
        <>
          <Text style={styles.sectionLabel}>APPLE WATCH — IMPORT DATA</Text>
          {awWorkouts.map(aw => (
            <TouchableOpacity
              key={aw.id}
              style={styles.awCard}
              onPress={() => handleLinkAW(aw)}
              activeOpacity={0.8}
            >
              <View style={styles.awRow}>
                <Text style={styles.awIcon}>⌚</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.awTitle}>{aw.activity_type}</Text>
                  <Text style={styles.awMeta}>
                    {aw.duration_minutes}min
                    {aw.distance_km ? ` · ${aw.distance_km}km` : ''}
                    {aw.avg_hr ? ` · ${aw.avg_hr}bpm avg` : ''}
                  </Text>
                </View>
                <Text style={styles.awLink}>Import →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
      {linkedAW && (
        <View style={styles.awLinked}>
          <Text style={styles.awLinkedText}>⌚ Apple Watch data imported</Text>
        </View>
      )}

      {/* Planned Session Run Targets */}
      {plannedSession?.targets && (plannedSession.targets.distance_km || plannedSession.targets.pace_per_km || plannedSession.targets.hr_zone) && (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Session Targets</Text>
          <View style={styles.targetRow}>
            {plannedSession.targets.distance_km && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>{(plannedSession.targets.distance_km * 0.621371).toFixed(1)} mi</Text>
                <Text style={styles.targetLabel}>Distance</Text>
              </View>
            )}
            {plannedSession.targets.pace_per_km && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>{(plannedSession.targets.pace_per_km * 1.60934).toFixed(1)}'/mi</Text>
                <Text style={styles.targetLabel}>Pace</Text>
              </View>
            )}
            {plannedSession.targets.hr_zone && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>Z{plannedSession.targets.hr_zone}</Text>
                <Text style={styles.targetLabel}>HR Zone</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Run Targets (from training plan) */}
      {(workout as any).run_targets && (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Today's Run Targets</Text>
          <View style={styles.targetRow}>
            {(workout as any).run_targets.distance_km && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>{((workout as any).run_targets.distance_km * 0.621371).toFixed(1)} mi</Text>
                <Text style={styles.targetLabel}>Distance</Text>
              </View>
            )}
            {(workout as any).run_targets.pace_per_km && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>{((workout as any).run_targets.pace_per_km * 1.60934).toFixed(1)}'/mi</Text>
                <Text style={styles.targetLabel}>Pace</Text>
              </View>
            )}
            {(workout as any).run_targets.hr_zone && (
              <View style={styles.targetItem}>
                <Text style={styles.targetValue}>Z{(workout as any).run_targets.hr_zone}</Text>
                <Text style={styles.targetLabel}>HR Zone</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Strength Exercises */}
      {hasExercises && (
        <>
          <Text style={styles.sectionLabel}>EXERCISES</Text>
          {workout.exercises.map((ex: any, exIdx: number) => {
            const name = ex.name || ex.exercise_name || `Exercise ${exIdx + 1}`;
            const rows = exerciseSets[name] || [];
            return (
              <View key={name} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{name}</Text>
                  {ex.suggested_weight_kg && (
                    <Text style={styles.exerciseSuggested}>~{ex.suggested_weight_kg}kg suggested</Text>
                  )}
                </View>
                {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}

                {/* Set headers */}
                <View style={styles.setHeader}>
                  <Text style={[styles.setHeaderCell, { width: 30 }]}>Set</Text>
                  <Text style={[styles.setHeaderCell, { flex: 1 }]}>Weight (kg)</Text>
                  <Text style={[styles.setHeaderCell, { flex: 1 }]}>Reps</Text>
                  <Text style={[styles.setHeaderCell, { width: 50 }]}>RPE</Text>
                </View>

                {rows.map((row, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={[styles.setNum, { width: 30 }]}>{row.set_number}</Text>
                    <TextInput
                      style={[styles.setInput, { flex: 1 }]}
                      value={row.weight_kg}
                      onChangeText={v => updateSetRow(name, i, 'weight_kg', v)}
                      placeholder="—"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.setInput, { flex: 1 }]}
                      value={row.reps_completed}
                      onChangeText={v => updateSetRow(name, i, 'reps_completed', v)}
                      placeholder="—"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                    />
                    <TextInput
                      style={[styles.setInput, { width: 50 }]}
                      value={row.rpe}
                      onChangeText={v => updateSetRow(name, i, 'rpe', v)}
                      placeholder="—"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetRow(name)}>
                  <Text style={styles.addSetBtnText}>+ Add Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* Run Logging */}
      {showRunSection && (
        <>
          <Text style={styles.sectionLabel}>RUN DATA</Text>
          <View style={styles.runCard}>
            <View style={styles.runGrid}>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>Distance (miles)</Text>
                <TextInput style={styles.runInput} value={runData.distance_km} onChangeText={v => setRunData(p => ({ ...p, distance_km: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>Duration (min)</Text>
                <TextInput style={styles.runInput} value={runData.duration_minutes} onChangeText={v => setRunData(p => ({ ...p, duration_minutes: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>Avg HR</Text>
                <TextInput style={styles.runInput} value={runData.avg_hr} onChangeText={v => setRunData(p => ({ ...p, avg_hr: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" />
              </View>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>Max HR</Text>
                <TextInput style={styles.runInput} value={runData.max_hr} onChangeText={v => setRunData(p => ({ ...p, max_hr: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" />
              </View>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>Zone 2 %</Text>
                <TextInput style={styles.runInput} value={runData.zone2_pct} onChangeText={v => setRunData(p => ({ ...p, zone2_pct: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.runField}>
                <Text style={styles.runLabel}>RPE (1-10)</Text>
                <TextInput style={styles.runInput} value={runData.rpe} onChangeText={v => setRunData(p => ({ ...p, rpe: v }))} placeholder="—" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" />
              </View>
            </View>
            <Text style={styles.runLabel}>Run Type</Text>
            <View style={styles.runTypeRow}>
              {['easy', 'tempo', 'long', 'interval', 'race'].map(rt => (
                <TouchableOpacity
                  key={rt}
                  style={[styles.runTypeChip, runData.run_type === rt && styles.runTypeChipActive]}
                  onPress={() => setRunData(p => ({ ...p, run_type: rt }))}
                >
                  <Text style={[styles.runTypeText, runData.run_type === rt && styles.runTypeTextActive]}>{rt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Notes */}
      <Text style={styles.sectionLabel}>NOTES</Text>
      <TextInput
        style={[inputStyle, { color: colors.textPrimary, height: 80, textAlignVertical: 'top', paddingTop: spacing.md, marginBottom: spacing.lg }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="How did it feel? Any injuries? PRs?"
        placeholderTextColor={colors.textTertiary}
        multiline
      />

      {/* Complete Button */}
      <TouchableOpacity
        style={[styles.completeBtn, saving && { opacity: 0.6 }]}
        onPress={handleComplete}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.completeBtnText}>Complete Session ✓</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ManualExercisePicker({
  exerciseSets,
  setExerciseSets,
}: {
  exerciseSets: Record<string, SetRow[]>;
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, SetRow[]>>>;
}) {
  const [newExercise, setNewExercise] = useState('');

  const addExercise = () => {
    const name = newExercise.trim();
    if (!name || exerciseSets[name]) return;
    setExerciseSets(prev => ({ ...prev, [name]: [{ set_number: 1, weight_kg: '', reps_completed: '', rpe: '' }] }));
    setNewExercise('');
  };

  const addSet = (exercise: string) => {
    setExerciseSets(prev => {
      const rows = prev[exercise] || [];
      return { ...prev, [exercise]: [...rows, { set_number: rows.length + 1, weight_kg: '', reps_completed: '', rpe: '' }] };
    });
  };

  const updateRow = (exercise: string, idx: number, field: keyof SetRow, val: string) => {
    setExerciseSets(prev => {
      const rows = [...(prev[exercise] || [])];
      rows[idx] = { ...rows[idx], [field]: val };
      return { ...prev, [exercise]: rows };
    });
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <TextInput
          style={[inputStyle, { flex: 1, color: colors.textPrimary }]}
          value={newExercise}
          onChangeText={setNewExercise}
          onSubmitEditing={addExercise}
          placeholder="Exercise name (e.g. Bench Press)"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.lg, justifyContent: 'center' }}
          onPress={addExercise}
        >
          <Text style={{ color: colors.white, fontWeight: font.bold }}>Add</Text>
        </TouchableOpacity>
      </View>
      {Object.entries(exerciseSets).map(([name, rows]) => (
        <View key={name} style={[{ ...cardStyle } as any, { marginBottom: spacing.md }]}>
          <Text style={{ fontSize: font.md, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm }}>{name}</Text>
          {rows.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Text style={{ color: colors.textTertiary, width: 24, paddingTop: 10, textAlign: 'center' }}>{row.set_number}</Text>
              <TextInput style={[{ backgroundColor: colors.bgInput, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, color: colors.textPrimary, textAlign: 'center' }, { flex: 1 }]} value={row.weight_kg} onChangeText={v => updateRow(name, i, 'weight_kg', v)} placeholder="kg" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              <TextInput style={[{ backgroundColor: colors.bgInput, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, color: colors.textPrimary, textAlign: 'center' }, { flex: 1 }]} value={row.reps_completed} onChangeText={v => updateRow(name, i, 'reps_completed', v)} placeholder="reps" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" />
              <TextInput style={[{ backgroundColor: colors.bgInput, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, color: colors.textPrimary, textAlign: 'center' }, { width: 50 }]} value={row.rpe} onChangeText={v => updateRow(name, i, 'rpe', v)} placeholder="RPE" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
            </View>
          ))}
          <TouchableOpacity onPress={() => addSet(name)}>
            <Text style={{ color: colors.primary, fontSize: font.sm, fontWeight: font.semibold }}>+ Add Set</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 80, fontSize: font.md },

  header: { ...cardStyle, marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary },
  workoutTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary, marginBottom: 4 },
  workoutMeta: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  aiReasoning: { fontSize: font.sm, color: colors.textTertiary, lineHeight: 18 },

  awCard: { ...cardStyle, marginBottom: spacing.sm, borderColor: colors.primaryBorder },
  awRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  awIcon: { fontSize: 24 },
  awTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  awMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  awLink: { fontSize: font.sm, color: colors.primary, fontWeight: font.bold },
  awLinked: { backgroundColor: colors.successMuted, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  awLinkedText: { color: colors.success, fontWeight: font.semibold, fontSize: font.sm },

  targetCard: { ...cardStyle, marginBottom: spacing.md, backgroundColor: colors.primaryMuted },
  targetTitle: { fontSize: font.sm, fontWeight: font.bold, color: colors.textAccent, marginBottom: spacing.md },
  targetRow: { flexDirection: 'row', gap: spacing.md },
  targetItem: { alignItems: 'center' },
  targetValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary },
  targetLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  exerciseCard: { ...cardStyle, marginBottom: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  exerciseName: { fontSize: font.md, fontWeight: font.bold, color: colors.textPrimary },
  exerciseSuggested: { fontSize: font.xs, color: colors.primary, fontWeight: font.semibold },
  exerciseNotes: { fontSize: font.xs, color: colors.textTertiary, marginBottom: spacing.sm, lineHeight: 16 },

  setHeader: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  setHeaderCell: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold, textAlign: 'center' },
  setRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, alignItems: 'center' },
  setNum: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingTop: 10 },
  setInput: {
    backgroundColor: colors.bgInput, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, color: colors.textPrimary, fontSize: font.sm, textAlign: 'center',
  },
  addSetBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  addSetBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: font.semibold },

  runCard: { ...cardStyle, marginBottom: spacing.md },
  runGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  runField: { width: '47%' },
  runLabel: { fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold, marginBottom: 4, letterSpacing: 0.5 },
  runInput: {
    backgroundColor: colors.bgInput, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, color: colors.textPrimary, fontSize: font.md, textAlign: 'center',
  },
  runTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  runTypeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radii.full, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  runTypeChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  runTypeText: { fontSize: font.sm, color: colors.textSecondary },
  runTypeTextActive: { color: colors.textAccent, fontWeight: font.semibold },

  histCard: { ...cardStyle, marginBottom: spacing.sm, opacity: 0.7 },
  histCardDone: { opacity: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  histDate: { fontSize: font.xs, color: colors.textTertiary },
  histTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 2 },
  histMeta: { fontSize: font.xs, color: colors.textSecondary },
  doneBadge: { backgroundColor: colors.successMuted, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  doneBadgeText: { fontSize: font.xs, color: colors.success, fontWeight: font.bold },

  completeBtn: {
    backgroundColor: colors.secondary, borderRadius: radii.md, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md,
  },
  completeBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.lg },
});
