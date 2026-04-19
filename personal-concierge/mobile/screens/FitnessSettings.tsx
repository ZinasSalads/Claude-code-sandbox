import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { API_URL, getEquipment, addEquipment, deleteEquipment } from '../lib/api';
import type { UserEquipment } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle } from '../theme';
import { useUnits } from '../context/UnitsContext';
import { kgToLbs, lbsToKg } from '../lib/units';
import { getBodyStats } from '../lib/appleHealth';

interface FitnessProfile {
  age?: number;
  gender?: string;
  max_hr?: number;
  weight_kg?: number;
  one_rep_maxes?: Record<string, number>;
}

const COMMON_EXERCISES = ['Squat', 'Deadlift', 'Bench Press', 'Overhead Press', 'Barbell Row'];
const GENDERS = ['male', 'female', 'prefer not to say'];

const PRESET_EQUIPMENT: Array<{ name: string; category: string; icon: string }> = [
  { name: 'Treadmill', category: 'cardio', icon: '🏃' },
  { name: 'Stationary Bike', category: 'cardio', icon: '🚴' },
  { name: 'Rowing Machine', category: 'cardio', icon: '🚣' },
  { name: 'Elliptical', category: 'cardio', icon: '⚡' },
  { name: 'Dumbbells', category: 'free_weights', icon: '🏋️' },
  { name: 'Barbell & Rack', category: 'free_weights', icon: '🏋️' },
  { name: 'Kettlebells', category: 'free_weights', icon: '🔔' },
  { name: 'Pull-up Bar', category: 'free_weights', icon: '🔝' },
  { name: 'Cable Machine', category: 'machines', icon: '🔧' },
  { name: 'Leg Press', category: 'machines', icon: '🦵' },
  { name: 'Chest Press Machine', category: 'machines', icon: '💪' },
  { name: 'Resistance Bands', category: 'other', icon: '🔁' },
];


async function fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

interface Props {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function FitnessSettings({ navigation }: Props) {
  const { units, setUnits } = useUnits();
  const [profile, setProfile] = useState<FitnessProfile>({});
  const [equipment, setEquipment] = useState<UserEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pullingHealth, setPullingHealth] = useState(false);

  // Form state
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [oneRepMaxes, setOneRepMaxes] = useState<Record<string, string>>({});
  const [newExercise, setNewExercise] = useState('');
  const [newOrm, setNewOrm] = useState('');

  const load = useCallback(async () => {
    const [prof, equip] = await Promise.all([
      fetchApi<FitnessProfile>('/fitness/profile-settings'),
      getEquipment().catch(() => [] as UserEquipment[]),
    ]);
    if (prof) {
      setProfile(prof);
      setAge(prof.age?.toString() || '');
      setGender(prof.gender || '');
      setMaxHr(prof.max_hr?.toString() || '');
      if (prof.weight_kg != null) {
        const displayWeight = units === 'imperial' ? Math.round(kgToLbs(prof.weight_kg)) : prof.weight_kg;
        setWeightKg(displayWeight.toString());
      }
      const ormStr: Record<string, string> = {};
      for (const [k, v] of Object.entries(prof.one_rep_maxes || {})) {
        const displayVal = units === 'imperial' ? Math.round(kgToLbs(v)) : v;
        ormStr[k] = displayVal.toString();
      }
      setOneRepMaxes(ormStr);
    }
    setEquipment(equip || []);
    setLoading(false);
  }, [units]);

  useEffect(() => { load(); }, [load]);

