import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { API_URL, getEquipment, addEquipment, deleteEquipment } from '../lib/api';
import type { UserEquipment } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle } from '../theme';

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
  const [profile, setProfile] = useState<FitnessProfile>({});
  const [equipment, setEquipment] = useState<UserEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setWeightKg(prof.weight_kg?.toString() || '');
      const ormStr: Record<string, string> = {};
      for (const [k, v] of Object.entries(prof.one_rep_maxes || {})) {
        ormStr[k] = v.toString();
      }
      setOneRepMaxes(ormStr);
    }
    setEquipment(equip || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const orms: Record<string, number> = {};
    for (const [k, v] of Object.entries(oneRepMaxes)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) orms[k] = n;
    }
    const data = {
      age: age ? parseInt(age) : undefined,
      gender: gender || undefined,
      max_hr: maxHr ? parseInt(maxHr) : undefined,
      weight_kg: weightKg ? parseFloat(weightKg) : undefined,
      one_rep_maxes: Object.keys(orms).length > 0 ? orms : undefined,
    };
    const result = await fetchApi('/fitness/profile-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (result) {
      Alert.alert('Saved', 'Fitness profile updated.');
    } else {
      Alert.alert('Error', 'Could not save settings. Try again.');
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

  const toggleEquipment = async (preset: typeof PRESET_EQUIPMENT[0]) => {
    const existing = equipment.find(e => e.name === preset.name);
    if (existing) {
      await deleteEquipment(existing.id);
    } else {
      await addEquipment({ name: preset.name, category: preset.category });
    }
    const updated = await getEquipment().catch(() => [] as UserEquipment[]);
    setEquipment(updated);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        <Text style={styles.fieldLabel}>Weight (kg)</Text>
        <TextInput style={styles.input} value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 75" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" returnKeyType="done" />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSaveProfile}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </TouchableOpacity>
      </View>

      {/* 1 Rep Max */}
      <Text style={styles.sectionLabel}>1 REP MAX (kg)</Text>
      <View style={styles.card}>
        {Object.entries(oneRepMaxes).map(([exercise, kg]) => (
          <View key={exercise} style={styles.ormRow}>
            <Text style={styles.ormExercise}>{exercise}</Text>
            <Text style={styles.ormValue}>{kg} kg</Text>
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
            placeholder="kg"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addOrmBtn} onPress={addOrm} activeOpacity={0.7}>
            <Text style={styles.addOrmBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {Object.keys(oneRepMaxes).length > 0 && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Save 1RM</Text>
          </TouchableOpacity>
        )}
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
        <Text style={styles.equipHint}>Tap to toggle available equipment. The AI uses this to plan workouts.</Text>
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
      </View>

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
