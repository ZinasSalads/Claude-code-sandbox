import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { submitRating } from '../lib/api';

const ACCENT = '#6C63FF';

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
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
  },
  btnNeg: {
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderColor: 'rgba(255,71,87,0.3)',
  },
  btnText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
  },
  btnTextNeg: {
    fontSize: 13,
    color: '#FF4757',
    fontWeight: '600',
  },
  thanks: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
