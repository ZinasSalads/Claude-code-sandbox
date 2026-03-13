import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getOnboardingStatus, getStepContent, completeOnboardingStep, skipOnboardingStep } from '../lib/api';

const ACCENT = '#6C63FF';
const BG = '#0D0D1A';
const CARD = '#1A1A2E';
const GREEN = '#00C48C';

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
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!status || status.is_complete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
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
                    placeholderTextColor="rgba(255,255,255,0.3)"
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
                    placeholderTextColor="rgba(255,255,255,0.3)"
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
              <ActivityIndicator color="#fff" />
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
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  bigTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 20, marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },
  card: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 16 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 8 },
  progressFill: { height: 4, backgroundColor: GREEN, borderRadius: 2 },
  progressText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 24 },
  fieldRow: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 },
  input: {
    backgroundColor: CARD, borderRadius: 10, padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: CARD, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 4,
  },
  chipSelected: { borderColor: ACCENT, backgroundColor: 'rgba(108,99,255,0.2)' },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' },
  chipTextSelected: { color: '#fff' },
  primaryBtn: { backgroundColor: ACCENT, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', padding: 14, marginTop: 8 },
  skipBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
