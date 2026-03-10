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

interface SliderRowProps {
  emoji: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
}

function getSliderColor(value: number): string {
  if (value <= 3) return '#F44336';
  if (value <= 6) return '#FFC107';
  return '#4CAF50';
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
                backgroundColor: n <= value ? color : 'rgba(255,255,255,0.1)',
                width: n <= value ? 28 : 24,
                height: n <= value ? 28 : 24,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                sliderStyles.dotText,
                { color: n <= value ? '#fff' : 'rgba(255,255,255,0.3)' },
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
    marginBottom: 12,
  },
  emoji: {
    fontSize: 22,
    marginRight: 10,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '600',
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
          placeholderTextColor="rgba(255,255,255,0.3)"
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
    backgroundColor: '#0D0D1A',
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 32,
  },
  slidersContainer: {
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    marginBottom: 24,
  },
  doneButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 32,
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#0D0D1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEmoji: {
    fontSize: 64,
    color: '#4CAF50',
    marginBottom: 16,
  },
  successText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
});
