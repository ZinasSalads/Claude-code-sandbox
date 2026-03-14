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
import * as Location from 'expo-location';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface EnvData {
  location_name?: string;
  temp_c?: number;
  humidity?: number;
  conditions?: string;
  weather_code?: number;
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

function weatherEmoji(code?: number): string {
  if (code == null) return '🌡️';
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 67) return '🧊';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function r(val?: number | null): string {
  if (val == null) return '—';
  return Math.round(val).toString();
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
        await loadEnvData();
      }
    } catch {
      setSaveError('Failed to save location. Check your connection.');
    }
    setSaving(false);
  }, [cityInput, loadEnvData]);

  const handleUseGPS = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setSaveError('Location permission denied. Please enter your city manually.');
        setSaving(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const resp = await fetch(`${API_URL}/environment/set-location-coords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      });
      const result = await resp.json();
      if (result.error) {
        setSaveError(result.error);
      } else if (result.success) {
        setLocation({ configured: true, city: result.city, country: result.country, admin1: result.admin1 });
        setSaveError(null);
        await loadEnvData();
      }
    } catch {
      setSaveError('Failed to get location. Try entering your city manually.');
    }
    setSaving(false);
  }, [loadEnvData]);

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

        <TouchableOpacity
          style={[styles.gpsBtn, saving && styles.setBtnDisabled]}
          onPress={handleUseGPS}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.gpsBtnText}>📍 Use My Location</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

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
            <Text style={styles.setBtnText}>Set</Text>
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

  const pollenLevel = data.pollen_risk_level || '';
  const pollenColor = pollenLevel === 'Low' ? colors.success
    : pollenLevel === 'Moderate' ? colors.warning
    : pollenLevel === 'High' || pollenLevel === 'Very High' ? colors.error
    : colors.textTertiary;

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

      {/* Hero weather card */}
      <View style={styles.weatherCard}>
        <Text style={styles.weatherEmoji}>{weatherEmoji(data.weather_code)}</Text>
        <Text style={styles.tempBig}>{r(data.temp_c)}°</Text>
        {data.conditions && (
          <Text style={styles.conditionsText}>{data.conditions}</Text>
        )}
        <View style={styles.weatherDetails}>
          <View style={styles.weatherDetail}>
            <Text style={styles.detailIcon}>💧</Text>
            <Text style={styles.detailValue}>{r(data.humidity)}%</Text>
            <Text style={styles.detailLabel}>Humidity</Text>
          </View>
          <View style={styles.weatherDetailDivider} />
          <View style={styles.weatherDetail}>
            <Text style={styles.detailIcon}>💨</Text>
            <Text style={styles.detailValue}>{r(data.wind_kph)}</Text>
            <Text style={styles.detailLabel}>km/h</Text>
          </View>
          <View style={styles.weatherDetailDivider} />
          <View style={styles.weatherDetail}>
            <Text style={styles.detailIcon}>☀️</Text>
            <Text style={styles.detailValue}>{data.uv_index_current != null ? Math.round(data.uv_index_current) : '—'}</Text>
            <Text style={styles.detailLabel}>UV Index</Text>
          </View>
        </View>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderTopWidth: 3, borderTopColor: aqiColor }]}>
          <Text style={styles.metricLabel}>AQI</Text>
          <Text style={[styles.metricValue, { color: aqiColor }]}>
            {r(data.aqi)}
          </Text>
          <Text style={styles.metricSub}>{data.aqi_category || ''}</Text>
        </View>
        <View style={[styles.metricCard, { borderTopWidth: 3, borderTopColor: uvColor }]}>
          <Text style={styles.metricLabel}>UV MAX</Text>
          <Text style={[styles.metricValue, { color: uvColor }]}>
            {uvVal ? Math.round(uvVal) : '—'}
          </Text>
          <Text style={styles.metricSub}>{data.uv_risk_level || ''}</Text>
        </View>
        <View style={[styles.metricCard, { borderTopWidth: 3, borderTopColor: pollenColor }]}>
          <Text style={styles.metricLabel}>POLLEN</Text>
          <Text style={[styles.metricValue, { color: pollenColor }]}>
            {data.pollen_risk_level || '—'}
          </Text>
          <Text style={styles.metricSub}>{data.pollen_risk_level ? '' : 'No data'}</Text>
        </View>
      </View>

      {/* Safety & Notes */}
      {(data.air_quality_notes || data.outdoor_exercise_safe != null) && (
        <View style={styles.recCard}>
          {data.outdoor_exercise_safe != null && (
            <View style={styles.recRow}>
              <Text style={styles.recIcon}>{data.outdoor_exercise_safe ? '✅' : '⚠️'}</Text>
              <Text style={styles.recText}>
                {data.outdoor_exercise_safe
                  ? 'Safe for outdoor exercise'
                  : 'Consider exercising indoors today'}
              </Text>
            </View>
          )}
          {data.sunscreen_required && (
            <View style={styles.recRow}>
              <Text style={styles.recIcon}>🧴</Text>
              <Text style={styles.recText}>Sunscreen recommended</Text>
            </View>
          )}
          {data.air_quality_notes && (
            <View style={styles.recRow}>
              <Text style={styles.recIcon}>🌬️</Text>
              <Text style={styles.recText}>{data.air_quality_notes}</Text>
            </View>
          )}
        </View>
      )}

      {data.date && (
        <Text style={styles.updatedText}>Updated: {data.date}</Text>
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
  gpsBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.lg, ...shadow.glow,
  },
  gpsBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textTertiary, fontSize: font.xs, marginHorizontal: spacing.md },
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
  // Hero weather card
  weatherCard: {
    ...cardStyle,
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  weatherEmoji: { fontSize: 56, marginBottom: spacing.sm },
  tempBig: { fontSize: 56, fontWeight: font.bold, color: colors.textPrimary, lineHeight: 64 },
  conditionsText: {
    fontSize: font.lg, color: colors.textSecondary, fontWeight: font.medium,
    marginBottom: spacing.xl, textTransform: 'capitalize',
  },
  weatherDetails: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', justifyContent: 'space-evenly',
  },
  weatherDetail: { alignItems: 'center' },
  weatherDetailDivider: { width: 1, height: 36, backgroundColor: colors.border },
  detailIcon: { fontSize: 18, marginBottom: spacing.xs },
  detailValue: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  detailLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  // Metrics row
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  metricLabel: {
    fontSize: 10, color: colors.textTertiary, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  metricValue: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary },
  metricSub: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.xs },
  // Recommendations
  recCard: { ...cardStyle, marginBottom: spacing.md },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  recIcon: { fontSize: 16, marginRight: spacing.sm, marginTop: 2 },
  recText: { color: colors.textPrimary, fontSize: font.sm, lineHeight: 20, flex: 1 },
  updatedText: { color: colors.textTertiary, fontSize: font.xs, textAlign: 'center', marginTop: spacing.sm },
  errorText: { color: colors.textSecondary, fontSize: font.lg },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radii.full, ...shadow.glow },
  retryText: { color: colors.white, fontWeight: font.semibold },
});
