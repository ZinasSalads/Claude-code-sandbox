import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getOnboardingStatus, getPersonalityProfile, getDataSummary } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const modules = [
  { key: 'CheckIn', title: 'Daily Check-In', emoji: '📋', desc: 'Energy, mood, stress & soreness' },
  { key: 'Personality', title: 'Personality Profile', emoji: '🧠', desc: 'MBTI assessment & coaching style' },
  { key: 'Onboarding', title: 'Onboarding & Setup', emoji: '🚀', desc: 'Configure your concierge' },
  { key: 'VoiceCommands', title: 'Voice & Briefings', emoji: '🎙️', desc: 'Morning briefing & commands' },
  { key: 'ContextualIntel', title: 'Contextual Intelligence', emoji: '🧩', desc: 'Signals & anomaly detection' },
  { key: 'HomeEnv', title: 'Home Environment', emoji: '🏠', desc: 'Optimization & correlations' },
  { key: 'Financial', title: 'Financial', emoji: '💳', desc: 'Subscriptions & budget audit' },
  { key: 'DigitalIdentity', title: 'Digital Identity', emoji: '🌐', desc: 'Online brand & presence' },
  { key: 'FinancialPlanning', title: 'Financial Goals', emoji: '💰', desc: 'Goal tracking & stress flags' },
  { key: 'Privacy', title: 'Privacy & Data', emoji: '🔒', desc: 'Export, delete & manage data' },
];

export default function ProfileDashboard({ navigation }: Props) {
  const [onboarding, setOnboarding] = useState<any>(null);
  const [personality, setPersonality] = useState<any>(null);
  const [dataSummary, setDataSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [ob, p, ds] = await Promise.all([
      getOnboardingStatus(),
      getPersonalityProfile(),
      getDataSummary(),
    ]);
    setOnboarding(ob);
    setPersonality(p);
    setDataSummary(ds);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Profile summary card */}
      <TouchableOpacity
        style={styles.summaryCard}
        onPress={() => navigation.navigate('Personality')}
        activeOpacity={0.7}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          {personality?.mbti_type ? (
            <>
              <Text style={styles.mbtiType}>{personality.mbti_type}</Text>
              <Text style={styles.mbtiLabel}>{personality.mbti_label || 'Personality assessed'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.mbtiType}>Not assessed</Text>
              <Text style={styles.mbtiLabel}>Tap to take the personality test</Text>
            </>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Onboarding progress */}
      {onboarding && !onboarding.is_complete && (
        <TouchableOpacity
          style={styles.onboardingCard}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.7}
        >
          <View style={styles.onboardingHeader}>
            <Text style={styles.onboardingTitle}>Setup Progress</Text>
            <Text style={styles.onboardingPct}>{onboarding.completion_percent || 0}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${onboarding.completion_percent || 0}%` }]} />
          </View>
          <Text style={styles.onboardingSub}>
            {onboarding.completed_steps}/{onboarding.total_steps} steps complete
            {onboarding.next_step ? ` · Next: ${onboarding.next_step}` : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Module list */}
      <Text style={styles.sectionTitle}>PROFILE & SETTINGS</Text>
      {modules.map((mod) => (
        <TouchableOpacity
          key={mod.key}
          style={styles.moduleRow}
          onPress={() => navigation.navigate(mod.key)}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle}>{mod.title}</Text>
            <Text style={styles.moduleDesc}>{mod.desc}</Text>
          </View>
          {mod.key === 'Onboarding' && onboarding && !onboarding.is_complete && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>!</Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  summaryCard: {
    ...cardStyle,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28 },
  mbtiType: { color: colors.primary, fontSize: font.xl, fontWeight: font.bold },
  mbtiLabel: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  onboardingCard: {
    ...cardStyle,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  onboardingTitle: { color: colors.textPrimary, fontSize: font.md, fontWeight: font.semibold },
  onboardingPct: { color: colors.primary, fontSize: font.md, fontWeight: font.bold },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  onboardingSub: { color: colors.textSecondary, fontSize: font.xs },
  sectionTitle: {
    ...sectionLabel,
  },
  moduleRow: {
    ...cardStyle,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moduleEmoji: { fontSize: 26, marginRight: spacing.lg },
  moduleTitle: { color: colors.textPrimary, fontSize: font.lg, fontWeight: font.semibold },
  moduleDesc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  badgeText: { color: colors.white, fontSize: font.xs, fontWeight: font.bold },
  chevron: { color: colors.textTertiary, fontSize: 22, fontWeight: '300' },
});
