import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import {
  isAppleHealthAvailable, requestPermissions, getDateRange,
  syncToBackend, getConnectionStatus,
} from '../lib/appleHealth';
import { getHealthGaps } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

export default function AppleHealth() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [gapDays, setGapDays] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setAvailable(false);
      return;
    }
    const avail = await isAppleHealthAvailable();
    setAvailable(avail);
  }, []);

  const loadGaps = useCallback(async () => {
    const gaps = await getHealthGaps();
    if (gaps && Array.isArray(gaps)) {
      setGapDays(gaps);
    }
  }, []);

  useEffect(() => {
    checkAvailability();
    loadGaps();
  }, [checkAvailability, loadGaps]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGaps();
    setRefreshing(false);
  }, [loadGaps]);

  const handleConnect = async () => {
    const granted = await requestPermissions();
    setConnected(granted);
    if (granted) {
      await handleSync();
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Sync last 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);

      const days = await getDateRange(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      );

      const result = await syncToBackend(days);
      if (result) {
        setSyncResult(`Synced ${result.synced} days of data`);
        setLastSync(new Date().toISOString());
      } else {
        setSyncResult('Sync completed');
      }
      await loadGaps();
    } catch (e) {
      setSyncResult('Sync failed — check connection');
    }
    setSyncing(false);
  };

  const status = getConnectionStatus();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Apple Health</Text>
      <Text style={styles.subtitle}>Fill data gaps when Oura isn't worn</Text>

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connection Status</Text>
        {Platform.OS !== 'ios' ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={styles.statusText}>Not Available (iOS only)</Text>
          </View>
        ) : available === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : available ? (
          connected ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={styles.statusText}>Connected</Text>
            </View>
          ) : (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                <Text style={styles.statusText}>Available — not connected</Text>
              </View>
              <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
                <Text style={styles.connectBtnText}>Connect Apple Health</Text>
              </TouchableOpacity>
            </>
          )
        ) : (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={styles.statusText}>Not available in Expo Go — requires dev build</Text>
          </View>
        )}
      </View>

      {/* Why Connect */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why Connect?</Text>
        <Text style={styles.desc}>
          Apple Health fills in data gaps when your Oura ring isn't worn:
          {'\n\n'}
          • Step count from your iPhone{'\n'}
          • Heart rate from Apple Watch{'\n'}
          • Sleep data on Oura-free nights{'\n'}
          • Workout tracking{'\n'}
          • Active calories{'\n\n'}
          Oura data is always the primary source — Apple Health only fills NULL fields.
        </Text>
      </View>

      {/* Data Gaps */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Gaps</Text>
        {gapDays.length > 0 ? (
          <>
            <Text style={styles.desc}>
              {gapDays.length} day{gapDays.length > 1 ? 's' : ''} with missing health data:
            </Text>
            {gapDays.slice(0, 10).map(d => (
              <Text key={d} style={styles.gapDate}>{d}</Text>
            ))}
            {gapDays.length > 10 && (
              <Text style={styles.desc}>...and {gapDays.length - 10} more</Text>
            )}
          </>
        ) : (
          <Text style={styles.desc}>No data gaps detected — Oura coverage is complete.</Text>
        )}
      </View>

      {/* Sync */}
      {connected && (
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncBtnText}>Sync Last 7 Days</Text>
          )}
        </TouchableOpacity>
      )}

      {syncResult && (
        <Text style={styles.syncResult}>{syncResult}</Text>
      )}

      {lastSync && (
        <Text style={styles.lastSync}>Last sync: {new Date(lastSync).toLocaleString()}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  title: { fontSize: font['3xl'], fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md },
  subtitle: { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  desc: { fontSize: font.md, color: colors.textSecondary, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: radii.full, marginRight: spacing.md },
  statusText: { fontSize: font.md, color: colors.textPrimary },
  connectBtn: {
    backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
    ...shadow.glow,
  },
  connectBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.semibold },
  gapDate: { fontSize: font.sm, color: colors.warning, marginTop: spacing.xs, fontFamily: 'monospace' },
  syncBtn: {
    backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm,
    ...shadow.glow,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  syncResult: { color: colors.success, textAlign: 'center', marginTop: spacing.md, fontSize: font.md },
  lastSync: { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, fontSize: font.sm },
});
