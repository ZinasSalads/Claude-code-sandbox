import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ACCENT = '#6C63FF';
const RED = '#FF4757';

interface ErrorStateProps {
  section: string;
  error?: string;
  onRetry?: () => void;
}

export default function ErrorState({ section, error, onRetry }: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Couldn't load {section}</Text>
      <Text style={styles.subtitle}>Check your connection and try again</Text>

      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}

      {error && (
        <TouchableOpacity onPress={() => setShowDetail(!showDetail)} style={styles.detailBtn}>
          <Text style={styles.detailBtnText}>
            {showDetail ? 'Hide details' : 'Show details'}
          </Text>
        </TouchableOpacity>
      )}

      {showDetail && error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailBtn: {
    padding: 8,
  },
  detailBtnText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  errorText: {
    fontSize: 11,
    color: RED,
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
