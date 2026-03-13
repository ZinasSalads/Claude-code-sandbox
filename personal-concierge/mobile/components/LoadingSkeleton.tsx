import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface LoadingSkeletonProps {
  width: number;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function LoadingSkeleton({
  width,
  height,
  borderRadius = 12,
  style,
}: LoadingSkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <Animated.View style={[styles.card, style]}>
      <LoadingSkeleton width={120} height={14} borderRadius={4} style={{ marginBottom: 12 }} />
      <LoadingSkeleton width={200} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <LoadingSkeleton width={160} height={12} borderRadius={4} />
    </Animated.View>
  );
}

export function SkeletonList({ rows = 4, style }: { rows?: number; style?: ViewStyle }) {
  return (
    <Animated.View style={style}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View key={i} style={styles.listRow}>
          <LoadingSkeleton width={40} height={40} borderRadius={20} />
          <Animated.View style={styles.listContent}>
            <LoadingSkeleton width={140} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
            <LoadingSkeleton width={100} height={10} borderRadius={4} />
          </Animated.View>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

export function SkeletonRing({ size = 80, style }: { size?: number; style?: ViewStyle }) {
  return (
    <LoadingSkeleton width={size} height={size} borderRadius={size / 2} style={style} />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2A2A3E',
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  listContent: {
    marginLeft: 12,
    flex: 1,
  },
});
