import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getHomeProfile, updateHomeProfile, getHomeRecommendations,
  generateHomeRecommendations, completeHomeRecommendation,
  getHomeCorrelations,
} from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

const EFFORT_COLORS: Record<string, string> = {
  quick_win: colors.success,
  moderate: colors.warning,
  investment: colors.error,
};

export default function HomeEnvironment() {
  const [profile, setProfile] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [completedRecs, setCompletedRecs] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [p, r, cr, corr] = await Promise.all([
      getHomeProfile(),
      getHomeRecommendations(false),
      getHomeRecommendations(true),
      getHomeCorrelations(),
    ]);
    if (p) setProfile(p);
    if (Array.isArray(r)) setRecs(r);
    if (Array.isArray(cr)) setCompletedRecs(cr);
    if (Array.isArray(corr)) setCorrelations(corr);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleField = async (field: string, value: boolean) => {
    await updateHomeProfile({ [field]: value });
    setProfile((p: any) => ({ ...p, [field]: value }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await generateHomeRecommendations();
    const r = await getHomeRecommendations(false);
    if (Array.isArray(r)) setRecs(r);
    setGenerating(false);
  };

  const handleComplete = async (id: string) => {
    await completeHomeRecommendation(id);
    await load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const totalRecs = recs.length + completedRecs.length;
  const completionPct = totalRecs > 0 ? Math.round((completedRecs.length / totalRecs) * 100) : 0;

  const boolFields = [
    { key: 'bedroom_blackout', label: 'Blackout curtains' },
    { key: 'morning_light_access', label: 'Morning light access' },
    { key: 'has_air_purifier', label: 'Air purifier' },
    { key: 'indoor_plants', label: 'Indoor plants' },
    { key: 'white_noise_device', label: 'White noise device' },
    { key: 'standing_desk', label: 'Standing desk' },
    { key: 'ergonomic_chair', label: 'Ergonomic chair' },
    { key: 'monitor_at_eye_level', label: 'Monitor at eye level' },
    { key: 'has_smart_lights', label: 'Smart lights' },
    { key: 'blue_light_filter_device', label: 'Blue light filter' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Home Environment</Text>
      <Text style={styles.subtitle}>Your home as a health variable</Text>

      {/* Progress */}
      {totalRecs > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Optimization Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
          </View>
          <Text style={styles.progressText}>{completedRecs.length} of {totalRecs} recommendations completed ({completionPct}%)</Text>
        </View>
      )}

      {/* Correlations */}
      {correlations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Correlations</Text>
          {correlations.map((c, i) => (
            <Text key={i} style={styles.corrText}>{c.observation}</Text>
          ))}
        </View>
      )}

      {/* Profile Setup */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Setup</Text>
        {boolFields.map(f => (
          <View key={f.key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{f.label}</Text>
            <Switch
              value={profile?.[f.key] || false}
              onValueChange={v => toggleField(f.key, v)}
              trackColor={{ false: colors.border, true: colors.primaryBorder }}
              thumbColor={profile?.[f.key] ? colors.primary : colors.textTertiary}
            />
          </View>
        ))}
      </View>

      {/* Recommendations */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          <TouchableOpacity onPress={handleGenerate} disabled={generating}>
            <Text style={styles.editBtn}>{generating ? 'Generating...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        {recs.length > 0 ? recs.map((r, i) => (
          <View key={r.id || i} style={styles.recRow}>
            <View style={styles.recContent}>
              <View style={styles.recBadges}>
                <Text style={[styles.badge, { backgroundColor: EFFORT_COLORS[r.effort] || colors.textTertiary }]}>
                  {(r.effort || '').replace('_', ' ')}
                </Text>
                <Text style={styles.priorityText}>{r.priority} priority</Text>
              </View>
              <Text style={styles.recText}>{r.recommendation}</Text>
              {r.estimated_impact && <Text style={styles.impactText}>{r.estimated_impact}</Text>}
            </View>
            <TouchableOpacity style={styles.checkBtn} onPress={() => handleComplete(r.id)}>
              <Text style={styles.checkText}>Done</Text>
            </TouchableOpacity>
          </View>
        )) : (
          <Text style={styles.emptyText}>
            Set up your home profile above, then tap Refresh to get recommendations.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: font['3xl'], fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  editBtn: { color: colors.primary, fontSize: font.sm, fontWeight: font.semibold },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: spacing.sm },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { fontSize: font.sm, color: colors.textSecondary },
  corrText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  switchLabel: { fontSize: font.sm, color: colors.textSecondary },
  recRow: {
    flexDirection: 'row', marginBottom: spacing.lg, paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  recContent: { flex: 1 },
  recBadges: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  badge: { fontSize: 10, color: colors.black, fontWeight: font.bold, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, textTransform: 'capitalize', overflow: 'hidden' },
  priorityText: { fontSize: font.xs, color: colors.textTertiary, textTransform: 'capitalize' },
  recText: { fontSize: font.sm, color: colors.textPrimary, lineHeight: 20 },
  impactText: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.xs },
  checkBtn: {
    backgroundColor: colors.successMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md,
    paddingVertical: 6, alignSelf: 'center', marginLeft: spacing.sm,
  },
  checkText: { color: colors.success, fontSize: font.xs, fontWeight: font.semibold },
  emptyText: { fontSize: font.sm, color: colors.textSecondary, fontStyle: 'italic' },
});
