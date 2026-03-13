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
    setItems(items);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
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
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#6c5ce7' }]}>
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
          <TextInput style={styles.input} placeholder="Item name" placeholderTextColor="#555577" value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Category (tops/bottoms/shoes/etc)" placeholderTextColor="#555577" value={newCategory} onChangeText={setNewCategory} />
          <TextInput style={styles.input} placeholder="Color" placeholderTextColor="#555577" value={newColor} onChangeText={setNewColor} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add Item</Text>
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
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  actionBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 13 },
  outfitItem: { fontSize: 14, color: '#f0f0f5', marginBottom: 4 },
  reasoning: { fontSize: 13, color: '#a29bfe', marginTop: 8, fontStyle: 'italic', lineHeight: 20 },
  auditText: { fontSize: 14, color: '#8888aa', marginBottom: 4 },
  catRow: { flexDirection: 'row', marginBottom: 16, maxHeight: 40 },
  catBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#141420', borderWidth: 1, borderColor: '#1e1e30',
  },
  catBtnActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  catText: { fontSize: 13, color: '#8888aa' },
  catTextActive: { color: '#fff' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#f0f0f5' },
  itemMeta: { fontSize: 12, color: '#8888aa', marginTop: 2 },
  condition: { fontSize: 12, color: '#555577', textTransform: 'capitalize' },
  emptyText: { color: '#555577', textAlign: 'center', padding: 20 },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6c5ce7', fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
