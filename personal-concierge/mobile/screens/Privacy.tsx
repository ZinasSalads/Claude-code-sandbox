import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { getDataSummary, exportData, deleteCategory, amnesia } from '../lib/api';

const ACCENT = '#6C63FF';
const BG = '#0D0D1A';
const CARD = '#1A1A2E';
const RED = '#FF4757';
const GREEN = '#00C48C';

export default function Privacy() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getDataSummary();
    if (s) setSummary(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    const result = await exportData();
    if (result) {
      setExportResult(`Exported ${result.tables_exported} tables, ${result.total_records} records`);
    }
    setExporting(false);
  };

  const handleDelete = (category: string) => {
    Alert.alert(
      `Delete ${category} data?`,
      'This will permanently delete all data in this category. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(category, true);
            await load();
          },
        },
      ],
    );
  };

  const handleAmnesia = (category: string) => {
    Alert.alert(
      `Amnesia: ${category}`,
      'This will permanently delete ALL data and STOP collecting this category. This is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget Everything',
          style: 'destructive',
          onPress: async () => {
            await amnesia(category, true);
            await load();
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>;
  }

  const categories = summary?.categories || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      <Text style={styles.title}>Privacy & Data</Text>
      <Text style={styles.subtitle}>You own all your data</Text>

      {/* Export */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export Your Data</Text>
        <Text style={styles.desc}>Download everything the app knows about you as JSON.</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text style={styles.exportBtnText}>
            {exporting ? 'Exporting...' : 'Export All Data'}
          </Text>
        </TouchableOpacity>
        {exportResult && <Text style={styles.exportResult}>{exportResult}</Text>}
      </View>

      {/* Data Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What I Know About You</Text>

        {Object.entries(categories).map(([cat, info]: [string, any]) => (
          <View key={cat} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{cat}</Text>
              <Text style={styles.catCount}>
                {info.data_points} record{info.data_points !== 1 ? 's' : ''}
                {info.type ? ` · ${info.type}` : ''}
                {info.date_range ? ` · ${info.date_range.oldest} to ${info.date_range.newest}` : ''}
              </Text>
            </View>
            {info.data_points > 0 && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(cat)}
              >
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Amnesia */}
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.cardTitle}>Amnesia Mode</Text>
        <Text style={styles.desc}>
          Permanently forget a category — deletes all data AND stops future collection.
          This cannot be undone.
        </Text>
        <View style={styles.amnesiaRow}>
          {['health', 'social', 'career', 'financial', 'personality', 'legacy', 'wardrobe', 'learning'].map(cat => (
            <TouchableOpacity
              key={cat}
              style={styles.amnesiaBtn}
              onPress={() => handleAmnesia(cat)}
            >
              <Text style={styles.amnesiaBtnText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
  dangerCard: { borderColor: 'rgba(255,71,87,0.2)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginBottom: 12 },
  exportBtn: {
    backgroundColor: ACCENT, borderRadius: 10, padding: 14, alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  exportResult: { color: GREEN, textAlign: 'center', marginTop: 10, fontSize: 13 },
  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '600', color: '#fff', textTransform: 'capitalize' },
  catCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  deleteBtn: {
    backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,71,87,0.3)',
  },
  deleteBtnText: { color: RED, fontSize: 12, fontWeight: '600' },
  amnesiaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amnesiaBtn: {
    backgroundColor: 'rgba(255,71,87,0.08)', borderRadius: 8, paddingHorizontal: 14,
    paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)',
  },
  amnesiaBtnText: { color: RED, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
});
