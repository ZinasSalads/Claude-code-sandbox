import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, font, radii, spacing } from '../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaAction?: () => void;
}

export default function EmptyState({ icon, title, description, ctaLabel, ctaAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {ctaLabel && ctaAction && (
        <TouchableOpacity style={styles.cta} onPress={ctaAction}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing['5xl'],
    paddingTop: 60,
  },
  icon: {
    fontSize: font['4xl'],
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: font.lg,
    fontWeight: font.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: font.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  ctaText: {
    color: colors.white,
    fontSize: font.md,
    fontWeight: font.semibold,
  },
});
