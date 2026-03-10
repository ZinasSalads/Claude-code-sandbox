import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TrendArrow from './TrendArrow';

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
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  unit: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
    fontWeight: '500',
  },
});
