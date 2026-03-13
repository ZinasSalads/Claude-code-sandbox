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
    setTrips(t);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
    >
      <Text style={styles.title}>Travel Intelligence</Text>

      {activeTrip && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#00b894' }]}>
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
          <TextInput style={styles.input} placeholder="Destination" placeholderTextColor="#555577" value={dest} onChangeText={setDest} />
          <TextInput style={styles.input} placeholder="Departure (YYYY-MM-DD)" placeholderTextColor="#555577" value={depDate} onChangeText={setDepDate} />
          <TextInput style={styles.input} placeholder="Return (YYYY-MM-DD)" placeholderTextColor="#555577" value={retDate} onChangeText={setRetDate} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate}>
            <Text style={styles.primaryBtnText}>Create Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {trips.filter(t => t.status === 'completed').length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Past Trips</Text>
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
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20 },
  loading: { color: '#8888aa', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0f0f5', marginBottom: 16 },
  card: {
    backgroundColor: '#141420', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#1e1e30', marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f0f0f5', marginBottom: 12 },
  activeLabel: { fontSize: 11, fontWeight: '700', color: '#00b894', letterSpacing: 1, marginBottom: 4 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripDest: { fontSize: 18, fontWeight: '700', color: '#f0f0f5' },
  countdown: { fontSize: 20, fontWeight: '700', color: '#6c5ce7' },
  tripDates: { fontSize: 13, color: '#8888aa', marginTop: 4 },
  tripMeta: { fontSize: 12, color: '#555577', marginTop: 4 },
  prepBtn: {
    marginTop: 12, backgroundColor: 'rgba(108,92,231,0.15)', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  prepBtnText: { color: '#a29bfe', fontWeight: '600', fontSize: 13 },
  planText: { fontSize: 12, color: '#8888aa', fontFamily: 'monospace' },
  addBtn: { alignItems: 'center', padding: 14, marginBottom: 16 },
  addBtnText: { color: '#6c5ce7', fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    color: '#f0f0f5', fontSize: 14, borderWidth: 1, borderColor: '#1e1e30', marginBottom: 12,
  },
  primaryBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
