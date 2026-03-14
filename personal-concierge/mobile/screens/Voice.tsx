import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getMorningBriefing, getEveningWindDown, processVoiceCommand } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

const SESSION_TYPES = ['Morning', 'Workout', 'Evening', 'Command'] as const;

export default function Voice() {
  const [sessionType, setSessionType] = useState<string>('Command');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBriefing = useCallback(async () => {
    setLoading(true);
    setResponse('');
    const result = await getMorningBriefing();
    setResponse(result?.text || 'Unable to generate briefing.');
    setLoading(false);
  }, []);

  const handleWindDown = useCallback(async () => {
    setLoading(true);
    setResponse('');
    const result = await getEveningWindDown();
    setResponse(result?.text || 'Unable to generate wind-down.');
    setLoading(false);
  }, []);

  const handleCommand = useCallback(async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setResponse('');
    const result = await processVoiceCommand(transcript, sessionType.toLowerCase());
    setResponse(result?.response_text || 'No response.');
    setLoading(false);
  }, [transcript, sessionType]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Voice Interface</Text>
      <Text style={styles.subtitle}>AI-powered voice commands and briefings</Text>

      <View style={styles.typeRow}>
        {SESSION_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, sessionType === t && styles.typeBtnActive]}
            onPress={() => setSessionType(t)}
          >
            <Text style={[styles.typeBtnText, sessionType === t && styles.typeBtnTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBriefing}>
          <Text style={styles.actionBtnText}>Morning Briefing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={handleWindDown}>
          <Text style={styles.actionBtnText}>Evening Wind-Down</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Text Command</Text>
        <TextInput
          style={styles.input}
          placeholder="Type a command..."
          placeholderTextColor={colors.textTertiary}
          value={transcript}
          onChangeText={setTranscript}
          multiline
        />
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.disabled]}
          onPress={handleCommand}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>{loading ? 'Processing...' : 'Send Command'}</Text>
        </TouchableOpacity>
      </View>

      {response ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Response</Text>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  typeBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: font.sm, fontWeight: font.medium, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.textPrimary },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  actionBtn: {
    backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: spacing.lg,
    alignItems: 'center',
  },
  actionBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, minHeight: 60, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
  disabled: { opacity: 0.5 },
  responseText: { fontSize: font.sm, color: colors.textAccent, lineHeight: 22 },
});
