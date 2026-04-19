import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { getOnboardingStatus, getStepContent, completeOnboardingStep, skipOnboardingStep, getAllOnboardingSteps } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

export default function Onboarding({ navigation }: any) {
  const [status, setStatus] = useState<any>(null);
  const [step, setStep] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allSteps, setAllSteps] = useState<any[]>([]);
  const [isRedoing, setIsRedoing] = useState(false);

  const loadStatus = useCallback(async () => {
    const s = await getOnboardingStatus();
    setStatus(s);
    if (s && s.next_step && !s.is_complete) {
      const content = await getStepContent(s.next_step);
      setStep(content);
      setFormData({});
    } else {
      setStep(null);
      const steps = await getAllOnboardingSteps();
      setAllSteps(steps);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  const handleComplete = async () => {
    if (!step) return;
    setSubmitting(true);
    const result = await completeOnboardingStep(step.step_name, formData);
    if (!result || result.error) {
      Alert.alert('Error', result?.error || 'Failed to save. Check your connection and try again.');
      setSubmitting(false);
      return;
    }
    setFormData({});
    await loadStatus();
    setSubmitting(false);
  };

  const handleSkip = async () => {
    if (!step) return;
    setSubmitting(true);
    const result = await skipOnboardingStep(step.step_name);
    if (!result || result.error) {
      Alert.alert('Error', result?.error || 'Failed to skip. Check your connection and try again.');
      setSubmitting(false);
      return;
    }
    setFormData({});
    await loadStatus();
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleRedoStep = async (stepName: string) => {
    const content = await getStepContent(stepName);
    if (content) {
      setStep(content);
      setFormData({});
      setIsRedoing(true);
    }
  };

  const handleBackFromStep = useCallback(() => {
    setStep(null);
    setIsRedoing(false);
    setFormData({});
    // Reload to reflect any changes
    loadStatus();
  }, [loadStatus]);

  // Override native back button when re-doing a step to go back to step list
  useLayoutEffect(() => {
    if (isRedoing) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={handleBackFromStep} style={{ marginLeft: 4, padding: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Setup</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerLeft: undefined });
    }
  }, [isRedoing, navigation, handleBackFromStep]);

  if (!isRedoing && (!status || status.is_complete)) {
    const displaySteps = allSteps.filter(s => s.step_name !== 'welcome' && s.step_name !== 'complete');
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.bigTitle}>Setup Complete</Text>
        <Text style={styles.subtitle}>Tap any step to review or update</Text>

        {displaySteps.map((s: any) => (
          <TouchableOpacity
            key={s.step_name}
            style={styles.stepRow}
            onPress={() => handleRedoStep(s.step_name)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepIcon}>{s.completed ? '✓' : s.skipped ? '—' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepStatus}>
                {s.completed ? 'Completed' : s.skipped ? 'Skipped' : 'Not started'}
              </Text>
            </View>
            <Text style={styles.stepChevron}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation?.getParent?.()?.navigate('Today')}>
          <Text style={styles.primaryBtnText}>Go to Command Center</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const progress = status.completion_percent || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {isRedoing
          ? `Editing: ${step?.title || 'Step'}`
          : `Step ${Math.min((status.completed_steps || 0) + 1, status.total_steps || 1)} of ${status.total_steps} — ${Math.round(progress)}% complete`
        }
      </Text>

      {step && (
        <>
          <Text style={styles.bigTitle}>{step.title}</Text>
          <Text style={styles.desc}>{step.description}</Text>

          {/* Render fields */}
          {(step.fields || []).map((field: any, idx: number) => {
            if (field.type === 'number') {
              return (
                <View key={idx} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textTertiary}
                    placeholder={field.label}
                    value={formData[field.key]?.toString() || ''}
                    onChangeText={v => setFormData(prev => ({ ...prev, [field.key]: parseInt(v) || 0 }))}
                  />
                </View>
              );
            }
            if (field.type === 'text' || field.type === 'textarea') {
              return (
                <View key={idx} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.type === 'textarea' && styles.textArea]}
                    multiline={field.type === 'textarea'}
                    numberOfLines={field.type === 'textarea' ? 4 : 1}
                    placeholderTextColor={colors.textTertiary}
                    placeholder={field.label}
                    value={formData[field.key] || ''}
                    onChangeText={v => setFormData(prev => ({ ...prev, [field.key]: v }))}
                  />
                </View>
              );
            }
            if (field.type === 'select') {
              return (
                <View key={idx} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.optionsRow}>
                    {(field.options || []).map((opt: string) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, formData[field.key] === opt && styles.chipSelected]}
                        onPress={() => setFormData(prev => ({ ...prev, [field.key]: opt }))}
                      >
                        <Text style={[styles.chipText, formData[field.key] === opt && styles.chipTextSelected]}>
                          {opt.replace(/_/g, ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            }
            if (field.type === 'multiselect') {
              const selected: string[] = formData[field.key] || [];
              return (
                <View key={idx} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.optionsRow}>
                    {(field.options || []).map((opt: string) => {
                      const isOn = selected.includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.chip, isOn && styles.chipSelected]}
                          onPress={() => {
                            const next = isOn ? selected.filter(s => s !== opt) : [...selected, opt];
                            setFormData(prev => ({ ...prev, [field.key]: next }));
                          }}
                        >
                          <Text style={[styles.chipText, isOn && styles.chipTextSelected]}>
                            {opt.replace(/_/g, ' ')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            }
            if (field.type === 'action') {
              // Only map to screens within the Profile stack
              const actionScreens: Record<string, string> = {
                personality: 'Personality',
              };
              const targetScreen = step?.step_name ? actionScreens[step.step_name] : null;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.actionBtn}
                  onPress={() => targetScreen && navigation?.navigate?.(targetScreen)}
                  disabled={!targetScreen}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionBtnText}>{field.label}</Text>
                  {targetScreen && <Text style={styles.actionChevron}>›</Text>}
                </TouchableOpacity>
              );
            }
            return null;
          })}

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={handleComplete}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step.step_name === 'complete' ? 'Finish Setup' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>

          {step.skip_allowed && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={submitting}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  bigTitle: { fontSize: font['3xl'], fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  subtitle: { fontSize: font.lg, color: colors.textSecondary, marginBottom: spacing['2xl'] },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  desc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.success, borderRadius: 2 },
  progressText: { color: colors.textSecondary, fontSize: font.xs, marginBottom: spacing['2xl'] },
  fieldRow: { marginBottom: spacing.xl },
  fieldLabel: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.sm, padding: spacing.lg, color: colors.textPrimary, fontSize: font.md,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.bgCard, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { fontSize: font.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextSelected: { color: colors.textPrimary },
  actionBtn: {
    backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: spacing.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.primary,
  },
  actionBtnText: { color: colors.textAccent, fontSize: font.md, fontWeight: font.semibold },
  actionChevron: { color: colors.textAccent, fontSize: 22, fontWeight: '300' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm, ...shadow.glow },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  skipBtn: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.sm },
  skipBtnText: { color: colors.textSecondary, fontSize: font.sm },
  stepRow: {
    ...cardStyle, flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.sm, gap: spacing.md,
  },
  stepIcon: { fontSize: font.lg, color: colors.success, width: 24, textAlign: 'center' },
  stepTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  stepStatus: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  stepChevron: { color: colors.textTertiary, fontSize: 22, fontWeight: '300' },
});
