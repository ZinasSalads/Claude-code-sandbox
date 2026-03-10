import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TrendArrowProps {
  direction: 'up' | 'down' | 'flat';
  color?: string;
}

export default function TrendArrow({ direction, color }: TrendArrowProps) {
  const defaultColors = {
    up: '#4CAF50',
    down: '#F44336',
    flat: '#888',
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
    fontSize: 16,
    fontWeight: '700',
  },
});
