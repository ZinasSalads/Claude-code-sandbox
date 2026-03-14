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
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

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

  const trendArrow = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const trendColor = (t: string) => t === 'up' ? colors.success : t === 'down' ? colors.error : colors.textSecondary;

  const interactionTypes = ['in-person', 'call', 'text', 'video', 'social-media'];

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading relationships...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Relationships</Text>

      <View style={styles.card}>
        <View style={styles.ringContainer}>
          <Text style={[styles.ringScore, { color: getScoreColor(overallScore) }]}>{overallScore}</Text>
          <Text style={styles.ringLabel}>/ 100</Text>
        </View>
        <Text style={styles.ringSubtitle}>Relationship Health</Text>
      </View>

      {briefing && (
        <View style={[styles.card, { borderColor: colors.primaryBorder }]}>
          <Text style={styles.cardTitle}>Weekly Briefing</Text>
          <Text style={styles.briefingText}>{briefing.summary}</Text>
          <Text style={styles.priorityLabel}>Top Priority</Text>
          <Text style={styles.priorityText}>{briefing.top_priority}</Text>
          {(briefing.action_items || []).length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              {(briefing.action_items || []).map((item, i) => (
                <Text key={i} style={styles.actionItem}>• {item}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>YOUR RELATIONSHIPS</Text>

      {relationships.map((rel) => (
        <View key={rel.id} style={[styles.card, rel.needs_attention && { borderColor: colors.warningMuted }]}>
          <View style={styles.relHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.relName}>{rel.name}</Text>
              <Text style={styles.relType}>{rel.type} · Last: {rel.last_contact}</Text>
            </View>
            <View style={styles.relScoreCol}>
              <View style={styles.relScoreRow}>
                <Text style={[styles.relScore, { color: getScoreColor(rel.health_score) }]}>{rel.health_score}</Text>
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
                    <Text style={[styles.sliderDotText, qualityRating === v && { color: colors.white }]}>{v}</Text>
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
                    <Text style={[styles.sliderDotText, energyAfter === v && { color: colors.white }]}>{v}</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  sectionTitle: { ...sectionLabel },
  ringContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: spacing.xs },
  ringScore: { fontSize: 56, fontWeight: font.bold },
  ringLabel: { fontSize: font.xl, color: colors.textSecondary, marginLeft: spacing.xs },
  ringSubtitle: { textAlign: 'center', color: colors.textSecondary, fontSize: font.sm },
  briefingText: { color: colors.textPrimary, fontSize: font.sm, lineHeight: 20, marginBottom: spacing.sm },
  priorityLabel: { fontSize: font.xs, color: colors.warning, fontWeight: font.bold, textTransform: 'uppercase', marginTop: spacing.xs },
  priorityText: { color: colors.textPrimary, fontSize: font.sm, fontWeight: font.semibold, marginTop: 2 },
  actionItem: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20 },
  relHeader: { flexDirection: 'row', alignItems: 'center' },
  relName: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  relType: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  relScoreCol: { alignItems: 'flex-end' },
  relScoreRow: { flexDirection: 'row', alignItems: 'center' },
  relScore: { fontSize: 22, fontWeight: font.bold },
  trendArrow: { fontSize: 18, fontWeight: font.bold, marginLeft: spacing.xs },
  attentionBadge: { backgroundColor: colors.warningMuted, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.xs },
  attentionText: { color: colors.warning, fontSize: 10, fontWeight: font.bold },
  relActions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  actionBtn: { backgroundColor: colors.primaryMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  actionBtnText: { color: colors.primary, fontSize: font.xs, fontWeight: font.semibold },
  insightBtn: { backgroundColor: colors.successMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  insightBtnText: { color: colors.success, fontSize: font.xs, fontWeight: font.semibold },
  insightBox: { backgroundColor: colors.primaryGlow, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm },
  insightText: { color: colors.textPrimary, fontSize: font.sm, lineHeight: 19 },
  logForm: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: 6, marginTop: spacing.sm },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  sliderDotActive: { backgroundColor: colors.primary },
  sliderDotText: { color: colors.textSecondary, fontSize: font.xs, fontWeight: font.semibold },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { backgroundColor: colors.bgInput, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipActive: { backgroundColor: colors.primaryMuted },
  typeChipText: { color: colors.textSecondary, fontSize: font.xs, fontWeight: font.semibold },
  typeChipTextActive: { color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
