import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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
    ? score >= 75 ? '#4CAF50' : score >= 50 ? '#FFC107' : '#F44336'
    : 'rgba(255,255,255,0.2)';

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
  value: { fontSize: 18, fontWeight: '700' },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6, textAlign: 'center' },
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
    return <View style={styles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;
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

  const deltaColor = (data.biological_age_delta ?? 0) < 0 ? '#4CAF50' : '#F44336';
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
        <View style={[styles.insightCard, { borderLeftWidth: 3, borderLeftColor: '#6C63FF' }]}>
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#0D0D1A' },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  heroCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  heroValue: { color: '#6C63FF', fontSize: 52, fontWeight: '700', marginVertical: 8 },
  heroDelta: { fontSize: 14, fontWeight: '600' },
  overallCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  trendBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  trendText: { color: '#6C63FF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 16,
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 20,
    gap: 16,
    marginBottom: 8,
  },
  insightCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  insightText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  recText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  assessmentText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  calcButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 16,
  },
  calcText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  recalcButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
  },
  recalcText: { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
});
