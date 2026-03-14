import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TrendArrow from './TrendArrow';
import { colors, font, radii, spacing, shadow } from '../theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  color?: string;
}

export default function MetricCard({ label, value, unit, trend, color }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, color ? { color } : null]}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        {trend ? <TrendArrow direction={trend} color={color} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flex: 1,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  label: {
    fontSize: font.xs,
    color: colors.textSecondary,
    fontWeight: font.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  value: {
    fontSize: font['2xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
  },
  unit: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    fontWeight: font.medium,
  },
});
