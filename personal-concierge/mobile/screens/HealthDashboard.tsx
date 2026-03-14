import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getTodayHealth, getFlaggedBiomarkers } from '../lib/api';
import type { HealthData, Biomarker } from '../lib/api';

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const modules = [
  { key: 'BloodWork', title: 'Blood Work', emoji: '🩸', desc: 'Biomarkers & lab results' },
  { key: 'Supplements', title: 'Supplements', emoji: '💊', desc: 'Stack & daily tracking' },
  { key: 'Longevity', title: 'Longevity', emoji: '🧬', desc: 'Bio age & longevity scores' },
  { key: 'Research', title: 'Research', emoji: '📚', desc: 'Health research & protocols' },
  { key: 'AppleHealth', title: 'Apple Health', emoji: '📱', desc: 'Sync wearable data' },
  { key: 'Skincare', title: 'Skincare', emoji: '✨', desc: 'Routine & skin tracking' },
];

export default function HealthDashboard({ navigation }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [flagged, setFlagged] = useState<Biomarker[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [h, f] = await Promise.all([getTodayHealth(), getFlaggedBiomarkers()]);
    setHealth(h);
    setFlagged(f || []);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
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

      <View style={{ height: 32 }} />
    </ScrollView>
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 16 },
  vitalsCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  vitalsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  vitalPill: {
    flex: 1,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: '#2E1A1A',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  alertEmoji: { fontSize: 22, marginRight: 12 },
  alertTitle: { color: '#F44336', fontSize: 15, fontWeight: '600' },
  alertSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  moduleRow: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleEmoji: { fontSize: 26, marginRight: 14 },
  moduleTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  moduleDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chevron: { color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: '300' },
});
