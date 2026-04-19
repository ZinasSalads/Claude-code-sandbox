import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { getDataSummary, exportData, deleteCategory, amnesia, getCategoryRecords, deleteRecord } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

export default function Privacy() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [catRecords, setCatRecords] = useState<Record<string, any[]>>({});
  const [loadingRecords, setLoadingRecords] = useState(false);

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

  const handleExpandCat = async (cat: string) => {
    if (expandedCat === cat) { setExpandedCat(null); return; }
    setExpandedCat(cat);
    setLoadingRecords(true);
    const data = await getCategoryRecords(cat);
    if (data?.tables) setCatRecords(data.tables);
    else setCatRecords({});
    setLoadingRecords(false);
  };

  const handleDeleteRecord = (table: string, recordId: string) => {
    Alert.alert('Delete record?', 'This record will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteRecord(table, recordId);
          if (expandedCat) handleExpandCat(expandedCat);
          await load();
        },
      },
    ]);
  };

  const formatRecordPreview = (record: any): string => {
    const skip = new Set(['id', 'created_at', 'updated_at', 'user_id']);
    const parts: string[] = [];
    for (const [k, v] of Object.entries(record)) {
      if (skip.has(k) || v == null || v === '') continue;
      if (typeof v === 'object') continue;
      const label = k.replace(/_/g, ' ');
      parts.push(`${label}: ${v}`);
      if (parts.length >= 3) break;
    }
    return parts.join(' | ') || 'Record';
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
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you sure?',
              `All "${category}" data will be permanently erased. There is no way to recover it.`,
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteCategory(category, true);
                    await load();
                  },
                },
              ],
            );
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
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Warning',
              `This will delete ALL "${category}" data AND stop future collection. You will lose everything permanently.`,
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Forget Everything',
                  style: 'destructive',
                  onPress: async () => {
                    await amnesia(category, true);
                    await load();
                  },
                },
              ],
            );
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
          <View key={cat}>
            <TouchableOpacity
              style={[styles.catRow, expandedCat === cat && styles.catRowActive]}
              onPress={() => info.data_points > 0 ? handleExpandCat(cat) : null}
              activeOpacity={info.data_points > 0 ? 0.7 : 1}
            >
              <View style={styles.catInfo}>
                <Text style={styles.catName}>{cat}</Text>
                <Text style={styles.catCount}>
                  {info.data_points} record{info.data_points !== 1 ? 's' : ''}
                  {info.type ? ` · ${info.type}` : ''}
                  {info.date_range ? ` · ${info.date_range.oldest} to ${info.date_range.newest}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {info.data_points > 0 && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(cat)}>
                    <Text style={styles.deleteBtnText}>Delete All</Text>
                  </TouchableOpacity>
                )}
                {info.data_points > 0 && (
                  <Text style={styles.chevron}>{expandedCat === cat ? '▲' : '›'}</Text>
                )}
              </View>
            </TouchableOpacity>
            {expandedCat === cat && (
              <View style={styles.recordsContainer}>
                {loadingRecords ? (
                  <ActivityIndicator color={colors.primary} style={{ padding: spacing.md }} />
                ) : Object.entries(catRecords).map(([table, records]: [string, any[]]) => (
                  <View key={table}>
                    {records.length > 0 && (
                      <Text style={styles.tableLabel}>{table.replace(/_/g, ' ')}</Text>
                    )}
                    {records.map((rec: any) => (
                      <View key={rec.id} style={styles.recordRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordText} numberOfLines={2}>
                            {formatRecordPreview(rec)}
                          </Text>
                          {rec.created_at && (
                            <Text style={styles.recordDate}>
                              {new Date(rec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.recordDeleteBtn}
                          onPress={() => handleDeleteRecord(table, rec.id)}
                        >
                          <Text style={styles.deleteBtnText}>X</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {records.length === 0 && (
                      <Text style={styles.emptyRecords}>No records</Text>
                    )}
                  </View>
                ))}
              </View>
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
  chevron: { color: colors.textTertiary, fontSize: 14 },
  catRowActive: { borderBottomWidth: 0 },
  recordsContainer: {
    backgroundColor: colors.bgCard, borderRadius: radii.sm,
    marginBottom: spacing.sm, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  tableLabel: {
    fontSize: font.xs, color: colors.textTertiary, fontWeight: font.bold,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  recordText: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 16 },
  recordDate: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  recordDeleteBtn: {
    backgroundColor: colors.errorMuted, borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  emptyRecords: { fontSize: font.xs, color: colors.textTertiary, padding: spacing.md, textAlign: 'center' },
});
