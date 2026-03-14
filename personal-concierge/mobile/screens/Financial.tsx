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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
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
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#fdcb6e' }]}>
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
          <TextInput style={styles.input} placeholder="Service name" placeholderTextColor="#555577" value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Monthly cost" placeholderTextColor="#555577" value={newCost} onChangeText={setNewCost} keyboardType="decimal-pad" />
          <TextInput style={styles.input} placeholder="Category (health/fitness/entertainment)" placeholderTextColor="#555577" value={newCategory} onChangeText={setNewCategory} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Subscription</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { color: '#8888aa', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0f0f5', marginBottom: 16 },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f0f0f5', marginBottom: 8 },
  totalLabel: { fontSize: 12, color: '#8888aa', textTransform: 'uppercase', letterSpacing: 1 },
  totalAmount: { fontSize: 36, fontWeight: '700', color: '#f0f0f5', marginTop: 4 },
  totalSubs: { fontSize: 13, color: '#555577', marginTop: 4 },
  auditBtn: {
    backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 16,
  },
  auditBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 14 },
  auditText: { fontSize: 14, color: '#fdcb6e', marginBottom: 8 },
  auditSubtitle: { fontSize: 12, fontWeight: '600', color: '#8888aa', marginTop: 8, marginBottom: 4 },
  auditItem: { fontSize: 13, color: '#e17055', marginBottom: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: 15, fontWeight: '600', color: '#f0f0f5' },
  subMeta: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  subCost: { fontSize: 18, fontWeight: '700', color: '#f0f0f5' },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6c5ce7', fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
