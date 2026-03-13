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

async function apiPut<T>(path: string, body: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

interface Platform { name: string; active: boolean; last_updated: string; profile_url?: string }
interface AuditResult { score: number; strengths: string[]; improvements: string[]; run_at: string }
interface ContentSuggestion { title: string; platform: string; topic: string; type: string }

interface ProfileData {
  brand_statement: string;
  thought_leadership: boolean;
  platforms_active: Platform[];
  linkedin_url: string;
  linkedin_headline: string;
  linkedin_summary: string;
  personal_website: string;
  github_url: string;
  twitter_handle: string;
  content_style: string;
  target_audience: string;
  brand_keywords: string;
  visibility_comfort: string;
  notes: string;
}

const PROFILE_FIELDS: { key: keyof ProfileFormData; label: string; multiline?: boolean }[] = [
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'linkedin_headline', label: 'LinkedIn Headline' },
  { key: 'linkedin_summary', label: 'LinkedIn Summary', multiline: true },
  { key: 'personal_website', label: 'Personal Website' },
  { key: 'github_url', label: 'GitHub URL' },
  { key: 'twitter_handle', label: 'Twitter Handle' },
  { key: 'content_style', label: 'Content Style' },
  { key: 'target_audience', label: 'Target Audience' },
  { key: 'brand_keywords', label: 'Brand Keywords' },
  { key: 'visibility_comfort', label: 'Visibility Comfort' },
  { key: 'notes', label: 'Notes', multiline: true },
];

interface ProfileFormData {
  linkedin_url: string;
  linkedin_headline: string;
  linkedin_summary: string;
  personal_website: string;
  github_url: string;
  twitter_handle: string;
  content_style: string;
  target_audience: string;
  brand_keywords: string;
  visibility_comfort: string;
  notes: string;
}

const emptyForm: ProfileFormData = {
  linkedin_url: '',
  linkedin_headline: '',
  linkedin_summary: '',
  personal_website: '',
  github_url: '',
  twitter_handle: '',
  content_style: '',
  target_audience: '',
  brand_keywords: '',
  visibility_comfort: '',
  notes: '',
};

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
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormData>({ ...emptyForm });

  const fetchData = useCallback(async () => {
    const [profile, audits, suggestions] = await Promise.all([
      api<ProfileData>('/digital/profile'),
      api<AuditResult[]>('/digital/audit-history'),
      api<ContentSuggestion[]>('/digital/content-suggestions'),
    ]);
    setBrandStatement(profile?.brand_statement || '');
    setThoughtLeadership(profile?.thought_leadership ?? false);
    setPlatforms(profile?.platforms_active || []);
    setProfileForm({
      linkedin_url: profile?.linkedin_url || '',
      linkedin_headline: profile?.linkedin_headline || '',
      linkedin_summary: profile?.linkedin_summary || '',
      personal_website: profile?.personal_website || '',
      github_url: profile?.github_url || '',
      twitter_handle: profile?.twitter_handle || '',
      content_style: profile?.content_style || '',
      target_audience: profile?.target_audience || '',
      brand_keywords: profile?.brand_keywords || '',
      visibility_comfort: profile?.visibility_comfort || '',
      notes: profile?.notes || '',
    });
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
    await apiPut('/digital/profile', { brand_statement: draftBrand });
    setBrandStatement(draftBrand);
    setEditingBrand(false);
    fetchData();
  }, [draftBrand, fetchData]);

  const handleRunAudit = useCallback(async () => {
    setAuditRunning(true);
    await apiPost('/digital/linkedin-audit', {});
    await fetchData();
    setAuditRunning(false);
  }, [fetchData]);

  const handleSaveProfile = useCallback(async () => {
    await apiPut('/digital/profile', profileForm);
    setEditingProfile(false);
    fetchData();
  }, [profileForm, fetchData]);

  const updateFormField = useCallback((key: keyof ProfileFormData, value: string) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
  }, []);

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
          <Text style={styles.cardTitle}>Profile Details</Text>
          <TouchableOpacity
            style={styles.runBtn}
            onPress={() => setEditingProfile(!editingProfile)}
          >
            <Text style={styles.runBtnText}>{editingProfile ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        {editingProfile ? (
          <>
            {PROFILE_FIELDS.map(({ key, label, multiline }) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={[styles.input, multiline ? { minHeight: 70, textAlignVertical: 'top' } : {}]}
                  multiline={multiline}
                  value={profileForm[key]}
                  onChangeText={(v) => updateFormField(key, v)}
                  placeholder={label}
                  placeholderTextColor="#555577"
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile}>
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View>
            {PROFILE_FIELDS.map(({ key, label }) => {
              const val = profileForm[key];
              if (!val) return null;
              return (
                <View key={key} style={{ marginBottom: 6 }}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{val}</Text>
                </View>
              );
            })}
            {PROFILE_FIELDS.every(({ key }) => !profileForm[key]) && (
              <Text style={styles.dimText}>No profile details set. Tap "Edit" to add your information.</Text>
            )}
          </View>
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
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#8888aa', marginBottom: 4 },
  fieldValue: { fontSize: 14, color: '#fff', lineHeight: 20 },
});
