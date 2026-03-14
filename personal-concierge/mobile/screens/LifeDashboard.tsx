import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    addListener: (event: string, callback: () => void) => () => void;
  };
}

const modules = [
  { key: 'Social', title: 'Social Health', emoji: '👥', desc: 'Connections & social score' },
  { key: 'Relationships', title: 'Relationships', emoji: '❤️', desc: 'Relationship health & coaching' },
  { key: 'Growth', title: '1% Growth', emoji: '📈', desc: 'Habits & compound score' },
  { key: 'Career', title: 'Career', emoji: '💼', desc: 'Profile, burnout & coaching' },
  { key: 'Travel', title: 'Travel', emoji: '✈️', desc: 'Trips & pre-trip planning' },
  { key: 'Wardrobe', title: 'Wardrobe', emoji: '👔', desc: 'Items & outfit suggestions' },
  { key: 'Hobbies', title: 'Hobbies', emoji: '🎯', desc: 'Activities & hobby health' },
  { key: 'Learning', title: 'Learning', emoji: '📖', desc: 'Books, courses & sessions' },
  { key: 'Legacy', title: 'Legacy & Vision', emoji: '🏛️', desc: 'Values, milestones & drift' },
  { key: 'Reviews', title: 'Weekly Reviews', emoji: '📊', desc: 'Progress summaries & trends' },
];

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export default function LifeDashboard({ navigation }: Props) {
  const [socialScore, setSocialScore] = useState<number | null>(null);
  const [growthScore, setGrowthScore] = useState<number | null>(null);
  const [growthStreak, setGrowthStreak] = useState<number>(0);
  const [overdueContacts, setOverdueContacts] = useState<number>(0);
  const [activeTrips, setActiveTrips] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [social, growth, contacts, trips] = await Promise.all([
      fetchJson<any>('/social/score'),
      fetchJson<any>('/growth/compound-score'),
      fetchJson<any[]>('/social/overdue'),
      fetchJson<any[]>('/travel/trips'),
    ]);
    if (social?.overall_score != null) setSocialScore(Math.round(social.overall_score));
    if (growth?.compound_score != null) setGrowthScore(Math.round(growth.compound_score));
    if (growth?.current_streak != null) setGrowthStreak(growth.current_streak);
    if (Array.isArray(contacts)) setOverdueContacts(contacts.length);
    if (Array.isArray(trips)) setActiveTrips(trips.filter((t: any) => t.status === 'active').length);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [load, navigation]);

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
      <Text style={styles.pageTitle}>Life</Text>
      <Text style={styles.pageSubtitle}>All aspects of your lifestyle in one place</Text>

      {/* Live pulse cards */}
      <View style={styles.pulseRow}>
        <TouchableOpacity style={styles.pulseCard} onPress={() => navigation.navigate('Social')} activeOpacity={0.7}>
          <Text style={styles.pulseLabel}>Social</Text>
          <Text style={[styles.pulseValue, socialScore != null && { color: getScoreColor(socialScore) }]}>
            {socialScore != null ? socialScore : '—'}
          </Text>
          {overdueContacts > 0 && (
            <Text style={styles.pulseAlert}>{overdueContacts} overdue</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.pulseCard} onPress={() => navigation.navigate('Growth')} activeOpacity={0.7}>
          <Text style={styles.pulseLabel}>Growth</Text>
          <Text style={[styles.pulseValue, growthScore != null && { color: getScoreColor(growthScore) }]}>
            {growthScore != null ? growthScore : '—'}
          </Text>
          {growthStreak > 0 && (
            <Text style={styles.pulseStreak}>{growthStreak}d streak</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.pulseCard} onPress={() => navigation.navigate('Travel')} activeOpacity={0.7}>
          <Text style={styles.pulseLabel}>Trips</Text>
          <Text style={styles.pulseValue}>{activeTrips}</Text>
          <Text style={styles.pulseSub}>active</Text>
        </TouchableOpacity>
      </View>

      {/* Module list */}
      <Text style={styles.sectionTitle}>MODULES</Text>
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
          {mod.key === 'Social' && overdueContacts > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{overdueContacts}</Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  pageTitle: {
    fontSize: font['3xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  pageSubtitle: {
    fontSize: font.sm,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  sectionTitle: { ...sectionLabel },
  // Pulse cards row
  pulseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pulseCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  pulseLabel: {
    fontSize: font.xs,
    color: colors.textTertiary,
    fontWeight: font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  pulseValue: {
    fontSize: font['2xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
  },
  pulseAlert: {
    fontSize: font.xs,
    color: colors.warning,
    fontWeight: font.medium,
    marginTop: 2,
  },
  pulseStreak: {
    fontSize: font.xs,
    color: colors.success,
    fontWeight: font.medium,
    marginTop: 2,
  },
  pulseSub: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // Module rows
  moduleRow: {
    ...cardStyle,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moduleEmoji: { fontSize: 26, marginRight: spacing.lg },
  moduleTitle: { color: colors.textPrimary, fontSize: font.lg, fontWeight: font.semibold },
  moduleDesc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  chevron: { color: colors.textTertiary, fontSize: 22, fontWeight: font.normal },
  badge: {
    backgroundColor: colors.warning,
    borderRadius: radii.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  badgeText: { color: colors.black, fontSize: font.xs, fontWeight: font.bold },
});
