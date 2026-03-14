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
    setFlaggedBiomarkers(fb);
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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C63FF"
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
        <View style={styles.card}>
          <Text style={styles.noDataText}>No workout available</Text>
        </View>
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
        <View style={styles.card}>
          <Text style={styles.noDataText}>No meal plan available</Text>
        </View>
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
    backgroundColor: '#0D0D1A',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  date: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  readinessSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  cardReasoning: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginBottom: 8,
  },
  mealLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  viewFull: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 6,
  },
  noDataCard: {
    alignItems: 'center',
    padding: 24,
  },
  noDataText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  syncButton: {
    marginTop: 12,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  checkInCard: {
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
    borderStyle: 'dashed',
  },
  checkInTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  checkInSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  moduleCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    width: (SCREEN_WIDTH - 40) / 2,
    alignItems: 'center',
    position: 'relative',
  },
  moduleEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  moduleTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  moduleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 32,
  },
});
