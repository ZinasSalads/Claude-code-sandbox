import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import {
  getFitnessGoals, createFitnessGoal, updateFitnessGoal,
} from '../lib/api';
import type { FitnessGoal } from '../lib/api';
import { colors, spacing, radii, font, cardStyle, sectionLabel, inputStyle, buttonPrimary, buttonPrimaryText } from '../theme';

const GOAL_TYPES = [
  { key: 'half_marathon', label: 'Half Marathon', icon: '🏅' },
  { key: 'marathon', label: 'Marathon', icon: '🏆' },
  { key: 'run_5k', label: '5K Run', icon: '🏃' },
  { key: 'run_10k', label: '10K Run', icon: '🎽' },
  { key: 'muscle_growth', label: 'Build Muscle', icon: '💪' },
  { key: 'weight_loss', label: 'Lose Weight', icon: '⚖️' },
  { key: 'general_fitness', label: 'General Fitness', icon: '🌟' },
  { key: 'strength', label: 'Get Stronger', icon: '🏋️' },
];

const VERDICT_COLOR: Record<string, string> = {
  realistic: '#22c55e',
  ambitious: '#f97316',
  very_ambitious: '#ef4444',
  unrealistic: '#dc2626',
  unknown: '#6b7280',
};

const VERDICT_LABEL: Record<string, string> = {
  realistic: 'Realistic',
  ambitious: 'Ambitious',
  very_ambitious: 'Very Ambitious',
  unrealistic: 'Unrealistic',
  unknown: 'Assessing…',
};

interface Props {
  navigation: {
    goBack: () => void;
    addListener: (event: string, callback: () => void) => () => void;
  };
  route?: { params?: { goalId?: string } };
}

