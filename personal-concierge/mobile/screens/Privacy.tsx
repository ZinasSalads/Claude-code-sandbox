import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { getDataSummary, exportData, deleteCategory, amnesia } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

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
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const categories = summary?.categories || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: font['3xl'], fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  dangerCard: { borderColor: colors.errorMuted },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  desc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  exportBtn: {
    backgroundColor: colors.primary, borderRadius: radii.sm, padding: spacing.lg, alignItems: 'center',
    ...shadow.glow,
  },
  exportBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.semibold },
  exportResult: { color: colors.success, textAlign: 'center', marginTop: spacing.sm, fontSize: font.sm },
  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  catInfo: { flex: 1 },
  catName: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, textTransform: 'capitalize' },
  catCount: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: {
    backgroundColor: colors.errorMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md,
    paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  deleteBtnText: { color: colors.error, fontSize: font.xs, fontWeight: font.semibold },
  amnesiaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amnesiaBtn: {
    backgroundColor: colors.errorMuted, borderRadius: radii.sm, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  amnesiaBtnText: { color: colors.error, fontSize: font.sm, fontWeight: font.medium, textTransform: 'capitalize' },
});
