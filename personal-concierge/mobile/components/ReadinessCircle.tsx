import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, font, getScoreColor } from '../theme';

interface ReadinessCircleProps {
  score: number;
  size?: number;
}

function getRecoveryLabel(score: number): string {
  if (score >= 85) return 'Excellent Recovery';
  if (score >= 70) return 'Good Recovery';
  if (score >= 55) return 'Moderate Recovery';
  if (score >= 40) return 'Poor Recovery';
  return 'Rest Recommended';
}

export default function ReadinessCircle({ score, size = 180 }: ReadinessCircleProps) {
  const color = getScoreColor(score);
  const label = getRecoveryLabel(score);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.6" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#grad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.outOf}>/ 100</Text>
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
      {/* Glow effect */}
      <View
        style={[
          styles.glow,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size * 0.35,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  score: {
    fontSize: font['4xl'],
    fontWeight: font.bold,
  },
  outOf: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: -4,
  },
  label: {
    fontSize: font.sm,
    fontWeight: font.semibold,
    marginTop: 4,
  },
  glow: {
    position: 'absolute',
    opacity: 0.06,
    zIndex: -1,
  },
});