export default function FitnessGoal({ navigation, route }: Props) {
  const editingGoalId = route?.params?.goalId;
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [goalType, setGoalType] = useState('');
  const [targetDescription, setTargetDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [baseline, setBaseline] = useState('');
  const [priority, setPriority] = useState<'primary' | 'secondary'>('primary');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState<FitnessGoal | null>(null);

  const load = useCallback(async () => {
    const g = await getFitnessGoals().catch(() => []);
    setGoals(g);
    if (editingGoalId) {
      const found = g.find(x => x.id === editingGoalId);
      if (found) {
        setEditingGoal(found);
        setGoalType(found.goal_type);
        setTargetDescription(found.target_description);
        setTargetDate(found.target_date || '');
        setBaseline(found.baseline_description || '');
        setPriority(found.priority as 'primary' | 'secondary');
      }
    }
    setLoading(false);
  }, [editingGoalId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!goalType) { Alert.alert('Select a goal type'); return; }
    if (!targetDescription.trim()) { Alert.alert('Describe your goal'); return; }
    setSaving(true);
    try {
      const payload = {
        goal_type: goalType,
        target_description: targetDescription.trim(),
        target_date: targetDate || undefined,
        baseline_description: baseline.trim() || undefined,
        priority,
      };
      if (editingGoal) {
        await updateFitnessGoal(editingGoal.id, payload);
        Alert.alert('Goal updated!', '', [{ text: 'Done', onPress: () => navigation.goBack() }]);
      } else {
        await createFitnessGoal(payload);
        Alert.alert('Goal set!', 'AI is assessing feasibility in the background.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (goal: FitnessGoal) => {
    Alert.alert('Archive Goal', 'Mark this goal as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          await updateFitnessGoal(goal.id, { status: 'completed' }).catch(() => null);
          load();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Existing Goals */}
      {goals.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>YOUR GOALS</Text>
          {goals.map(g => (
            <View key={g.id} style={styles.existingCard}>
              <View style={styles.existingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.existingTarget}>{g.target_description}</Text>
                  {g.target_date && (
                    <Text style={styles.existingMeta}>
                      Target: {new Date(g.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleArchive(g)} style={styles.archiveBtn}>
                  <Text style={styles.archiveBtnText}>Archive</Text>
                </TouchableOpacity>
              </View>

              {g.ai_feasibility && (
                <View style={styles.feasibilityBox}>
                  <View style={styles.feasibilityHeader}>
                    <View style={[styles.verdictBadge, { backgroundColor: (VERDICT_COLOR[g.ai_feasibility.verdict] || '#6b7280') + '20' }]}>
                      <Text style={[styles.verdictText, { color: VERDICT_COLOR[g.ai_feasibility.verdict] || '#6b7280' }]}>
                        {VERDICT_LABEL[g.ai_feasibility.verdict] || g.ai_feasibility.verdict}
                      </Text>
                    </View>
                    {g.ai_feasibility.timeline_weeks_needed != null && (
                      <Text style={styles.feasibilityTimeline}>{g.ai_feasibility.timeline_weeks_needed} wks needed</Text>
                    )}
                  </View>
                  {g.ai_feasibility.summary && (
                    <Text style={styles.feasibilitySummary}>{g.ai_feasibility.summary}</Text>
                  )}
                  {(g.ai_feasibility as any).roadmap && (
                    <View style={styles.roadmapBox}>
                      <Text style={styles.roadmapLabel}>ROADMAP</Text>
                      <Text style={styles.roadmapText}>{(g.ai_feasibility as any).roadmap}</Text>
                    </View>
                  )}
                  {g.ai_feasibility.phases?.length > 0 && (
                    <View style={styles.phaseList}>
                      {g.ai_feasibility.phases.map((p: string, i: number) => (
                        <View key={i} style={styles.phaseItem}>
                          <View style={styles.phaseNum}><Text style={styles.phaseNumText}>{i + 1}</Text></View>
                          <Text style={styles.phaseItemText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {g.ai_feasibility.conditions?.length > 0 && (
                    <View style={styles.conditionsList}>
                      <Text style={styles.conditionsTitle}>Key conditions</Text>
                      {g.ai_feasibility.conditions.slice(0, 4).map((c: string, i: number) => (
                        <Text key={i} style={styles.conditionItem}>• {c}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* Add / Edit Form */}
      <Text style={styles.sectionLabel}>{editingGoal ? 'EDIT GOAL' : 'NEW GOAL'}</Text>

      <Text style={styles.fieldLabel}>Goal Type</Text>
      <View style={styles.chipGrid}>
        {GOAL_TYPES.map(gt => (
          <TouchableOpacity
            key={gt.key}
            style={[styles.chip, goalType === gt.key && styles.chipActive]}
            onPress={() => setGoalType(gt.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipIcon}>{gt.icon}</Text>
            <Text style={[styles.chipLabel, goalType === gt.key && styles.chipLabelActive]}>{gt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Describe your goal</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={targetDescription}
        onChangeText={setTargetDescription}
        placeholder="e.g. Run a sub-2 hour half marathon in September"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={2}
      />

      <Text style={styles.fieldLabel}>Target Date (optional)</Text>
      <TextInput
        style={styles.input}
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textTertiary}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.fieldLabel}>Current fitness baseline (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={baseline}
        onChangeText={setBaseline}
        placeholder="e.g. Currently running 25km/week, last HM in 2:20"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={2}
      />

      <Text style={styles.fieldLabel}>Priority</Text>
      <View style={styles.priorityRow}>
        {(['primary', 'secondary'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.priorityBtnText, priority === p && styles.priorityBtnTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[buttonPrimary, styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.white} />
          : <Text style={buttonPrimaryText}>{editingGoal ? 'Update Goal' : 'Set Goal & Assess'}</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionLabel: { ...sectionLabel },
  fieldLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.md },

  existingCard: { ...cardStyle, marginBottom: spacing.md },
  existingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  existingTarget: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 2 },
  existingMeta: { fontSize: font.xs, color: colors.textSecondary },
  archiveBtn: { backgroundColor: colors.bgElevated, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  archiveBtnText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold },

  feasibilityBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  feasibilityHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  verdictBadge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  verdictText: { fontSize: font.xs, fontWeight: font.bold },
  feasibilityTimeline: { fontSize: font.xs, color: colors.textSecondary },
  feasibilitySummary: { fontSize: font.sm, color: colors.textPrimary, lineHeight: 20, marginBottom: spacing.md },
  roadmapBox: { backgroundColor: colors.primaryGlow, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primaryBorder },
  roadmapLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textAccent, letterSpacing: 0.5, marginBottom: spacing.xs },
  roadmapText: { fontSize: font.sm, color: colors.textPrimary, lineHeight: 20 },
  phaseList: { gap: spacing.sm, marginBottom: spacing.md },
  phaseItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  phaseNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  phaseNumText: { fontSize: font.xs, fontWeight: font.bold, color: colors.textAccent },
  phaseItemText: { flex: 1, fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },
  conditionsList: { gap: 3, marginBottom: spacing.sm },
  conditionsTitle: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 0.5, marginBottom: spacing.xs },
  conditionItem: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.bgCard, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipIcon: { fontSize: 14 },
  chipLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.medium },
  chipLabelActive: { color: colors.textAccent, fontWeight: font.semibold },

  input: { ...inputStyle, marginBottom: spacing.sm },
  inputMulti: { height: 72, textAlignVertical: 'top', paddingTop: spacing.md },

  priorityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  priorityBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radii.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  priorityBtnActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  priorityBtnText: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textSecondary },
  priorityBtnTextActive: { color: colors.textAccent },

  saveBtn: { marginTop: spacing.lg },
});
