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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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

interface Review {
  id: string; period: string; type: 'weekly' | 'monthly';
  narrative: string;
  wins: string[];
  patterns: string[];
  metrics: { label: string; value: string; change?: string }[];
  coach_insight: string;
  intention: string;
  created_at: string;
}

export default function Reviews() {
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [history, setHistory] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [editingIntention, setEditingIntention] = useState(false);
  const [draftIntention, setDraftIntention] = useState('');

  const fetchData = useCallback(async () => {
    const [current, hist] = await Promise.all([
      api<Review>(`/reviews/current?type=${viewType}`),
      api<Review[]>(`/reviews/history?type=${viewType}`),
    ]);
    setCurrentReview(current);
    setHistory(hist || []);
    setLoading(false);
  }, [viewType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    await apiPost(`/reviews/generate`, { type: viewType });
    await fetchData();
    setGenerating(false);
  }, [viewType, fetchData]);

  const handleSaveIntention = useCallback(async () => {
    if (!currentReview) return;
    await apiPost(`/reviews/${currentReview.id}/intention`, { intention: draftIntention });
    setEditingIntention(false);
    fetchData();
  }, [currentReview, draftIntention, fetchData]);

  const handleToggleType = useCallback((type: 'weekly' | 'monthly') => {
    if (type !== viewType) {
      setLoading(true);
      setViewType(type);
    }
  }, [viewType]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading reviews...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Reviews</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewType === 'weekly' && styles.toggleBtnActive]}
          onPress={() => handleToggleType('weekly')}
        >
          <Text style={[styles.toggleText, viewType === 'weekly' && styles.toggleTextActive]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewType === 'monthly' && styles.toggleBtnActive]}
          onPress={() => handleToggleType('monthly')}
        >
          <Text style={[styles.toggleText, viewType === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
        </TouchableOpacity>
      </View>

      {currentReview ? (
        <>
          <View style={styles.card}>
            <Text style={styles.periodLabel}>{currentReview.period}</Text>
            <Text style={styles.narrative}>{currentReview.narrative}</Text>
          </View>

          <Text style={styles.sectionTitle}>WINS</Text>
          <View style={styles.card}>
            {currentReview.wins.slice(0, 3).map((win, i) => (
              <View key={i} style={styles.winBadge}>
                <Text style={styles.winText}>{win}</Text>
              </View>
            ))}
            {currentReview.wins.length === 0 && <Text style={styles.dimText}>No wins recorded yet</Text>}
          </View>

          {currentReview.patterns.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>PATTERNS DETECTED</Text>
              <View style={styles.card}>
                {currentReview.patterns.map((p, i) => (
                  <View key={i} style={styles.patternBadge}>
                    <Text style={styles.patternText}>{p}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {currentReview.metrics.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>METRICS</Text>
              <View style={styles.metricsGrid}>
                {currentReview.metrics.map((m, i) => (
                  <View key={i} style={styles.metricCard}>
                    <Text style={styles.metricValue}>{m.value}</Text>
                    {m.change && (
                      <Text style={[styles.metricChange, {
                        color: m.change.startsWith('+') ? '#00b894' : m.change.startsWith('-') ? '#e17055' : '#8888aa',
                      }]}>{m.change}</Text>
                    )}
                    <Text style={styles.metricLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {currentReview.coach_insight ? (
            <>
              <Text style={styles.sectionTitle}>COACH INSIGHT</Text>
              <View style={[styles.card, { borderColor: 'rgba(108,99,255,0.3)' }]}>
                <Text style={styles.coachText}>{currentReview.coach_insight}</Text>
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>
            {viewType === 'weekly' ? 'NEXT WEEK INTENTION' : 'NEXT MONTH INTENTION'}
          </Text>
          <View style={styles.card}>
            {editingIntention ? (
              <>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  multiline
                  value={draftIntention}
                  onChangeText={setDraftIntention}
                  placeholder="What's your intention?"
                  placeholderTextColor="#555577"
                />
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditingIntention(false)}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveIntention}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity onPress={() => { setDraftIntention(currentReview.intention || ''); setEditingIntention(true); }}>
                <Text style={currentReview.intention ? styles.intentionText : styles.dimText}>
                  {currentReview.intention || 'Tap to set your intention...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.dimText}>No {viewType} review available yet.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.generateBtn, generating && { opacity: 0.5 }]}
        onPress={handleGenerate}
        disabled={generating}
      >
        <Text style={styles.generateBtnText}>{generating ? 'Generating...' : 'Generate New Review'}</Text>
      </TouchableOpacity>

      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>PAST REVIEWS</Text>
          {history.map((review) => (
            <TouchableOpacity
              key={review.id}
              style={styles.card}
              onPress={() => setExpandedHistoryId(expandedHistoryId === review.id ? null : review.id)}
            >
              <View style={styles.historyHeader}>
                <Text style={styles.historyPeriod}>{review.period}</Text>
                <Text style={styles.historyDate}>{review.created_at}</Text>
              </View>
              {expandedHistoryId === review.id && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.narrative}>{review.narrative}</Text>
                  {review.wins.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {review.wins.slice(0, 3).map((w, i) => (
                        <View key={i} style={styles.winBadge}><Text style={styles.winText}>{w}</Text></View>
                      ))}
                    </View>
                  )}
                  {review.coach_insight ? (
                    <View style={[styles.coachBox, { marginTop: 8 }]}>
                      <Text style={styles.coachText}>{review.coach_insight}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}
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
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  dimText: { fontSize: 13, color: '#8888aa' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: {
    flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  toggleBtnActive: { backgroundColor: 'rgba(108,99,255,0.2)', borderColor: '#6C63FF' },
  toggleText: { color: '#8888aa', fontWeight: '600', fontSize: 15 },
  toggleTextActive: { color: '#6C63FF' },
  periodLabel: { fontSize: 13, color: '#6C63FF', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  narrative: { fontSize: 15, color: '#fff', lineHeight: 22 },
  winBadge: { backgroundColor: 'rgba(0,184,148,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  winText: { color: '#00b894', fontSize: 14, fontWeight: '500' },
  patternBadge: { backgroundColor: 'rgba(253,203,110,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  patternText: { color: '#fdcb6e', fontSize: 14, fontWeight: '500' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricCard: {
    backgroundColor: '#141420', borderRadius: 12, padding: 12, width: '48%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
  metricChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  metricLabel: { fontSize: 11, color: '#8888aa', marginTop: 4, textTransform: 'uppercase', textAlign: 'center' },
  coachText: { fontSize: 14, color: '#fff', lineHeight: 21, fontStyle: 'italic' },
  coachBox: { backgroundColor: 'rgba(108,99,255,0.08)', borderRadius: 10, padding: 12 },
  intentionText: { fontSize: 15, color: '#fff', lineHeight: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#8888aa', fontWeight: '600', fontSize: 15 },
  generateBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, padding: 16, alignItems: 'center', marginVertical: 12,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyPeriod: { fontSize: 15, fontWeight: '600', color: '#fff' },
  historyDate: { fontSize: 12, color: '#8888aa' },
});
