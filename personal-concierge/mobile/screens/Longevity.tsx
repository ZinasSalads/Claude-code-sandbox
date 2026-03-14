import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

interface LongevityData {
  chronological_age?: number;
  biological_age_estimate?: number;
  biological_age_delta?: number;
  overall_longevity_score?: number;
  hrv_score?: number;
  rhr_score?: number;
  sleep_quality_score?: number;
  cardiovascular_score?: number;
  metabolic_score?: number;
  recovery_score?: number;
  trend_direction?: string;
  key_insights?: string[];
  recommendations?: string[];
  overall_assessment?: string;
  calculated_date?: string;
}

function ScoreRing({ score, label, size = 60 }: { score?: number | null; label: string; size?: number }) {
  const displayScore = score != null ? Math.round(score) : '—';
  const color = score != null
    ? getScoreColor(score)
    : colors.textTertiary;

  return (
    <View style={ringStyles.container}>
      <View style={[ringStyles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
        <Text style={[ringStyles.value, { color }]}>{displayScore}</Text>
      </View>
      <Text style={ringStyles.label}>{label}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  ring: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: font.xl, fontWeight: font.bold },
  label: { color: colors.textSecondary, fontSize: font.xs, marginTop: spacing.sm, textAlign: 'center' },
});

export default function Longevity() {
  const [data, setData] = useState<LongevityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/longevity/latest`);
      if (resp.ok) setData(await resp.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCalculate = useCallback(async () => {
    setCalculating(true);
    try {
      const resp = await fetch(`${API_URL}/longevity/calculate`, { method: 'POST' });
      if (resp.ok) setData(await resp.json());
    } catch { /* ignore */ }
    setCalculating(false);
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!data || data.overall_longevity_score == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No longevity data yet.</Text>
        <TouchableOpacity style={styles.calcButton} onPress={handleCalculate} disabled={calculating}>
          {calculating ? <ActivityIndicator color="#fff" /> : <Text style={styles.calcText}>Calculate Now</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  const deltaColor = (data.biological_age_delta ?? 0) < 0 ? colors.success : colors.error;
  const deltaPrefix = (data.biological_age_delta ?? 0) < 0 ? '' : '+';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Bio Age Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>BIOLOGICAL AGE</Text>
        <Text style={styles.heroValue}>{data.biological_age_estimate?.toFixed(1) ?? '—'}</Text>
        {data.biological_age_delta != null && (
          <Text style={[styles.heroDelta, { color: deltaColor }]}>
            {deltaPrefix}{data.biological_age_delta.toFixed(1)} years vs chronological ({data.chronological_age})
          </Text>
        )}
      </View>

      {/* Overall Score */}
      <View style={styles.overallCard}>
        <ScoreRing score={data.overall_longevity_score} label="Overall" size={80} />
        <View style={styles.trendBadge}>
          <Text style={styles.trendText}>{data.trend_direction?.toUpperCase() || 'STABLE'}</Text>
        </View>
      </View>

      {/* Component Scores */}
      <Text style={styles.sectionTitle}>COMPONENT SCORES</Text>
      <View style={styles.scoresGrid}>
        <ScoreRing score={data.hrv_score} label="HRV" />
        <ScoreRing score={data.rhr_score} label="RHR" />
        <ScoreRing score={data.sleep_quality_score} label="Sleep" />
        <ScoreRing score={data.cardiovascular_score} label="Cardio" />
        <ScoreRing score={data.metabolic_score} label="Metabolic" />
        <ScoreRing score={data.recovery_score} label="Recovery" />
      </View>

      {/* Insights */}
      {data.key_insights && data.key_insights.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>KEY INSIGHTS</Text>
          <View style={styles.insightCard}>
            {data.key_insights.map((insight, i) => (
              <Text key={i} style={styles.insightText}>• {insight}</Text>
            ))}
          </View>
        </>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          <View style={styles.insightCard}>
            {data.recommendations.map((rec, i) => (
              <Text key={i} style={styles.recText}>{i + 1}. {rec}</Text>
            ))}
          </View>
        </>
      )}

      {/* Assessment */}
      {data.overall_assessment && (
        <View style={[styles.insightCard, { borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
          <Text style={styles.assessmentText}>{data.overall_assessment}</Text>
        </View>
      )}

      {/* Recalculate */}
      <TouchableOpacity style={styles.recalcButton} onPress={handleCalculate} disabled={calculating}>
        {calculating ? <ActivityIndicator color="#fff" /> : <Text style={styles.recalcText}>Recalculate</Text>}
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['5xl'], backgroundColor: colors.bg },
  empty: { color: colors.textSecondary, fontSize: font.lg },
  heroCard: {
    ...cardStyle,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.elevated,
  },
  heroLabel: { ...sectionLabel, marginTop: 0, marginBottom: 0 },
  heroValue: { color: colors.primary, fontSize: font['4xl'], fontWeight: font.bold, marginVertical: spacing.sm },
  heroDelta: { fontSize: font.md, fontWeight: font.semibold },
  overallCard: {
    ...cardStyle,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trendBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted,
  },
  trendText: { color: colors.textAccent, fontSize: font.sm, fontWeight: font.bold, letterSpacing: 0.5 },
  sectionTitle: {
    ...sectionLabel,
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    ...cardStyle,
    padding: spacing.xl,
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  insightCard: {
    ...cardStyle,
    marginBottom: spacing.sm,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: font.md,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  recText: {
    color: colors.textPrimary,
    fontSize: font.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  assessmentText: {
    color: colors.textPrimary,
    fontSize: font.md,
    lineHeight: 22,
  },
  calcButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    marginTop: spacing.lg,
    ...shadow.glow,
  },
  calcText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  recalcButton: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  recalcText: { color: colors.textAccent, fontSize: font.md, fontWeight: font.semibold },
});
