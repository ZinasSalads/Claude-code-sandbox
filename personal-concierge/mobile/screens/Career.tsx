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
import { getCareerProfile, getBurnoutRisk, getCareerCoaching, logCareerReflection } from '../lib/api';
import type { CareerProfile, BurnoutRisk } from '../lib/api';

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

  const riskColor = (level: string) => {
    switch (level) {
      case 'high': return '#e17055';
      case 'elevated': return '#fdcb6e';
      case 'moderate': return '#ffeaa7';
      default: return '#00b894';
    }
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading career data...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
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
          {burnout.contributing_factors.map((f, i) => (
            <Text key={i} style={styles.factorText}>• {f}</Text>
          ))}
          {burnout.recommendations.map((r, i) => (
            <Text key={i} style={styles.recText}>→ {r}</Text>
          ))}
        </View>
      )}

      {profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          {profile.current_role && (
            <Text style={styles.profileText}>{profile.current_role} · {profile.industry || 'N/A'}</Text>
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
          {!profile.current_role && <Text style={styles.emptyText}>Set up your career profile via the API.</Text>}
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
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#6c5ce7' }]}>
          <Text style={styles.cardTitle}>Career Coaching</Text>
          <Text style={styles.coachingText}>{coaching}</Text>
        </View>
      ) : null}

      {showReflection && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Reflection</Text>
          <TextInput style={styles.input} placeholder="Wins (comma-separated)" placeholderTextColor="#555577" value={wins} onChangeText={setWins} />
          <TextInput style={styles.input} placeholder="Challenges (comma-separated)" placeholderTextColor="#555577" value={challenges} onChangeText={setChallenges} />
          <TextInput style={styles.input} placeholder="Productivity (1-10)" placeholderTextColor="#555577" value={productivity} onChangeText={setProductivity} keyboardType="numeric" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReflection}>
            <Text style={styles.primaryBtnText}>Submit Reflection</Text>
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
  burnoutLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#8888aa', marginBottom: 4 },
  burnoutRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  burnoutScore: { fontSize: 36, fontWeight: '700' },
  burnoutLevel: { fontSize: 14, fontWeight: '600' },
  factorText: { fontSize: 13, color: '#8888aa', marginBottom: 2 },
  recText: { fontSize: 13, color: '#a29bfe', marginTop: 4 },
  profileText: { fontSize: 16, color: '#f0f0f5', marginBottom: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metricLabel: { fontSize: 13, color: '#8888aa' },
  metricVal: { fontSize: 15, fontWeight: '600', color: '#f0f0f5' },
  milestone: { fontSize: 13, color: '#a29bfe', marginTop: 8, fontStyle: 'italic' },
  emptyText: { fontSize: 13, color: '#555577' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  actionBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 13 },
  coachingText: { fontSize: 14, color: '#a29bfe', lineHeight: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
