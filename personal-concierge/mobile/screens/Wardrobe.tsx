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
import { getWardrobeItems, getOutfitSuggestion, addWardrobeItem, getWardrobeAudit } from '../lib/api';
import type { WardrobeItem, OutfitSuggestion } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

const CATEGORIES = ['All', 'tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'formalwear'];

export default function WardrobeScreen() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfit, setOutfit] = useState<OutfitSuggestion | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('tops');
  const [newColor, setNewColor] = useState('');

  const fetchData = useCallback(async () => {
    const items = await getWardrobeItems();
    setItems(items || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSuggest = useCallback(async () => {
    setOutfit(null);
    const s = await getOutfitSuggestion('casual');
    setOutfit(s);
  }, []);

  const handleAudit = useCallback(async () => {
    setAudit(null);
    const a = await getWardrobeAudit();
    setAudit(a);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;
    await addWardrobeItem({
      item_name: newName,
      category: newCategory,
      color: newColor || undefined,
    } as Partial<WardrobeItem>);
    setShowAdd(false);
    setNewName(''); setNewColor('');
    fetchData();
  }, [newName, newCategory, newColor, fetchData]);

  const filtered = category === 'All' ? items : items.filter(i => i.category === category);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading wardrobe...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Wardrobe</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleSuggest}>
          <Text style={styles.actionBtnText}>Today's Outfit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleAudit}>
          <Text style={styles.actionBtnText}>Audit</Text>
        </TouchableOpacity>
      </View>

      {outfit && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.accent }]}>
          <Text style={styles.cardTitle}>Suggested Outfit</Text>
          {outfit.outfit_items?.map((item, i) => (
            <Text key={i} style={styles.outfitItem}>{item.category}: {item.name}</Text>
          ))}
          {outfit.reasoning && <Text style={styles.reasoning}>{outfit.reasoning}</Text>}
        </View>
      )}

      {audit && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wardrobe Audit</Text>
          <Text style={styles.auditText}>Total items: {(audit as Record<string, number>).total_items}</Text>
          <Text style={styles.auditText}>
            Never worn: {((audit as Record<string, WardrobeItem[]>).never_worn || []).length}
          </Text>
          <Text style={styles.auditText}>
            Retire candidates: {((audit as Record<string, WardrobeItem[]>).retire_candidates || []).length}
          </Text>
          {(audit as Record<string, string>).gap_analysis && (
            <Text style={styles.reasoning}>{(audit as Record<string, string>).gap_analysis}</Text>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catBtn, category === c && styles.catBtnActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.itemRow}>
            <View>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemMeta}>
                {item.category} · {item.color || 'No color'} · Worn {item.times_worn}x
              </Text>
            </View>
            <Text style={styles.condition}>{item.condition}</Text>
          </View>
        </View>
      ))}

      {filtered.length === 0 && (
        <Text style={styles.emptyText}>No items in this category.</Text>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(!showAdd)}>
        <Text style={styles.addBtnText}>{showAdd ? 'Cancel' : '+ Add Item'}</Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Item name" placeholderTextColor={colors.textTertiary} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Category (tops/bottoms/shoes/etc)" placeholderTextColor={colors.textTertiary} value={newCategory} onChangeText={setNewCategory} />
          <TextInput style={styles.input} placeholder="Color" placeholderTextColor={colors.textTertiary} value={newColor} onChangeText={setNewColor} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Item</Text>
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
  cardTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  actionBtn: {
    flex: 1, backgroundColor: colors.accentMuted, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  actionBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  outfitItem: { fontSize: font.sm, color: colors.textPrimary, marginBottom: spacing.xs },
  reasoning: { fontSize: font.sm, color: colors.textAccent, marginTop: spacing.sm, fontStyle: 'italic', lineHeight: 20 },
  auditText: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  catRow: { flexDirection: 'row', marginBottom: spacing.lg, maxHeight: 40 },
  catBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, marginRight: spacing.sm,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  catBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontSize: font.sm, color: colors.textSecondary },
  catTextActive: { color: colors.white },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  itemMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  condition: { fontSize: font.xs, color: colors.textTertiary, textTransform: 'capitalize' },
  emptyText: { color: colors.textTertiary, textAlign: 'center', padding: spacing.xl },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.accent, fontWeight: font.semibold, fontSize: font.md },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
