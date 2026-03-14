import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getTodayHealth, getHealthHistory, getFlaggedBiomarkers, syncOura } from '../lib/api';
import type { HealthData, Biomarker } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    addListener: (event: string, callback: () => void) => () => void;
  };
}

const modules = [
  { key: 'BloodWork', title: 'Blood Work', emoji: '🩸', desc: 'Biomarkers & lab results' },
  { key: 'Supplements', title: 'Supplements', emoji: '💊', desc: 'Stack & daily tracking' },
  { key: 'Longevity', title: 'Longevity', emoji: '🧬', desc: 'Bio age & longevity scores' },
  { key: 'Research', title: 'Research', emoji: '📚', desc: 'Health research & protocols' },
  { key: 'AppleHealth', title: 'Apple Health', emoji: '📱', desc: 'Sync wearable data' },
  { key: 'Skincare', title: 'Skincare', emoji: '✨', desc: 'Routine & skin tracking' },
  { key: 'Environment', title: 'Environment', emoji: '🌍', desc: 'Air quality, UV & pollen' },
];

export default function HealthDashboard({ navigation }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [history, setHistory] = useState<HealthData[]>([]);
  const [flagged, setFlagged] = useState<Biomarker[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [h, hist, f] = await Promise.all([getTodayHealth(), getHealthHistory(), getFlaggedBiomarkers()]);
    setHealth(h);
    setHistory(hist || []);
    setFlagged(f || []);
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
    await syncOura();
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Today's vitals summary */}
      {health && (
        <View style={styles.vitalsCard}>
          <Text style={styles.vitalsTitle}>TODAY'S VITALS</Text>
          <View style={styles.vitalsRow}>
            <VitalPill label="HRV" value={health.hrv != null ? `${health.hrv} ms` : '—'} />
            <VitalPill label="RHR" value={health.resting_heart_rate != null ? `${health.resting_heart_rate} bpm` : '—'} />
            <VitalPill label="Sleep" value={health.sleep_duration != null ? `${health.sleep_duration}h` : '—'} />
          </View>
          <View style={styles.vitalsRow}>
            <VitalPill label="Readiness" value={health.readiness_score != null ? `${health.readiness_score}` : '—'} />
            <VitalPill label="Activity" value={health.activity_score != null ? `${health.activity_score}` : '—'} />
            <VitalPill label="Sleep Score" value={health.sleep_score != null ? `${health.sleep_score}` : '—'} />
          </View>
        </View>
      )}

      {!health && (
        <View style={styles.vitalsCard}>
          <Text style={styles.vitalsTitle}>TODAY'S VITALS</Text>
          <Text style={styles.emptyText}>No health data synced yet. Sync from Apple Health or Oura on the Home tab.</Text>
        </View>
      )}

      {/* Flagged biomarkers alert */}
      {flagged.length > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate('BloodWork')}
          activeOpacity={0.7}
        >
          <Text style={styles.alertEmoji}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{flagged.length} biomarker{flagged.length > 1 ? 's' : ''} flagged</Text>
            <Text style={styles.alertSub}>Tap to review in Blood Work</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Module grid */}
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
          {mod.key === 'BloodWork' && flagged.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{flagged.length}</Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Recent history */}
      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECENT HISTORY</Text>
          {history.slice(0, 7).map((day) => (
            <View key={day.date} style={styles.historyRow}>
              <Text style={styles.historyDate}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <View style={styles.historyStats}>
                <MiniStat label="HRV" value={day.hrv != null ? `${day.hrv}` : '—'} />
                <MiniStat label="Sleep" value={day.sleep_score != null ? `${day.sleep_score}` : '—'} />
                <MiniStat label="Ready" value={day.readiness_score != null ? `${day.readiness_score}` : '—'} />
                <MiniStat label="Active" value={day.activity_score != null ? `${day.activity_score}` : '—'} />
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function VitalPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.vitalPill}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  vitalsCard: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  vitalsTitle: {
    ...sectionLabel,
    marginTop: 0,
    marginBottom: spacing.md,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  vitalPill: {
    flex: 1,
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  vitalLabel: {
    fontSize: font.xs,
    color: colors.textTertiary,
    fontWeight: font.semibold,
    marginBottom: spacing.xs,
  },
  vitalValue: {
    fontSize: font.lg,
    color: colors.textPrimary,
    fontWeight: font.bold,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.md,
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: colors.errorMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
    borderWidth: 1,
    borderColor: colors.errorMuted,
  },
  alertEmoji: { fontSize: 22, marginRight: spacing.md },
  alertTitle: { color: colors.error, fontSize: font.md, fontWeight: font.semibold },
  alertSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
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
    backgroundColor: colors.error,
    borderRadius: radii.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  badgeText: { color: colors.white, fontSize: font.xs, fontWeight: font.bold },
  chevron: { color: colors.textTertiary, fontSize: 22, fontWeight: '300' },
  historyRow: {
    ...cardStyle,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: font.semibold,
    width: 70,
  },
  historyStats: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  miniLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: font.semibold,
    marginBottom: 2,
  },
  miniValue: {
    color: colors.textPrimary,
    fontSize: font.md,
    fontWeight: font.bold,
  },
});
