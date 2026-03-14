import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface Article {
  pubmed_id: string;
  title: string;
  authors?: string;
  journal?: string;
  publication_date?: string;
  relevance_score?: number;
  relevance_reasons?: string;
  evidence_grade?: string;
  study_type?: string;
  domains?: string[];
  url?: string;
  saved?: boolean;
}

function GradeBadge({ grade }: { grade?: string }) {
  const gradeColors: Record<string, string> = {
    high: colors.success,
    moderate: colors.warning,
    low: colors.error,
  };
  const gradeColorsBg: Record<string, string> = {
    high: colors.successMuted,
    moderate: colors.warningMuted,
    low: colors.errorMuted,
  };
  const fg = gradeColors[grade || ''] || colors.textTertiary;
  const bg = gradeColorsBg[grade || ''] || colors.bgElevated;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg }]}>
      <Text style={[badgeStyles.text, { color: fg }]}>{(grade || 'unknown').toUpperCase()}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm },
  text: { fontSize: font.xs, fontWeight: font.bold, letterSpacing: 0.5 },
});

export default function Research() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/research/articles`);
      if (resp.ok) setArticles(await resp.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSweep = useCallback(async () => {
    setSweeping(true);
    try {
      const resp = await fetch(`${API_URL}/research/sweep`, { method: 'POST' });
      if (resp.ok) {
        const result = await resp.json();
        setArticles(result.articles || []);
      }
    } catch { /* ignore */ }
    setSweeping(false);
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sweep button */}
      <TouchableOpacity style={styles.sweepButton} onPress={handleSweep} disabled={sweeping} activeOpacity={0.8}>
        {sweeping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sweepText}>Run Research Sweep</Text>
        )}
      </TouchableOpacity>

      {articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No research articles yet.</Text>
          <Text style={styles.emptyHint}>Run a sweep to find relevant studies.</Text>
        </View>
      ) : (
        articles.map((a) => (
          <TouchableOpacity
            key={a.pubmed_id}
            style={styles.card}
            onPress={() => a.url && Linking.openURL(a.url)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <GradeBadge grade={a.evidence_grade} />
              {a.study_type && (
                <Text style={styles.studyType}>{a.study_type}</Text>
              )}
              {a.relevance_score != null && (
                <Text style={styles.relevance}>
                  {Math.round(a.relevance_score * 100)}% relevant
                </Text>
              )}
            </View>
            <Text style={styles.title} numberOfLines={3}>{a.title}</Text>
            <Text style={styles.journal} numberOfLines={1}>
              {a.journal} · {a.publication_date}
            </Text>
            {a.authors && (
              <Text style={styles.authors} numberOfLines={1}>{a.authors}</Text>
            )}
            {a.relevance_reasons && (
              <Text style={styles.reasons} numberOfLines={2}>{a.relevance_reasons}</Text>
            )}
            {a.domains && a.domains.length > 0 && (
              <View style={styles.domains}>
                {a.domains.map((d, i) => (
                  <View key={i} style={styles.domainTag}>
                    <Text style={styles.domainText}>{d}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  sweepButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadow.glow,
  },
  sweepText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  emptyContainer: { alignItems: 'center', paddingTop: spacing['5xl'] },
  empty: { color: colors.textSecondary, fontSize: font.lg },
  emptyHint: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm },
  card: {
    ...cardStyle,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  studyType: {
    color: colors.textTertiary,
    fontSize: font.xs,
    fontWeight: font.semibold,
    textTransform: 'uppercase',
  },
  relevance: {
    color: colors.textAccent,
    fontSize: font.sm,
    fontWeight: font.semibold,
    marginLeft: 'auto',
  },
  title: {
    color: colors.textPrimary,
    fontSize: font.md,
    fontWeight: font.semibold,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  journal: {
    color: colors.textTertiary,
    fontSize: font.sm,
    marginBottom: spacing.xs,
  },
  authors: {
    color: colors.textTertiary,
    fontSize: font.xs,
    marginBottom: spacing.sm,
  },
  reasons: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  domains: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  domainTag: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  domainText: {
    color: colors.textAccent,
    fontSize: font.xs,
    fontWeight: font.semibold,
  },
});
