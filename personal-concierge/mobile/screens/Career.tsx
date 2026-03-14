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
import { getCareerProfile, getBurnoutRisk, getCareerCoaching, logCareerReflection, updateCareerProfile } from '../lib/api';
import type { CareerProfile, BurnoutRisk } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

export default function Career() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [burnout, setBurnout] = useState<BurnoutRisk | null>(null);
  const [coaching, setCoaching] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [productivity, setProductivity] = useState('7');
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editYears, setEditYears] = useState('');
  const [editGoals, setEditGoals] = useState('');
  const [editSkillsDev, setEditSkillsDev] = useState('');
  const [editSkillsStrong, setEditSkillsStrong] = useState('');
  const [editSatisfaction, setEditSatisfaction] = useState('7');
  const [editMilestone, setEditMilestone] = useState('');

  const fetchData = useCallback(async () => {
    const [p, b] = await Promise.all([getCareerProfile(), getBurnoutRisk()]);
    setProfile(p);
    setBurnout(b);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCoaching = useCallback(async () => {
    setCoaching('Loading...');
    const result = await getCareerCoaching();
    setCoaching(result?.coaching || 'Unable to generate coaching.');
  }, []);

  const handleReflection = useCallback(async () => {
    await logCareerReflection({
      wins: wins.split(',').map(w => w.trim()).filter(Boolean),
      challenges: challenges.split(',').map(c => c.trim()).filter(Boolean),
      productivity_score: parseInt(productivity) || 7,
    });
    setShowReflection(false);
    setWins(''); setChallenges(''); setProductivity('7');
    fetchData();
  }, [wins, challenges, productivity, fetchData]);

  const openProfileEditor = useCallback(() => {
    if (profile) {
      setEditRole(profile.role_title || '');
      setEditIndustry(profile.industry || '');
      setEditYears(profile.years_experience?.toString() || '');
      setEditGoals((profile.career_goals || []).join(', '));
      setEditSkillsDev((profile.skills_to_develop || []).join(', '));
      setEditSkillsStrong((profile.skills_strong || []).join(', '));
      setEditSatisfaction(profile.satisfaction_score?.toString() || '7');
      setEditMilestone(profile.next_milestone || '');
    }
    setShowProfileEditor(true);
  }, [profile]);

  const handleSaveProfile = useCallback(async () => {
    await updateCareerProfile({
      role_title: editRole,
      industry: editIndustry,
      years_experience: parseInt(editYears) || undefined,
      career_goals: editGoals.split(',').map(s => s.trim()).filter(Boolean),
      skills_to_develop: editSkillsDev.split(',').map(s => s.trim()).filter(Boolean),
      skills_strong: editSkillsStrong.split(',').map(s => s.trim()).filter(Boolean),
      satisfaction_score: parseInt(editSatisfaction) || 7,
      next_milestone: editMilestone,
    });
    setShowProfileEditor(false);
    fetchData();
  }, [editRole, editIndustry, editYears, editGoals, editSkillsDev, editSkillsStrong, editSatisfaction, editMilestone, fetchData]);

  const riskColor = (level: string) => {
    switch (level) {
      case 'high': return colors.error;
      case 'elevated': return colors.warning;
      case 'moderate': return colors.scoreFair;
      default: return colors.success;
    }
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading career data...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Career & Development</Text>

      {burnout && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: riskColor(burnout.risk_level) }]}>
          <Text style={styles.burnoutLabel}>BURNOUT RISK</Text>
          <View style={styles.burnoutRow}>
            <Text style={[styles.burnoutScore, { color: riskColor(burnout.risk_level) }]}>
              {burnout.risk_score}
            </Text>
            <Text style={[styles.burnoutLevel, { color: riskColor(burnout.risk_level) }]}>
              {burnout.risk_level.toUpperCase()}
            </Text>
          </View>
          {(burnout.contributing_factors || []).map((f, i) => (
            <Text key={i} style={styles.factorText}>• {f}</Text>
          ))}
          {(burnout.recommendations || []).map((r, i) => (
            <Text key={i} style={styles.recText}>→ {r}</Text>
          ))}
        </View>
      )}

      {profile && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Profile</Text>
            <TouchableOpacity onPress={openProfileEditor}>
              <Text style={{ color: colors.textAccent, fontSize: font.sm, fontWeight: font.semibold }}>Edit</Text>
            </TouchableOpacity>
          </View>
          {profile.role_title && (
            <Text style={styles.profileText}>{profile.role_title} · {profile.industry || 'N/A'}</Text>
          )}
          {profile.satisfaction_score != null && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Satisfaction</Text>
              <Text style={styles.metricVal}>{profile.satisfaction_score}/10</Text>
            </View>
          )}
          {profile.next_milestone && (
            <Text style={styles.milestone}>Next: {profile.next_milestone}</Text>
          )}
          {!profile.role_title && (
            <TouchableOpacity onPress={openProfileEditor}>
              <Text style={styles.emptyText}>Tap to set up your career profile</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showProfileEditor && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Career Profile</Text>
          <TextInput style={styles.input} placeholder="Role / Title" placeholderTextColor={colors.textTertiary} value={editRole} onChangeText={setEditRole} />
          <TextInput style={styles.input} placeholder="Industry" placeholderTextColor={colors.textTertiary} value={editIndustry} onChangeText={setEditIndustry} />
          <TextInput style={styles.input} placeholder="Years of experience" placeholderTextColor={colors.textTertiary} keyboardType="numeric" value={editYears} onChangeText={setEditYears} />
          <TextInput style={styles.input} placeholder="Career goals (comma-separated)" placeholderTextColor={colors.textTertiary} value={editGoals} onChangeText={setEditGoals} />
          <TextInput style={styles.input} placeholder="Skills to develop (comma-separated)" placeholderTextColor={colors.textTertiary} value={editSkillsDev} onChangeText={setEditSkillsDev} />
          <TextInput style={styles.input} placeholder="Strong skills (comma-separated)" placeholderTextColor={colors.textTertiary} value={editSkillsStrong} onChangeText={setEditSkillsStrong} />
          <TextInput style={styles.input} placeholder="Satisfaction (1-10)" placeholderTextColor={colors.textTertiary} keyboardType="numeric" value={editSatisfaction} onChangeText={setEditSatisfaction} />
          <TextInput style={styles.input} placeholder="Next milestone" placeholderTextColor={colors.textTertiary} value={editMilestone} onChangeText={setEditMilestone} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.bgElevated }]} onPress={() => setShowProfileEditor(false)}>
              <Text style={styles.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleSaveProfile}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCoaching}>
          <Text style={styles.actionBtnText}>Get Coaching</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReflection(!showReflection)}>
          <Text style={styles.actionBtnText}>{showReflection ? 'Cancel' : 'Weekly Reflection'}</Text>
        </TouchableOpacity>
      </View>

      {coaching ? (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
          <Text style={styles.cardTitle}>Career Coaching</Text>
          <Text style={styles.coachingText}>{coaching}</Text>
        </View>
      ) : null}

      {showReflection && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Reflection</Text>
          <TextInput style={styles.input} placeholder="Wins (comma-separated)" placeholderTextColor={colors.textTertiary} value={wins} onChangeText={setWins} />
          <TextInput style={styles.input} placeholder="Challenges (comma-separated)" placeholderTextColor={colors.textTertiary} value={challenges} onChangeText={setChallenges} />
          <TextInput style={styles.input} placeholder="Productivity (1-10)" placeholderTextColor={colors.textTertiary} value={productivity} onChangeText={setProductivity} keyboardType="numeric" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReflection}>
            <Text style={styles.primaryBtnText}>Submit Reflection</Text>
          </TouchableOpacity>
        </View>
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
  cardTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  burnoutLabel: { ...sectionLabel, marginTop: 0 },
  burnoutRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm },
  burnoutScore: { fontSize: 36, fontWeight: font.bold },
  burnoutLevel: { fontSize: font.sm, fontWeight: font.semibold },
  factorText: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  recText: { fontSize: font.sm, color: colors.textAccent, marginTop: spacing.xs },
  profileText: { fontSize: font.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  metricLabel: { fontSize: font.sm, color: colors.textSecondary },
  metricVal: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  milestone: { fontSize: font.sm, color: colors.textAccent, marginTop: spacing.sm, fontStyle: 'italic' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  actionBtn: {
    flex: 1, backgroundColor: colors.primaryMuted, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  actionBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  coachingText: { fontSize: font.sm, color: colors.textAccent, lineHeight: 22 },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
