import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { submitCheckIn } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle } from '../theme';

interface SliderRowProps {
  emoji: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
}

function getSliderColor(value: number): string {
  if (value <= 3) return colors.error;
  if (value <= 6) return colors.warning;
  return colors.success;
}

function SliderRow({ emoji, label, value, onChange }: SliderRowProps) {
  const color = getSliderColor(value);

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={sliderStyles.emoji}>{emoji}</Text>
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={[sliderStyles.value, { color }]}>{value}</Text>
      </View>
      <View style={sliderStyles.dotsRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[
              sliderStyles.dot,
              {
                backgroundColor: n <= value ? color : colors.border,
                width: n <= value ? 28 : 24,
                height: n <= value ? 28 : 24,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                sliderStyles.dotText,
                { color: n <= value ? colors.white : colors.textTertiary },
              ]}
            >
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 22,
    marginRight: 10,
  },
  label: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  value: {
    fontSize: font['2xl'],
    fontWeight: font.bold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: font.xs,
    fontWeight: font.semibold,
  },
});

interface CheckInProps {
  navigation: {
    goBack: () => void;
  };
}

export default function CheckIn({ navigation }: CheckInProps) {
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const result = await submitCheckIn({ energy, mood, stress, soreness, notes: notes || undefined });
    setSubmitting(false);

    if (result) {
      setSuccess(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => navigation.goBack(), 800);
      });
    }
  }, [energy, mood, stress, soreness, notes, fadeAnim, navigation]);

  if (success) {
    return (
      <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
        <Text style={styles.successEmoji}>✓</Text>
        <Text style={styles.successText}>Check-in saved!</Text>
      </Animated.View>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>How are you feeling?</Text>
        <Text style={styles.subtitle}>{today}</Text>

        <View style={styles.slidersContainer}>
          <SliderRow emoji="⚡" label="Energy" value={energy} onChange={setEnergy} />
          <SliderRow emoji="😊" label="Mood" value={mood} onChange={setMood} />
          <SliderRow emoji="😤" label="Stress" value={stress} onChange={setStress} />
          <SliderRow emoji="💪" label="Soreness" value={soreness} onChange={setSoreness} />
        </View>

        <TextInput
          style={styles.notesInput}
          placeholder="Anything else to note?"
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.doneButton, submitting && styles.doneButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>
            {submitting ? 'Saving...' : 'Done'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: font['3xl'],
    fontWeight: font.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: font.md,
    color: colors.textSecondary,
    marginBottom: spacing['3xl'],
  },
  slidersContainer: {
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: font.md,
    minHeight: 80,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: spacing['3xl'],
    ...shadow.glow,
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: font.bold,
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEmoji: {
    fontSize: 64,
    color: colors.success,
    marginBottom: spacing.lg,
  },
  successText: {
    fontSize: 22,
    fontWeight: font.semibold,
    color: colors.textPrimary,
  },
});
