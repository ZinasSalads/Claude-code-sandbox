import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getLegacyProfile, saveLegacyProfile, getLegacyMilestones,
  logLegacyMilestone, getLegacyDrift, getLegacyBridge,
} from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

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
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const categories = ['fitness', 'career', 'relationship', 'travel', 'health', 'personal'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: font['3xl'], fontWeight: font.bold, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  editBtn: { color: colors.primary, fontSize: font.sm, fontWeight: font.semibold },
  bridgeCard: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryGlow },
  bridgeLabel: { fontSize: font.xs, color: colors.primary, fontWeight: font.semibold, marginBottom: spacing.sm },
  bridgeText: { fontSize: font.md, color: colors.textPrimary, lineHeight: 24 },
  driftCard: { borderColor: colors.warningMuted, backgroundColor: 'rgba(251, 191, 36, 0.08)' },
  driftLabel: { fontSize: font.xs, color: colors.warning, fontWeight: font.semibold, marginBottom: spacing.sm },
  driftText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22 },
  visionText: { fontSize: font.md, color: colors.textSecondary, lineHeight: 24 },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, fontStyle: 'italic' },
  textArea: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.lg,
    color: colors.textPrimary, fontSize: font.md, minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.border,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { color: colors.white, fontSize: font.sm, fontWeight: font.semibold },
  addForm: { marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.lg,
    color: colors.textPrimary, fontSize: font.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.lg,
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { fontSize: font.xs, color: colors.textTertiary, textTransform: 'capitalize' },
  chipTextSel: { color: colors.textPrimary },
  milestoneRow: { flexDirection: 'row', marginBottom: spacing.lg, paddingLeft: spacing.xs },
  milestoneDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginTop: 6, marginRight: spacing.md,
  },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  milestoneDate: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  milestoneDesc: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
