import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const SYMPTOMS = [
  { id: 'tired', emoji: '😴', label: 'Unusually tired' },
  { id: 'stress', emoji: '😤', label: 'High stress' },
  { id: 'sore', emoji: '💪', label: 'Sore / aching' },
  { id: 'sick', emoji: '🤒', label: 'Feeling sick' },
  { id: 'mood', emoji: '😔', label: 'Low mood' },
  { id: 'fog', emoji: '🧠', label: 'Brain fog' },
  { id: 'other', emoji: '✍️', label: 'Other' },
];

const SEVERITY = ['Mild', 'Moderate', 'Severe'] as const;
type SeverityType = typeof SEVERITY[number];

interface CheckInProps {
  navigation: { goBack: () => void };
}

export default function CheckIn({ navigation }: CheckInProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [severity, setSeverity] = useState<SeverityType>('Moderate');
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = useCallback(async () => {
    if (selected.length === 0) return;
    setSubmitting(true);

    const signalText = [
      ...selected.filter(s => s !== 'other').map(s => SYMPTOMS.find(x => x.id === s)?.label || s),
      ...(selected.includes('other') && otherText.trim() ? [`Other: ${otherText.trim()}`] : []),
    ].join(', ');

    await apiPost('/context/signal', {
      signal_text: `User flagged symptoms (${severity}): ${signalText}`,
    });

    const severityMap: Record<SeverityType, number> = { Mild: 3, Moderate: 6, Severe: 9 };
    const val = 10 - severityMap[severity];
    await apiPost('/checkin', {
      energy: selected.includes('tired') ? severityMap[severity] : 7,
      mood: selected.includes('mood') ? severityMap[severity] : 7,
      stress: selected.includes('stress') ? severityMap[severity] : 3,
      soreness: selected.includes('sore') ? severityMap[severity] : 3,
      notes: signalText,
    });

    const adjustments: string[] = [];
    if (selected.includes('tired') || selected.includes('sick')) adjustments.push("workout adjusted to recovery");
    if (selected.includes('sore')) adjustments.push("high-impact exercises removed");
    if (selected.includes('stress') || selected.includes('fog')) adjustments.push("heavy cognitive tasks de-prioritised");
    if (selected.includes('mood')) adjustments.push("social and positive activities surfaced");

    const fb = adjustments.length > 0
      ? `Noted. ${adjustments.join(', ')}.`
      : "Noted. I'll factor this into today's recommendations.";

    setFeedback(fb);
    setSubmitting(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [selected, severity, otherText, fadeAnim]);

  if (feedback) {
    return (
      <Animated.View style={[styles.feedbackScreen, { opacity: fadeAnim }]}>
        <Text style={styles.feedbackEmoji}>✓</Text>
        <Text style={styles.feedbackTitle}>Got it</Text>
        <Text style={styles.feedbackText}>{feedback}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>What's going on?</Text>
        <Text style={styles.subtitle}>Select all that apply</Text>

        <View style={styles.symptomsGrid}>
          {SYMPTOMS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.symptomChip, selected.includes(s.id) && styles.symptomChipActive]}
              onPress={() => toggle(s.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.symptomEmoji}>{s.emoji}</Text>
              <Text style={[styles.symptomLabel, selected.includes(s.id) && styles.symptomLabelActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selected.includes('other') && (
          <TextInput
            style={styles.otherInput}
            placeholder="Describe what's going on..."
            placeholderTextColor={colors.textTertiary}
            value={otherText}
            onChangeText={setOtherText}
            multiline
            autoFocus
          />
        )}

        <Text style={styles.severityLabel}>How bad is it?</Text>
        <View style={styles.severityRow}>
          {SEVERITY.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.severityBtn, severity === s && styles.severityBtnActive]}
              onPress={() => setSeverity(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.severityText, severity === s && styles.severityTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (selected.length === 0 || submitting) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={selected.length === 0 || submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Saving...' : 'Flag It'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['4xl'] },

  title: { fontSize: font['3xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing['2xl'] },

  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing['2xl'] },
  symptomChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.bgCard, borderRadius: radii.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.border,
  },
  symptomChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  symptomEmoji: { fontSize: 18 },
  symptomLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.medium },
  symptomLabelActive: { color: colors.textAccent },

  otherInput: {
    backgroundColor: colors.bgInput, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, color: colors.textPrimary,
    fontSize: font.md, minHeight: 80, marginBottom: spacing['2xl'],
    textAlignVertical: 'top',
  },

  severityLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: spacing.sm },
  severityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['3xl'] },
  severityBtn: {
    flex: 1, paddingVertical: spacing.md + 2, borderRadius: radii.md,
    alignItems: 'center', backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  severityBtnActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  severityText: { color: colors.textSecondary, fontSize: font.md, fontWeight: font.semibold },
  severityTextActive: { color: colors.textAccent },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radii.lg,
    paddingVertical: 18, alignItems: 'center', ...shadow.glow,
  },
  submitBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },

  feedbackScreen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  feedbackEmoji: { fontSize: 64, color: colors.success, marginBottom: spacing.lg },
  feedbackTitle: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  feedbackText: { fontSize: font.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: spacing['3xl'] },
  doneBtn: { backgroundColor: colors.primary, borderRadius: radii.lg, paddingHorizontal: spacing['4xl'], paddingVertical: spacing.md + 2, ...shadow.glow },
  doneBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.bold },
});
