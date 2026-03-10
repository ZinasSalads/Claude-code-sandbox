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

interface WorkoutDetailProps {
  route: {
    params: {
      workout: Workout;
    };
  };
}

function IntensityBadge({ intensity }: { intensity: string }) {
  const colors: Record<string, string> = {
    low: '#4CAF50',
    moderate: '#FFC107',
    high: '#F44336',
  };
  const bg = colors[intensity] || '#6C63FF';

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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: '#1E1E2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6C63FF20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  number: {
    color: '#6C63FF',
    fontWeight: '700',
    fontSize: 13,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 8,
  },
  detail: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  weight: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '500',
    marginTop: 4,
  },
  notes: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    marginTop: 4,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dot: {
    color: 'rgba(255,255,255,0.4)',
    marginRight: 8,
    fontSize: 14,
  },
  text: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
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
    backgroundColor: '#0D0D1A',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  duration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  reasoningCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
  },
  reasoningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  coachingCard: {
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  coachingText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  completeButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
