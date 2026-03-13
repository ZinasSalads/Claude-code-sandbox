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
    setContacts(c);
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

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading social data...</Text></View>;
  }

  const overdue = contacts.filter(c => c.is_overdue);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Social Health</Text>

      {score && (
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: scoreColor(score.score) }]}>{score.score}</Text>
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
            <View key={c.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#e17055' }]}>
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
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#555577" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Relationship (friend, family, etc.)" placeholderTextColor="#555577" value={relType} onChangeText={setRelType} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Contact</Text>
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
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 16 },
  scoreNum: { fontSize: 48, fontWeight: '700' },
  scoreLabel: { fontSize: 18, color: '#555577', marginLeft: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-around' },
  breakdownItem: { alignItems: 'center' },
  breakdownVal: { fontSize: 18, fontWeight: '600', color: '#f0f0f5' },
  breakdownLabel: { fontSize: 10, color: '#555577', textTransform: 'uppercase', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactName: { fontSize: 16, fontWeight: '600', color: '#f0f0f5' },
  contactMeta: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  logBtn: {
    backgroundColor: 'rgba(108,92,231,0.2)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  logBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 13 },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6c5ce7', fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
