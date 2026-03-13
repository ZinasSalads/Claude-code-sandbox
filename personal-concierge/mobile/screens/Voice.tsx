import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getMorningBriefing, getEveningWindDown, processVoiceCommand } from '../lib/api';

const SESSION_TYPES = ['Morning', 'Workout', 'Evening', 'Command'] as const;

export default function Voice() {
  const [sessionType, setSessionType] = useState<string>('Command');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBriefing = useCallback(async () => {
    setLoading(true);
    setResponse('');
    const result = await getMorningBriefing();
    setResponse(result?.text || 'Unable to generate briefing.');
    setLoading(false);
  }, []);

  const handleWindDown = useCallback(async () => {
    setLoading(true);
    setResponse('');
    const result = await getEveningWindDown();
    setResponse(result?.text || 'Unable to generate wind-down.');
    setLoading(false);
  }, []);

  const handleCommand = useCallback(async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setResponse('');
    const result = await processVoiceCommand(transcript, sessionType.toLowerCase());
    setResponse(result?.response_text || 'No response.');
    setLoading(false);
  }, [transcript, sessionType]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Voice Interface</Text>
      <Text style={styles.subtitle}>AI-powered voice commands and briefings</Text>

      <View style={styles.typeRow}>
        {SESSION_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, sessionType === t && styles.typeBtnActive]}
            onPress={() => setSessionType(t)}
          >
            <Text style={[styles.typeBtnText, sessionType === t && styles.typeBtnTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBriefing}>
          <Text style={styles.actionBtnText}>Morning Briefing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={handleWindDown}>
          <Text style={styles.actionBtnText}>Evening Wind-Down</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Text Command</Text>
        <TextInput
          style={styles.input}
          placeholder="Type a command..."
          placeholderTextColor="#555577"
          value={transcript}
          onChangeText={setTranscript}
          multiline
        />
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.disabled]}
          onPress={handleCommand}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>{loading ? 'Processing...' : 'Send Command'}</Text>
        </TouchableOpacity>
      </View>

      {response ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Response</Text>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0f0f5', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8888aa', marginBottom: 20 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#141420', borderWidth: 1, borderColor: '#1e1e30',
  },
  typeBtnActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  typeBtnText: { fontSize: 13, fontWeight: '500', color: '#8888aa' },
  typeBtnTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#1e1e30', marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f0f0f5', marginBottom: 12 },
  actionBtn: {
    backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12, padding: 14,
    alignItems: 'center',
  },
  actionBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, minHeight: 60, borderWidth: 1, borderColor: '#1e1e30',
    marginBottom: 12, textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.5 },
  responseText: { fontSize: 14, color: '#a29bfe', lineHeight: 22 },
});
