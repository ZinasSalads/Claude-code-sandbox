import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getLegacyProfile, saveLegacyProfile, getLegacyMilestones,
  logLegacyMilestone, getLegacyDrift, getLegacyBridge,
} from '../lib/api';

const ACCENT = '#6C63FF';
const BG = '#0D0D1A';
const CARD = '#1A1A2E';
const AMBER = '#FFB547';
const GREEN = '#00C48C';

export default function Legacy() {
  const [profile, setProfile] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [drift, setDrift] = useState<any>(null);
  const [bridge, setBridge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit states
  const [editingVision, setEditingVision] = useState(false);
  const [visionText, setVisionText] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneCategory, setMilestoneCategory] = useState('personal');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [p, m, d, b] = await Promise.all([
      getLegacyProfile(),
      getLegacyMilestones(),
      getLegacyDrift(),
      getLegacyBridge(),
    ]);
    if (p) {
      setProfile(p);
      setVisionText(p.ten_year_vision || '');
    }
    if (Array.isArray(m)) setMilestones(m);
    if (d && d.detected) setDrift(d);
    if (b && b.bridge) setBridge(b.bridge);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const saveVision = async () => {
    setSaving(true);
    await saveLegacyProfile({ ten_year_vision: visionText });
    setEditingVision(false);
    await load();
    setSaving(false);
  };

  const addMilestone = async () => {
    if (!milestoneTitle.trim()) return;
    setSaving(true);
    await logLegacyMilestone({
      title: milestoneTitle,
      category: milestoneCategory,
      milestone_date: new Date().toISOString().split('T')[0],
    });
    setMilestoneTitle('');
    setAddingMilestone(false);
    await load();
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  }

  const categories = ['fitness', 'career', 'relationship', 'travel', 'health', 'personal'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      <Text style={styles.title}>Legacy & Vision</Text>
      <Text style={styles.subtitle}>Your 10-year horizon</Text>

      {/* Bridge moment */}
      {bridge && (
        <View style={[styles.card, styles.bridgeCard]}>
          <Text style={styles.bridgeLabel}>This Week's Bridge</Text>
          <Text style={styles.bridgeText}>{bridge}</Text>
        </View>
      )}

      {/* Values drift */}
      {drift && (
        <View style={[styles.card, styles.driftCard]}>
          <Text style={styles.driftLabel}>Values Drift Detected</Text>
          <Text style={styles.driftText}>{drift.gentle_observation}</Text>
        </View>
      )}

      {/* Vision */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>10-Year Vision</Text>
          <TouchableOpacity onPress={() => setEditingVision(!editingVision)}>
            <Text style={styles.editBtn}>{editingVision ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {editingVision ? (
          <>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              value={visionText}
              onChangeText={setVisionText}
              placeholder="Where do you want to be in 10 years?"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveVision} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Vision'}</Text>
            </TouchableOpacity>
          </>
        ) : profile?.ten_year_vision ? (
          <Text style={styles.visionText}>{profile.ten_year_vision}</Text>
        ) : (
          <Text style={styles.emptyText}>Write your 10-year vision to anchor every daily decision.</Text>
        )}
      </View>

      {/* Milestones */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Life Milestones</Text>
          <TouchableOpacity onPress={() => setAddingMilestone(!addingMilestone)}>
            <Text style={styles.editBtn}>{addingMilestone ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {addingMilestone && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Milestone title"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={milestoneTitle}
              onChangeText={setMilestoneTitle}
            />
            <View style={styles.chipRow}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, milestoneCategory === c && styles.chipSelected]}
                  onPress={() => setMilestoneCategory(c)}
                >
                  <Text style={[styles.chipText, milestoneCategory === c && styles.chipTextSel]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={addMilestone} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Log Milestone'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {milestones.length > 0 ? (
          milestones.slice(0, 10).map((m, i) => (
            <View key={m.id || i} style={styles.milestoneRow}>
              <View style={styles.milestoneDot} />
              <View style={styles.milestoneContent}>
                <Text style={styles.milestoneTitle}>{m.title}</Text>
                <Text style={styles.milestoneDate}>{m.milestone_date} · {m.category}</Text>
                {m.description && <Text style={styles.milestoneDesc}>{m.description}</Text>}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No milestones yet. Log your first achievement.</Text>
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  editBtn: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  bridgeCard: { borderColor: 'rgba(108,99,255,0.3)', backgroundColor: 'rgba(108,99,255,0.08)' },
  bridgeLabel: { fontSize: 12, color: ACCENT, fontWeight: '600', marginBottom: 8 },
  bridgeText: { fontSize: 15, color: '#fff', lineHeight: 24 },
  driftCard: { borderColor: 'rgba(255,181,71,0.3)', backgroundColor: 'rgba(255,181,71,0.08)' },
  driftLabel: { fontSize: 12, color: AMBER, fontWeight: '600', marginBottom: 8 },
  driftText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  visionText: { fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 24 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addForm: { marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: { borderColor: ACCENT, backgroundColor: 'rgba(108,99,255,0.2)' },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' },
  chipTextSel: { color: '#fff' },
  milestoneRow: { flexDirection: 'row', marginBottom: 16, paddingLeft: 4 },
  milestoneDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginTop: 6, marginRight: 12,
  },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  milestoneDate: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  milestoneDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
});
