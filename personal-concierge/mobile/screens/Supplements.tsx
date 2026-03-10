import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface Supplement {
  id: string;
  name: string;
  brand?: string;
  dose_amount?: number;
  dose_unit?: string;
  timing?: string;
  purpose?: string;
  category?: string;
  active?: boolean;
}

interface TodayLog {
  supplement_id: string;
  name: string;
  dose_amount?: number;
  dose_unit?: string;
  timing?: string;
  taken: boolean;
  skipped_reason?: string;
}

interface AdherenceStats {
  period_days: number;
  total_logs: number;
  total_taken: number;
  adherence_pct: number;
  current_streak_days: number;
  breakdown: {
    name: string;
    adherence_pct: number;
    taken: number;
    total: number;
  }[];
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

type Tab = 'today' | 'stack' | 'add' | 'stats';

// ---- Today Tab ----
function TodayTab() {
  const [logs, setLogs] = useState<TodayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchApi<TodayLog[]>('/supplements/today');
    setLogs(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (supplementId: string, taken: boolean) => {
    await fetchApi('/supplements/log', {
      method: 'POST',
      body: JSON.stringify({ supplement_id: supplementId, taken }),
    });
    load();
  }, [load]);

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;

  if (logs.length === 0) {
    return (
      <View style={tabStyles.center}>
        <Text style={tabStyles.empty}>No supplements in your stack yet.</Text>
        <Text style={tabStyles.emptyHint}>Add supplements to start tracking.</Text>
      </View>
    );
  }

  const taken = logs.filter(l => l.taken).length;
  const total = logs.length;

  return (
    <ScrollView
      style={tabStyles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6C63FF" />}
    >
      {/* Progress */}
      <View style={todayStyles.progressCard}>
        <Text style={todayStyles.progressText}>{taken}/{total} taken today</Text>
        <View style={todayStyles.progressBar}>
          <View style={[todayStyles.progressFill, { width: `${(taken / total) * 100}%` }]} />
        </View>
      </View>

      {/* Supplement list */}
      {logs.map((l) => (
        <TouchableOpacity
          key={l.supplement_id}
          style={[todayStyles.item, l.taken && todayStyles.itemTaken]}
          onPress={() => toggle(l.supplement_id, !l.taken)}
          activeOpacity={0.7}
        >
          <View style={[todayStyles.checkbox, l.taken && todayStyles.checkboxChecked]}>
            {l.taken && <Text style={todayStyles.check}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[todayStyles.name, l.taken && todayStyles.nameTaken]}>{l.name}</Text>
            <Text style={todayStyles.dose}>
              {l.dose_amount} {l.dose_unit} · {l.timing}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const todayStyles = StyleSheet.create({
  progressCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  item: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTaken: {
    opacity: 0.6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  check: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  nameTaken: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.5)',
  },
  dose: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
  },
});

// ---- Stack Tab ----
function StackTab() {
  const [stack, setStack] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<Supplement[]>('/supplements/stack?active_only=false').then(s => {
      setStack(s || []);
      setLoading(false);
    });
  }, []);

  const deactivate = useCallback(async (id: string) => {
    Alert.alert('Remove Supplement', 'Deactivate this supplement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API_URL}/supplements/${id}`, { method: 'DELETE' });
          setStack(prev => prev.map(s => s.id === id ? { ...s, active: false } : s));
        },
      },
    ]);
  }, []);

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;

