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
import { getSocialCircle, getSocialScore, addSocialContact, logSocialConnection } from '../lib/api';
import type { SocialContact, SocialScore } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

export default function Social() {
  const [contacts, setContacts] = useState<SocialContact[]>([]);
  const [score, setScore] = useState<SocialScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relType, setRelType] = useState('');

  const fetchData = useCallback(async () => {
    const [c, s] = await Promise.all([getSocialCircle(), getSocialScore()]);
    setContacts(c || []);
    setScore(s);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAdd = useCallback(async () => {
    if (!name.trim()) return;
    await addSocialContact({ name, relationship_type: relType || undefined } as Partial<SocialContact>);
    setShowForm(false);
    setName(''); setRelType('');
    fetchData();
  }, [name, relType, fetchData]);

  const handleLog = useCallback(async (contactId: string) => {
    await logSocialConnection(contactId, { activity_type: 'check-in', quality_rating: 4 });
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading social data...</Text></View>;
  }

  const overdue = contacts.filter(c => c.is_overdue);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Social Health</Text>

      {score && (
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: getScoreColor(score.score) }]}>{score.score}</Text>
            <Text style={styles.scoreLabel}>/ 100</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{score.connection_score}</Text>
              <Text style={styles.breakdownLabel}>Connect</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{score.quality_score}</Text>
              <Text style={styles.breakdownLabel}>Quality</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{score.leisure_score}</Text>
              <Text style={styles.breakdownLabel}>Leisure</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{score.balance_score}</Text>
              <Text style={styles.breakdownLabel}>Balance</Text>
            </View>
          </View>
        </View>
      )}

      {overdue.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>CONNECT SOON</Text>
          {overdue.slice(0, 5).map((c) => (
            <View key={c.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.error }]}>
              <View style={styles.contactRow}>
                <View>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactMeta}>
                    {c.relationship_type || 'Contact'} · {c.days_since_contact != null ? `${c.days_since_contact} days ago` : 'Never contacted'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.logBtn} onPress={() => handleLog(c.id)}>
                  <Text style={styles.logBtnText}>Log</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>ALL CONTACTS</Text>
      {contacts.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.contactRow}>
            <View>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactMeta}>
                {c.relationship_type || 'Contact'}
                {c.last_contact_date ? ` · Last: ${c.last_contact_date}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.logBtn} onPress={() => handleLog(c.id)}>
              <Text style={styles.logBtnText}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add Contact'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textTertiary} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Relationship (friend, family, etc.)" placeholderTextColor={colors.textTertiary} value={relType} onChangeText={setRelType} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Contact</Text>
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
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: spacing.lg },
  scoreNum: { fontSize: 48, fontWeight: font.bold },
  scoreLabel: { fontSize: font.lg, color: colors.textTertiary, marginLeft: spacing.xs },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-around' },
  breakdownItem: { alignItems: 'center' },
  breakdownVal: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  breakdownLabel: { ...sectionLabel, marginBottom: 0, marginTop: 2 },
  sectionTitle: { ...sectionLabel },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactName: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  contactMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  logBtn: {
    backgroundColor: colors.accentMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  logBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.accent, fontWeight: font.semibold, fontSize: font.md },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
