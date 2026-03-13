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

interface Relationship {
  id: string; name: string; type: string; health_score: number;
  last_contact: string; trend: 'up' | 'down' | 'stable'; needs_attention: boolean;
  coaching_insight?: string;
}
interface WeeklyBriefing { summary: string; top_priority: string; action_items: string[] }

export default function Relationships() {
  const [overallScore, setOverallScore] = useState(0);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [briefing, setBriefing] = useState<WeeklyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logRelId, setLogRelId] = useState<string | null>(null);
  const [qualityRating, setQualityRating] = useState(5);
  const [interactionType, setInteractionType] = useState('in-person');
  const [energyAfter, setEnergyAfter] = useState(5);

  const fetchData = useCallback(async () => {
    const [score, rels, brief] = await Promise.all([
      api<{ score: number }>('/relationships/health'),
      api<Relationship[]>('/relationships'),
      api<WeeklyBriefing>('/relationships/briefing'),
    ]);
    setOverallScore(score?.score ?? 0);
    setRelationships((rels || []).sort((a, b) => (b.needs_attention ? 1 : 0) - (a.needs_attention ? 1 : 0)));
    setBriefing(brief);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleLogInteraction = useCallback(async () => {
    if (!logRelId) return;
    await apiPost(`/relationships/${logRelId}/interactions`, {
      quality_rating: qualityRating,
      type: interactionType,
      energy_after: energyAfter,
    });
    setLogRelId(null);
    setQualityRating(5);
    setEnergyAfter(5);
    fetchData();
  }, [logRelId, qualityRating, interactionType, energyAfter, fetchData]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';
  const trendArrow = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const trendColor = (t: string) => t === 'up' ? '#00b894' : t === 'down' ? '#e17055' : '#8888aa';

  const interactionTypes = ['in-person', 'call', 'text', 'video', 'social-media'];

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading relationships...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Relationships</Text>

      <View style={styles.card}>
        <View style={styles.ringContainer}>
          <Text style={[styles.ringScore, { color: scoreColor(overallScore) }]}>{overallScore}</Text>
          <Text style={styles.ringLabel}>/ 100</Text>
        </View>
        <Text style={styles.ringSubtitle}>Relationship Health</Text>
      </View>

      {briefing && (
        <View style={[styles.card, { borderColor: 'rgba(108,99,255,0.3)' }]}>
          <Text style={styles.cardTitle}>Weekly Briefing</Text>
          <Text style={styles.briefingText}>{briefing.summary}</Text>
          <Text style={styles.priorityLabel}>Top Priority</Text>
          <Text style={styles.priorityText}>{briefing.top_priority}</Text>
          {briefing.action_items.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {briefing.action_items.map((item, i) => (
                <Text key={i} style={styles.actionItem}>• {item}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>YOUR RELATIONSHIPS</Text>

      {relationships.map((rel) => (
        <View key={rel.id} style={[styles.card, rel.needs_attention && { borderColor: 'rgba(253,203,110,0.3)' }]}>
          <View style={styles.relHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.relName}>{rel.name}</Text>
              <Text style={styles.relType}>{rel.type} · Last: {rel.last_contact}</Text>
            </View>
            <View style={styles.relScoreCol}>
              <View style={styles.relScoreRow}>
                <Text style={[styles.relScore, { color: scoreColor(rel.health_score) }]}>{rel.health_score}</Text>
                <Text style={[styles.trendArrow, { color: trendColor(rel.trend) }]}>{trendArrow(rel.trend)}</Text>
              </View>
              {rel.needs_attention && (
                <View style={styles.attentionBadge}>
                  <Text style={styles.attentionText}>Needs Attention</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.relActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setLogRelId(logRelId === rel.id ? null : rel.id)}>
              <Text style={styles.actionBtnText}>Log Interaction</Text>
            </TouchableOpacity>
            {rel.coaching_insight && (
              <TouchableOpacity style={styles.insightBtn} onPress={() => setExpandedId(expandedId === rel.id ? null : rel.id)}>
                <Text style={styles.insightBtnText}>Coaching</Text>
              </TouchableOpacity>
            )}
          </View>

          {expandedId === rel.id && rel.coaching_insight && (
            <View style={styles.insightBox}>
              <Text style={styles.insightText}>{rel.coaching_insight}</Text>
            </View>
          )}

          {logRelId === rel.id && (
            <View style={styles.logForm}>
              <Text style={styles.formLabel}>Quality ({qualityRating}/10)</Text>
              <View style={styles.sliderRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <TouchableOpacity key={v} style={[styles.sliderDot, qualityRating === v && styles.sliderDotActive]} onPress={() => setQualityRating(v)}>
                    <Text style={[styles.sliderDotText, qualityRating === v && { color: '#fff' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeRow}>
                {interactionTypes.map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeChip, interactionType === t && styles.typeChipActive]} onPress={() => setInteractionType(t)}>
                    <Text style={[styles.typeChipText, interactionType === t && styles.typeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Energy After ({energyAfter}/10)</Text>
              <View style={styles.sliderRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <TouchableOpacity key={v} style={[styles.sliderDot, energyAfter === v && styles.sliderDotActive]} onPress={() => setEnergyAfter(v)}>
                    <Text style={[styles.sliderDotText, energyAfter === v && { color: '#fff' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogInteraction}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  ringContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 4 },
  ringScore: { fontSize: 56, fontWeight: '700' },
  ringLabel: { fontSize: 20, color: '#8888aa', marginLeft: 4 },
  ringSubtitle: { textAlign: 'center', color: '#8888aa', fontSize: 13 },
  briefingText: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  priorityLabel: { fontSize: 11, color: '#fdcb6e', fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  priorityText: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  actionItem: { color: '#8888aa', fontSize: 13, lineHeight: 20 },
  relHeader: { flexDirection: 'row', alignItems: 'center' },
  relName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  relType: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  relScoreCol: { alignItems: 'flex-end' },
  relScoreRow: { flexDirection: 'row', alignItems: 'center' },
  relScore: { fontSize: 22, fontWeight: '700' },
  trendArrow: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
  attentionBadge: { backgroundColor: 'rgba(253,203,110,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  attentionText: { color: '#fdcb6e', fontSize: 10, fontWeight: '700' },
  relActions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  actionBtn: { backgroundColor: 'rgba(108,99,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '600' },
  insightBtn: { backgroundColor: 'rgba(0,184,148,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  insightBtnText: { color: '#00b894', fontSize: 12, fontWeight: '600' },
  insightBox: { backgroundColor: 'rgba(0,184,148,0.08)', borderRadius: 10, padding: 12, marginTop: 10 },
  insightText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  logForm: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
  formLabel: { fontSize: 12, color: '#8888aa', fontWeight: '600', marginBottom: 6, marginTop: 8 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  sliderDotActive: { backgroundColor: '#6C63FF' },
  sliderDotText: { color: '#8888aa', fontSize: 11, fontWeight: '600' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipActive: { backgroundColor: 'rgba(108,99,255,0.2)' },
  typeChipText: { color: '#8888aa', fontSize: 12, fontWeight: '600' },
  typeChipTextActive: { color: '#6C63FF' },
  primaryBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
