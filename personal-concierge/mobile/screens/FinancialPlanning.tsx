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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

async function api<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function apiPost<T>(path: string, body: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function apiPut<T>(path: string, body: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

interface FinancialGoal {
  id: string; name: string; type: string; current_amount: number;
  target_amount: number; target_date: string; life_goal_alignment?: string;
}
interface StressLog { week: string; level: number }
interface AnnualReview { due: boolean; last_review_date?: string }

export default function FinancialPlanning() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [stressLogs, setStressLogs] = useState<StressLog[]>([]);
  const [annualReview, setAnnualReview] = useState<AnnualReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalType, setNewGoalType] = useState('savings');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');
  const [updateGoalId, setUpdateGoalId] = useState<string | null>(null);
  const [updateAmount, setUpdateAmount] = useState('');
  const [stressLevel, setStressLevel] = useState(5);
  const [showLifeGoals, setShowLifeGoals] = useState(false);

  const fetchData = useCallback(async () => {
    const [g, s, a] = await Promise.all([
      api<FinancialGoal[]>('/financial-planning/goals'),
      api<StressLog[]>('/financial-planning/stress-flag'),
      api<AnnualReview>('/financial-planning/annual-prompt'),
    ]);
    setGoals(g || []);
    setStressLogs(s || []);
    setAnnualReview(a);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAddGoal = useCallback(async () => {
    if (!newGoalName.trim() || !newGoalTarget) return;
    await apiPost('/financial-planning/goals', {
      name: newGoalName, type: newGoalType,
      target_amount: parseFloat(newGoalTarget), target_date: newGoalDate || undefined,
    });
    setNewGoalName(''); setNewGoalTarget(''); setNewGoalDate('');
    setShowAddGoal(false);
    fetchData();
  }, [newGoalName, newGoalType, newGoalTarget, newGoalDate, fetchData]);

  const handleUpdateProgress = useCallback(async () => {
    if (!updateGoalId || !updateAmount) return;
    await apiPut(`/financial-planning/goals/${updateGoalId}/progress`, {
      current_amount: parseFloat(updateAmount),
    });
    setUpdateGoalId(null); setUpdateAmount('');
    fetchData();
  }, [updateGoalId, updateAmount, fetchData]);

  const handleLogStress = useCallback(async () => {
    await apiPost('/financial-planning/stress', { stress_level: stressLevel, primary_stressor: '' });
    setStressLevel(5);
    fetchData();
  }, [stressLevel, fetchData]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';
  const goalTypes = ['savings', 'investment', 'debt-payoff', 'emergency', 'retirement', 'other'];

  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading financial data...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Financial Planning</Text>

      {annualReview?.due && (
        <View style={[styles.card, { borderColor: 'rgba(108,99,255,0.4)' }]}>
          <Text style={styles.cardTitle}>Annual Review Due</Text>
          <Text style={styles.dimText}>
            Last review: {annualReview.last_review_date || 'Never'}
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 10 }]} onPress={() => api('/financial-planning/alignment')}>
            <Text style={styles.primaryBtnText}>Start Annual Review</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>GOALS</Text>
        <TouchableOpacity onPress={() => setShowLifeGoals(!showLifeGoals)}>
          <Text style={styles.toggleLink}>{showLifeGoals ? 'Progress View' : 'Life-Goal View'}</Text>
        </TouchableOpacity>
      </View>

      {goals.map((goal) => {
        const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
        return (
          <View key={goal.id} style={styles.card}>
            <View style={styles.goalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalType}>{goal.type}{goal.target_date ? ` · Due: ${goal.target_date}` : ''}</Text>
              </View>
              <Text style={[styles.goalPct, { color: scoreColor(pct) }]}>{pct.toFixed(0)}%</Text>
            </View>

            {showLifeGoals && goal.life_goal_alignment && (
              <View style={styles.alignmentBox}>
                <Text style={styles.alignmentText}>{goal.life_goal_alignment}</Text>
              </View>
            )}

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: scoreColor(pct) }]} />
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountText}>{formatCurrency(goal.current_amount)}</Text>
              <Text style={styles.dimText}>{formatCurrency(goal.target_amount)}</Text>
            </View>

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={() => setUpdateGoalId(updateGoalId === goal.id ? null : goal.id)}
            >
              <Text style={styles.updateBtnText}>Update Progress</Text>
            </TouchableOpacity>

            {updateGoalId === goal.id && (
              <View style={styles.updateForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Current amount"
                  placeholderTextColor="#555577"
                  keyboardType="numeric"
                  value={updateAmount}
                  onChangeText={setUpdateAmount}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdateProgress}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddGoal(!showAddGoal)}>
        <Text style={styles.addBtnText}>{showAddGoal ? 'Cancel' : '+ Add Goal'}</Text>
      </TouchableOpacity>

      {showAddGoal && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Goal name" placeholderTextColor="#555577" value={newGoalName} onChangeText={setNewGoalName} />
          <Text style={styles.formLabel}>Type</Text>
          <View style={styles.typeRow}>
            {goalTypes.map((t) => (
              <TouchableOpacity key={t} style={[styles.typeChip, newGoalType === t && styles.typeChipActive]} onPress={() => setNewGoalType(t)}>
                <Text style={[styles.typeChipText, newGoalType === t && styles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Target amount" placeholderTextColor="#555577" keyboardType="numeric" value={newGoalTarget} onChangeText={setNewGoalTarget} />
          <TextInput style={styles.input} placeholder="Target date (YYYY-MM-DD)" placeholderTextColor="#555577" value={newGoalDate} onChangeText={setNewGoalDate} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddGoal}>
            <Text style={styles.primaryBtnText}>Create Goal</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Financial Stress Check</Text>
        <Text style={styles.dimText}>How stressed are you about finances? ({stressLevel}/10)</Text>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <TouchableOpacity key={v} style={[styles.sliderDot, stressLevel === v && styles.sliderDotActive]} onPress={() => setStressLevel(v)}>
              <Text style={[styles.sliderDotText, stressLevel === v && { color: '#fff' }]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleLogStress}>
          <Text style={styles.primaryBtnText}>Log Stress Level</Text>
        </TouchableOpacity>
        {stressLogs.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.formLabel}>Recent Logs</Text>
            {stressLogs.slice(0, 4).map((log, i) => (
              <View key={i} style={styles.stressRow}>
                <Text style={styles.dimText}>{log.week}</Text>
                <Text style={[styles.stressVal, { color: log.level <= 3 ? '#00b894' : log.level <= 6 ? '#fdcb6e' : '#e17055' }]}>{log.level}/10</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { color: '#8888aa', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1 },
  dimText: { fontSize: 13, color: '#8888aa' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  toggleLink: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  goalName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  goalType: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  goalPct: { fontSize: 22, fontWeight: '700' },
  alignmentBox: { backgroundColor: 'rgba(108,99,255,0.08)', borderRadius: 8, padding: 10, marginBottom: 10 },
  alignmentText: { color: '#6C63FF', fontSize: 13 },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 6, borderRadius: 3 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  updateBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(108,99,255,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  updateBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '600' },
  updateForm: { marginTop: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 15 },
  formLabel: { fontSize: 12, color: '#8888aa', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  typeChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipActive: { backgroundColor: 'rgba(108,99,255,0.2)' },
  typeChipText: { color: '#8888aa', fontSize: 12, fontWeight: '600' },
  typeChipTextActive: { color: '#6C63FF' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  sliderDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  sliderDotActive: { backgroundColor: '#6C63FF' },
  sliderDotText: { color: '#8888aa', fontSize: 11, fontWeight: '600' },
  stressRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  stressVal: { fontSize: 14, fontWeight: '600' },
});
