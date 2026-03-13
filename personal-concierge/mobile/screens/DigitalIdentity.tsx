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

interface Platform { name: string; active: boolean; last_updated: string; profile_url?: string }
interface AuditResult { score: number; strengths: string[]; improvements: string[]; run_at: string }
interface ContentSuggestion { title: string; platform: string; topic: string; type: string }

export default function DigitalIdentity() {
  const [brandStatement, setBrandStatement] = useState('');
  const [editingBrand, setEditingBrand] = useState(false);
  const [draftBrand, setDraftBrand] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [latestAudit, setLatestAudit] = useState<AuditResult | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([]);
  const [contentSuggestions, setContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [thoughtLeadership, setThoughtLeadership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [expandedAuditIdx, setExpandedAuditIdx] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const [profile, plats, audits, suggestions] = await Promise.all([
      api<{ brand_statement: string; thought_leadership: boolean }>('/digital-identity/profile'),
      api<Platform[]>('/digital-identity/platforms'),
      api<AuditResult[]>('/digital-identity/audits'),
      api<ContentSuggestion[]>('/digital-identity/content-suggestions'),
    ]);
    setBrandStatement(profile?.brand_statement || '');
    setThoughtLeadership(profile?.thought_leadership ?? false);
    setPlatforms(plats || []);
    setAuditHistory(audits || []);
    if (audits && audits.length > 0) setLatestAudit(audits[0]);
    setContentSuggestions(suggestions || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSaveBrand = useCallback(async () => {
    await apiPost('/digital-identity/profile', { brand_statement: draftBrand });
    setBrandStatement(draftBrand);
    setEditingBrand(false);
    fetchData();
  }, [draftBrand, fetchData]);

  const handleRunAudit = useCallback(async () => {
    setAuditRunning(true);
    await apiPost('/digital-identity/audits/run', {});
    await fetchData();
    setAuditRunning(false);
  }, [fetchData]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading digital identity...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Digital Identity</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Brand Statement</Text>
        {editingBrand ? (
          <>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
              value={draftBrand}
              onChangeText={setDraftBrand}
              placeholder="Define your personal brand..."
              placeholderTextColor="#555577"
            />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditingBrand(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveBrand}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={() => { setDraftBrand(brandStatement); setEditingBrand(true); }}>
            <Text style={brandStatement ? styles.brandText : styles.dimText}>
              {brandStatement || 'Tap to define your personal brand statement...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.auditHeader}>
          <Text style={styles.cardTitle}>LinkedIn Audit</Text>
          <TouchableOpacity style={styles.runBtn} onPress={handleRunAudit} disabled={auditRunning}>
            <Text style={styles.runBtnText}>{auditRunning ? 'Running...' : 'Run Audit'}</Text>
          </TouchableOpacity>
        </View>
        {latestAudit ? (
          <>
            <View style={styles.auditScoreRow}>
              <Text style={[styles.auditScore, { color: scoreColor(latestAudit.score) }]}>{latestAudit.score}</Text>
              <Text style={styles.auditScoreLabel}>/ 100</Text>
            </View>
            {latestAudit.strengths.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.subLabel}>Strengths</Text>
                {latestAudit.strengths.map((s, i) => (
                  <View key={i} style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            {latestAudit.improvements.length > 0 && (
              <View>
                <Text style={styles.subLabel}>Improvements</Text>
                {latestAudit.improvements.map((s, i) => (
                  <View key={i} style={styles.badgeAmber}>
                    <Text style={styles.badgeAmberText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.dimText}>No audit run yet. Tap "Run Audit" to begin.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>PLATFORMS</Text>
      {platforms.map((p, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.platformRow}>
            <View style={[styles.statusDot, { backgroundColor: p.active ? '#00b894' : '#e17055' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.platformName}>{p.name}</Text>
              <Text style={styles.dimText}>Updated: {p.last_updated}</Text>
            </View>
            <Text style={[styles.statusLabel, { color: p.active ? '#00b894' : '#e17055' }]}>
              {p.active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      ))}
      {platforms.length === 0 && (
        <View style={styles.card}><Text style={styles.dimText}>No platforms connected</Text></View>
      )}

      {thoughtLeadership && contentSuggestions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>CONTENT SUGGESTIONS</Text>
          {contentSuggestions.map((cs, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.contentTitle}>{cs.title}</Text>
              <View style={styles.contentMeta}>
                <View style={styles.metaChip}><Text style={styles.metaChipText}>{cs.platform}</Text></View>
                <View style={styles.metaChip}><Text style={styles.metaChipText}>{cs.type}</Text></View>
              </View>
              <Text style={styles.dimText}>{cs.topic}</Text>
            </View>
          ))}
        </>
      )}

      {auditHistory.length > 1 && (
        <>
          <Text style={styles.sectionTitle}>AUDIT HISTORY</Text>
          {auditHistory.slice(1).map((audit, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.card}
              onPress={() => setExpandedAuditIdx(expandedAuditIdx === idx ? null : idx)}
            >
              <View style={styles.historyRow}>
                <Text style={styles.historyDate}>{audit.run_at}</Text>
                <Text style={[styles.historyScore, { color: scoreColor(audit.score) }]}>{audit.score}/100</Text>
              </View>
              {expandedAuditIdx === idx && (
                <View style={{ marginTop: 8 }}>
                  {audit.strengths.map((s, i) => (
                    <Text key={i} style={styles.historyDetail}>+ {s}</Text>
                  ))}
                  {audit.improvements.map((s, i) => (
                    <Text key={i} style={[styles.historyDetail, { color: '#fdcb6e' }]}>- {s}</Text>
                  ))}
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  dimText: { fontSize: 13, color: '#8888aa' },
  brandText: { fontSize: 15, color: '#fff', lineHeight: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#8888aa', fontWeight: '600', fontSize: 15 },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  runBtn: { backgroundColor: 'rgba(108,99,255,0.15)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  runBtnText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  auditScoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 12 },
  auditScore: { fontSize: 42, fontWeight: '700' },
  auditScoreLabel: { fontSize: 18, color: '#8888aa', marginLeft: 4 },
  subLabel: { fontSize: 11, color: '#8888aa', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  badgeGreen: { backgroundColor: 'rgba(0,184,148,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  badgeGreenText: { color: '#00b894', fontSize: 13, fontWeight: '500' },
  badgeAmber: { backgroundColor: 'rgba(253,203,110,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  badgeAmberText: { color: '#fdcb6e', fontSize: 13, fontWeight: '500' },
  platformRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  platformName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  contentTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 6 },
  contentMeta: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  metaChip: { backgroundColor: 'rgba(108,99,255,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  metaChipText: { color: '#6C63FF', fontSize: 11, fontWeight: '600' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 14, color: '#fff' },
  historyScore: { fontSize: 16, fontWeight: '700' },
  historyDetail: { fontSize: 13, color: '#00b894', lineHeight: 20 },
});
