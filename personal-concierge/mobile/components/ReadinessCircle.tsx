import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface ReadinessCircleProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#4CAF50';
  if (score >= 70) return '#8BC34A';
  if (score >= 55) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent Recovery';
  if (score >= 70) return 'Good Recovery';
  if (score >= 55) return 'Moderate Recovery';
  if (score >= 40) return 'Poor Recovery';
  return 'Rest Recommended';
}

export default function ReadinessCircle({ score, size = 180 }: ReadinessCircleProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
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
          stroke="rgba(255,255,255,0.08)"
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
    fontSize: 48,
    fontWeight: '700',
  },
  outOf: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  glow: {
    position: 'absolute',
    opacity: 0.06,
    zIndex: -1,
  },
});
