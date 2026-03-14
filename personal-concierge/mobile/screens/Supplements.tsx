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
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

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

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
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
    ...cardStyle,
    marginBottom: spacing.lg,
  },
  progressText: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: font.bold,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.full,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: radii.full,
  },
  item: {
    ...cardStyle,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTaken: {
    opacity: 0.6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    marginRight: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  check: {
    color: colors.white,
    fontWeight: font.bold,
    fontSize: font.md,
  },
  name: {
    color: colors.textPrimary,
    fontSize: font.md,
    fontWeight: font.semibold,
  },
  nameTaken: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  dose: {
    color: colors.textTertiary,
    fontSize: font.sm,
    marginTop: spacing.xs,
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

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

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
    ...cardStyle,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactive: { opacity: 0.4 },
  name: { color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold },
  detail: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.xs },
  purpose: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.xs, fontStyle: 'italic' },
  inactiveLabel: { color: colors.error, fontSize: font.xs, fontWeight: font.bold, marginTop: spacing.xs },
  removeBtn: { padding: spacing.sm },
  removeTxt: { color: colors.error, fontSize: 22, fontWeight: font.bold },
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
        placeholderTextColor={colors.textTertiary}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={addStyles.label}>Dose</Text>
          <TextInput
            style={addStyles.input}
            value={dose}
            onChangeText={setDose}
            placeholder="5000"
            placeholderTextColor={colors.textTertiary}
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
            placeholderTextColor={colors.textTertiary}
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
        placeholderTextColor={colors.textTertiary}
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
    ...sectionLabel,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radii.md,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: font.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timingBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timingActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  timingText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: font.semibold,
  },
  timingActiveText: {
    color: colors.textAccent,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing['2xl'],
    ...shadow.glow,
  },
  addBtnText: {
    color: colors.white,
    fontSize: font.lg,
    fontWeight: font.bold,
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

  if (loading) return <View style={tabStyles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
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

      {Array.isArray(stats.breakdown) && stats.breakdown.length > 0 && (
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
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { color: colors.textAccent, fontSize: 28, fontWeight: font.bold },
  statLabel: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.xs },
  breakdownRow: {
    ...cardStyle,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownName: { color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold, width: 100 },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    marginHorizontal: spacing.md,
  },
  bar: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: radii.full,
  },
  breakdownPct: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold, width: 45, textAlign: 'right' },
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
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['5xl'] },
  empty: { color: colors.textSecondary, fontSize: font.lg, textAlign: 'center' },
  emptyHint: { color: colors.textTertiary, fontSize: font.sm, textAlign: 'center', marginTop: spacing.sm },
  sectionTitle: {
    ...sectionLabel,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: 'transparent',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  tabText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: font.semibold },
  activeTabText: { color: colors.textAccent },
  content: { flex: 1, paddingTop: spacing.sm },
});
