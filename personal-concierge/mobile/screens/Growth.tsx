import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { getTodayHabits, logHabitCompletion, getGrowthScore, suggestNextHabit, addGrowthHabit } from '../lib/api';
import type { TodayHabits, CompoundScore, GrowthHabit } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

export default function Growth() {
  const [todayData, setTodayData] = useState<TodayHabits | null>(null);
  const [score, setScore] = useState<CompoundScore | null>(null);
  const [suggestion, setSuggestion] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('health');

  const fetchData = useCallback(async () => {
    const [t, s] = await Promise.all([getTodayHabits(), getGrowthScore()]);
    setTodayData(t);
    setScore(s);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleToggle = useCallback(async (habitId: string, currentlyDone: boolean) => {
    await logHabitCompletion(habitId, !currentlyDone);
    fetchData();
  }, [fetchData]);

  const handleSuggest = useCallback(async () => {
    const s = await suggestNextHabit();
    setSuggestion(s);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;
    await addGrowthHabit({ name: newName, category: newCategory } as Partial<GrowthHabit>);
    setShowAdd(false);
    setNewName('');
    fetchData();
  }, [newName, newCategory, fetchData]);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading habits...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>1% Growth Engine</Text>

      {score && (
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: getScoreColor(score.score) }]}>{score.score}</Text>
            <Text style={styles.scoreLabel}>Compound Score</Text>
          </View>
          {Object.entries(score.domains).length > 0 && (
            <View style={styles.domainRow}>
              {Object.entries(score.domains).map(([domain, val]) => (
                <View key={domain} style={styles.domainItem}>
                  <Text style={styles.domainVal}>{val}</Text>
                  <Text style={styles.domainLabel}>{domain}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {todayData && (
        <View style={styles.card}>
          <View style={styles.progressRow}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.progressText}>
              {todayData.completed}/{todayData.total}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${todayData.completion_rate * 100}%` }]}
            />
          </View>
        </View>
      )}

      {(todayData?.habits || []).map((habit) => (
        <TouchableOpacity
          key={habit.id}
          style={styles.card}
          onPress={() => handleToggle(habit.id, habit.completed_today)}
        >
          <View style={styles.habitRow}>
            <View style={[styles.checkbox, habit.completed_today && styles.checkboxDone]}>
              {habit.completed_today && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.habitInfo}>
              <Text style={[styles.habitName, habit.completed_today && styles.habitDone]}>
                {habit.name}
              </Text>
              <Text style={styles.habitMeta}>
                {habit.category} · Streak: {habit.current_streak}
                {habit.current_streak > 0 ? ' 🔥' : ''}
              </Text>
            </View>
            <Text style={styles.streakNum}>{habit.current_streak}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {todayData?.streak_at_risk && todayData.streak_at_risk.length > 0 && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.warning }]}>
          <Text style={styles.riskTitle}>Streak at Risk</Text>
          {todayData.streak_at_risk.map((h) => (
            <Text key={h.id} style={styles.riskText}>
              {h.name} — {h.current_streak} day streak
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleSuggest}>
          <Text style={styles.actionBtnText}>Suggest Habit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAdd(!showAdd)}>
          <Text style={styles.actionBtnText}>{showAdd ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {suggestion && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.accent }]}>
          <Text style={styles.cardTitle}>Suggested: {(suggestion as Record<string, string>).name}</Text>
          <Text style={styles.suggestText}>{(suggestion as Record<string, string>).description}</Text>
          <Text style={styles.suggestWhy}>{(suggestion as Record<string, string>).why_now}</Text>
        </View>
      )}

      {showAdd && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Habit name" placeholderTextColor={colors.textTertiary} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Category (health/skill/mindset)" placeholderTextColor={colors.textTertiary} value={newCategory} onChangeText={setNewCategory} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Habit</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  scoreRow: { alignItems: 'center', marginBottom: spacing.md },
  scoreNum: { fontSize: 48, fontWeight: font.bold },
  scoreLabel: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing.xs },
  domainRow: { flexDirection: 'row', justifyContent: 'space-around' },
  domainItem: { alignItems: 'center' },
  domainVal: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  domainLabel: { ...sectionLabel, marginBottom: 0, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressText: { fontSize: font.md, fontWeight: font.semibold, color: colors.accent },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  habitRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 28, height: 28, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: colors.white, fontWeight: font.bold, fontSize: font.lg },
  habitInfo: { flex: 1 },
  habitName: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  habitDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  habitMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  streakNum: { fontSize: font.xl, fontWeight: font.bold, color: colors.accent },
  riskTitle: { fontSize: font.sm, fontWeight: font.semibold, color: colors.warning, marginBottom: spacing.xs },
  riskText: { fontSize: font.sm, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  actionBtn: {
    flex: 1, backgroundColor: colors.accentMuted, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  actionBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  suggestText: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  suggestWhy: { fontSize: font.sm, color: colors.textAccent, fontStyle: 'italic' },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
