import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getHomeProfile, updateHomeProfile, getHomeRecommendations,
  generateHomeRecommendations, completeHomeRecommendation,
  getHomeCorrelations,
} from '../lib/api';

const ACCENT = '#6C63FF';
const BG = '#0D0D1A';
const CARD = '#1A1A2E';
const GREEN = '#00C48C';

const EFFORT_COLORS: Record<string, string> = {
  quick_win: GREEN,
  moderate: '#FFB547',
  investment: '#FF6B6B',
};

export default function HomeEnvironment() {
  const [profile, setProfile] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [completedRecs, setCompletedRecs] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [p, r, cr, corr] = await Promise.all([
      getHomeProfile(),
      getHomeRecommendations(false),
      getHomeRecommendations(true),
      getHomeCorrelations(),
    ]);
    if (p) setProfile(p);
    if (Array.isArray(r)) setRecs(r);
    if (Array.isArray(cr)) setCompletedRecs(cr);
    if (Array.isArray(corr)) setCorrelations(corr);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleField = async (field: string, value: boolean) => {
    await updateHomeProfile({ [field]: value });
    setProfile((p: any) => ({ ...p, [field]: value }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await generateHomeRecommendations();
    const r = await getHomeRecommendations(false);
    if (Array.isArray(r)) setRecs(r);
    setGenerating(false);
  };

  const handleComplete = async (id: string) => {
    await completeHomeRecommendation(id);
    await load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  }

  const totalRecs = recs.length + completedRecs.length;
  const completionPct = totalRecs > 0 ? Math.round((completedRecs.length / totalRecs) * 100) : 0;

  const boolFields = [
    { key: 'bedroom_blackout', label: 'Blackout curtains' },
    { key: 'morning_light_access', label: 'Morning light access' },
    { key: 'has_air_purifier', label: 'Air purifier' },
    { key: 'indoor_plants', label: 'Indoor plants' },
    { key: 'white_noise_device', label: 'White noise device' },
    { key: 'standing_desk', label: 'Standing desk' },
    { key: 'ergonomic_chair', label: 'Ergonomic chair' },
    { key: 'monitor_at_eye_level', label: 'Monitor at eye level' },
    { key: 'has_smart_lights', label: 'Smart lights' },
    { key: 'blue_light_filter_device', label: 'Blue light filter' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      <Text style={styles.title}>Home Environment</Text>
      <Text style={styles.subtitle}>Your home as a health variable</Text>

      {/* Progress */}
      {totalRecs > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Optimization Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
          </View>
          <Text style={styles.progressText}>{completedRecs.length} of {totalRecs} recommendations completed ({completionPct}%)</Text>
        </View>
      )}

      {/* Correlations */}
      {correlations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Correlations</Text>
          {correlations.map((c, i) => (
            <Text key={i} style={styles.corrText}>{c.observation}</Text>
          ))}
        </View>
      )}

      {/* Profile Setup */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Setup</Text>
        {boolFields.map(f => (
          <View key={f.key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{f.label}</Text>
            <Switch
              value={profile?.[f.key] || false}
              onValueChange={v => toggleField(f.key, v)}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(108,99,255,0.4)' }}
              thumbColor={profile?.[f.key] ? ACCENT : '#666'}
            />
          </View>
        ))}
      </View>

      {/* Recommendations */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          <TouchableOpacity onPress={handleGenerate} disabled={generating}>
            <Text style={styles.editBtn}>{generating ? 'Generating...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        {recs.length > 0 ? recs.map((r, i) => (
          <View key={r.id || i} style={styles.recRow}>
            <View style={styles.recContent}>
              <View style={styles.recBadges}>
                <Text style={[styles.badge, { backgroundColor: EFFORT_COLORS[r.effort] || '#666' }]}>
                  {(r.effort || '').replace('_', ' ')}
                </Text>
                <Text style={styles.priorityText}>{r.priority} priority</Text>
              </View>
              <Text style={styles.recText}>{r.recommendation}</Text>
              {r.estimated_impact && <Text style={styles.impactText}>{r.estimated_impact}</Text>}
            </View>
            <TouchableOpacity style={styles.checkBtn} onPress={() => handleComplete(r.id)}>
              <Text style={styles.checkText}>Done</Text>
            </TouchableOpacity>
          </View>
        )) : (
          <Text style={styles.emptyText}>
            Set up your home profile above, then tap Refresh to get recommendations.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  card: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  editBtn: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: GREEN, borderRadius: 3 },
  progressText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  corrText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  switchLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  recRow: {
    flexDirection: 'row', marginBottom: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  recContent: { flex: 1 },
  recBadges: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  badge: { fontSize: 10, color: '#000', fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'capitalize', overflow: 'hidden' },
  priorityText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' },
  recText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  impactText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  checkBtn: {
    backgroundColor: 'rgba(0,196,140,0.15)', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 6, alignSelf: 'center', marginLeft: 8,
  },
  checkText: { color: GREEN, fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
});
