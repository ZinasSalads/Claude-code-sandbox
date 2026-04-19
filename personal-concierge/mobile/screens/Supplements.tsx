import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, inputStyle } from '../theme';

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
}

interface AdherenceStats {
  period_days: number;
  total_logs: number;
  total_taken: number;
  adherence_pct: number;
  current_streak_days: number;
  breakdown: { name: string; adherence_pct: number; taken: number; total: number }[];
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

const TIMINGS = ['morning', 'afternoon', 'evening', 'with_meals', 'bedtime'];

export default function Supplements() {
  const [logs, setLogs] = useState<TodayLog[]>([]);
  const [stack, setStack] = useState<Supplement[]>([]);
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDose, setFormDose] = useState('');
  const [formUnit, setFormUnit] = useState('mg');
  const [formTiming, setFormTiming] = useState('morning');
  const [formPurpose, setFormPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [l, s, st] = await Promise.all([
      fetchApi<TodayLog[]>('/supplements/today'),
      fetchApi<Supplement[]>('/supplements/stack?active_only=false'),
      fetchApi<AdherenceStats>('/supplements/stats'),
    ]);
    setLogs(l || []);
    setStack(s || []);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleTaken = useCallback(async (supplementId: string, taken: boolean) => {
    await fetchApi('/supplements/log', {
      method: 'POST',
      body: JSON.stringify({ supplement_id: supplementId, taken }),
    });
    load();
  }, [load]);

  const markAllTaken = useCallback(async () => {
    const untaken = logs.filter(l => !l.taken);
    if (untaken.length === 0) return;
    await Promise.all(untaken.map(l =>
      fetchApi('/supplements/log', {
        method: 'POST',
        body: JSON.stringify({ supplement_id: l.supplement_id, taken: true }),
      })
    ));
    load();
  }, [logs, load]);

  const resetForm = () => {
    setFormName('');
    setFormDose('');
    setFormUnit('mg');
    setFormTiming('morning');
    setFormPurpose('');
    setEditingSupplement(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (s: Supplement) => {
    setEditingSupplement(s);
    setFormName(s.name);
    setFormDose(s.dose_amount?.toString() || '');
    setFormUnit(s.dose_unit || 'mg');
    setFormTiming(s.timing || 'morning');
    setFormPurpose(s.purpose || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Enter a supplement name'); return; }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      dose_amount: formDose ? parseFloat(formDose) : undefined,
      dose_unit: formUnit,
      timing: formTiming,
      purpose: formPurpose.trim() || undefined,
    };

    let result;
    if (editingSupplement) {
      result = await fetchApi(`/supplements/${editingSupplement.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!result) {
        result = await fetchApi('/supplements/add', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    } else {
      result = await fetchApi('/supplements/add', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    if (result) {
      setShowForm(false);
      resetForm();
      load();
    } else {
      Alert.alert('Error', 'Could not save supplement. Check your connection and try again.');
    }
  };

  const handleDeactivate = (s: Supplement) => {
    Alert.alert('Remove Supplement', `Remove "${s.name}" from your stack?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await fetch(`${API_URL}/supplements/${s.id}`, { method: 'DELETE' });
          load();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  const taken = logs.filter(l => l.taken).length;
  const total = logs.length;
  const activeStack = stack.filter(s => s.active !== false);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Today's Progress */}
        {total > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{taken}/{total} taken today</Text>
              {taken < total && (
                <TouchableOpacity onPress={markAllTaken} style={styles.markAllBtn} activeOpacity={0.7}>
                  <Text style={styles.markAllBtnText}>Mark All Taken</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${total > 0 ? (taken / total) * 100 : 0}%` }]} />
            </View>
          </View>
        )}

        {/* Today's Checklist */}
        {logs.length > 0 ? (
          <>
            {logs.map(l => {
              const supp = stack.find(s => s.id === l.supplement_id);
              return (
                <TouchableOpacity
                  key={l.supplement_id}
                  style={[styles.checkItem, l.taken && styles.checkItemDone]}
                  onPress={() => toggleTaken(l.supplement_id, !l.taken)}
                  onLongPress={() => supp && openEditForm(supp)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, l.taken && styles.checkboxDone]}>
                    {l.taken && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkName, l.taken && styles.checkNameDone]}>{l.name}</Text>
                    <Text style={styles.checkDose}>{l.dose_amount} {l.dose_unit} · {l.timing}</Text>
                  </View>
                  <TouchableOpacity onPress={() => supp && openEditForm(supp)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No supplements in your stack.</Text>
            <Text style={styles.emptyHint}>Tap + to add your first supplement.</Text>
          </View>
        )}

        {/* Stats Summary (inline, not a separate tab) */}
        {stats && stats.total_logs > 0 && (
          <>
            <Text style={styles.sectionLabel}>ADHERENCE</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.adherence_pct}%</Text>
                <Text style={styles.statLabel}>Rate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.current_streak_days}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.period_days}d</Text>
                <Text style={styles.statLabel}>Tracked</Text>
              </View>
            </View>
          </>
        )}

        {/* Full Stack (with edit/remove) */}
        {activeStack.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR STACK</Text>
            {activeStack.map(s => (
              <View key={s.id} style={styles.stackCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stackName}>{s.name}</Text>
                  <Text style={styles.stackDetail}>
                    {s.dose_amount} {s.dose_unit} · {s.timing}
                    {s.purpose ? ` · ${s.purpose}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEditForm(s)} style={styles.stackBtn}>
                  <Text style={styles.stackBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeactivate(s)} style={[styles.stackBtn, styles.stackBtnDanger]}>
                  <Text style={styles.stackBtnDangerText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowForm(false); resetForm(); }}>
        <KeyboardAvoidingView style={styles.modalSheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingSupplement ? 'Edit Supplement' : 'Add Supplement'}</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Vitamin D3"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="next"
            />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Dose</Text>
                <TextInput
                  style={styles.input}
                  value={formDose}
                  onChangeText={setFormDose}
                  placeholder="5000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={formUnit}
                  onChangeText={setFormUnit}
                  placeholder="mg"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="next"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Timing</Text>
            <View style={styles.chipRow}>
              {TIMINGS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, formTiming === t && styles.chipActive]}
                  onPress={() => setFormTiming(t)}
                >
                  <Text style={[styles.chipText, formTiming === t && styles.chipTextActive]}>
                    {t.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Purpose (optional)</Text>
            <TextInput
              style={styles.input}
              value={formPurpose}
              onChangeText={setFormPurpose}
              placeholder="e.g. Bone health"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.saveBtn, (!formName.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!formName.trim() || saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>{editingSupplement ? 'Update' : 'Add to Stack'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  sectionLabel: { ...sectionLabel },

  progressCard: { ...cardStyle, marginBottom: spacing.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  progressText: { color: colors.textPrimary, fontSize: font.lg, fontWeight: font.bold },
  markAllBtn: { backgroundColor: colors.primaryMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.primaryBorder },
  markAllBtnText: { color: colors.textAccent, fontSize: font.sm, fontWeight: font.semibold },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: radii.full },
  progressFill: { height: 6, backgroundColor: colors.success, borderRadius: radii.full },

  checkItem: { ...cardStyle, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  checkItemDone: { opacity: 0.6 },
  checkbox: {
    width: 28, height: 28, borderRadius: radii.full,
    borderWidth: 2, borderColor: colors.textTertiary,
    marginRight: spacing.lg, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: colors.white, fontWeight: font.bold, fontSize: font.md },
  checkName: { color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold },
  checkNameDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  checkDose: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2 },
  editIcon: { fontSize: 14 },

  emptyCard: { ...cardStyle, alignItems: 'center', padding: spacing['2xl'] },
  emptyText: { color: colors.textSecondary, fontSize: font.lg, textAlign: 'center' },
  emptyHint: { color: colors.textTertiary, fontSize: font.sm, textAlign: 'center', marginTop: spacing.sm },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, ...cardStyle, alignItems: 'center', padding: spacing.md },
  statValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.textAccent },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  stackCard: { ...cardStyle, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  stackName: { color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold },
  stackDetail: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2 },
  stackBtn: { backgroundColor: colors.bgElevated, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  stackBtnText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold },
  stackBtnDanger: { backgroundColor: colors.errorMuted },
  stackBtnDangerText: { fontSize: font.lg, color: colors.error, fontWeight: font.bold },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    ...shadow.glow,
  },
  fabText: { color: colors.white, fontSize: 28, fontWeight: font.bold, marginTop: -2 },

  modalSheet: { flex: 1, backgroundColor: colors.bg },
  modalScrollContent: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textTertiary, padding: spacing.sm },

  fieldLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 0.8, marginBottom: spacing.xs, marginTop: spacing.md },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  input: { ...inputStyle, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.sm, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold },
  chipTextActive: { color: colors.textAccent },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl,
    ...shadow.glow,
  },
  saveBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
});
