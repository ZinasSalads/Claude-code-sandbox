import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font } from '../theme';

interface TrendArrowProps {
  direction: 'up' | 'down' | 'flat';
  color?: string;
}

export default function TrendArrow({ direction, color }: TrendArrowProps) {
  const defaultColors = {
    up: colors.success,
    down: colors.error,
    flat: colors.textTertiary,
  };

  const symbols = {
    up: '↑',
    down: '↓',
    flat: '—',
  };

  const resolvedColor = color || defaultColors[direction];

  return (
    <View style={styles.container}>
      <Text style={[styles.arrow, { color: resolvedColor }]}>
        {symbols[direction]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
  },
  arrow: {
    fontSize: font.lg,
    fontWeight: font.bold,
  },
});
