import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

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
  { key: 'Financial', title: 'Financial', emoji: '💳', desc: 'Subscriptions & budget audit' },
  { key: 'Hobbies', title: 'Hobbies', emoji: '🎯', desc: 'Activities & hobby health' },
  { key: 'Legacy', title: 'Legacy & Vision', emoji: '🏛️', desc: 'Values, milestones & drift' },
  { key: 'HomeEnv', title: 'Home Environment', emoji: '🏠', desc: 'Optimization & correlations' },
  { key: 'Learning', title: 'Learning', emoji: '📖', desc: 'Books, courses & sessions' },
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

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  content: { padding: 16 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    marginTop: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
  },
  moduleRow: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleEmoji: { fontSize: 26, marginRight: 14 },
  moduleTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  moduleDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  chevron: { color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: '300' },
});
