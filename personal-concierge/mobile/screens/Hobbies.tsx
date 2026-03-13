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

interface Hobby {
  id: string; name: string; category: string; weekly_target_hours: number;
  weekly_actual_hours: number; last_activity_date: string; dormant_weeks: number;
  priority: number;
}
interface SeasonalUpcoming { name: string; season: string; starts_in: string }
interface PriorityConflict { hobby_a: string; hobby_b: string; overlap: string; suggestion: string }

export default function Hobbies() {
  const [healthScore, setHealthScore] = useState(0);
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalUpcoming[]>([]);
  const [conflicts, setConflicts] = useState<PriorityConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('creative');
  const [newTargetHours, setNewTargetHours] = useState('2');

  const fetchData = useCallback(async () => {
    const [score, h, s, c] = await Promise.all([
      api<{ score: number }>('/hobbies/score'),
      api<Hobby[]>('/hobbies'),
      api<SeasonalUpcoming[]>('/hobbies/seasonal'),
      api<PriorityConflict[]>('/hobbies/conflicts'),
    ]);
    setHealthScore(score?.score ?? 0);
    setHobbies(h || []);
    setSeasonal(s || []);
    setConflicts(c || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAddHobby = useCallback(async () => {
    if (!newName.trim()) return;
    await apiPost('/hobbies', {
      name: newName, category: newCategory,
      weekly_target_hours: parseFloat(newTargetHours) || 2,
    });
    setNewName(''); setNewTargetHours('2');
    setShowAddForm(false);
    fetchData();
  }, [newName, newCategory, newTargetHours, fetchData]);

  const scoreColor = (s: number) => s >= 70 ? '#00b894' : s >= 40 ? '#fdcb6e' : '#e17055';
  const categories = ['creative', 'physical', 'intellectual', 'social', 'outdoor', 'other'];

  const activeHobbies = hobbies.filter((h) => h.dormant_weeks < 3);
  const dormantHobbies = hobbies.filter((h) => h.dormant_weeks >= 3);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading hobbies...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Hobbies</Text>

      <View style={styles.card}>
        <View style={styles.ringContainer}>
          <Text style={[styles.ringScore, { color: scoreColor(healthScore) }]}>{healthScore}</Text>
          <Text style={styles.ringLabel}>/ 100</Text>
        </View>
        <Text style={styles.ringSubtitle}>Hobby Health Score</Text>
      </View>

      <Text style={styles.sectionTitle}>ACTIVE HOBBIES</Text>
      {activeHobbies.map((h) => {
        const pct = h.weekly_target_hours > 0 ? Math.min((h.weekly_actual_hours / h.weekly_target_hours) * 100, 100) : 0;
        return (
          <View key={h.id} style={styles.card}>
            <View style={styles.hobbyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hobbyName}>{h.name}</Text>
                <Text style={styles.hobbyCategory}>{h.category}</Text>
              </View>
              <Text style={[styles.hobbyHours, { color: scoreColor(pct) }]}>
                {h.weekly_actual_hours.toFixed(1)}h / {h.weekly_target_hours}h
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: scoreColor(pct) }]} />
            </View>
            <Text style={styles.dimText}>Last activity: {h.last_activity_date}</Text>
          </View>
        );
      })}
      {activeHobbies.length === 0 && (
        <View style={styles.card}><Text style={styles.dimText}>No active hobbies this week</Text></View>
      )}

      {dormantHobbies.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>DORMANT ALERTS</Text>
          {dormantHobbies.map((h) => (
            <View key={h.id} style={[styles.card, { borderColor: 'rgba(253,203,110,0.3)' }]}>
              <View style={styles.dormantRow}>
                <View style={styles.dormantIcon}>
                  <Text style={styles.dormantIconText}>!</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dormantText}>
                    You haven't done {h.name} in {h.dormant_weeks} weeks
                  </Text>
                  <Text style={styles.dimText}>Last: {h.last_activity_date}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {seasonal.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SEASONAL UPCOMING</Text>
          <View style={styles.card}>
            {seasonal.map((s, i) => (
              <View key={i} style={[styles.seasonalRow, i < seasonal.length - 1 && styles.seasonalRowBorder]}>
                <View style={styles.seasonBadge}>
                  <Text style={styles.seasonBadgeText}>{s.season}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seasonalName}>{s.name}</Text>
                  <Text style={styles.dimText}>Starts in {s.starts_in}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {conflicts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>PRIORITY CONFLICTS</Text>
          {conflicts.map((c, i) => (
            <View key={i} style={[styles.card, { borderColor: 'rgba(225,112,85,0.3)' }]}>
              <Text style={styles.conflictTitle}>{c.hobby_a} vs {c.hobby_b}</Text>
              <Text style={styles.conflictOverlap}>{c.overlap}</Text>
              <View style={styles.suggestionBox}>
                <Text style={styles.suggestionText}>{c.suggestion}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm(!showAddForm)}>
        <Text style={styles.addBtnText}>{showAddForm ? 'Cancel' : '+ Add Hobby'}</Text>
      </TouchableOpacity>

      {showAddForm && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Hobby name" placeholderTextColor="#555577" value={newName} onChangeText={setNewName} />
          <Text style={styles.formLabel}>Category</Text>
          <View style={styles.typeRow}>
            {categories.map((c) => (
              <TouchableOpacity key={c} style={[styles.typeChip, newCategory === c && styles.typeChipActive]} onPress={() => setNewCategory(c)}>
                <Text style={[styles.typeChipText, newCategory === c && styles.typeChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Weekly target hours" placeholderTextColor="#555577" keyboardType="numeric" value={newTargetHours} onChangeText={setNewTargetHours} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddHobby}>
            <Text style={styles.primaryBtnText}>Add Hobby</Text>
          </TouchableOpacity>
        </View>
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
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8888aa', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  dimText: { fontSize: 13, color: '#8888aa' },
  ringContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 4 },
  ringScore: { fontSize: 56, fontWeight: '700' },
  ringLabel: { fontSize: 20, color: '#8888aa', marginLeft: 4 },
  ringSubtitle: { textAlign: 'center', color: '#8888aa', fontSize: 13 },
  hobbyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hobbyName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  hobbyCategory: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  hobbyHours: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 6, borderRadius: 3 },
  dormantRow: { flexDirection: 'row', alignItems: 'center' },
  dormantIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(253,203,110,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  dormantIconText: { color: '#fdcb6e', fontSize: 16, fontWeight: '700' },
  dormantText: { color: '#fdcb6e', fontSize: 14, fontWeight: '500' },
  seasonalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  seasonalRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  seasonBadge: { backgroundColor: 'rgba(108,99,255,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 12 },
  seasonBadgeText: { color: '#6C63FF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  seasonalName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  conflictTitle: { fontSize: 15, fontWeight: '600', color: '#e17055', marginBottom: 4 },
  conflictOverlap: { fontSize: 13, color: '#8888aa', marginBottom: 8 },
  suggestionBox: { backgroundColor: 'rgba(108,99,255,0.08)', borderRadius: 8, padding: 10 },
  suggestionText: { color: '#fff', fontSize: 13 },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 15 },
  formLabel: { fontSize: 12, color: '#8888aa', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  typeChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipActive: { backgroundColor: 'rgba(108,99,255,0.2)' },
  typeChipText: { color: '#8888aa', fontSize: 12, fontWeight: '600' },
  typeChipTextActive: { color: '#6C63FF' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