  const handleSaveAll = async () => {
    setSaving(true);
    const orms: Record<string, number> = {};
    for (const [k, v] of Object.entries(oneRepMaxes)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) {
        orms[k] = units === 'imperial' ? Math.round(lbsToKg(n) * 10) / 10 : n;
      }
    }
    const weightVal = weightKg ? parseFloat(weightKg) : undefined;
    const weightInKg = weightVal != null && units === 'imperial' ? Math.round(lbsToKg(weightVal) * 10) / 10 : weightVal;
    const data = {
      age: age ? parseInt(age) : undefined,
      gender: gender || undefined,
      max_hr: maxHr ? parseInt(maxHr) : undefined,
      weight_kg: weightInKg,
      one_rep_maxes: Object.keys(orms).length > 0 ? orms : undefined,
    };
    const result = await fetchApi('/fitness/profile-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (result) {
      Alert.alert('Saved', 'All settings updated.');
    } else {
      Alert.alert('Error', 'Could not save settings. Try again.');
    }
  };

  const handlePullFromAppleHealth = async () => {
    setPullingHealth(true);
    const stats = await getBodyStats();
    if (stats.weight_kg != null) {
      const displayWeight = units === 'imperial' ? Math.round(kgToLbs(stats.weight_kg)) : parseFloat(stats.weight_kg.toFixed(1));
      setWeightKg(displayWeight.toString());
    }
    setPullingHealth(false);
    if (stats.weight_kg == null) {
      Alert.alert('No Data', 'Could not read body stats from Apple Health. Make sure Health permissions are granted.');
    } else {
      const label = units === 'imperial' ? `${Math.round(kgToLbs(stats.weight_kg))} lbs` : `${stats.weight_kg.toFixed(1)} kg`;
      Alert.alert('Imported', `Weight set to ${label} from Apple Health.`);
    }
  };

  const addOrm = () => {
    if (!newExercise.trim() || !newOrm.trim()) return;
    setOneRepMaxes(prev => ({ ...prev, [newExercise.trim()]: newOrm.trim() }));
    setNewExercise('');
    setNewOrm('');
  };

  const removeOrm = (key: string) => {
    setOneRepMaxes(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const [equipSaved, setEquipSaved] = useState(false);
  const [customEquipInput, setCustomEquipInput] = useState('');
  const [catalogCache, setCatalogCache] = useState<Array<{ name: string; category: string }> | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (catalogCache !== null || catalogLoading) return;
    setCatalogLoading(true);
    const data = await fetchApi<Array<{ name: string; category: string }>>('/fitness/equipment-catalog');
    setCatalogCache(data || []);
    setCatalogLoading(false);
  }, [catalogCache, catalogLoading]);

  const equipSuggestions = customEquipInput.trim().length >= 2 && catalogCache
    ? catalogCache.filter(e =>
        e.name.toLowerCase().includes(customEquipInput.trim().toLowerCase()) &&
        !equipment.some(eq => eq.name === e.name) &&
        !PRESET_EQUIPMENT.some(p => p.name === e.name)
      ).slice(0, 6)
    : [];

  const addCustomEquipment = async (name: string, category: string) => {
    await addEquipment({ name, category });
    const updated = await getEquipment().catch(() => [] as UserEquipment[]);
    setEquipment(updated);
    setCustomEquipInput('');
    setEquipSaved(true);
    setTimeout(() => setEquipSaved(false), 2000);
  };

  const toggleEquipment = async (preset: typeof PRESET_EQUIPMENT[0]) => {
    const existing = equipment.find(e => e.name === preset.name);
    if (existing) {
      await deleteEquipment(existing.id);
    } else {
      await addEquipment({ name: preset.name, category: preset.category });
    }
    const updated = await getEquipment().catch(() => [] as UserEquipment[]);
    setEquipment(updated);
    setEquipSaved(true);
    setTimeout(() => setEquipSaved(false), 2000);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Unit System */}
      <Text style={styles.sectionLabel}>UNIT SYSTEM</Text>
      <View style={styles.card}>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, units === 'imperial' && styles.chipActive]}
            onPress={() => setUnits('imperial')}
          >
            <Text style={[styles.chipText, units === 'imperial' && styles.chipTextActive]}>Imperial (lbs, mph, ft)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, units === 'metric' && styles.chipActive]}
            onPress={() => setUnits('metric')}
          >
            <Text style={[styles.chipText, units === 'metric' && styles.chipTextActive]}>Metric (kg, km/h, cm)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fitness Profile */}
      <Text style={styles.sectionLabel}>FITNESS PROFILE</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g. 32" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" returnKeyType="next" />

        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDERS.map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, gender === g && styles.chipActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Max Heart Rate (bpm)</Text>
        <Text style={styles.fieldHint}>If unsure, we'll estimate from age: 220 - age</Text>
        <TextInput style={styles.input} value={maxHr} onChangeText={setMaxHr} placeholder="e.g. 185" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" returnKeyType="next" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.fieldLabel}>Weight ({units === 'imperial' ? 'lbs' : 'kg'})</Text>
          <TouchableOpacity onPress={handlePullFromAppleHealth} disabled={pullingHealth} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md }}>
            {pullingHealth
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={{ color: colors.primary, fontSize: font.xs, fontWeight: font.semibold }}>📱 Pull from Apple Health</Text>
            }
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} value={weightKg} onChangeText={setWeightKg} placeholder={units === 'imperial' ? 'e.g. 165' : 'e.g. 75'} placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" returnKeyType="done" />
      </View>

      {/* 1 Rep Max */}
      <Text style={styles.sectionLabel}>1 REP MAX ({units === 'imperial' ? 'lbs' : 'kg'})</Text>
      <View style={styles.card}>
        {Object.entries(oneRepMaxes).map(([exercise, val]) => (
          <View key={exercise} style={styles.ormRow}>
            <Text style={styles.ormExercise}>{exercise}</Text>
            <Text style={styles.ormValue}>{val} {units === 'imperial' ? 'lbs' : 'kg'}</Text>
            <TouchableOpacity onPress={() => removeOrm(exercise)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.ormDelete}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Text style={styles.fieldLabel}>Add Exercise</Text>
        <View style={styles.ormInputRow}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            value={newExercise}
            onChangeText={setNewExercise}
            placeholder="Exercise name"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newOrm}
            onChangeText={setNewOrm}
            placeholder={units === 'imperial' ? 'lbs' : 'kg'}
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addOrmBtn} onPress={addOrm} activeOpacity={0.7}>
            <Text style={styles.addOrmBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.commonExLabel}>Common exercises:</Text>
        <View style={styles.chipRow}>
          {COMMON_EXERCISES.filter(e => !oneRepMaxes[e]).map(e => (
            <TouchableOpacity key={e} style={styles.chip} onPress={() => setNewExercise(e)}>
              <Text style={styles.chipText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Equipment */}
      <Text style={styles.sectionLabel}>EQUIPMENT</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={[styles.equipHint, { marginBottom: 0, flex: 1 }]}>Tap to toggle. Changes save automatically.</Text>
          {equipSaved && <Text style={{ color: colors.success, fontSize: font.xs, fontWeight: font.bold }}>Saved</Text>}
        </View>
        {['cardio', 'free_weights', 'machines', 'other'].map(cat => {
          const presets = PRESET_EQUIPMENT.filter(p => p.category === cat);
          const catLabel = cat === 'free_weights' ? 'Free Weights' : cat.charAt(0).toUpperCase() + cat.slice(1);
          return (
            <View key={cat}>
              <Text style={styles.catLabel}>{catLabel}</Text>
              <View style={styles.equipGrid}>
                {presets.map(p => {
                  const isActive = equipment.some(e => e.name === p.name);
                  return (
                    <TouchableOpacity
                      key={p.name}
                      style={[styles.equipItem, isActive && styles.equipItemActive]}
                      onPress={() => toggleEquipment(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.equipIcon}>{p.icon}</Text>
                      <Text style={[styles.equipName, isActive && styles.equipNameActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Custom equipment already added (not in presets) */}
        {equipment.filter(eq => !PRESET_EQUIPMENT.some(p => p.name === eq.name)).length > 0 && (
          <>
            <Text style={styles.catLabel}>Your Custom Equipment</Text>
            <View style={styles.equipGrid}>
              {equipment.filter(eq => !PRESET_EQUIPMENT.some(p => p.name === eq.name)).map(eq => (
                <TouchableOpacity
                  key={eq.id}
                  style={[styles.equipItem, styles.equipItemActive]}
                  onPress={() => Alert.alert('Remove Equipment', `Remove "${eq.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: async () => {
                      await deleteEquipment(eq.id);
                      const updated = await getEquipment().catch(() => [] as UserEquipment[]);
                      setEquipment(updated);
                    }},
                  ])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.equipIcon}>+</Text>
                  <Text style={[styles.equipName, styles.equipNameActive]}>{eq.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Add custom equipment */}
        <Text style={styles.catLabel}>Add Equipment</Text>
        <TextInput
          style={[styles.input, { marginBottom: equipSuggestions.length > 0 ? 0 : spacing.sm }]}
          value={customEquipInput}
          onChangeText={setCustomEquipInput}
          onFocus={loadCatalog}
          placeholder="Start typing to search..."
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={() => {
            const name = customEquipInput.trim();
            if (name && !equipment.some(e => e.name === name)) {
              addCustomEquipment(name, 'other');
            }
          }}
        />
        {catalogLoading && customEquipInput.trim().length >= 2 && (
          <View style={{ padding: spacing.sm, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {equipSuggestions.length > 0 && (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, marginBottom: spacing.sm, overflow: 'hidden' }}>
            {equipSuggestions.map(s => (
              <TouchableOpacity
                key={s.name}
                style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgCard }}
                onPress={() => addCustomEquipment(s.name, s.category)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textPrimary, fontSize: font.md }}>{s.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: font.xs }}>{s.category.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Save All */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        onPress={handleSaveAll}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save All Settings</Text>}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  sectionLabel: { ...sectionLabel },
  card: { ...cardStyle, marginBottom: spacing.lg },

  fieldLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 0.8, marginBottom: spacing.xs, marginTop: spacing.md },
  fieldHint: { fontSize: font.xs, color: colors.textTertiary, marginBottom: spacing.xs },
  input: { ...inputStyle, marginBottom: spacing.xs },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  chipHalf: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold },
  chipTextActive: { color: colors.textAccent },

  saveBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.bold },

  ormRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  ormExercise: { flex: 1, color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold },
  ormValue: { color: colors.textAccent, fontSize: font.md, fontWeight: font.bold, marginRight: spacing.lg },
  ormDelete: { fontSize: 22, color: colors.error, fontWeight: font.bold },
  ormInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addOrmBtn: { backgroundColor: colors.primaryMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.primary },
  addOrmBtnText: { color: colors.textAccent, fontWeight: font.bold, fontSize: font.sm },
  commonExLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.xs },

  equipHint: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  catLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.sm },
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipItem: { alignItems: 'center', width: '30%', padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  equipItemActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  equipIcon: { fontSize: 22, marginBottom: 2 },
  equipName: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', fontWeight: font.medium },
  equipNameActive: { color: colors.textAccent },
});
