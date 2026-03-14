import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface EnvData {
  location_name?: string;
  temp_c?: number;
  humidity?: number;
  conditions?: string;
  wind_kph?: number;
  aqi?: number;
  aqi_category?: string;
  pm25?: number;
  pm10?: number;
  uv_index_current?: number;
  uv_index_max?: number;
  uv_risk_level?: string;
  pollen_risk_level?: string;
  pollen_tree?: number;
  pollen_grass?: number;
  pollen_weed?: number;
  outdoor_exercise_safe?: boolean;
  sunscreen_required?: boolean;
  air_quality_notes?: string;
  date?: string;
  error?: string;
}

interface SavedLocation {
  configured: boolean;
  city?: string;
  country?: string;
  admin1?: string;
}

export default function Environment() {
  const [data, setData] = useState<EnvData | null>(null);
  const [location, setLocation] = useState<SavedLocation | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocation = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/environment/location`);
      if (resp.ok) {
        const loc = await resp.json();
        setLocation(loc);
        return loc.configured;
      }
    } catch {}
    return false;
  }, []);

  const loadEnvData = useCallback(async () => {
    try {
      setError(null);
      const resp = await fetch(`${API_URL}/environment/today`);
      if (resp.ok) {
        const d = await resp.json();
        if (d.error) {
          setData(null);
        } else {
          setData(d);
        }
      } else {
        setError('Could not load environment data');
      }
    } catch {
      setError('Could not load environment data');
    }
  }, []);

  const load = useCallback(async () => {
    const hasLocation = await loadLocation();
    if (hasLocation) {
      await loadEnvData();
    }
    setLoading(false);
  }, [loadLocation, loadEnvData]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSetLocation = useCallback(async () => {
    if (!cityInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const resp = await fetch(`${API_URL}/environment/set-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityInput.trim() }),
      });
      const result = await resp.json();
      if (result.error) {
        setSaveError(result.error);
      } else if (result.success) {
        setLocation({ configured: true, city: result.city, country: result.country, admin1: result.admin1 });
        setCityInput('');
        setSaveError(null);
        // Now load env data
        await loadEnvData();
      }
    } catch {
      setSaveError('Failed to save location. Check your connection.');
    }
    setSaving(false);
  }, [cityInput, loadEnvData]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  // Location not configured — show setup
  if (!location?.configured) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.setupContent}>
        <Text style={styles.setupEmoji}>🌍</Text>
        <Text style={styles.setupTitle}>Set Your Location</Text>
        <Text style={styles.setupDesc}>
          Enter your city to get local air quality, UV index, pollen levels, and weather data.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.cityInput}
            placeholder="e.g. Richmond, VA"
            placeholderTextColor={colors.textTertiary}
            value={cityInput}
            onChangeText={setCityInput}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSetLocation}
            editable={!saving}
          />
          <TouchableOpacity
            style={[styles.setBtn, (!cityInput.trim() || saving) && styles.setBtnDisabled]}
            onPress={handleSetLocation}
            disabled={!cityInput.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.setBtnText}>Set</Text>
            )}
          </TouchableOpacity>
        </View>

        {saveError && <Text style={styles.saveError}>{saveError}</Text>}
      </ScrollView>
    );
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
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading environment data...</Text>
      </View>
    );
  }

  const aqiVal = data.aqi ?? 0;
  const aqiColor = aqiVal <= 50 ? colors.success : aqiVal <= 100 ? colors.warning : colors.error;

  const uvVal = data.uv_index_max ?? data.uv_index_current ?? 0;
  const uvColor = uvVal <= 2 ? colors.success
    : uvVal <= 5 ? colors.warning
    : uvVal <= 7 ? colors.scorePoor : colors.error;

  const locationLabel = [location?.city, location?.admin1, location?.country].filter(Boolean).join(', ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Location header */}
      <View style={styles.locationRow}>
        <Text style={styles.locationText}>{data.location_name || locationLabel || 'Your Location'}</Text>
        <TouchableOpacity onPress={() => setLocation({ configured: false })}>
          <Text style={styles.changeLocation}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Weather */}
      {(data.conditions || data.temp_c != null) && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>WEATHER</Text>
          {data.conditions && (
            <Text style={styles.weatherText}>
              {data.conditions.charAt(0).toUpperCase() + data.conditions.slice(1)}
            </Text>
          )}
          {data.temp_c != null && (
            <Text style={styles.tempText}>
              {data.temp_c}°C · {data.humidity ?? '—'}% humidity
              {data.wind_kph != null ? ` · ${data.wind_kph} km/h wind` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>AQI</Text>
          <Text style={[styles.metricValue, { color: aqiColor }]}>
            {data.aqi ?? '—'}
          </Text>
          <Text style={styles.metricSub}>{data.aqi_category || ''}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>UV</Text>
          <Text style={[styles.metricValue, { color: uvColor }]}>
            {uvVal || '—'}
          </Text>
          <Text style={styles.metricSub}>{data.uv_risk_level || ''}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>POLLEN</Text>
          <Text style={styles.metricValue}>{data.pollen_risk_level || '—'}</Text>
        </View>
      </View>

      {/* Safety & Notes */}
      {(data.air_quality_notes || data.outdoor_exercise_safe != null) && (
        <>
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          <View style={styles.card}>
            {data.outdoor_exercise_safe != null && (
              <Text style={styles.recText}>
                {data.outdoor_exercise_safe
                  ? '✅ Conditions are safe for outdoor exercise'
                  : '⚠️ Consider exercising indoors today'}
              </Text>
            )}
            {data.sunscreen_required && (
              <Text style={styles.recText}>🧴 Sunscreen recommended (UV ≥ 3)</Text>
            )}
            {data.air_quality_notes && (
              <Text style={styles.recText}>{data.air_quality_notes}</Text>
            )}
          </View>
        </>
      )}

      {data.date && (
        <Text style={styles.updatedText}>Data for: {data.date}</Text>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['5xl'], backgroundColor: colors.bg },
  // Setup screen
  setupContent: { flex: 1, justifyContent: 'center', padding: spacing['3xl'] },
  setupEmoji: { fontSize: 56, textAlign: 'center', marginBottom: spacing.lg },
  setupTitle: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  setupDesc: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing['2xl'] },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  cityInput: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.md, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, color: colors.textPrimary, fontSize: font.md,
    borderWidth: 1, borderColor: colors.border,
  },
  setBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xl,
    justifyContent: 'center', alignItems: 'center', ...shadow.glow,
  },
  setBtnDisabled: { opacity: 0.4 },
  setBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.md },
  saveError: { color: colors.error, fontSize: font.sm, textAlign: 'center', marginTop: spacing.md },
  loadingText: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.md },
  // Location header
  locationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  locationText: { color: colors.textPrimary, fontSize: font.lg, fontWeight: font.semibold },
  changeLocation: { color: colors.primary, fontSize: font.sm, fontWeight: font.medium },
  // Data display
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
  errorText: { color: colors.textSecondary, fontSize: font.lg },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radii.full, ...shadow.glow },
  retryText: { color: colors.white, fontWeight: font.semibold },
});
