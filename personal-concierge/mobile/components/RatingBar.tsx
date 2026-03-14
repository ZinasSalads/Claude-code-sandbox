import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { submitRating } from '../lib/api';
import { colors, font, radii, spacing } from '../theme';

interface RatingBarProps {
  category: string;
  itemId: string;
  itemDescription: string;
  onRated?: (rating: string) => void;
}

export default function RatingBar({ category, itemId, itemDescription, onRated }: RatingBarProps) {
  const [rated, setRated] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async (rating: string) => {
    if (submitting || rated) return;
    setSubmitting(true);
    setRated(rating);

    await submitRating({
      category,
      item_id: itemId,
      item_description: itemDescription,
      rating,
    });

    setSubmitting(false);
    onRated?.(rating);
  };

  if (rated) {
    const labels: Record<string, string> = {
      loved_it: 'Loved it!',
      it_was_fine: 'Noted',
      not_for_me: 'Got it',
    };
    return (
      <View style={styles.container}>
        <Text style={styles.thanks}>{labels[rated] || 'Thanks!'} — noted for next time</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>How was it?</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => handleRate('loved_it')}>
          <Text style={styles.btnText}>Loved it</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => handleRate('it_was_fine')}>
          <Text style={styles.btnText}>Fine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnNeg]} onPress={() => handleRate('not_for_me')}>
          <Text style={styles.btnTextNeg}>Not for me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  label: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  btnNeg: {
    backgroundColor: colors.errorMuted,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  btnText: {
    fontSize: font.sm,
    color: colors.textAccent,
    fontWeight: font.semibold,
  },
  btnTextNeg: {
    fontSize: font.sm,
    color: colors.error,
    fontWeight: font.semibold,
  },
  thanks: {
    fontSize: font.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
