import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { getEquipment, addEquipment, deleteEquipment } from '../lib/api';
import type { UserEquipment } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle } from '../theme';

const PRESET_EQUIPMENT: Array<{ name: string; category: string; icon: string }> = [
  // Cardio
  { name: 'Treadmill', category: 'cardio', icon: '🏃' },
  { name: 'Stationary Bike', category: 'cardio', icon: '🚴' },
  { name: 'Rowing Machine', category: 'cardio', icon: '🚣' },
  { name: 'Elliptical', category: 'cardio', icon: '⚡' },
  // Free Weights
  { name: 'Dumbbells', category: 'free_weights', icon: '🏋️' },
  { name: 'Barbell & Rack', category: 'free_weights', icon: '🏋️' },
  { name: 'Kettlebells', category: 'free_weights', icon: '🔔' },
  { name: 'Pull-up Bar', category: 'free_weights', icon: '🔝' },
  // Machines
  { name: 'Cable Machine', category: 'machines', icon: '🔧' },
  { name: 'Leg Press', category: 'machines', icon: '🦵' },
  { name: 'Chest Press Machine', category: 'machines', icon: '💪' },
  { name: 'Lat Pulldown', category: 'machines', icon: '⬇️' },
  { name: 'Smith Machine', category: 'machines', icon: '🔩' },
  { name: 'Leg Curl Machine', category: 'machines', icon: '🦵' },
  // Bodyweight / Other
  { name: 'Resistance Bands', category: 'other', icon: '🔁' },
  { name: 'Yoga Mat', category: 'other', icon: '🧘' },
  { name: 'Jump Rope', category: 'other', icon: '🪢' },
  { name: 'Foam Roller', category: 'other', icon: '🔵' },
];

const CATEGORY_LABELS: Record<string, string> = {
  cardio: 'Cardio',
  free_weights: 'Free Weights',
  machines: 'Machines',
  other: 'Other / Bodyweight',
};

const CATEGORIES = ['cardio', 'free_weights', 'machines', 'other'];

interface Props {
  navigation: object;
}

export default function EquipmentSetup({ navigation }: Props) {
  const [equipment, setEquipment] = useState<UserEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('other');
  const [addingCustom, setAddingCustom] = useState(false);

  const load = useCallback(async () => {
    const eq = await getEquipment().catch(() => []);
    setEquipment(eq);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isOwned = (name: string) => equipment.some(e => e.name.toLowerCase() === name.toLowerCase());

  const toggle = async (preset: typeof PRESET_EQUIPMENT[0]) => {
    const owned = isOwned(preset.name);
    setSaving(preset.name);
    try {
      if (owned) {
        const item = equipment.find(e => e.name.toLowerCase() === preset.name.toLowerCase());
        if (item) await deleteEquipment(item.id);
      } else {
        await addEquipment({ name: preset.name, category: preset.category });
      }
      await load();
    } catch {
      Alert.alert('Error', 'Could not update equipment.');
    } finally {
      setSaving(null);
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setAddingCustom(true);
    try {
      await addEquipment({ name: customName.trim(), category: customCategory });
      setCustomName('');
      await load();
    } catch {
      Alert.alert('Error', 'Could not add equipment.');
    } finally {
      setAddingCustom(false);
    }
  };

  const handleDeleteCustom = async (item: UserEquipment) => {
    Alert.alert('Remove Equipment', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteEquipment(item.id).catch(() => null);
          load();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  const customItems = equipment.filter(e =>
    !PRESET_EQUIPMENT.some(p => p.name.toLowerCase() === e.name.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Select the equipment you have access to. The AI uses this to personalize your workouts.
      </Text>

      {CATEGORIES.map(cat => {
        const presets = PRESET_EQUIPMENT.filter(p => p.category === cat);
        return (
          <View key={cat}>
            <Text style={styles.sectionLabel}>{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.checkGrid}>
              {presets.map(preset => {
                const owned = isOwned(preset.name);
                const isSaving = saving === preset.name;
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={[styles.checkItem, owned && styles.checkItemOwned]}
                    onPress={() => toggle(preset)}
                    activeOpacity={0.7}
                    disabled={!!saving}
                  >
                    {isSaving
                      ? <ActivityIndicator size="small" color={colors.primary} style={styles.checkIcon} />
                      : <Text style={styles.checkIcon}>{owned ? '✓' : '  '}</Text>
                    }
                    <Text style={styles.presetIcon}>{preset.icon}</Text>
                    <Text style={[styles.checkLabel, owned && styles.checkLabelOwned]} numberOfLines={2}>
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Custom Equipment */}
      <Text style={styles.sectionLabel}>CUSTOM EQUIPMENT</Text>
      {customItems.map(item => (
        <View key={item.id} style={styles.customRow}>
          <Text style={styles.customName}>{item.name}</Text>
          <Text style={styles.customCategory}>{item.category || 'other'}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCustom(item)}>
            <Text style={styles.deleteBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add custom form */}
      <View style={styles.addCustomCard}>
        <TextInput
          style={[inputStyle, styles.customInput]}
          value={customName}
          onChangeText={setCustomName}
          placeholder="Equipment name (e.g. Battle Ropes)"
          placeholderTextColor={colors.textTertiary}
        />
        <View style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, customCategory === cat && styles.catChipActive]}
              onPress={() => setCustomCategory(cat)}
            >
              <Text style={[styles.catChipText, customCategory === cat && styles.catChipTextActive]}>
                {CATEGORY_LABELS[cat].split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (!customName.trim() || addingCustom) && { opacity: 0.5 }]}
          onPress={handleAddCustom}
          disabled={!customName.trim() || addingCustom}
        >
          {addingCustom
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.addBtnText}>+ Add Equipment</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },
  intro: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },

  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  checkItem: {
    width: '30%', backgroundColor: colors.bgCard,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, alignItems: 'center', gap: 4,
  },
  checkItemOwned: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  checkIcon: { fontSize: font.sm, color: colors.primary, fontWeight: font.bold, minWidth: 16, textAlign: 'center' },
  presetIcon: { fontSize: 20 },
  checkLabel: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', fontWeight: font.medium },
  checkLabelOwned: { color: colors.textAccent, fontWeight: font.semibold },

  customRow: {
    ...cardStyle, flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.xs, padding: spacing.md,
  },
  customName: { flex: 1, fontSize: font.md, color: colors.textPrimary },
  customCategory: { fontSize: font.xs, color: colors.textTertiary },
  deleteBtn: { backgroundColor: colors.errorMuted, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deleteBtnText: { fontSize: font.xs, color: colors.error, fontWeight: font.semibold },

  addCustomCard: { ...cardStyle, marginTop: spacing.sm },
  customInput: { color: colors.textPrimary, marginBottom: spacing.md },
  catRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radii.full, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  catChipText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold },
  catChipTextActive: { color: colors.textAccent },

  addBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  addBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.sm },
});
