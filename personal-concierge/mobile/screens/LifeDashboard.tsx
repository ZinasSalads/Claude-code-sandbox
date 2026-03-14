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
  { key: 'Social', title: 'Social Health', emoji: '👥', desc: 'Connections & social score' },
  { key: 'Relationships', title: 'Relationships', emoji: '❤️', desc: 'Relationship health & coaching' },
  { key: 'Growth', title: '1% Growth', emoji: '📈', desc: 'Habits & compound score' },
  { key: 'Career', title: 'Career', emoji: '💼', desc: 'Profile, burnout & coaching' },
  { key: 'Travel', title: 'Travel', emoji: '✈️', desc: 'Trips & pre-trip planning' },
  { key: 'Wardrobe', title: 'Wardrobe', emoji: '👔', desc: 'Items & outfit suggestions' },
  { key: 'Hobbies', title: 'Hobbies', emoji: '🎯', desc: 'Activities & hobby health' },
  { key: 'Learning', title: 'Learning', emoji: '📖', desc: 'Books, courses & sessions' },
  { key: 'Legacy', title: 'Legacy & Vision', emoji: '🏛️', desc: 'Values, milestones & drift' },
];

export default function LifeDashboard({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Life</Text>
      <Text style={styles.pageSubtitle}>All aspects of your lifestyle in one place</Text>

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

      <View style={{ height: spacing['3xl'] }} />
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
    color: colors.textTertiary,
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
  chevron: { color: colors.textTertiary, fontSize: 22, fontWeight: font.normal },
});
