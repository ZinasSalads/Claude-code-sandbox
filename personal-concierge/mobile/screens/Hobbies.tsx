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
import { API_URL } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

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
  const [logHobbyId, setLogHobbyId] = useState<string | null>(null);
  const [logDuration, setLogDuration] = useState('30');
  const [logQuality, setLogQuality] = useState(5);
  const [logNotes, setLogNotes] = useState('');

  const fetchData = useCallback(async () => {
    const [score, h, s, c] = await Promise.all([
      api<{ score: number }>('/hobbies/health-score'),
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

  const handleLogSession = useCallback(async () => {
    if (!logHobbyId) return;
    await apiPost(`/hobbies/${logHobbyId}/log`, {
      duration_minutes: parseInt(logDuration) || 30,
      quality_rating: logQuality,
      notes: logNotes,
    });
    setLogHobbyId(null); setLogDuration('30'); setLogQuality(5); setLogNotes('');
    fetchData();
  }, [logHobbyId, logDuration, logQuality, logNotes, fetchData]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Hobbies</Text>

      <View style={styles.card}>
        <View style={styles.ringContainer}>
          <Text style={[styles.ringScore, { color: getScoreColor(healthScore) }]}>{healthScore}</Text>
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
              <Text style={[styles.hobbyHours, { color: getScoreColor(pct) }]}>
                {h.weekly_actual_hours.toFixed(1)}h / {h.weekly_target_hours}h
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: getScoreColor(pct) }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.dimText}>Last activity: {h.last_activity_date}</Text>
              <TouchableOpacity onPress={() => setLogHobbyId(logHobbyId === h.id ? null : h.id)}>
                <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: font.semibold }}>Log Session</Text>
              </TouchableOpacity>
            </View>
            {logHobbyId === h.id && (
              <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                <TextInput style={styles.input} placeholder="Duration (minutes)" placeholderTextColor={colors.textTertiary} keyboardType="numeric" value={logDuration} onChangeText={setLogDuration} />
                <Text style={styles.formLabel}>Quality ({logQuality}/10)</Text>
                <View style={styles.typeRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                    <TouchableOpacity key={v} style={[styles.typeChip, logQuality === v && styles.typeChipActive]} onPress={() => setLogQuality(v)}>
                      <Text style={[styles.typeChipText, logQuality === v && styles.typeChipTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Notes (optional)" placeholderTextColor={colors.textTertiary} value={logNotes} onChangeText={setLogNotes} />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleLogSession}>
                  <Text style={styles.primaryBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
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
            <View key={h.id} style={[styles.card, { borderColor: colors.warningMuted }]}>
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
            <View key={i} style={[styles.card, { borderColor: colors.errorMuted }]}>
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
          <TextInput style={styles.input} placeholder="Hobby name" placeholderTextColor={colors.textTertiary} value={newName} onChangeText={setNewName} />
          <Text style={styles.formLabel}>Category</Text>
          <View style={styles.typeRow}>
            {categories.map((c) => (
              <TouchableOpacity key={c} style={[styles.typeChip, newCategory === c && styles.typeChipActive]} onPress={() => setNewCategory(c)}>
                <Text style={[styles.typeChipText, newCategory === c && styles.typeChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Weekly target hours" placeholderTextColor={colors.textTertiary} keyboardType="numeric" value={newTargetHours} onChangeText={setNewTargetHours} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddHobby}>
            <Text style={styles.primaryBtnText}>Add Hobby</Text>
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
  sectionTitle: { ...sectionLabel },
  dimText: { fontSize: font.sm, color: colors.textSecondary },
  ringContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: spacing.xs },
  ringScore: { fontSize: 56, fontWeight: font.bold },
  ringLabel: { fontSize: font.xl, color: colors.textSecondary, marginLeft: spacing.xs },
  ringSubtitle: { textAlign: 'center', color: colors.textSecondary, fontSize: font.sm },
  hobbyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  hobbyName: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  hobbyCategory: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  hobbyHours: { fontSize: font.sm, fontWeight: font.bold },
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 6, borderRadius: 3 },
  dormantRow: { flexDirection: 'row', alignItems: 'center' },
  dormantIcon: {
    width: 32, height: 32, borderRadius: radii.full, backgroundColor: colors.warningMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  dormantIconText: { color: colors.warning, fontSize: font.lg, fontWeight: font.bold },
  dormantText: { color: colors.warning, fontSize: font.sm, fontWeight: font.medium },
  seasonalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  seasonalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  seasonBadge: { backgroundColor: colors.accentMuted, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: spacing.xs, marginRight: spacing.md },
  seasonBadgeText: { color: colors.accent, fontSize: font.xs, fontWeight: font.bold, textTransform: 'uppercase' },
  seasonalName: { fontSize: font.sm, fontWeight: font.semibold, color: colors.textPrimary },
  conflictTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.error, marginBottom: spacing.xs },
  conflictOverlap: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  suggestionBox: { backgroundColor: colors.accentGlow, borderRadius: radii.sm, padding: spacing.sm },
  suggestionText: { color: colors.textPrimary, fontSize: font.sm },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.accent, fontWeight: font.semibold, fontSize: font.md },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: 6, marginTop: spacing.xs },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  typeChip: { backgroundColor: colors.bgInput, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipActive: { backgroundColor: colors.accentMuted },
  typeChipText: { color: colors.textSecondary, fontSize: font.xs, fontWeight: font.semibold },
  typeChipTextActive: { color: colors.accent },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
