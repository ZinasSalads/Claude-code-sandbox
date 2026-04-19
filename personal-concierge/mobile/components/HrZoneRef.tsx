import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing, radii, font } from '../theme';

export const HR_ZONES = [
  { z: 1, pctLow: 0.50, pctHigh: 0.60, label: 'Recovery',          color: '#6b7280' },
  { z: 2, pctLow: 0.60, pctHigh: 0.70, label: 'Aerobic Base',       color: '#22c55e' },
  { z: 3, pctLow: 0.70, pctHigh: 0.80, label: 'Aerobic / Tempo',    color: '#f97316' },
  { z: 4, pctLow: 0.80, pctHigh: 0.90, label: 'Lactate Threshold',  color: '#ef4444' },
  { z: 5, pctLow: 0.90, pctHigh: 1.00, label: 'VO₂ Max',            color: '#dc2626' },
];

interface Props {
  zone: number;
  maxHr: number | null;
}

export default function HrZoneRef({ zone, maxHr }: Props) {
  const info = HR_ZONES.find(z => z.z === zone);
  if (!info) return null;

  const mhr = maxHr ?? null;
  if (!mhr) {
    // Don't show a zone ref until we know the user's max HR — avoids showing wrong numbers
    return (
      <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radii.sm,
        backgroundColor: colors.bgCard, borderLeftWidth: 3, borderLeftColor: colors.border }}>
        <Text style={{ fontSize: font.sm, color: colors.textTertiary }}>
          Z{zone} · Set your max HR in Fitness Settings to see bpm targets.
        </Text>
      </View>
    );
  }

  const lo = Math.round(mhr * info.pctLow);
  const hi = Math.round(mhr * info.pctHigh);

  return (
    <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radii.sm,
      backgroundColor: info.color + '20', borderLeftWidth: 3, borderLeftColor: info.color }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: font.sm, fontWeight: font.semibold as any, color: info.color }}>
          Z{zone} · {info.label}
        </Text>
        <Text style={{ fontSize: font.lg, fontWeight: font.bold as any, color: info.color }}>
          {lo}–{hi} bpm
        </Text>
      </View>
      <Text style={{ fontSize: font.xs, color: info.color + 'cc', marginTop: 2 }}>
        Based on your max HR: {mhr} bpm
      </Text>
    </View>
  );
}
