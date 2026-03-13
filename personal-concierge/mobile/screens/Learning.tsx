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

const ACCENT = '#6C63FF';
const BG = '#0D0D1A';
const CARD = '#1A1A2E';
const GREEN = '#00C48C';

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
    return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      <Text style={styles.title}>Learning</Text>
      <Text style={styles.subtitle}>Books, courses, languages & growth</Text>

      {/* Today's recommendation */}
      {today && (
        <View style={[styles.card, styles.todayCard]}>
          <Text style={styles.todayLabel}>Today's Learning</Text>
          <Text style={styles.todayText}>{today.suggestion}</Text>
          {today.format_options && (
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
            placeholderTextColor="rgba(255,255,255,0.3)"
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
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor="rgba(255,255,255,0.3)" value={bookTitle} onChangeText={setBookTitle} />
            <TextInput style={styles.input} placeholder="Author" placeholderTextColor="rgba(255,255,255,0.3)" value={bookAuthor} onChangeText={setBookAuthor} />
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
            <TextInput style={styles.input} placeholder="Course title" placeholderTextColor="rgba(255,255,255,0.3)" value={courseTitle} onChangeText={setCourseTitle} />
            <TextInput style={styles.input} placeholder="Provider (Coursera, Udemy...)" placeholderTextColor="rgba(255,255,255,0.3)" value={courseProvider} onChangeText={setCourseProvider} />
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
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  card: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  addBtn: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  todayCard: { borderColor: 'rgba(108,99,255,0.3)', backgroundColor: 'rgba(108,99,255,0.08)' },
  todayLabel: { fontSize: 12, color: ACCENT, fontWeight: '600', marginBottom: 6 },
  todayText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  formatText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: CARD, borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  logRow: { flexDirection: 'row', gap: 8 },
  logInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  logBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  logBtnText: { color: '#fff', fontWeight: '600' },
  addForm: { marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  itemMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'capitalize' },
  pageBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6 },
  pageFill: { height: 4, backgroundColor: GREEN, borderRadius: 2 },
  rating: { color: '#FFB547', fontSize: 14, alignSelf: 'center' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  insightText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, fontStyle: 'italic' },
});
