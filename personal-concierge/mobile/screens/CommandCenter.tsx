import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import ReadinessCircle from '../components/ReadinessCircle';
import MetricCard from '../components/MetricCard';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';
import {
  getTodayHealth,
  getTodayCheckIn,
  getTodayWorkout,
  getTodayMeals,
  syncOura,
  getFlaggedBiomarkers,
  getBiomarkers,
} from '../lib/api';
import type { HealthData, CheckIn, Workout, MealPlan, Biomarker } from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

interface CommandCenterProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function CommandCenter({ navigation }: CommandCenterProps) {
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [flaggedBiomarkers, setFlaggedBiomarkers] = useState<Biomarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [h, c, w, m, fb] = await Promise.all([
      getTodayHealth(),
      getTodayCheckIn(),
      getTodayWorkout(),
      getTodayMeals(),
      getFlaggedBiomarkers(),
    ]);
    setHealth(h);
    setCheckIn(c);
    setWorkout(w);
    setMealPlan(m);
    setFlaggedBiomarkers(fb || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await syncOura();
    await fetchAll();
    setSyncing(false);
  }, [fetchAll]);

  const readiness = health?.readiness_score;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      {/* Readiness Circle */}
      <View style={styles.readinessSection}>
        {loading ? (
          <LoadingSkeleton width={180} height={180} borderRadius={90} />
        ) : readiness != null ? (
          <ReadinessCircle score={readiness} size={180} />
        ) : (
          <View style={styles.noDataCard}>
            <Text style={styles.noDataText}>Oura sync pending</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={styles.syncButtonText}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Metric Cards */}
      {!loading && health && (
        <View style={styles.metricsRow}>
          <MetricCard
            label="HRV"
            value={health.hrv ?? '—'}
            unit="ms"
            trend={health.hrv && health.hrv > 50 ? 'up' : health.hrv ? 'down' : undefined}
          />
          <MetricCard
            label="Sleep"
            value={health.sleep_duration ? `${health.sleep_duration}h` : '—'}
            trend={
              health.sleep_score && health.sleep_score >= 80
                ? 'up'
                : health.sleep_score
                ? 'down'
                : undefined
            }
          />
        </View>
      )}
      {loading && (
        <View style={styles.metricsRow}>
          <LoadingSkeleton width={(SCREEN_WIDTH - 48) / 2} height={80} />
          <LoadingSkeleton width={(SCREEN_WIDTH - 48) / 2} height={80} />
        </View>
      )}

      {/* Today's Workout */}
      <Text style={styles.sectionTitle}>TODAY'S WORKOUT</Text>
      {loading ? (
        <LoadingSkeleton width={SCREEN_WIDTH - 32} height={120} />
      ) : workout ? (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('WorkoutDetail', { workout })}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>
              {workout.workout_type === 'rest' ? '🧘' : '💪'}
            </Text>
            <Text style={styles.cardTitle}>{workout.title}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {workout.duration_minutes} min · {workout.intensity} intensity
          </Text>
          <Text style={styles.cardReasoning} numberOfLines={2}>
            {workout.ai_reasoning}
          </Text>
          <Text style={styles.viewFull}>View Full →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Profile', { screen: 'CheckIn' })}
          activeOpacity={0.7}
        >
          <Text style={styles.noDataText}>Complete your morning check-in to generate today's plan</Text>
          <Text style={styles.viewFull}>Go to Check-In →</Text>
        </TouchableOpacity>
      )}

      {/* Today's Nutrition */}
      <Text style={styles.sectionTitle}>TODAY'S NUTRITION</Text>
      {loading ? (
        <LoadingSkeleton width={SCREEN_WIDTH - 32} height={120} />
      ) : mealPlan && mealPlan.meals && mealPlan.meals.length > 0 ? (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('MealPlan', { mealPlan })}
          activeOpacity={0.7}
        >
          <Text style={styles.cardTitle}>
            {mealPlan.daily_targets.calories.toLocaleString()} kcal ·{' '}
            {mealPlan.daily_targets.protein}g protein
          </Text>
          {mealPlan.meals.slice(0, 3).map((meal, i) => (
            <Text key={i} style={styles.mealLine}>
              {meal.meal_type?.charAt(0).toUpperCase()}:{' '}
              {meal.title}
            </Text>
          ))}
          <Text style={styles.viewFull}>View Full →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Profile', { screen: 'CheckIn' })}
          activeOpacity={0.7}
        >
          <Text style={styles.noDataText}>Complete your morning check-in to generate today's meal plan</Text>
          <Text style={styles.viewFull}>Go to Check-In →</Text>
        </TouchableOpacity>
      )}

      {/* Quick Access Modules */}
      <Text style={styles.sectionTitle}>MODULES</Text>
      <View style={styles.modulesGrid}>
        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => navigation.navigate('Health', { screen: 'BloodWork' })}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>🩸</Text>
          <Text style={styles.moduleTitle}>Blood Work</Text>
          {flaggedBiomarkers.length > 0 && (
            <View style={styles.moduleBadge}>
              <Text style={styles.moduleBadgeText}>{flaggedBiomarkers.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => navigation.navigate('Health', { screen: 'Supplements' })}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>💊</Text>
          <Text style={styles.moduleTitle}>Supplements</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => navigation.navigate('Health', { screen: 'Longevity' })}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>🧬</Text>
          <Text style={styles.moduleTitle}>Longevity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moduleCard}
          onPress={() => navigation.navigate('Health', { screen: 'Research' })}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>📚</Text>
          <Text style={styles.moduleTitle}>Research</Text>
        </TouchableOpacity>
      </View>

      {/* Check-In Card */}
      {!loading && !checkIn && (
        <TouchableOpacity
          style={[styles.card, styles.checkInCard]}
          onPress={() => navigation.navigate('Profile', { screen: 'CheckIn' })}
          activeOpacity={0.7}
        >
          <Text style={styles.checkInTitle}>📋 Morning Check-In</Text>
          <Text style={styles.checkInSubtitle}>Takes 30 seconds</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    marginTop: spacing.sm,
  },
  greeting: {
    fontSize: font['2xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
  },
  date: {
    fontSize: font.md,
    color: colors.textSecondary,
    fontWeight: font.medium,
  },
  readinessSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  sectionTitle: {
    ...sectionLabel,
  },
  card: {
    ...cardStyle,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  cardEmoji: {
    fontSize: font.xl,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardReasoning: {
    fontSize: font.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  mealLine: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  viewFull: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: font.semibold,
    textAlign: 'right',
    marginTop: spacing.xs + 2,
  },
  noDataCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  noDataText: {
    color: colors.textTertiary,
    fontSize: font.md,
  },
  syncButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md - 2,
    borderRadius: radii.full,
    ...shadow.glow,
  },
  syncButtonText: {
    color: colors.white,
    fontWeight: font.semibold,
    fontSize: font.sm + 1,
  },
  checkInCard: {
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderStyle: 'dashed',
  },
  checkInTitle: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  checkInSubtitle: {
    fontSize: font.sm,
    color: colors.textTertiary,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  moduleCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: (SCREEN_WIDTH - 40) / 2,
    alignItems: 'center',
    position: 'relative',
    ...shadow.card,
  },
  moduleEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  moduleTitle: {
    color: colors.textPrimary,
    fontSize: font.sm,
    fontWeight: font.semibold,
  },
  moduleBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radii.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleBadgeText: {
    color: colors.white,
    fontSize: font.xs,
    fontWeight: font.bold,
  },
  bottomSpacer: {
    height: spacing['3xl'],
  },
});
