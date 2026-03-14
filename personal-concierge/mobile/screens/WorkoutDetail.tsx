import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { completeWorkout } from '../lib/api';
import type { Workout, Exercise, WarmupCooldown } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface WorkoutDetailProps {
  route: {
    params: {
      workout: Workout;
    };
  };
}

function IntensityBadge({ intensity }: { intensity: string }) {
  const intensityColors: Record<string, string> = {
    low: colors.success,
    moderate: colors.warning,
    high: colors.error,
  };
  const bg = intensityColors[intensity] || colors.primary;

  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg + '20' }]}>
      <Text style={[badgeStyles.text, { color: bg }]}>
        {intensity.toUpperCase()}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm + 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: font.xs + 1,
    fontWeight: font.bold,
    letterSpacing: 0.5,
  },
});

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  return (
    <View style={exerciseStyles.card}>
      <View style={exerciseStyles.header}>
        <View style={exerciseStyles.numberBadge}>
          <Text style={exerciseStyles.number}>{index + 1}</Text>
        </View>
        <Text style={exerciseStyles.name}>{exercise.name}</Text>
      </View>
      <View style={exerciseStyles.details}>
        <View style={exerciseStyles.detail}>
          <Text style={exerciseStyles.detailLabel}>Sets</Text>
          <Text style={exerciseStyles.detailValue}>{exercise.sets}</Text>
        </View>
        <View style={exerciseStyles.detail}>
          <Text style={exerciseStyles.detailLabel}>Reps</Text>
          <Text style={exerciseStyles.detailValue}>{exercise.reps}</Text>
        </View>
        <View style={exerciseStyles.detail}>
          <Text style={exerciseStyles.detailLabel}>Rest</Text>
          <Text style={exerciseStyles.detailValue}>{exercise.rest_seconds}s</Text>
        </View>
      </View>
      {exercise.weight_guidance ? (
        <Text style={exerciseStyles.weight}>{exercise.weight_guidance}</Text>
      ) : null}
      {exercise.notes ? (
        <Text style={exerciseStyles.notes}>{exercise.notes}</Text>
      ) : null}
    </View>
  );
}

const exerciseStyles = StyleSheet.create({
  card: {
    ...cardStyle,
    marginBottom: spacing.md - 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md - 2,
  },
  number: {
    color: colors.primary,
    fontWeight: font.bold,
    fontSize: font.sm,
  },
  name: {
    color: colors.textPrimary,
    fontSize: font.md + 1,
    fontWeight: font.semibold,
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    gap: spacing['2xl'],
    marginBottom: spacing.sm,
  },
  detail: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: font.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  weight: {
    fontSize: font.sm,
    color: colors.textAccent,
    fontWeight: font.medium,
    marginTop: spacing.xs,
  },
  notes: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});

function PhaseList({ title, items }: { title: string; items: WarmupCooldown[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={phaseStyles.container}>
      <Text style={phaseStyles.title}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={phaseStyles.item}>
          <Text style={phaseStyles.dot}>•</Text>
          <Text style={phaseStyles.text}>
            {item.exercise} — {item.duration_or_sets}
          </Text>
        </View>
      ))}
    </View>
  );
}

const phaseStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  title: {
    ...sectionLabel,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs + 2,
  },
  dot: {
    color: colors.textTertiary,
    marginRight: spacing.sm,
    fontSize: font.sm + 1,
  },
  text: {
    color: colors.textSecondary,
    fontSize: font.sm + 1,
    flex: 1,
  },
});

export default function WorkoutDetail({ route }: WorkoutDetailProps) {
  const { workout } = route.params;
  const [completed, setCompleted] = useState(workout.completed || false);
  const [completing, setCompleting] = useState(false);

  const exercises: Exercise[] = Array.isArray(workout.exercises)
    ? workout.exercises
    : [];

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    const result = await completeWorkout();
    if (result) {
      setCompleted(true);
    }
    setCompleting(false);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{workout.title}</Text>
      <View style={styles.headerRow}>
        <IntensityBadge intensity={workout.intensity} />
        <Text style={styles.duration}>{workout.duration_minutes} min</Text>
      </View>

      {/* AI Reasoning */}
      <View style={styles.reasoningCard}>
        <Text style={styles.reasoningTitle}>Why this workout today</Text>
        <Text style={styles.reasoningText}>{workout.ai_reasoning}</Text>
      </View>

      {/* Coaching Note */}
      {workout.coaching_note ? (
        <View style={styles.coachingCard}>
          <Text style={styles.coachingText}>💡 {workout.coaching_note}</Text>
        </View>
      ) : null}

      {/* Warm-up */}
      <PhaseList title="Warm-Up" items={workout.warmup || []} />

      {/* Main Workout */}
      <Text style={styles.sectionTitle}>EXERCISES</Text>
      {exercises.map((ex, i) => (
        <ExerciseCard key={i} exercise={ex} index={i} />
      ))}

      {/* Cool-down */}
      <PhaseList title="Cool-Down" items={workout.cooldown || []} />

      {/* Complete Button */}
      <TouchableOpacity
        style={[
          styles.completeButton,
          completed && styles.completedButton,
        ]}
        onPress={handleComplete}
        disabled={completed || completing}
        activeOpacity={0.8}
      >
        <Text style={styles.completeButtonText}>
          {completed ? '✓ Completed' : completing ? 'Saving...' : 'Mark Complete'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
  },
  title: {
    fontSize: font['3xl'] - 6,
    fontWeight: font.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md - 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  duration: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    fontWeight: font.medium,
  },
  reasoningCard: {
    ...cardStyle,
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  reasoningTitle: {
    fontSize: font.xs + 1,
    fontWeight: font.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  reasoningText: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  coachingCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.md + 2,
    padding: spacing.lg - 2,
    marginBottom: spacing.xl,
  },
  coachingText: {
    fontSize: font.sm + 1,
    color: colors.textPrimary,
    fontWeight: font.medium,
    lineHeight: 20,
  },
  sectionTitle: {
    ...sectionLabel,
    marginTop: spacing.xs,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadow.glow,
  },
  completedButton: {
    backgroundColor: colors.success,
  },
  completeButtonText: {
    color: colors.white,
    fontSize: font.xl - 2,
    fontWeight: font.bold,
  },
});
