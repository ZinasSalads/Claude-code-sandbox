import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions, Modal, TextInput,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const { width: W } = Dimensions.get('window');

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Score ring — thin arc with score inside
function ScoreRing({ score, label, size = 110 }: { score: number | null; label: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(Math.max(score, 0), 100) / 100 : 0;
  const dash = pct * circ;
  const gap = circ - dash;
  const color = score == null ? colors.border
    : score >= 85 ? colors.scoreExcellent
    : score >= 70 ? colors.scoreGood
    : score >= 55 ? colors.scoreFair
    : score >= 40 ? colors.scorePoor
    : colors.scoreBad;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={6} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={6} fill="none"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill as object} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.ringScore, { color }]}>{score ?? '—'}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

// Environmental alert pill
function EnvPill({ emoji, label, value, level }: { emoji: string; label: string; value: string; level: 'ok' | 'warn' | 'bad' }) {
  const bg = level === 'bad' ? colors.errorMuted : level === 'warn' ? colors.warningMuted : colors.successMuted;
  const tx = level === 'bad' ? colors.error : level === 'warn' ? colors.warning : colors.success;
  return (
    <View style={[styles.envPill, { backgroundColor: bg }]}>
      <Text style={styles.envEmoji}>{emoji}</Text>
      <View>
        <Text style={[styles.envValue, { color: tx }]}>{value}</Text>
        <Text style={styles.envLabel}>{label}</Text>
      </View>
    </View>
  );
}

const SYMPTOMS = [
  { id: 'tired', emoji: '😴', label: 'Unusually tired' },
  { id: 'stress', emoji: '😤', label: 'High stress' },
  { id: 'sore', emoji: '💪', label: 'Sore / aching' },
  { id: 'sick', emoji: '🤒', label: 'Feeling sick' },
  { id: 'mood', emoji: '😔', label: 'Low mood' },
  { id: 'fog', emoji: '🧠', label: 'Brain fog' },
  { id: 'other', emoji: '✍️', label: 'Other' },
];

const SEVERITY = ['Mild', 'Moderate', 'Severe'] as const;
type SeverityType = typeof SEVERITY[number];

interface FlagModalProps {
  visible: boolean;
  onClose: () => void;
}

