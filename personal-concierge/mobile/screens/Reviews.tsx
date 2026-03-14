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
      api<Review>(`/reviews/${viewType}`),
      api<Review[]>(`/reviews/history/${viewType}`),
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
    await apiPost(`/reviews/${viewType}/generate`, {});
    await fetchData();
    setGenerating(false);
  }, [viewType, fetchData]);

  const handleSaveIntention = useCallback(() => {
    if (!currentReview) return;
    setCurrentReview({ ...currentReview, intention: draftIntention });
    setEditingIntention(false);
  }, [currentReview, draftIntention]);

  const handleToggleType = useCallback((type: 'weekly' | 'monthly') => {
    if (type !== viewType) {
      setLoading(true);
      setViewType(type);
    }
  }, [viewType]);

  const scoreColor = (s: number) => s >= 70 ? colors.success : s >= 40 ? colors.warning : colors.error;

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading reviews...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
            {(currentReview.wins || []).slice(0, 3).map((win, i) => (
              <View key={i} style={styles.winBadge}>
                <Text style={styles.winText}>{win}</Text>
              </View>
            ))}
            {(currentReview.wins || []).length === 0 && <Text style={styles.dimText}>No wins recorded yet</Text>}
          </View>

          {(currentReview.patterns || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>PATTERNS DETECTED</Text>
              <View style={styles.card}>
                {(currentReview.patterns || []).map((p, i) => (
                  <View key={i} style={styles.patternBadge}>
                    <Text style={styles.patternText}>{p}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {(currentReview.metrics || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>METRICS</Text>
              <View style={styles.metricsGrid}>
                {(currentReview.metrics || []).map((m, i) => (
                  <View key={i} style={styles.metricCard}>
                    <Text style={styles.metricValue}>{m.value}</Text>
                    {m.change && (
                      <Text style={[styles.metricChange, {
                        color: m.change.startsWith('+') ? colors.success : m.change.startsWith('-') ? colors.error : colors.textSecondary,
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
              <View style={[styles.card, { borderColor: colors.borderAccent }]}>
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
                  placeholderTextColor={colors.textTertiary}
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
                  {(review.wins || []).length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {(review.wins || []).slice(0, 3).map((w, i) => (
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...sectionLabel },
  dimText: { fontSize: font.sm, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  toggleBtn: {
    flex: 1, padding: spacing.md, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
  },
  toggleBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontWeight: font.semibold, fontSize: font.md },
  toggleTextActive: { color: colors.accent },
  periodLabel: { fontSize: font.sm, color: colors.accent, fontWeight: font.bold, marginBottom: spacing.sm, textTransform: 'uppercase' },
  narrative: { fontSize: font.md, color: colors.textPrimary, lineHeight: 22 },
  winBadge: { backgroundColor: colors.successMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 6 },
  winText: { color: colors.success, fontSize: font.sm, fontWeight: font.medium },
  patternBadge: { backgroundColor: colors.warningMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 6 },
  patternText: { color: colors.warning, fontSize: font.sm, fontWeight: font.medium },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: {
    backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, width: '48%',
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    ...shadow.card,
  },
  metricValue: { fontSize: 22, fontWeight: font.bold, color: colors.textPrimary },
  metricChange: { fontSize: font.xs, fontWeight: font.semibold, marginTop: 2 },
  metricLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: spacing.xs, textTransform: 'uppercase', textAlign: 'center' },
  coachText: { fontSize: font.sm, color: colors.textPrimary, lineHeight: 21, fontStyle: 'italic' },
  coachBox: { backgroundColor: colors.accentGlow, borderRadius: radii.sm, padding: spacing.md },
  intentionText: { fontSize: font.md, color: colors.textPrimary, lineHeight: 22 },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
  secondaryBtn: { flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: font.semibold, fontSize: font.md },
  generateBtn: {
    backgroundColor: colors.accent, borderRadius: radii.lg, padding: spacing.lg, alignItems: 'center', marginVertical: spacing.md,
    ...shadow.glow,
  },
  generateBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.lg },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyPeriod: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  historyDate: { fontSize: font.xs, color: colors.textSecondary },
});
