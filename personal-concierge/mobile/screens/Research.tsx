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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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
  const colors: Record<string, string> = {
    high: '#4CAF50',
    moderate: '#FFC107',
    low: '#F44336',
  };
  const bg = colors[grade || ''] || 'rgba(255,255,255,0.2)';
  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg + '20' }]}>
      <Text style={[badgeStyles.text, { color: bg }]}>{(grade || 'unknown').toUpperCase()}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
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
    return <View style={styles.center}><ActivityIndicator color="#6C63FF" size="large" /></View>;
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
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D1A' },
  sweepButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  sweepText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  emptyHint: { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 8 },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  studyType: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  relevance: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 6,
  },
  journal: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 4,
  },
  authors: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginBottom: 8,
  },
  reasons: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 8,
  },
  domains: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  domainTag: {
    backgroundColor: 'rgba(108,99,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  domainText: {
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: '600',
  },
});
