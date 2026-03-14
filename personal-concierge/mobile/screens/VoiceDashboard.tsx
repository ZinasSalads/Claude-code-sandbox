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
