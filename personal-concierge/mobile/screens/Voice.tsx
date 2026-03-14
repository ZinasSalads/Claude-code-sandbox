import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getMorningBriefing, getEveningWindDown, processVoiceCommand } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

interface BriefingCard {
  key: string;
  title: string;
  emoji: string;
  desc: string;
  sessionType: string;
}

const BRIEFINGS: BriefingCard[] = [
  {
    key: 'morning',
    title: 'Morning Briefing',
    emoji: '☀️',
    desc: 'Get a personalized rundown of your day — schedule, health insights, priorities, and weather.',
    sessionType: 'morning',
  },
  {
    key: 'workout',
    title: 'Pre-Workout Brief',
    emoji: '🏋️',
    desc: 'Your workout plan, energy level assessment, and any adjustments based on today\'s readiness.',
    sessionType: 'workout',
  },
  {
    key: 'evening',
    title: 'Evening Wind-Down',
    emoji: '🌙',
    desc: 'Reflect on your day — what you accomplished, tomorrow\'s preview, and sleep optimization tips.',
    sessionType: 'evening',
  },
];

export default function Voice() {
  const [activeBriefing, setActiveBriefing] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [responseBriefing, setResponseBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBriefing = useCallback(async (briefing: BriefingCard) => {
    setLoading(true);
    setActiveBriefing(briefing.key);
    setResponse(null);
    setResponseBriefing(null);

    let result: any = null;
    if (briefing.key === 'morning') {
      result = await getMorningBriefing();
    } else if (briefing.key === 'evening') {
      result = await getEveningWindDown();
    } else {
      result = await processVoiceCommand('Generate my pre-workout briefing', briefing.sessionType);
    }

    const text = result?.text || result?.response_text || 'Unable to generate briefing right now. Please try again.';
    setResponse(text);
    setResponseBriefing(briefing.key);
    setLoading(false);
    setActiveBriefing(null);
  }, []);

  const dismissResponse = useCallback(() => {
    setResponse(null);
    setResponseBriefing(null);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Briefings</Text>
      <Text style={styles.subtitle}>
        Tap a briefing to get a personalized AI summary based on your latest data.
      </Text>

      {BRIEFINGS.map((briefing) => {
        const isLoading = loading && activeBriefing === briefing.key;
        const showResponse = responseBriefing === briefing.key && response;

        return (
          <View key={briefing.key}>
            <TouchableOpacity
              style={[styles.briefingCard, isLoading && styles.briefingCardLoading]}
              onPress={() => handleBriefing(briefing)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.briefingHeader}>
                <Text style={styles.briefingEmoji}>{briefing.emoji}</Text>
                <View style={styles.briefingInfo}>
                  <Text style={styles.briefingTitle}>{briefing.title}</Text>
                  <Text style={styles.briefingDesc}>{briefing.desc}</Text>
                </View>
              </View>
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Generating...</Text>
                </View>
              ) : (
                <View style={styles.generateRow}>
                  <Text style={styles.generateText}>Generate</Text>
                  <Text style={styles.generateArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>

            {showResponse && (
              <View style={styles.responseCard}>
                <View style={styles.responseHeader}>
                  <Text style={styles.responseTitle}>{briefing.emoji} {briefing.title}</Text>
                  <TouchableOpacity onPress={dismissResponse}>
                    <Text style={styles.dismissBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.responseText}>{response}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Tip</Text>
        <Text style={styles.tipText}>
          For open-ended questions or conversation, use the chat button in the bottom-right corner of any screen.
        </Text>
      </View>

      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: {
    fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: font.sm, color: colors.textSecondary, lineHeight: 20,
    marginBottom: spacing.xl,
  },
  // Briefing cards
  briefingCard: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  briefingCardLoading: {
    borderColor: colors.primaryBorder,
  },
  briefingHeader: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  briefingEmoji: {
    fontSize: 32,
    marginRight: spacing.lg,
    marginTop: 2,
  },
  briefingInfo: {
    flex: 1,
  },
  briefingTitle: {
    fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  briefingDesc: {
    fontSize: font.sm, color: colors.textSecondary, lineHeight: 20,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  generateText: {
    fontSize: font.sm, fontWeight: font.semibold, color: colors.primary,
  },
  generateArrow: {
    fontSize: font.md, color: colors.primary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  loadingText: {
    fontSize: font.sm, color: colors.textTertiary,
  },
  // Response
  responseCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  responseTitle: {
    fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary,
  },
  dismissBtn: {
    fontSize: font.md, color: colors.textTertiary, padding: spacing.xs,
  },
  responseText: {
    fontSize: font.sm, color: colors.textAccent, lineHeight: 22,
  },
  // Tip
  tipCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tipTitle: {
    fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tipText: {
    fontSize: font.sm, color: colors.textTertiary, lineHeight: 20,
  },
});
