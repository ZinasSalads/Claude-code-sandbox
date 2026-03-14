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
    return <View style={styles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;
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

  const aqiColor = (data.air_quality_index ?? 0) <= 50 ? '#4CAF50'
    : (data.air_quality_index ?? 0) <= 100 ? '#FFC107' : '#F44336';

  const uvColor = (data.uv_index ?? 0) <= 2 ? '#4CAF50'
    : (data.uv_index ?? 0) <= 5 ? '#FFC107'
    : (data.uv_index ?? 0) <= 7 ? '#FF9800' : '#F44336';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#0D0D1A' },
  location: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  card: { backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 8 },
  weatherText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  tempText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 14, alignItems: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6 },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  metricSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 10, marginTop: 8 },
  recText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 6 },
  updatedText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  retryButton: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#6C63FF', borderRadius: 20 },
  retryText: { color: '#fff', fontWeight: '600' },
});