  return (
    <ScrollView style={tabStyles.scroll}>
      {stack.length === 0 ? (
        <View style={tabStyles.center}><Text style={tabStyles.empty}>No supplements added.</Text></View>
      ) : (
        stack.map(s => (
          <View key={s.id} style={[stackStyles.card, !s.active && stackStyles.inactive]}>
            <View style={{ flex: 1 }}>
              <Text style={stackStyles.name}>{s.name}</Text>
              <Text style={stackStyles.detail}>
                {s.dose_amount} {s.dose_unit} · {s.timing} · {s.category || 'general'}
              </Text>
              {s.purpose && <Text style={stackStyles.purpose}>{s.purpose}</Text>}
              {!s.active && <Text style={stackStyles.inactiveLabel}>INACTIVE</Text>}
            </View>
            {s.active && (
              <TouchableOpacity onPress={() => deactivate(s.id)} style={stackStyles.removeBtn}>
                <Text style={stackStyles.removeTxt}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const stackStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactive: { opacity: 0.4 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  detail: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  purpose: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  inactiveLabel: { color: '#F44336', fontSize: 11, fontWeight: '700', marginTop: 4 },
  removeBtn: { padding: 8 },
  removeTxt: { color: '#F44336', fontSize: 22, fontWeight: '700' },
});

// ---- Add Tab ----
function AddTab({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg');
  const [timing, setTiming] = useState('morning');
  const [purpose, setPurpose] = useState('');
  const [adding, setAdding] = useState(false);

  const timings = ['morning', 'afternoon', 'evening', 'with_meals', 'bedtime'];

  const handleAdd = useCallback(async () => {
    if (!name.trim()) return;
    setAdding(true);
    const result = await fetchApi('/supplements/add', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        dose_amount: parseFloat(dose) || undefined,
        dose_unit: unit,
        timing,
        purpose: purpose.trim() || undefined,
      }),
    });
    setAdding(false);
    if (result) {
      setName('');
      setDose('');
      setPurpose('');
      onAdded();
      Alert.alert('Added', `${name} added to your stack.`);
    } else {
      Alert.alert('Error', 'Failed to add supplement.');
    }
  }, [name, dose, unit, timing, purpose, onAdded]);

  return (
    <ScrollView style={tabStyles.scroll}>
      <Text style={addStyles.label}>Supplement Name</Text>
      <TextInput
        style={addStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g., Vitamin D3"
        placeholderTextColor="rgba(255,255,255,0.3)"
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={addStyles.label}>Dose</Text>
          <TextInput
            style={addStyles.input}
            value={dose}
            onChangeText={setDose}
            placeholder="5000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={addStyles.label}>Unit</Text>
          <TextInput
            style={addStyles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder="mg, mcg, IU"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
      </View>

      <Text style={addStyles.label}>Timing</Text>
      <View style={addStyles.timingRow}>
        {timings.map(t => (
          <TouchableOpacity
            key={t}
            style={[addStyles.timingBtn, timing === t && addStyles.timingActive]}
            onPress={() => setTiming(t)}
          >
            <Text style={[addStyles.timingText, timing === t && addStyles.timingActiveText]}>
              {t.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={addStyles.label}>Purpose (optional)</Text>
      <TextInput
        style={addStyles.input}
        value={purpose}
        onChangeText={setPurpose}
        placeholder="e.g., Bone health, immune support"
        placeholderTextColor="rgba(255,255,255,0.3)"
      />

      <TouchableOpacity
        style={addStyles.addBtn}
        onPress={handleAdd}
        disabled={adding || !name.trim()}
        activeOpacity={0.8}
      >
        {adding ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={addStyles.addBtnText}>Add Supplement</Text>
        )}
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const addStyles = StyleSheet.create({
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  timingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timingBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1A1A2E',
  },
  timingActive: {
    backgroundColor: '#6C63FF',
  },
  timingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  timingActiveText: {
    color: '#fff',
  },
  addBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

// ---- Stats Tab ----
function StatsTab() {
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<AdherenceStats>('/supplements/stats').then(s => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;
  if (!stats || !stats.total_logs) {
    return (
      <View style={tabStyles.center}>
        <Text style={tabStyles.empty}>No adherence data yet.</Text>
        <Text style={tabStyles.emptyHint}>Start logging to see your stats.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={tabStyles.scroll}>
      <View style={statsStyles.overviewCard}>
        <View style={statsStyles.statRow}>
          <View style={statsStyles.stat}>
            <Text style={statsStyles.statValue}>{stats.adherence_pct}%</Text>
            <Text style={statsStyles.statLabel}>Adherence</Text>
          </View>
          <View style={statsStyles.stat}>
            <Text style={statsStyles.statValue}>{stats.current_streak_days}</Text>
            <Text style={statsStyles.statLabel}>Day Streak</Text>
          </View>
          <View style={statsStyles.stat}>
            <Text style={statsStyles.statValue}>{stats.period_days}d</Text>
            <Text style={statsStyles.statLabel}>Period</Text>
          </View>
        </View>
      </View>

      {stats.breakdown && stats.breakdown.length > 0 && (
        <>
          <Text style={tabStyles.sectionTitle}>BY SUPPLEMENT</Text>
          {stats.breakdown.map((b, i) => (
            <View key={i} style={statsStyles.breakdownRow}>
              <Text style={statsStyles.breakdownName} numberOfLines={1}>{b.name}</Text>
              <View style={statsStyles.barContainer}>
                <View style={[statsStyles.bar, { width: `${b.adherence_pct}%` }]} />
              </View>
              <Text style={statsStyles.breakdownPct}>{b.adherence_pct}%</Text>
            </View>
          ))}
        </>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const statsStyles = StyleSheet.create({
  overviewCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { color: '#6C63FF', fontSize: 28, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  breakdownRow: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownName: { color: '#fff', fontSize: 14, fontWeight: '600', width: 100 },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  bar: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  breakdownPct: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', width: 45, textAlign: 'right' },
});

// ---- Main Screen ----
export default function Supplements() {
  const [tab, setTab] = useState<Tab>('today');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {(['today', 'stack', 'add', 'stats'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content} key={refreshKey}>
        {tab === 'today' && <TodayTab />}
        {tab === 'stack' && <StackTab />}
        {tab === 'add' && <AddTab onAdded={() => { setRefreshKey(k => k + 1); setTab('today'); }} />}
        {tab === 'stats' && <StatsTab />}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center' },
  emptyHint: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 16,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
  },
  activeTab: { backgroundColor: '#6C63FF' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#fff' },
  content: { flex: 1, paddingTop: 8 },
});
