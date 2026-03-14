import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, font, radii, spacing } from '../theme';

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
    padding: spacing['3xl'],
  },
  title: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: font.sm,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontSize: font.md,
    fontWeight: font.semibold,
  },
  detailBtn: {
    padding: spacing.sm,
  },
  detailBtnText: {
    color: colors.textTertiary,
    fontSize: font.xs,
  },
  errorText: {
    fontSize: font.xs,
    color: colors.error,
    marginTop: spacing.sm,
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
