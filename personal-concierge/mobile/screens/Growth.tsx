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

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading habits...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>1% Growth Engine</Text>

      {score && (
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: scoreColor(score.score) }]}>{score.score}</Text>
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
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#fdcb6e' }]}>
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
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#6c5ce7' }]}>
          <Text style={styles.cardTitle}>Suggested: {(suggestion as Record<string, string>).name}</Text>
          <Text style={styles.suggestText}>{(suggestion as Record<string, string>).description}</Text>
          <Text style={styles.suggestWhy}>{(suggestion as Record<string, string>).why_now}</Text>
        </View>
      )}

      {showAdd && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Habit name" placeholderTextColor="#555577" value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Category (health/skill/mindset)" placeholderTextColor="#555577" value={newCategory} onChangeText={setNewCategory} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Habit</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { color: '#8888aa', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0f0f5', marginBottom: 16 },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f0f0f5', marginBottom: 8 },
  scoreRow: { alignItems: 'center', marginBottom: 12 },
  scoreNum: { fontSize: 48, fontWeight: '700' },
  scoreLabel: { fontSize: 13, color: '#8888aa', marginTop: 4 },
  domainRow: { flexDirection: 'row', justifyContent: 'space-around' },
  domainItem: { alignItems: 'center' },
  domainVal: { fontSize: 16, fontWeight: '600', color: '#f0f0f5' },
  domainLabel: { fontSize: 10, color: '#555577', textTransform: 'uppercase', marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 15, fontWeight: '600', color: '#6c5ce7' },
  progressBar: { height: 6, backgroundColor: '#1e1e30', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#6c5ce7', borderRadius: 3 },
  habitRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#1e1e30',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  checkboxDone: { backgroundColor: '#00b894', borderColor: '#00b894' },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 16 },
  habitInfo: { flex: 1 },
  habitName: { fontSize: 15, fontWeight: '600', color: '#f0f0f5' },
  habitDone: { textDecorationLine: 'line-through', color: '#8888aa' },
  habitMeta: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  streakNum: { fontSize: 20, fontWeight: '700', color: '#6c5ce7' },
  riskTitle: { fontSize: 13, fontWeight: '600', color: '#fdcb6e', marginBottom: 4 },
  riskText: { fontSize: 13, color: '#8888aa' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  actionBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 13 },
  suggestText: { fontSize: 14, color: '#8888aa', marginBottom: 4 },
  suggestWhy: { fontSize: 13, color: '#a29bfe', fontStyle: 'italic' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
