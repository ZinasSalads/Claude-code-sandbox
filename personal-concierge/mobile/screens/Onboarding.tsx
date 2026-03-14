import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getOnboardingStatus, getStepContent, completeOnboardingStep, skipOnboardingStep } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

export default function Onboarding({ navigation }: any) {
  const [status, setStatus] = useState<any>(null);
  const [step, setStep] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    const s = await getOnboardingStatus();
    setStatus(s);
    if (s && s.next_step && !s.is_complete) {
      const content = await getStepContent(s.next_step);
      setStep(content);
      setFormData({});
    } else {
      setStep(null);
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
    if (result?.next_step) {
      const content = await getStepContent(result.next_step);
      setStep(content);
      setFormData({});
    }
    const s = await getOnboardingStatus();
    setStatus(s);
    setSubmitting(false);
  };

  const handleSkip = async () => {
    if (!step) return;
    setSubmitting(true);
    const result = await skipOnboardingStep(step.step_name);
    if (result?.next_step) {
      const content = await getStepContent(result.next_step);
      setStep(content);
      setFormData({});
    }
    const s = await getOnboardingStatus();
    setStatus(s);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!status || status.is_complete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.bigTitle}>All Set!</Text>
        <Text style={styles.subtitle}>Your app is fully personalized</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Setup Complete</Text>
          <Text style={styles.desc}>
            Every recommendation is now tailored to your personality, goals, and preferences.
            Explore your Command Center to see what's new today.
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation?.navigate?.('Home')}>
          <Text style={styles.primaryBtnText}>Go to Command Center</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const progress = status.completion_percent || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>
        Step {(status.completed_steps || 0) + 1} of {status.total_steps} — {Math.round(progress)}% complete
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
              return (
                <View key={idx} style={styles.fieldRow}>
                  <Text style={styles.desc}>{field.label} — complete this in the relevant app section.</Text>
                </View>
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
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { fontSize: font.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextSelected: { color: colors.textPrimary },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm, ...shadow.glow },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  skipBtn: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.sm },
  skipBtnText: { color: colors.textSecondary, fontSize: font.sm },
});
