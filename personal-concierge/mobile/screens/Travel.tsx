import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { getTrips, getActiveTrip, createTrip, getPreTripPlan } from '../lib/api';
import type { Trip } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

export default function Travel() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [prepPlan, setPrepPlan] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [dest, setDest] = useState('');
  const [depDate, setDepDate] = useState('');
  const [retDate, setRetDate] = useState('');
  const [tripType, setTripType] = useState('leisure');

  const fetchData = useCallback(async () => {
    const [t, a] = await Promise.all([getTrips(), getActiveTrip()]);
    setTrips(t || []);
    setActiveTrip(a);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCreate = useCallback(async () => {
    if (!dest || !depDate || !retDate) return;
    await createTrip({
      destination: dest,
      departure_date: depDate,
      return_date: retDate,
      trip_type: tripType,
    });
    setShowForm(false);
    setDest(''); setDepDate(''); setRetDate('');
    fetchData();
  }, [dest, depDate, retDate, tripType, fetchData]);

  const handlePrep = useCallback(async (tripId: string) => {
    setPrepPlan(null);
    const plan = await getPreTripPlan(tripId);
    setPrepPlan(plan);
  }, []);

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading trips...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Travel Intelligence</Text>

      {activeTrip && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.success }]}>
          <Text style={styles.activeLabel}>ACTIVE TRIP</Text>
          <Text style={styles.tripDest}>{activeTrip.destination}</Text>
          <Text style={styles.tripDates}>{activeTrip.departure_date} → {activeTrip.return_date}</Text>
        </View>
      )}

      {trips.filter(t => t.status === 'upcoming').map((trip) => (
        <View key={trip.id} style={styles.card}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripDest}>{trip.destination}</Text>
            <Text style={styles.countdown}>{daysUntil(trip.departure_date)}d</Text>
          </View>
          <Text style={styles.tripDates}>{trip.departure_date} → {trip.return_date}</Text>
          <Text style={styles.tripMeta}>{trip.trip_type} · {trip.travel_companions}</Text>
          <TouchableOpacity style={styles.prepBtn} onPress={() => handlePrep(trip.id)}>
            <Text style={styles.prepBtnText}>Generate Pre-Trip Plan</Text>
          </TouchableOpacity>
        </View>
      ))}

      {prepPlan && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pre-Trip Plan</Text>
          <Text style={styles.planText}>{JSON.stringify(prepPlan, null, 2)}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add Trip'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Destination" placeholderTextColor={colors.textTertiary} value={dest} onChangeText={setDest} />
          <TextInput style={styles.input} placeholder="Departure (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} value={depDate} onChangeText={setDepDate} />
          <TextInput style={styles.input} placeholder="Return (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} value={retDate} onChangeText={setRetDate} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate}>
            <Text style={styles.primaryBtnText}>Create Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {trips.filter(t => t.status === 'completed').length > 0 && (
        <>
          <Text style={styles.sectionTitle}>PAST TRIPS</Text>
          {trips.filter(t => t.status === 'completed').map((trip) => (
            <View key={trip.id} style={[styles.card, { opacity: 0.7 }]}>
              <Text style={styles.tripDest}>{trip.destination}</Text>
              <Text style={styles.tripDates}>{trip.departure_date} → {trip.return_date}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  loading: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing['5xl'] },
  title: { fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    ...cardStyle,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: font.md, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  activeLabel: { ...sectionLabel, color: colors.success, marginTop: 0, marginBottom: spacing.xs },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripDest: { fontSize: font.lg, fontWeight: font.bold, color: colors.textPrimary },
  countdown: { fontSize: font.xl, fontWeight: font.bold, color: colors.accent },
  tripDates: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing.xs },
  tripMeta: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.xs },
  prepBtn: {
    marginTop: spacing.md, backgroundColor: colors.accentMuted, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  prepBtnText: { color: colors.textAccent, fontWeight: font.semibold, fontSize: font.sm },
  planText: { fontSize: font.xs, color: colors.textSecondary, fontFamily: 'monospace' },
  addBtn: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  addBtnText: { color: colors.accent, fontWeight: font.semibold, fontSize: font.md },
  sectionTitle: { ...sectionLabel },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radii.md, padding: spacing.md,
    color: colors.textPrimary, fontSize: font.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
