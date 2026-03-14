import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface EnvData {
  location?: string;
  air_quality_index?: number;
  air_quality_label?: string;
  uv_index?: number;
  uv_label?: string;
  pollen_level?: string;
  temperature_c?: number;
  humidity_pct?: number;
  weather_summary?: string;
  recommendations?: string[];
  last_updated?: string;
}

export default function Environment() {
  const [data, setData] = useState<EnvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const resp = await fetch(`${API_URL}/environment/current`);
      if (resp.ok) {
        setData(await resp.json());
      } else {
        setError('Could not load environment data');
      }
    } catch {
      setError('Could not load environment data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🌍</Text>
        <Text style={styles.emptyTitle}>No environment data</Text>
        <Text style={styles.emptyDesc}>
          Configure your location to get air quality, UV index, pollen, and weather data.
        </Text>
      </View>
    );
  }

  const aqiColor = (data.air_quality_index ?? 0) <= 50 ? colors.success
    : (data.air_quality_index ?? 0) <= 100 ? colors.warning : colors.error;

  const uvColor = (data.uv_index ?? 0) <= 2 ? colors.success
    : (data.uv_index ?? 0) <= 5 ? colors.warning
    : (data.uv_index ?? 0) <= 7 ? colors.scorePoor : colors.error;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {data.location && <Text style={styles.location}>{data.location}</Text>}

      {/* Weather */}
      {data.weather_summary && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>WEATHER</Text>
          <Text style={styles.weatherText}>{data.weather_summary}</Text>
          {data.temperature_c != null && (
            <Text style={styles.tempText}>{data.temperature_c}°C · {data.humidity_pct ?? '—'}% humidity</Text>
          )}
        </View>
      )}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>AQI</Text>
          <Text style={[styles.metricValue, { color: aqiColor }]}>
            {data.air_quality_index ?? '—'}
          </Text>
          <Text style={styles.metricSub}>{data.air_quality_label || ''}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>UV</Text>
          <Text style={[styles.metricValue, { color: uvColor }]}>
            {data.uv_index ?? '—'}
          </Text>
          <Text style={styles.metricSub}>{data.uv_label || ''}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>POLLEN</Text>
          <Text style={styles.metricValue}>{data.pollen_level || '—'}</Text>
        </View>
      </View>

      {/* Recommendations */}
      {(data.recommendations || []).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          <View style={styles.card}>
            {(data.recommendations || []).map((rec, i) => (
              <Text key={i} style={styles.recText}>{i + 1}. {rec}</Text>
            ))}
          </View>
        </>
      )}

      {data.last_updated && (
        <Text style={styles.updatedText}>Last updated: {data.last_updated}</Text>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['5xl'], backgroundColor: colors.bg },
  location: { color: colors.textSecondary, fontSize: font.md, marginBottom: spacing.md, textAlign: 'center' },
  card: { ...cardStyle, marginBottom: spacing.md },
  cardLabel: { ...sectionLabel, marginTop: 0 },
  weatherText: { color: colors.textPrimary, fontSize: font.xl, fontWeight: font.semibold },
  tempText: { color: colors.textSecondary, fontSize: font.md, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  metricLabel: { ...sectionLabel, marginTop: 0, marginBottom: spacing.sm },
  metricValue: { fontSize: 28, fontWeight: font.bold, color: colors.textPrimary },
  metricSub: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },
  sectionTitle: { ...sectionLabel },
  recText: { color: colors.textPrimary, fontSize: font.md, lineHeight: 22, marginBottom: spacing.sm },
  updatedText: { color: colors.textTertiary, fontSize: font.sm, textAlign: 'center', marginTop: spacing.sm },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: font.xl, fontWeight: font.semibold, marginBottom: spacing.sm },
  emptyDesc: { color: colors.textSecondary, fontSize: font.md, textAlign: 'center', lineHeight: 20 },
  errorText: { color: colors.textSecondary, fontSize: font.lg },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md, backgroundColor: colors.accent, borderRadius: radii.full, ...shadow.glow },
  retryText: { color: colors.white, fontWeight: font.semibold },
});
