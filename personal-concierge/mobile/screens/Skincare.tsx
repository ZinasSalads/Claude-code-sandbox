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
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

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

interface Product { id: string; product_name: string; brand: string; product_type: string; active_ingredients: string[]; routine_slot: 'morning' | 'evening'; application_order: number; frequency: string; conflicts?: string[] }
interface SkinProfile { skin_type: string; concerns: string[]; sensitivity_level: string; allergies: string[]; climate: string; age_range: string; goals: string[]; notes: string }
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
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductType, setNewProductType] = useState('cleanser');
  const [newProductIngredients, setNewProductIngredients] = useState('');
  const [newProductRoutine, setNewProductRoutine] = useState<'morning' | 'evening'>('morning');
  const [newProductOrder, setNewProductOrder] = useState('1');
  const [newProductFrequency, setNewProductFrequency] = useState('daily');
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editSkinType, setEditSkinType] = useState('');
  const [editSensitivity, setEditSensitivity] = useState('');
  const [editConcerns, setEditConcerns] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editClimate, setEditClimate] = useState('');
  const [editAgeRange, setEditAgeRange] = useState('');
  const [editGoals, setEditGoals] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = useCallback(async () => {
    const [p, m, e, w, c] = await Promise.all([
      api<SkinProfile>('/skincare/profile'),
      api<Product[]>('/skincare/routine/morning'),
      api<Product[]>('/skincare/routine/evening'),
      api<WeeklyTrend>('/skincare/weekly'),
      api<HealthCorrelation[]>('/skincare/correlations'),
    ]);
    setProfile(p);
    setMorningRoutine(Array.isArray(m) ? m : []);
    setEveningRoutine(Array.isArray(e) ? e : []);
    setWeeklyTrend(w);
    setCorrelations(Array.isArray(c) ? c : []);
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
      product_name: newProductName,
      brand: newProductBrand,
      product_type: newProductType,
      active_ingredients: newProductIngredients.split(',').map(s => s.trim()).filter(Boolean),
      routine_slot: newProductRoutine,
      application_order: parseInt(newProductOrder) || 1,
      frequency: newProductFrequency,
    });
    setNewProductName(''); setNewProductBrand(''); setNewProductIngredients('');
    setNewProductOrder('1');
    setShowAddProduct(false);
    fetchData();
  }, [newProductName, newProductBrand, newProductType, newProductIngredients, newProductRoutine, newProductOrder, newProductFrequency, fetchData]);

  const handleSaveProfile = useCallback(async () => {
    await apiPut('/skincare/profile', {
      skin_type: editSkinType,
      sensitivity_level: editSensitivity,
      concerns: editConcerns.split(',').map(s => s.trim()).filter(Boolean),
      allergies: editAllergies.split(',').map(s => s.trim()).filter(Boolean),
      climate: editClimate,
      age_range: editAgeRange,
      goals: editGoals.split(',').map(s => s.trim()).filter(Boolean),
      notes: editNotes,
    });
    setShowProfileEditor(false);
    fetchData();
  }, [editSkinType, editSensitivity, editConcerns, editAllergies, editClimate, editAgeRange, editGoals, editNotes, fetchData]);

  const openProfileEditor = useCallback(() => {
    if (profile) {
      setEditSkinType(profile.skin_type || '');
      setEditSensitivity(profile.sensitivity_level || '');
      setEditConcerns((profile.concerns || []).join(', '));
      setEditAllergies((profile.allergies || []).join(', '));
      setEditClimate(profile.climate || '');
      setEditAgeRange(profile.age_range || '');
      setEditGoals((profile.goals || []).join(', '));
      setEditNotes(profile.notes || '');
    }
    setShowProfileEditor(true);
  }, [profile]);

  const scoreColor = (s: number) => s >= 70 ? colors.success : s >= 40 ? colors.warning : colors.error;

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading skincare data...</Text></View>;
  }

  const renderRoutine = (title: string, products: Product[]) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {[...(products || [])].sort((a, b) => a.application_order - b.application_order).map((p) => (
        <View key={p.id} style={styles.productRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{p.application_order}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{p.product_name}{p.brand ? ` (${p.brand})` : ''}</Text>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Skincare</Text>

      {profile && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Skin Profile</Text>
            <TouchableOpacity onPress={openProfileEditor}>
              <Text style={{ color: colors.textAccent, fontSize: font.sm, fontWeight: font.semibold }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Type</Text>
            <Text style={styles.profileValue}>{profile.skin_type}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Sensitivity</Text>
            <Text style={styles.profileValue}>{profile.sensitivity_level}</Text>
          </View>
          {profile.climate ? <View style={styles.profileRow}><Text style={styles.profileLabel}>Climate</Text><Text style={styles.profileValue}>{profile.climate}</Text></View> : null}
          {profile.age_range ? <View style={styles.profileRow}><Text style={styles.profileLabel}>Age Range</Text><Text style={styles.profileValue}>{profile.age_range}</Text></View> : null}
          <Text style={styles.profileLabel}>Concerns</Text>
          <View style={styles.tagRow}>
            {(profile.concerns || []).map((c, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{c}</Text>
              </View>
            ))}
          </View>
          {profile.goals && profile.goals.length > 0 && (
            <>
              <Text style={[styles.profileLabel, { marginTop: 8 }]}>Goals</Text>
              <View style={styles.tagRow}>
                {profile.goals.map((g, i) => (
                  <View key={i} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
      {!profile && (
        <TouchableOpacity style={styles.addBtn} onPress={openProfileEditor}>
          <Text style={styles.addBtnText}>+ Set Up Skin Profile</Text>
        </TouchableOpacity>
      )}

      {showProfileEditor && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Skin Profile</Text>
          <TextInput style={styles.input} placeholder="Skin type (oily, dry, combination, normal, sensitive)" placeholderTextColor={colors.textTertiary} value={editSkinType} onChangeText={setEditSkinType} />
          <TextInput style={styles.input} placeholder="Sensitivity level (low, medium, high)" placeholderTextColor={colors.textTertiary} value={editSensitivity} onChangeText={setEditSensitivity} />
          <TextInput style={styles.input} placeholder="Concerns (comma-separated)" placeholderTextColor={colors.textTertiary} value={editConcerns} onChangeText={setEditConcerns} />
          <TextInput style={styles.input} placeholder="Allergies (comma-separated)" placeholderTextColor={colors.textTertiary} value={editAllergies} onChangeText={setEditAllergies} />
          <TextInput style={styles.input} placeholder="Climate (humid, dry, temperate, tropical)" placeholderTextColor={colors.textTertiary} value={editClimate} onChangeText={setEditClimate} />
          <TextInput style={styles.input} placeholder="Age range (20s, 30s, 40s, 50s+)" placeholderTextColor={colors.textTertiary} value={editAgeRange} onChangeText={setEditAgeRange} />
          <TextInput style={styles.input} placeholder="Goals (comma-separated)" placeholderTextColor={colors.textTertiary} value={editGoals} onChangeText={setEditGoals} />
          <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={colors.textTertiary} value={editNotes} onChangeText={setEditNotes} multiline />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.bgElevated }]} onPress={() => setShowProfileEditor(false)}>
              <Text style={styles.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleSaveProfile}>
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            </TouchableOpacity>
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
          placeholderTextColor={colors.textTertiary}
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
              <Text style={[styles.metricVal, { color: weeklyTrend.breakout_days > 2 ? colors.error : colors.success }]}>
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
              <View style={[styles.impactDot, { backgroundColor: c.impact === 'positive' ? colors.success : c.impact === 'negative' ? colors.error : colors.warning }]} />
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
          <TextInput style={styles.input} placeholder="Product name" placeholderTextColor={colors.textTertiary} value={newProductName} onChangeText={setNewProductName} />
          <TextInput style={styles.input} placeholder="Brand" placeholderTextColor={colors.textTertiary} value={newProductBrand} onChangeText={setNewProductBrand} />
          <Text style={styles.formLabel}>Product Type</Text>
          <View style={styles.typeRow}>
            {['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'treatment', 'mask', 'eye cream'].map((t) => (
              <TouchableOpacity key={t} style={[styles.typeChip, newProductType === t && styles.typeChipActive]} onPress={() => setNewProductType(t)}>
                <Text style={[styles.typeChipText, newProductType === t && styles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Active ingredients (comma-separated)" placeholderTextColor={colors.textTertiary} value={newProductIngredients} onChangeText={setNewProductIngredients} />
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
          <TextInput style={styles.input} placeholder="Application order" placeholderTextColor={colors.textTertiary} keyboardType="numeric" value={newProductOrder} onChangeText={setNewProductOrder} />
          <Text style={styles.formLabel}>Frequency</Text>
          <View style={styles.typeRow}>
            {['daily', 'twice-daily', 'weekly', 'as-needed'].map((f) => (
              <TouchableOpacity key={f} style={[styles.typeChip, newProductFrequency === f && styles.typeChipActive]} onPress={() => setNewProductFrequency(f)}>
                <Text style={[styles.typeChipText, newProductFrequency === f && styles.typeChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddProduct}>
            <Text style={styles.primaryBtnText}>Add Product</Text>
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
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  dimText: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  profileLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  profileValue: { fontSize: font.md, color: colors.textPrimary, fontWeight: font.semibold },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { backgroundColor: colors.accentMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tagText: { color: colors.textAccent, fontSize: font.sm, fontWeight: font.semibold },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  stepBadge: {
    width: 28, height: 28, borderRadius: radii.full, backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  stepText: { color: colors.textAccent, fontSize: font.sm, fontWeight: font.bold },
  productName: { fontSize: font.md, color: colors.textPrimary, fontWeight: font.medium },
  conflictRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs },
  conflictBadge: { backgroundColor: colors.warningMuted, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  conflictText: { color: colors.warning, fontSize: font.xs, fontWeight: font.semibold },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  sliderDot: {
    width: 30, height: 30, borderRadius: radii.full, backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  sliderDotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sliderDotText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary },
  metricLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  correlationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  impactDot: { width: 10, height: 10, borderRadius: radii.full, marginRight: spacing.md },
  correlationFactor: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', ...shadow.glow },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: spacing.sm, marginTop: spacing.xs },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeChip: { backgroundColor: colors.bgElevated, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  typeChipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold },
  typeChipTextActive: { color: colors.textAccent },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleBtn: {
    flex: 1, padding: spacing.md, borderRadius: radii.sm, alignItems: 'center',
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  toggleBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontWeight: font.semibold, fontSize: font.sm },
  toggleTextActive: { color: colors.textAccent },
});
