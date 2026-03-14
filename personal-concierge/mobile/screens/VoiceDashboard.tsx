import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface Props {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const modules = [
  { key: 'VoiceMain', title: 'Voice Commands', emoji: '🎙️', desc: 'Briefings, wind-down & commands' },
  { key: 'Reviews', title: 'Weekly & Monthly Reviews', emoji: '📊', desc: 'Progress summaries & trends' },
  { key: 'ContextualIntel', title: 'Contextual Intelligence', emoji: '🧠', desc: 'Signals & anomaly detection' },
];

export default function VoiceDashboard({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Intelligence</Text>
      <Text style={styles.pageSubtitle}>Voice control, reviews & contextual awareness</Text>

      {modules.map((mod) => (
        <TouchableOpacity
          key={mod.key}
          style={styles.moduleRow}
          onPress={() => navigation.navigate(mod.key)}
          activeOpacity={0.7}
        >
          <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle}>{mod.title}</Text>
            <Text style={styles.moduleDesc}>{mod.desc}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  pageTitle: {
    fontSize: font['3xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  pageSubtitle: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  moduleRow: {
    ...cardStyle,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moduleEmoji: { fontSize: 26, marginRight: spacing.lg },
  moduleTitle: { color: colors.textPrimary, fontSize: font.lg, fontWeight: font.semibold },
  moduleDesc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  chevron: { color: colors.textTertiary, fontSize: 22, fontWeight: '300' },
});
