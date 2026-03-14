import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

async function api<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function apiPost<T>(path: string, body: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

interface Signal {
  id: string; text: string; source: string; timestamp: string;
  module_breakdown?: { module: string; relevance: string; impact: string }[];
  is_anomaly: boolean;
}

export default function ContextualIntelligence() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  const fetchData = useCallback(async () => {
    const s = await api<Signal[]>('/context/signals?days=7');
    setSignals(s || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSubmitSignal = useCallback(async () => {
    if (!manualInput.trim()) return;
    await apiPost('/context/signal', { signal_text: manualInput, source: 'manual' });
    setManualInput('');
    fetchData();
  }, [manualInput, fetchData]);

  const scoreColor = (s: number) => s >= 70 ? colors.success : s >= 40 ? colors.warning : colors.error;

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading intelligence...</Text></View>;
  }

  const anomalies = signals.filter((s) => s.is_anomaly);
  const regularSignals = signals.filter((s) => !s.is_anomaly);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Contextual Intelligence</Text>

      <View style={styles.inputCard}>
        <TextInput
          style={styles.signalInput}
          placeholder="Share something you noticed..."
          placeholderTextColor={colors.textTertiary}
          value={manualInput}
          onChangeText={setManualInput}
          multiline
        />
        <TouchableOpacity
          style={[styles.submitBtn, !manualInput.trim() && styles.submitBtnDisabled]}
          onPress={handleSubmitSignal}
          disabled={!manualInput.trim()}
        >
          <Text style={styles.submitBtnText}>Submit Signal</Text>
        </TouchableOpacity>
      </View>

      {anomalies.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ANOMALY ALERTS</Text>
          {anomalies.map((signal) => (
            <View key={signal.id} style={[styles.card, styles.anomalyCard]}>
              <View style={styles.anomalyHeader}>
                <View style={styles.anomalyBadge}>
                  <Text style={styles.anomalyBadgeText}>Anomaly</Text>
                </View>
              </View>
              <Text style={styles.signalText}>{signal.text}</Text>
              <Text style={styles.signalMeta}>{signal.source} · {signal.timestamp}</Text>
              {signal.module_breakdown && (
                <TouchableOpacity onPress={() => setExpandedId(expandedId === signal.id ? null : signal.id)}>
                  <Text style={styles.expandLink}>
                    {expandedId === signal.id ? 'Hide breakdown' : 'View module breakdown'}
                  </Text>
                </TouchableOpacity>
              )}
              {expandedId === signal.id && signal.module_breakdown && (
                <View style={styles.breakdownContainer}>
                  {signal.module_breakdown.map((m, i) => (
                    <View key={i} style={styles.breakdownItem}>
                      <View style={styles.breakdownHeader}>
                        <Text style={styles.breakdownModule}>{m.module}</Text>
                        <Text style={[styles.breakdownImpact, {
                          color: m.impact === 'high' ? colors.error : m.impact === 'medium' ? colors.warning : colors.success,
                        }]}>{m.impact}</Text>
                      </View>
                      <Text style={styles.breakdownRelevance}>{m.relevance}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>WHAT I NOTICED</Text>
      {regularSignals.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.dimText}>No signals detected yet. Share observations or check back later.</Text>
        </View>
      )}
      {regularSignals.map((signal) => (
        <TouchableOpacity
          key={signal.id}
          style={styles.card}
          onPress={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
          activeOpacity={0.7}
        >
          <View style={styles.signalRow}>
            <View style={[styles.sourceDot, {
              backgroundColor: signal.source === 'manual' ? colors.primary : signal.source === 'health' ? colors.success : colors.warning,
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.signalText}>{signal.text}</Text>
              <Text style={styles.signalMeta}>{signal.source} · {signal.timestamp}</Text>
            </View>
            <Text style={styles.expandArrow}>{expandedId === signal.id ? '▾' : '▸'}</Text>
          </View>
          {expandedId === signal.id && signal.module_breakdown && (
            <View style={styles.breakdownContainer}>
              {signal.module_breakdown.map((m, i) => (
                <View key={i} style={styles.breakdownItem}>
                  <View style={styles.breakdownHeader}>
                    <Text style={styles.breakdownModule}>{m.module}</Text>
                    <Text style={[styles.breakdownImpact, {
                      color: m.impact === 'high' ? colors.error : m.impact === 'medium' ? colors.warning : colors.success,
                    }]}>{m.impact}</Text>
                  </View>
                  <Text style={styles.breakdownRelevance}>{m.relevance}</Text>
                </View>
              ))}
            </View>
          )}
          {expandedId === signal.id && !signal.module_breakdown && (
            <View style={styles.breakdownContainer}>
              <Text style={styles.dimText}>No module breakdown available for this signal.</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  anomalyCard: { borderColor: colors.errorMuted },
  sectionTitle: { ...sectionLabel },
  dimText: { fontSize: font.sm, color: colors.textSecondary },
  inputCard: {
    ...cardStyle,
    marginBottom: spacing.lg,
  },
  signalInput: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border,
    minHeight: 60, textAlignVertical: 'top', marginBottom: spacing.sm,
  },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.sm },
  anomalyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  anomalyBadge: { backgroundColor: colors.errorMuted, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  anomalyBadgeText: { color: colors.error, fontSize: font.xs, fontWeight: font.bold, textTransform: 'uppercase' },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sourceDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 4 },
  signalText: { fontSize: font.sm, color: colors.textPrimary, lineHeight: 20, marginBottom: spacing.xs },
  signalMeta: { fontSize: font.xs, color: colors.textSecondary },
  expandArrow: { color: colors.textSecondary, fontSize: 14, marginLeft: spacing.sm },
  expandLink: { color: colors.primary, fontSize: font.sm, fontWeight: font.semibold, marginTop: spacing.sm },
  breakdownContainer: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  breakdownItem: { marginBottom: spacing.sm },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  breakdownModule: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary },
  breakdownImpact: { fontSize: font.xs, fontWeight: font.bold, textTransform: 'uppercase' },
  breakdownRelevance: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 18 },
});