function FlagModal({ visible, onClose }: FlagModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [severity, setSeverity] = useState<SeverityType>('Moderate');
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);

    const signalText = [
      ...selected.filter(s => s !== 'other').map(s => SYMPTOMS.find(x => x.id === s)?.label || s),
      ...(selected.includes('other') && otherText.trim() ? [`Other: ${otherText.trim()}`] : []),
    ].join(', ');

    // Post as contextual signal
    await apiPost('/context/signal', {
      signal_text: `User flagged symptoms (${severity}): ${signalText}`,
    });

    // Also post to check-in for record keeping
    const severityMap: Record<SeverityType, number> = { Mild: 3, Moderate: 6, Severe: 9 };
    const val = severityMap[severity];
    await apiPost('/checkin', {
      energy: selected.includes('tired') ? val : 7,
      mood: selected.includes('mood') ? val : 7,
      stress: selected.includes('stress') ? val : 3,
      soreness: selected.includes('sore') ? val : 3,
      notes: signalText,
    });

    // Generate feedback message
    const adjustments: string[] = [];
    if (selected.includes('tired') || selected.includes('sick')) adjustments.push('workout adjusted to recovery');
    if (selected.includes('sore')) adjustments.push('high-impact exercises removed');
    if (selected.includes('stress') || selected.includes('fog')) adjustments.push('heavy cognitive tasks de-prioritised');
    if (selected.includes('mood')) adjustments.push('social and positive activities surfaced');

    const fb = adjustments.length > 0
      ? `Noted. ${adjustments.join(', ')}.`
      : "Noted. I'll factor this into today's recommendations.";

    setFeedback(fb);
    setSubmitting(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleClose = () => {
    setSelected([]); setSeverity('Moderate'); setOtherText('');
    setFeedback(''); fadeAnim.setValue(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>What's going on?</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {feedback ? (
            <Animated.View style={[styles.feedbackCard, { opacity: fadeAnim }]}>
              <Text style={styles.feedbackEmoji}>✓</Text>
              <Text style={styles.feedbackText}>{feedback}</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <Text style={styles.modalSubtitle}>Select all that apply</Text>
              <View style={styles.symptomsGrid}>
                {SYMPTOMS.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.symptomChip, selected.includes(s.id) && styles.symptomChipActive]}
                    onPress={() => toggle(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.symptomEmoji}>{s.emoji}</Text>
                    <Text style={[styles.symptomLabel, selected.includes(s.id) && styles.symptomLabelActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selected.includes('other') && (
                <TextInput
                  style={styles.otherInput}
                  placeholder="Describe what's going on..."
                  placeholderTextColor={colors.textTertiary}
                  value={otherText}
                  onChangeText={setOtherText}
                  multiline
                  autoFocus
                />
              )}

              <Text style={styles.severityLabel}>How bad?</Text>
              <View style={styles.severityRow}>
                {SEVERITY.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.severityBtn, severity === s && styles.severityBtnActive]}
                    onPress={() => setSeverity(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.severityText, severity === s && styles.severityTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (selected.length === 0 || submitting) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={selected.length === 0 || submitting}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Saving...' : 'Flag It'}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface CommandCenterProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void };
}

export default function CommandCenter({ navigation }: CommandCenterProps) {
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<Record<string, number | null> | null>(null);
  const [env, setEnv] = useState<Record<string, unknown> | null>(null);
  const [workout, setWorkout] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFlag, setShowFlag] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);

  const fetchAll = useCallback(async () => {
    const [summary, envData, workoutData] = await Promise.all([
      apiFetch<{ today: Record<string, number | null> }>('/dashboard/summary'),
      apiFetch<Record<string, unknown>>('/environment/today'),
      apiFetch<Record<string, unknown>>('/fitness/today'),
    ]);
    setHealth(summary?.today || null);
    setEnv(envData);
    setWorkout(workoutData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await apiPost('/sync/oura', {});
    await fetchAll();
    setSyncing(false);
  }, [fetchAll]);

  const readiness = health?.readiness_score ?? null;
  const sleep = health?.sleep_score ?? null;
  const sleepHours = health?.sleep_duration ?? null;

  // AI insight text
  const insight = (() => {
    if (readiness == null) return null;
    const envNotes = (env?.air_quality_notes as string) || '';
    const base = readiness >= 85
      ? "You're well recovered. Good day for intensity."
      : readiness >= 70
      ? "Solid readiness. Moderate to high effort is fine."
      : readiness >= 55
      ? "Moderate readiness. Keep effort controlled today."
      : "Low readiness. Prioritise recovery over performance.";
    if (envNotes && !envNotes.includes('good for outdoor')) {
      return `${base} ${envNotes}`;
    }
    return base;
  })();

  // Env alerts
  const aqi = env?.aqi as number | undefined;
  const uv = env?.uv_index_max as number | undefined;
  const pollen = env?.pollen_risk_level as string | undefined;
  const showEnvBar = (aqi && aqi > 50) || (uv && uv >= 6) || (pollen && ['Moderate', 'High', 'Very High'].includes(pollen));

  const formatDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const workoutTitle = workout ? `${workout.workout_type === 'rest' ? '🧘' : '💪'} ${workout.title}` : null;
  const workoutSummary = workout ? `${workout.duration_minutes} min · ${workout.intensity} intensity` : null;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>{syncing ? '↻' : '⟳'}</Text>
          </TouchableOpacity>
        </View>

        {/* Sleep + Readiness circles */}
        <View style={styles.scoreRow}>
          {loading ? (
            <>
              <View style={styles.scorePlaceholder}><Text style={styles.placeholderText}>—</Text><Text style={styles.ringLabel}>Sleep</Text></View>
              <View style={styles.scoreDivider} />
              <View style={styles.scorePlaceholder}><Text style={styles.placeholderText}>—</Text><Text style={styles.ringLabel}>Readiness</Text></View>
            </>
          ) : (
            <>
              <View style={{ alignItems: 'center' }}>
                <ScoreRing score={sleep as number | null} label="Sleep" size={120} />
                {sleepHours != null && <Text style={styles.sleepHours}>{sleepHours}h</Text>}
              </View>
              <View style={styles.scoreDivider} />
              <ScoreRing score={readiness as number | null} label="Readiness" size={120} />
            </>
          )}
        </View>

        {/* No data state */}
        {!loading && readiness == null && (
          <TouchableOpacity style={styles.syncCard} onPress={handleSync} activeOpacity={0.7}>
            <Text style={styles.syncCardText}>Oura data not synced yet</Text>
            <Text style={styles.syncCardCta}>Tap to sync →</Text>
          </TouchableOpacity>
        )}

        {/* AI insight */}
        {insight && (
          <View style={styles.insightCard}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        )}

        {/* Environmental alerts */}
        {showEnvBar && (
          <View style={styles.envBar}>
            {aqi && aqi > 50 && (
              <EnvPill emoji="💨" label="AQI" value={`${Math.round(aqi)}`}
                level={aqi > 150 ? 'bad' : 'warn'} />
            )}
            {uv && uv >= 6 && (
              <EnvPill emoji="☀️" label="UV" value={`${uv}`}
                level={uv >= 8 ? 'bad' : 'warn'} />
            )}
            {pollen && ['Moderate', 'High', 'Very High'].includes(pollen) && (
              <EnvPill emoji="🌿" label="Pollen" value={pollen}
                level={['High', 'Very High'].includes(pollen) ? 'bad' : 'warn'} />
            )}
          </View>
        )}

        {/* Today's plan */}
        <View style={styles.planCard}>
          <TouchableOpacity
            style={styles.planHeader}
            onPress={() => setPlanExpanded(!planExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>TODAY'S PLAN</Text>
              {loading ? (
                <Text style={styles.planSummary}>Loading...</Text>
              ) : workoutTitle ? (
                <Text style={styles.planSummary}>{workoutTitle}</Text>
              ) : (
                <Text style={styles.planSummaryDim}>No plan generated yet</Text>
              )}
            </View>
            <Text style={styles.planChevron}>{planExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {planExpanded && workout && (
            <View style={styles.planDetail}>
              <Text style={styles.planDetailMeta}>{workoutSummary}</Text>
              {workout.ai_reasoning ? (
                <Text style={styles.planDetailReasoning} numberOfLines={3}>{workout.ai_reasoning as string}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.planViewBtn}
                onPress={() => navigation.navigate('WorkoutDetail', { workout })}
                activeOpacity={0.7}
              >
                <Text style={styles.planViewBtnText}>View Full Workout →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Flag button — immediately below plan */}
          <TouchableOpacity style={styles.flagBtn} onPress={() => setShowFlag(true)} activeOpacity={0.7}>
            <Text style={styles.flagBtnEmoji}>⚑</Text>
            <Text style={styles.flagBtnText}>Something feels off?</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>

      <FlagModal visible={showFlag} onClose={() => setShowFlag(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['2xl'] },
  greeting: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary },
  date: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  syncBtn: { padding: spacing.sm },
  syncBtnText: { fontSize: font.xl, color: colors.textTertiary },

  scoreRow: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    ...cardStyle, marginBottom: spacing.lg,
  },
  scoreDivider: { width: 1, height: 80, backgroundColor: colors.border },
  scorePlaceholder: { alignItems: 'center' },
  placeholderText: { fontSize: font['2xl'], color: colors.textTertiary, fontWeight: font.bold },
  ringScore: { fontSize: font['2xl'], fontWeight: font.bold },
  ringLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: spacing.xs, fontWeight: font.semibold, letterSpacing: 0.5 },
  sleepHours: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  syncCard: { ...cardStyle, marginBottom: spacing.lg, alignItems: 'center', padding: spacing['2xl'] },
  syncCardText: { color: colors.textSecondary, fontSize: font.md, marginBottom: spacing.xs },
  syncCardCta: { color: colors.primary, fontSize: font.sm, fontWeight: font.semibold },

  insightCard: {
    backgroundColor: colors.primaryGlow, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.primaryBorder,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  insightText: { color: colors.textAccent, fontSize: font.md, lineHeight: 22, fontWeight: font.medium },

  envBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  envPill: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  envEmoji: { fontSize: 16 },
  envValue: { fontSize: font.sm, fontWeight: font.bold },
  envLabel: { fontSize: font.xs, color: colors.textTertiary },

  planCard: { ...cardStyle, marginBottom: spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center' },
  planLabel: { fontSize: font.xs, fontWeight: font.bold, color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 },
  planSummary: { fontSize: font.lg, fontWeight: font.semibold, color: colors.textPrimary },
  planSummaryDim: { fontSize: font.md, color: colors.textTertiary },
  planChevron: { color: colors.textTertiary, fontSize: font.sm, marginLeft: spacing.sm },
  planDetail: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  planDetailMeta: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  planDetailReasoning: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  planViewBtn: { alignSelf: 'flex-start' },
  planViewBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: font.semibold },

  flagBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.lg, paddingTop: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  flagBtnEmoji: { fontSize: 16, color: colors.warning },
  flagBtnText: { color: colors.warning, fontSize: font.sm, fontWeight: font.semibold },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary },
  closeBtn: { padding: spacing.xs },
  closeBtnText: { color: colors.textSecondary, fontSize: font.lg },
  modalContent: { padding: spacing.xl },
  modalSubtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },

  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  symptomChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.bgCard, borderRadius: radii.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.border,
  },
  symptomChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  symptomEmoji: { fontSize: 16 },
  symptomLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.medium },
  symptomLabelActive: { color: colors.textAccent },

  otherInput: {
    backgroundColor: colors.bgInput, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, color: colors.textPrimary,
    fontSize: font.md, minHeight: 80, marginBottom: spacing.lg,
    textAlignVertical: 'top',
  },

  severityLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: font.semibold, marginBottom: spacing.sm },
  severityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['2xl'] },
  severityBtn: {
    flex: 1, padding: spacing.md, borderRadius: radii.md,
    alignItems: 'center', backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  severityBtnActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  severityText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: font.semibold },
  severityTextActive: { color: colors.textAccent },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radii.lg,
    padding: spacing.lg, alignItems: 'center', ...shadow.glow,
  },
  submitBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.bold },

  feedbackCard: {
    ...cardStyle, alignItems: 'center', padding: spacing['3xl'],
    borderColor: colors.primaryBorder,
  },
  feedbackEmoji: { fontSize: 48, color: colors.success, marginBottom: spacing.lg },
  feedbackText: { fontSize: font.md, color: colors.textPrimary, textAlign: 'center', lineHeight: 24, marginBottom: spacing['2xl'] },
  doneBtn: { backgroundColor: colors.primary, borderRadius: radii.lg, paddingHorizontal: spacing['3xl'], paddingVertical: spacing.md, ...shadow.glow },
  doneBtnText: { color: colors.white, fontSize: font.md, fontWeight: font.bold },
});
