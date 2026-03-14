import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getLearningProfile, getLearningToday, getLearningBooks,
  addLearningBook, getLearningCourses, addLearningCourse,
  logLearningSession, getLearningWeekly,
} from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

export default function Learning() {
  const [profile, setProfile] = useState<any>(null);
  const [today, setToday] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add forms
  const [addingBook, setAddingBook] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseProvider, setCourseProvider] = useState('');
  const [saving, setSaving] = useState(false);
  const [logMinutes, setLogMinutes] = useState('');

  const load = useCallback(async () => {
    const [p, t, b, c, w] = await Promise.all([
      getLearningProfile(),
      getLearningToday(),
      getLearningBooks(),
      getLearningCourses(),
      getLearningWeekly(),
    ]);
    if (p) setProfile(p);
    if (t) setToday(t);
    if (Array.isArray(b)) setBooks(b);
    if (Array.isArray(c)) setCourses(c);
    if (w) setWeekly(w);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleAddBook = async () => {
    if (!bookTitle.trim()) return;
    setSaving(true);
    await addLearningBook({ title: bookTitle, author: bookAuthor || undefined });
    setBookTitle('');
    setBookAuthor('');
    setAddingBook(false);
    await load();
    setSaving(false);
  };

  const handleAddCourse = async () => {
    if (!courseTitle.trim()) return;
    setSaving(true);
    await addLearningCourse({ title: courseTitle, provider: courseProvider || undefined });
    setCourseTitle('');
    setCourseProvider('');
    setAddingCourse(false);
    await load();
    setSaving(false);
  };

  const handleLogSession = async () => {
    const mins = parseInt(logMinutes);
    if (!mins || mins <= 0) return;
    setSaving(true);
    await logLearningSession({ minutes_spent: mins, activity_type: 'reading' });
    setLogMinutes('');
    await load();
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Learning</Text>
      <Text style={styles.subtitle}>Books, courses, languages & growth</Text>

      {/* Today's recommendation */}
      {today && (
        <View style={[styles.card, styles.todayCard]}>
          <Text style={styles.todayLabel}>Today's Learning</Text>
          <Text style={styles.todayText}>{today.suggestion}</Text>
          {today.format_options && Array.isArray(today.format_options) && (
            <Text style={styles.formatText}>
              Formats: {today.format_options.join(', ')}
            </Text>
          )}
        </View>
      )}

      {/* Streak & Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{profile?.current_streak || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{weekly?.minutes_this_week || 0}</Text>
          <Text style={styles.statLabel}>Min This Week</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{weekly?.books_completed_this_month || 0}</Text>
          <Text style={styles.statLabel}>Books/Month</Text>
        </View>
      </View>

      {/* Log Session */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log Session</Text>
        <View style={styles.logRow}>
          <TextInput
            style={styles.logInput}
            keyboardType="numeric"
            placeholder="Minutes"
            placeholderTextColor={colors.textTertiary}
            value={logMinutes}
            onChangeText={setLogMinutes}
          />
          <TouchableOpacity style={styles.logBtn} onPress={handleLogSession} disabled={saving}>
            <Text style={styles.logBtnText}>Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Books */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Books</Text>
          <TouchableOpacity onPress={() => setAddingBook(!addingBook)}>
            <Text style={styles.addBtn}>{addingBook ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {addingBook && (
          <View style={styles.addForm}>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={colors.textTertiary} value={bookTitle} onChangeText={setBookTitle} />
            <TextInput style={styles.input} placeholder="Author" placeholderTextColor={colors.textTertiary} value={bookAuthor} onChangeText={setBookAuthor} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddBook} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add Book'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {books.length > 0 ? books.slice(0, 10).map((b, i) => (
          <View key={b.id || i} style={styles.itemRow}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{b.title}</Text>
              <Text style={styles.itemMeta}>{b.author || 'Unknown'} · {b.status?.replace('_', ' ')}</Text>
              {b.status === 'reading' && b.total_pages && (
                <View style={styles.pageBar}>
                  <View style={[styles.pageFill, { width: `${((b.current_page || 0) / b.total_pages) * 100}%` }]} />
                </View>
              )}
            </View>
            {b.rating && <Text style={styles.rating}>{'*'.repeat(b.rating)}</Text>}
          </View>
        )) : (
          <Text style={styles.emptyText}>Add a book or course to start tracking.</Text>
        )}
      </View>

      {/* Courses */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Courses</Text>
          <TouchableOpacity onPress={() => setAddingCourse(!addingCourse)}>
            <Text style={styles.addBtn}>{addingCourse ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {addingCourse && (
          <View style={styles.addForm}>
            <TextInput style={styles.input} placeholder="Course title" placeholderTextColor={colors.textTertiary} value={courseTitle} onChangeText={setCourseTitle} />
            <TextInput style={styles.input} placeholder="Provider (Coursera, Udemy...)" placeholderTextColor={colors.textTertiary} value={courseProvider} onChangeText={setCourseProvider} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCourse} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add Course'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {courses.length > 0 ? courses.map((c, i) => (
          <View key={c.id || i} style={styles.itemRow}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{c.title}</Text>
              <Text style={styles.itemMeta}>{c.provider || ''} · {c.completion_percent || 0}% done</Text>
              <View style={styles.pageBar}>
                <View style={[styles.pageFill, { width: `${c.completion_percent || 0}%` }]} />
              </View>
            </View>
          </View>
        )) : (
          <Text style={styles.emptyText}>No courses yet.</Text>
        )}
      </View>

      {/* Weekly insight */}
      {weekly?.top_insight && (
        <View style={styles.card}>
          <Text style={styles.insightText}>{weekly.top_insight}</Text>
        </View>
      )}
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
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  addBtn: { color: colors.accent, fontSize: font.sm, fontWeight: font.semibold },
  todayCard: { borderColor: colors.accentBorder, backgroundColor: colors.accentGlow },
  todayLabel: { fontSize: font.xs, color: colors.accent, fontWeight: font.semibold, marginBottom: 6 },
  todayText: { fontSize: font.lg, color: colors.textPrimary, fontWeight: font.semibold },
  formatText: { fontSize: font.xs, color: colors.textTertiary, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statBox: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  statNum: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary },
  statLabel: { ...sectionLabel, marginBottom: 0, marginTop: spacing.xs },
  logRow: { flexDirection: 'row', gap: spacing.sm },
  logInput: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.md, borderWidth: 1, borderColor: colors.border,
  },
  logBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  logBtnText: { color: colors.white, fontWeight: font.semibold },
  addForm: { marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  saveBtnText: { color: colors.white, fontSize: font.sm, fontWeight: font.semibold },
  itemRow: {
    flexDirection: 'row', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  itemMeta: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  pageBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 6 },
  pageFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  rating: { color: colors.warning, fontSize: font.sm, alignSelf: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, fontStyle: 'italic' },
  insightText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
});
