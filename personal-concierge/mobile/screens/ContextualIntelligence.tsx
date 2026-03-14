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

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading intelligence...</Text></View>;
  }

  const anomalies = signals.filter((s) => s.is_anomaly);
  const regularSignals = signals.filter((s) => !s.is_anomaly);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Contextual Intelligence</Text>

      <View style={styles.inputCard}>
        <TextInput
          style={styles.signalInput}
          placeholder="Share something you noticed..."
          placeholderTextColor="#555577"
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
                          color: m.impact === 'high' ? '#e17055' : m.impact === 'medium' ? '#fdcb6e' : '#00b894',
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
              backgroundColor: signal.source === 'manual' ? '#6C63FF' : signal.source === 'health' ? '#00b894' : '#fdcb6e',
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
                      color: m.impact === 'high' ? '#e17055' : m.impact === 'medium' ? '#fdcb6e' : '#00b894',
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { color: '#8888aa', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  anomalyCard: { borderColor: 'rgba(225,112,85,0.3)' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  dimText: { fontSize: 13, color: '#8888aa' },
  inputCard: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16,
  },
  signalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 60, textAlignVertical: 'top', marginBottom: 10,
  },
  submitBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  anomalyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  anomalyBadge: { backgroundColor: 'rgba(225,112,85,0.15)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  anomalyBadgeText: { color: '#e17055', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sourceDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 4 },
  signalText: { fontSize: 14, color: '#fff', lineHeight: 20, marginBottom: 4 },
  signalMeta: { fontSize: 11, color: '#8888aa' },
  expandArrow: { color: '#8888aa', fontSize: 14, marginLeft: 8 },
  expandLink: { color: '#6C63FF', fontSize: 13, fontWeight: '600', marginTop: 8 },
  breakdownContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  breakdownItem: { marginBottom: 8 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  breakdownModule: { fontSize: 13, fontWeight: '600', color: '#fff' },
  breakdownImpact: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  breakdownRelevance: { fontSize: 12, color: '#8888aa', lineHeight: 18 },
});
