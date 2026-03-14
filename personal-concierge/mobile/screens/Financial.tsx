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
import { getSubscriptions, getSubscriptionAudit, addSubscription } from '../lib/api';
import type { Subscription, SubscriptionAudit } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

export default function Financial() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [audit, setAudit] = useState<SubscriptionAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const fetchData = useCallback(async () => {
    const s = await getSubscriptions();
    setSubs(s || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAudit = useCallback(async () => {
    setAudit(null);
    const a = await getSubscriptionAudit();
    setAudit(a);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;
    await addSubscription({
      service_name: newName,
      monthly_cost: parseFloat(newCost) || 0,
      category: newCategory || undefined,
    } as Partial<Subscription>);
    setShowAdd(false);
    setNewName(''); setNewCost(''); setNewCategory('');
    fetchData();
  }, [newName, newCost, newCategory, fetchData]);

  const totalMonthly = subs.reduce((acc, s) => acc + (s.monthly_cost || 0), 0);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading financial data...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Financial</Text>

      <View style={styles.card}>
        <Text style={styles.totalLabel}>Monthly Subscriptions</Text>
        <Text style={styles.totalAmount}>${totalMonthly.toFixed(2)}/mo</Text>
        <Text style={styles.totalSubs}>{subs.length} active subscriptions</Text>
      </View>

      <TouchableOpacity style={styles.auditBtn} onPress={handleAudit}>
        <Text style={styles.auditBtnText}>Run Subscription Audit</Text>
      </TouchableOpacity>

      {audit && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.warning }]}>
          <Text style={styles.cardTitle}>Audit Results</Text>
          <Text style={styles.auditText}>
            Potential savings: ${audit.monthly_savings_potential.toFixed(2)}/mo
          </Text>
          {(audit.dormant_subscriptions || []).length > 0 && (
            <>
              <Text style={styles.auditSubtitle}>Dormant</Text>
              {(audit.dormant_subscriptions || []).map((s, i) => (
                <Text key={i} style={styles.auditItem}>{s.service_name} — ${s.monthly_cost}/mo</Text>
              ))}
            </>
          )}
          {(audit.cancellation_candidates || []).length > 0 && (
            <>
              <Text style={styles.auditSubtitle}>Cancel Candidates</Text>
              {(audit.cancellation_candidates || []).map((s, i) => (
                <Text key={i} style={styles.auditItem}>{s.service_name} — ${s.monthly_cost}/mo</Text>
              ))}
            </>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>SUBSCRIPTIONS</Text>
      {subs.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.subRow}>
            <View>
              <Text style={styles.subName}>{s.service_name}</Text>
              <Text style={styles.subMeta}>{s.category || 'Uncategorized'} · {s.usage_frequency || 'Unknown usage'}</Text>
            </View>
            <Text style={styles.subCost}>${s.monthly_cost?.toFixed(2)}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(!showAdd)}>
        <Text style={styles.addBtnText}>{showAdd ? 'Cancel' : '+ Add Subscription'}</Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Service name" placeholderTextColor={colors.textTertiary} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Monthly cost" placeholderTextColor={colors.textTertiary} value={newCost} onChangeText={setNewCost} keyboardType="decimal-pad" />
          <TextInput style={styles.input} placeholder="Category (health/fitness/entertainment)" placeholderTextColor={colors.textTertiary} value={newCategory} onChangeText={setNewCategory} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Subscription</Text>
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
  totalLabel: { ...sectionLabel, marginBottom: 0, marginTop: 0 },
  totalAmount: { fontSize: font['4xl'], fontWeight: font.bold, color: colors.textPrimary, marginTop: spacing.xs },
  totalSubs: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },
  auditBtn: {
    backgroundColor: colors.primaryMuted, borderRadius: radii.md, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  auditBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  auditText: { fontSize: font.sm, color: colors.warning, marginBottom: spacing.sm },
  auditSubtitle: { fontSize: font.xs, fontWeight: font.semibold, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  auditItem: { fontSize: font.sm, color: colors.error, marginBottom: 2 },
  sectionTitle: { ...sectionLabel },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  subMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  subCost: { fontSize: 18, fontWeight: font.bold, color: colors.textPrimary },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.md },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
