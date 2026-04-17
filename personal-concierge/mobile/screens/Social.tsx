import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { getSocialCircle, getSocialScore, addSocialContact, updateSocialContact, logSocialConnection } from '../lib/api';
import type { SocialContact, SocialScore } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel, getScoreColor } from '../theme';

const ACTIVITY_TYPES = [
  { id: 'check-in', label: 'Check-in' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'call', label: 'Call' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'hangout', label: 'Hangout' },
  { id: 'other', label: 'Other' },
];

const QUALITY_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'];

export default function Social() {
  const [contacts, setContacts] = useState<SocialContact[]>([]);
  const [score, setScore] = useState<SocialScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relType, setRelType] = useState('');

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRelType, setEditRelType] = useState('');
  const [editTargetDays, setEditTargetDays] = useState('14');

  // Log modal
  const [logContactId, setLogContactId] = useState<string | null>(null);
  const [logActivity, setLogActivity] = useState('check-in');
  const [logQuality, setLogQuality] = useState(4);
  const [logNotes, setLogNotes] = useState('');
  const [logFeedback, setLogFeedback] = useState('');
  const [logging, setLogging] = useState(false);

  const fetchData = useCallback(async () => {
    const [c, s] = await Promise.all([getSocialCircle(), getSocialScore()]);
    setContacts(c || []);
    setScore(s);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAdd = useCallback(async () => {
    if (!name.trim()) return;
    await addSocialContact({ name, relationship_type: relType || undefined } as Partial<SocialContact>);
    setShowForm(false);
    setName(''); setRelType('');
    fetchData();
  }, [name, relType, fetchData]);

  const startEdit = (c: SocialContact) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditRelType(c.relationship_type || '');
    setEditTargetDays(String(c.target_contact_days || 14));
  };

  const handleUpdate = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    await updateSocialContact(editingId, {
      name: editName,
      relationship_type: editRelType || undefined,
      target_contact_days: parseInt(editTargetDays, 10) || 14,
    } as Partial<SocialContact>);
    setEditingId(null);
    fetchData();
  }, [editingId, editName, editRelType, editTargetDays, fetchData]);

  const openLog = (contactId: string) => {
    setLogContactId(contactId);
    setLogActivity('check-in');
    setLogQuality(4);
    setLogNotes('');
    setLogFeedback('');
  };

  const handleLog = useCallback(async () => {
    if (!logContactId) return;
    setLogging(true);
    await logSocialConnection(logContactId, {
      activity_type: logActivity,
      quality_rating: logQuality,
      notes: logNotes.trim() || undefined,
    });
    setLogFeedback(`Logged! Quality: ${QUALITY_LABELS[logQuality]}`);
    setLogging(false);
    fetchData();
  }, [logContactId, logActivity, logQuality, logNotes, fetchData]);

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading social data...</Text></View>;
  }

  const overdue = contacts.filter(c => c.is_overdue);
  const logContact = contacts.find(c => c.id === logContactId);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Social Health</Text>

        {score && (
          <View style={styles.card}>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreNum, { color: getScoreColor(score.score) }]}>{score.score}</Text>
              <Text style={styles.scoreLabel}>/ 100</Text>
            </View>
            {score.score === 0 && (
              <Text style={styles.scoreHint}>Log interactions to build your score</Text>
            )}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownVal}>{score.connection_score}</Text>
                <Text style={styles.breakdownLabel}>Connect</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownVal}>{score.quality_score}</Text>
                <Text style={styles.breakdownLabel}>Quality</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownVal}>{score.leisure_score}</Text>
                <Text style={styles.breakdownLabel}>Leisure</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownVal}>{score.balance_score}</Text>
                <Text style={styles.breakdownLabel}>Balance</Text>
              </View>
            </View>
          </View>
        )}

        {overdue.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>CONNECT SOON</Text>
            {overdue.slice(0, 5).map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                isEditing={editingId === c.id}
                editName={editName}
                editRelType={editRelType}
                editTargetDays={editTargetDays}
                onEdit={() => startEdit(c)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={handleUpdate}
                onEditName={setEditName}
                onEditRelType={setEditRelType}
                onEditTargetDays={setEditTargetDays}
                onLog={() => openLog(c.id)}
                accent={colors.error}
              />
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>ALL CONTACTS</Text>
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            isEditing={editingId === c.id}
            editName={editName}
            editRelType={editRelType}
            editTargetDays={editTargetDays}
            onEdit={() => startEdit(c)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={handleUpdate}
            onEditName={setEditName}
            onEditRelType={setEditRelType}
            onEditTargetDays={setEditTargetDays}
            onLog={() => openLog(c.id)}
          />
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add Contact'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textTertiary} value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Relationship (friend, family, etc.)" placeholderTextColor={colors.textTertiary} value={relType} onChangeText={setRelType} />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
              <Text style={styles.primaryBtnText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Log modal */}
      <Modal visible={!!logContactId} transparent animationType="slide" onRequestClose={() => setLogContactId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {logFeedback ? (
              <>
                <Text style={styles.feedbackIcon}>✓</Text>
                <Text style={styles.feedbackText}>{logFeedback}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setLogContactId(null)}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Log interaction</Text>
                {logContact && <Text style={styles.modalSub}>with {logContact.name}</Text>}

                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.chipRow}>
                  {ACTIVITY_TYPES.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.chip, logActivity === a.id && styles.chipActive]}
                      onPress={() => setLogActivity(a.id)}
                    >
                      <Text style={[styles.chipText, logActivity === a.id && styles.chipTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Quality — {QUALITY_LABELS[logQuality]}</Text>
                <View style={styles.qualityRow}>
                  {[1, 2, 3, 4, 5].map(q => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.qualityBtn, logQuality === q && styles.qualityBtnActive]}
                      onPress={() => setLogQuality(q)}
                    >
                      <Text style={[styles.qualityBtnText, logQuality === q && styles.qualityBtnTextActive]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.input, { marginBottom: spacing.lg }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={logNotes}
                  onChangeText={setLogNotes}
                  multiline
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogContactId(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleLog} disabled={logging}>
                    <Text style={styles.primaryBtnText}>{logging ? 'Saving...' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

interface ContactCardProps {
  contact: SocialContact;
  isEditing: boolean;
  editName: string;
  editRelType: string;
  editTargetDays: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditName: (v: string) => void;
  onEditRelType: (v: string) => void;
  onEditTargetDays: (v: string) => void;
  onLog: () => void;
  accent?: string;
}

function ContactCard({ contact: c, isEditing, editName, editRelType, editTargetDays, onEdit, onCancelEdit, onSaveEdit, onEditName, onEditRelType, onEditTargetDays, onLog, accent }: ContactCardProps) {
  const cardStyle: any = [styles.card];
  if (accent) cardStyle.push({ borderLeftWidth: 3, borderLeftColor: accent });

  if (isEditing) {
    return (
      <View style={cardStyle}>
        <TextInput style={styles.input} value={editName} onChangeText={onEditName} placeholder="Name" placeholderTextColor={colors.textTertiary} />
        <TextInput style={styles.input} value={editRelType} onChangeText={onEditRelType} placeholder="Relationship" placeholderTextColor={colors.textTertiary} />
        <TextInput style={styles.input} value={editTargetDays} onChangeText={onEditTargetDays} placeholder="Target days between contact" placeholderTextColor={colors.textTertiary} keyboardType="numeric" />
        <View style={styles.editBtnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancelEdit}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={onSaveEdit}>
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      <View style={styles.contactRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactName}>{c.name}</Text>
          <Text style={styles.contactMeta}>
            {c.relationship_type || 'Contact'}
            {c.last_contact_date ? ` · Last: ${c.last_contact_date}` : ''}
            {c.days_since_contact != null ? ` (${c.days_since_contact}d ago)` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.editIcon} onPress={onEdit}>
          <Text style={styles.editIconText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logBtn} onPress={onLog}>
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: spacing.sm },
  scoreNum: { fontSize: 48, fontWeight: font.bold },
  scoreLabel: { fontSize: font.lg, color: colors.textTertiary, marginLeft: spacing.xs },
  scoreHint: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  breakdownItem: { alignItems: 'center' },
  breakdownVal: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  breakdownLabel: { ...sectionLabel, marginBottom: 0, marginTop: 2 },
  sectionTitle: { ...sectionLabel },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
  contactName: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary },
  contactMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  editIcon: { padding: spacing.sm, marginRight: spacing.xs },
  editIconText: { color: colors.textSecondary, fontSize: 16 },
  logBtn: {
    backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  logBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.md },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
  editBtnRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: font.semibold, fontSize: font.md },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.xl, paddingBottom: spacing['4xl'],
  },
  modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  modalSub: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  fieldLabel: { fontSize: font.xs, fontWeight: font.semibold, color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.textAccent, fontWeight: font.semibold },
  qualityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  qualityBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radii.md,
    alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  qualityBtnActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  qualityBtnText: { color: colors.textSecondary, fontWeight: font.semibold },
  qualityBtnTextActive: { color: colors.textAccent },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm },
  feedbackIcon: { fontSize: 48, textAlign: 'center', color: colors.success, marginBottom: spacing.md },
  feedbackText: { fontSize: font.md, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xl },
});
