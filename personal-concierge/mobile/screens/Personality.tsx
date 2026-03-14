import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import {
  getPersonalityQuestions, scorePersonalityAssessment,
  getPersonalityProfile, getPersonalityInsight, getCoachingStyle,
} from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

const { width } = Dimensions.get('window');

type AssessmentQuestion = {
  id: number;
  text: string;
  options: (string | { text: string; score?: number; score_label?: string })[];
  dimension?: string;
};

export default function Personality() {
  const [phase, setPhase] = useState<'loading' | 'intro' | 'questions' | 'scoring' | 'result'>('loading');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selected_option: string; selected_index: number }>>({});
  const [profile, setProfile] = useState<any>(null);
  const [insight, setInsight] = useState<string>('');
  const [coachingStyle, setCoachingStyle] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadProfile = useCallback(async () => {
    const p = await getPersonalityProfile();
    if (p && p.mbti_type) {
      setProfile(p);
      const ins = await getPersonalityInsight();
      if (ins?.insight) setInsight(ins.insight);
      const cs = await getCoachingStyle();
      if (cs) setCoachingStyle(cs);
      setPhase('result');
    } else {
      setPhase('intro');
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const startAssessment = async () => {
    const data = await getPersonalityQuestions();
    if (data) {
      const all = [
        ...(data.mbti_questions || []),
        ...(data.values_questions || []),
      ];
      setQuestions(all);
      setCurrentIdx(0);
      setAnswers({});
      setPhase('questions');
    }
  };

  const selectAnswer = (optIdx: number) => {
    const q = questions[currentIdx];
    const opt = q.options[optIdx];
    const optText = typeof opt === 'string' ? opt : opt.text;
    setAnswers(prev => ({
      ...prev,
      [q.id]: { selected_option: optText, selected_index: optIdx },
    }));
  };

  const nextQuestion = async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // Submit
      setPhase('scoring');
      const responses = Object.entries(answers).map(([qId, ans]) => ({
        question_id: parseInt(qId),
        selected_option: ans.selected_option,
        selected_index: ans.selected_index,
      }));
      const result = await scorePersonalityAssessment(responses);
      if (result) {
        setProfile(result);
        const ins = await getPersonalityInsight();
        if (ins?.insight) setInsight(ins.insight);
        const cs = await getCoachingStyle();
        if (cs) setCoachingStyle(cs);
      }
      setPhase('result');
    }
  };

  const currentQ = questions[currentIdx];
  const currentAnswer = currentQ ? answers[currentQ.id] : null;

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (phase === 'intro') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.bigTitle}>Personality Assessment</Text>
        <Text style={styles.subtitle}>Discover your type</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you'll learn</Text>
          <Text style={styles.desc}>
            A 30-question assessment covering personality dimensions and values orientation.
            Results personalize every recommendation — from coaching tone to meal suggestions.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          <Text style={styles.desc}>
            20 situational questions scored across MBTI dimensions (continuous, not binary).
            {'\n'}10 values questions covering lifestyle preferences.
            {'\n\n'}Takes about 10 minutes.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={startAssessment}>
          <Text style={styles.primaryBtnText}>Start Assessment</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'questions' && currentQ) {
    const progress = (currentIdx + 1) / questions.length;
    return (
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentIdx + 1} of {questions.length}
        </Text>

        <Text style={styles.questionText}>{currentQ.text}</Text>

        {currentQ.options.map((opt, idx) => {
          const optText = typeof opt === 'string' ? opt : opt.text;
          const isSelected = currentAnswer?.selected_index === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
              onPress={() => selectAnswer(idx)}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {optText}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.primaryBtn, !currentAnswer && styles.primaryBtnDisabled]}
          onPress={nextQuestion}
          disabled={!currentAnswer}
        >
          <Text style={styles.primaryBtnText}>
            {currentIdx === questions.length - 1 ? 'Complete' : 'Next'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'scoring') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.scoringText}>Analyzing your responses...</Text>
      </View>
    );
  }

  // Result phase
  const dims = profile?.mbti_dimensions || {};
  const dimLabels = [
    { key: 'EI', left: 'Extravert', right: 'Introvert' },
    { key: 'SN', left: 'Sensing', right: 'Intuition' },
    { key: 'TF', left: 'Thinking', right: 'Feeling' },
    { key: 'JP', left: 'Judging', right: 'Perceiving' },
  ];

  const reassessDue = profile?.reassess_due;
  const canReassess = reassessDue ? new Date(reassessDue) <= new Date() : true;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.bigTitle}>{profile?.mbti_type || '—'}</Text>
      <Text style={styles.subtitle}>{profile?.mbti_label || ''}</Text>

      {/* Dimension sliders */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Dimensions</Text>
        {dimLabels.map(d => {
          const val = dims[d.key] ?? 0.5;
          return (
            <View key={d.key} style={styles.dimRow}>
              <Text style={styles.dimLabel}>{d.left}</Text>
              <View style={styles.dimTrack}>
                <View style={[styles.dimThumb, { left: `${val * 100}%` }]} />
              </View>
              <Text style={styles.dimLabel}>{d.right}</Text>
            </View>
          );
        })}
      </View>

      {/* Insight */}
      {insight ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Insight</Text>
          <Text style={styles.desc}>{insight}</Text>
        </View>
      ) : null}

      {/* Values */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Values Orientation</Text>
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>Style</Text>
          <Text style={styles.valueVal}>{profile?.style_orientation || '—'}</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>Energy Source</Text>
          <Text style={styles.valueVal}>{profile?.energy_source || '—'}</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>Decision Style</Text>
          <Text style={styles.valueVal}>{profile?.decision_style || '—'}</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.valueLabel}>Structure</Text>
          <Text style={styles.valueVal}>{profile?.structure_preference || '—'}</Text>
        </View>
      </View>

      {/* Coaching style */}
      {coachingStyle && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How I'll Coach You</Text>
          <Text style={styles.desc}>
            Communication: {coachingStyle.communication_style?.replace('_', ' ')}
            {'\n'}Motivation: {coachingStyle.motivation_frame}
            {'\n'}Feedback: {coachingStyle.feedback_preference}
            {'\n'}Structure: {coachingStyle.structure_preference?.replace('_', ' ')}
          </Text>
        </View>
      )}

      {canReassess && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={startAssessment}>
          <Text style={styles.secondaryBtnText}>Reassess</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing['5xl'] },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  bigTitle: { fontSize: font['4xl'], fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xl },
  subtitle: { fontSize: font.lg, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing['2xl'] },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.md },
  desc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg,
    ...shadow.glow,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: colors.white, fontSize: font.lg, fontWeight: font.bold },
  secondaryBtn: {
    borderColor: colors.primary, borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg,
  },
  secondaryBtnText: { color: colors.primary, fontSize: font.md, fontWeight: font.semibold },
  progressBar: {
    height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing.sm,
  },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  progressText: { color: colors.textSecondary, fontSize: font.xs, textAlign: 'center', marginBottom: spacing['2xl'] },
  questionText: { fontSize: font.xl, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing['2xl'], lineHeight: 28 },
  optionBtn: {
    backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  optionText: { fontSize: font.md, color: colors.textSecondary, lineHeight: 22 },
  optionTextSelected: { color: colors.textPrimary },
  scoringText: { color: colors.textSecondary, marginTop: spacing.lg, fontSize: font.lg },
  dimRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  dimLabel: { fontSize: font.xs, color: colors.textSecondary, width: 70, textAlign: 'center' },
  dimTrack: {
    flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, marginHorizontal: spacing.sm,
  },
  dimThumb: {
    position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, marginLeft: -8,
  },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  valueLabel: { fontSize: font.sm, color: colors.textSecondary },
  valueVal: { fontSize: font.sm, color: colors.textPrimary, fontWeight: font.semibold, textTransform: 'capitalize' },
});
