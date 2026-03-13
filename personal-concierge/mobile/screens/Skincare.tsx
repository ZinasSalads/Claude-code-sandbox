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

interface Product { id: string; name: string; step: number; routine: 'morning' | 'evening'; conflicts?: string[] }
interface SkinProfile { skin_type: string; concerns: string[]; sensitivity: string }
interface CheckIn { date: string; condition: number; note: string }
interface WeeklyTrend { avg_condition: number; breakout_days: number; trend: string }
interface HealthCorrelation { factor: string; impact: string; detail: string }

export default function Skincare() {
  const [profile, setProfile] = useState<SkinProfile | null>(null);
  const [morningRoutine, setMorningRoutine] = useState<Product[]>([]);
  const [eveningRoutine, setEveningRoutine] = useState<Product[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend | null>(null);
  const [correlations, setCorrelations] = useState<HealthCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conditionVal, setConditionVal] = useState(5);
  const [checkInNote, setCheckInNote] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductRoutine, setNewProductRoutine] = useState<'morning' | 'evening'>('morning');
  const [newProductStep, setNewProductStep] = useState('1');

  const fetchData = useCallback(async () => {
    const [p, m, e, w, c] = await Promise.all([
      api<SkinProfile>('/skincare/profile'),
      api<Product[]>('/skincare/routine/morning'),
      api<Product[]>('/skincare/routine/evening'),
      api<WeeklyTrend>('/skincare/trend/weekly'),
      api<HealthCorrelation[]>('/skincare/correlations'),
    ]);
    setProfile(p);
    setMorningRoutine(m || []);
    setEveningRoutine(e || []);
    setWeeklyTrend(w);
    setCorrelations(c || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCheckIn = useCallback(async () => {
    await apiPost('/skincare/checkin', { condition: conditionVal, note: checkInNote });
    setCheckInNote('');
    setConditionVal(5);
    fetchData();
  }, [conditionVal, checkInNote, fetchData]);

  const handleAddProduct = useCallback(async () => {
    if (!newProductName.trim()) return;
    await apiPost('/skincare/products', {
      name: newProductName, routine: newProductRoutine, step: parseInt(newProductStep) || 1,
    });
    setNewProductName('');
    setNewProductStep('1');
    setShowAddProduct(false);
    fetchData();
  }, [newProductName, newProductRoutine, newProductStep, fetchData]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading skincare data...</Text></View>;
  }

  const renderRoutine = (title: string, products: Product[]) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {products.sort((a, b) => a.step - b.step).map((p) => (
        <View key={p.id} style={styles.productRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{p.step}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{p.name}</Text>
            {p.conflicts && p.conflicts.length > 0 && (
              <View style={styles.conflictRow}>
                {p.conflicts.map((c, i) => (
                  <View key={i} style={styles.conflictBadge}>
                    <Text style={styles.conflictText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
      {products.length === 0 && <Text style={styles.dimText}>No products added yet</Text>}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Skincare</Text>

      {profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Skin Profile</Text>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Type</Text>
            <Text style={styles.profileValue}>{profile.skin_type}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Sensitivity</Text>
            <Text style={styles.profileValue}>{profile.sensitivity}</Text>
          </View>
          <Text style={styles.profileLabel}>Concerns</Text>
          <View style={styles.tagRow}>
            {profile.concerns.map((c, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {renderRoutine('Morning Routine', morningRoutine)}
      {renderRoutine('Evening Routine', eveningRoutine)}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Check-In</Text>
        <Text style={styles.dimText}>Skin Condition: {conditionVal}/10</Text>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.sliderDot, conditionVal === v && styles.sliderDotActive]}
              onPress={() => setConditionVal(v)}
            >
              <Text style={[styles.sliderDotText, conditionVal === v && { color: '#fff' }]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Notes (optional)"
          placeholderTextColor="#555577"
          value={checkInNote}
          onChangeText={setCheckInNote}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCheckIn}>
          <Text style={styles.primaryBtnText}>Submit Check-In</Text>
        </TouchableOpacity>
      </View>

      {weeklyTrend && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Skin Trend</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: scoreColor(weeklyTrend.avg_condition * 10) }]}>
                {weeklyTrend.avg_condition.toFixed(1)}
              </Text>
              <Text style={styles.metricLabel}>Avg Condition</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: weeklyTrend.breakout_days > 2 ? '#e17055' : '#00b894' }]}>
                {weeklyTrend.breakout_days}
              </Text>
              <Text style={styles.metricLabel}>Breakout Days</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{weeklyTrend.trend === 'up' ? '↑' : weeklyTrend.trend === 'down' ? '↓' : '→'}</Text>
              <Text style={styles.metricLabel}>Trend</Text>
            </View>
          </View>
        </View>
      )}

      {correlations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Correlations</Text>
          {correlations.map((c, i) => (
            <View key={i} style={styles.correlationItem}>
              <View style={[styles.impactDot, { backgroundColor: c.impact === 'positive' ? '#00b894' : c.impact === 'negative' ? '#e17055' : '#fdcb6e' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.correlationFactor}>{c.factor}</Text>
                <Text style={styles.dimText}>{c.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddProduct(!showAddProduct)}>
        <Text style={styles.addBtnText}>{showAddProduct ? 'Cancel' : '+ Add Product'}</Text>
      </TouchableOpacity>

      {showAddProduct && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Product name" placeholderTextColor="#555577" value={newProductName} onChangeText={setNewProductName} />
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, newProductRoutine === 'morning' && styles.toggleBtnActive]}
              onPress={() => setNewProductRoutine('morning')}
            >
              <Text style={[styles.toggleText, newProductRoutine === 'morning' && styles.toggleTextActive]}>Morning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, newProductRoutine === 'evening' && styles.toggleBtnActive]}
              onPress={() => setNewProductRoutine('evening')}
            >
              <Text style={[styles.toggleText, newProductRoutine === 'evening' && styles.toggleTextActive]}>Evening</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Step number" placeholderTextColor="#555577" keyboardType="numeric" value={newProductStep} onChangeText={setNewProductStep} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddProduct}>
            <Text style={styles.primaryBtnText}>Add Product</Text>
          </TouchableOpacity>
        </View>
      )}
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  dimText: { fontSize: 13, color: '#8888aa', marginBottom: 4 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  profileLabel: { fontSize: 13, color: '#8888aa', marginBottom: 6 },
  profileValue: { fontSize: 14, color: '#fff', fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: 'rgba(108,99,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: '#6C63FF', fontSize: 12, fontWeight: '600' },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(108,99,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stepText: { color: '#6C63FF', fontSize: 13, fontWeight: '700' },
  productName: { fontSize: 14, color: '#fff', fontWeight: '500' },
  conflictRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  conflictBadge: { backgroundColor: 'rgba(253,203,110,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  conflictText: { color: '#fdcb6e', fontSize: 11, fontWeight: '600' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  sliderDot: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  sliderDotActive: { backgroundColor: '#6C63FF' },
  sliderDotText: { color: '#8888aa', fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: 24, fontWeight: '700', color: '#fff' },
  metricLabel: { fontSize: 11, color: '#8888aa', marginTop: 2, textTransform: 'uppercase' },
  correlationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  impactDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  correlationFactor: { fontSize: 14, fontWeight: '600', color: '#fff' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  toggleBtnActive: { backgroundColor: 'rgba(108,99,255,0.2)', borderColor: '#6C63FF' },
  toggleText: { color: '#8888aa', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#6C63FF' },
});
