/**
 * Apple Health integration via react-native-health.
 *
 * Permissions requested:
 *   Read: StepCount, HeartRate, HeartRateVariabilitySDNN, SleepAnalysis,
 *         ActiveEnergyBurned, BasalEnergyBurned, BodyMass, Height,
 *         BloodOxygen, RespiratoryRate, MindfulSession
 *
 * Data merging strategy:
 *   Oura data is primary — always preferred.
 *   Apple Health fills in:
 *     - Days where Oura ring wasn't worn (sleep_score = null)
 *     - Step count (Oura doesn't always capture phone steps)
 *     - Heart rate from Apple Watch
 *     - Workout data
 *
 * NOTE: If react-native-health is not available (Expo Go),
 * gracefully degrade — all health features work from Oura alone.
 */

import { Platform } from 'react-native';

export interface AppleHealthDay {
  date: string;
  steps: number | null;
  heart_rate_avg: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_quality: string | null;
  active_calories: number | null;
  workouts: AppleHealthWorkout[];
}

export interface AppleHealthWorkout {
  type: string;
  duration_minutes: number;
  calories: number;
  start_time: string;
  end_time: string;
}

let AppleHealthKit: any = null;
let isAvailable = false;

// Try to import react-native-health; fail gracefully if not available
async function loadHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    const mod = require('react-native-health');
    AppleHealthKit = mod.default || mod;
    isAvailable = true;
    return true;
  } catch {
    console.log('react-native-health not available — Apple Health disabled');
    isAvailable = false;
    return false;
  }
}

export async function isAppleHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (AppleHealthKit !== null) return isAvailable;
  return loadHealthKit();
}

export async function requestPermissions(): Promise<boolean> {
  if (!(await isAppleHealthAvailable())) return false;

  return new Promise((resolve) => {
    const permissions = {
      permissions: {
        read: [
          'StepCount',
          'HeartRate',
          'HeartRateVariabilitySDNN',
          'SleepAnalysis',
          'ActiveEnergyBurned',
          'BasalEnergyBurned',
          'BodyMass',
          'Height',
          'OxygenSaturation',
          'RespiratoryRate',
          'MindfulSession',
        ],
        write: [],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      if (err) {
        console.error('Apple Health permission error:', err);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

export async function getDayData(dateStr: string): Promise<AppleHealthDay> {
  const empty: AppleHealthDay = {
    date: dateStr,
    steps: null,
    heart_rate_avg: null,
    hrv: null,
    sleep_hours: null,
    sleep_quality: null,
    active_calories: null,
    workouts: [],
  };

  if (!(await isAppleHealthAvailable())) return empty;

  const dayStart = new Date(dateStr);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dateStr);
  dayEnd.setHours(23, 59, 59, 999);

  const opts = { startDate: dayStart.toISOString(), endDate: dayEnd.toISOString() };

  try {
    const [steps, heartRate, hrv, sleep, calories] = await Promise.all([
      getSteps(opts),
      getHeartRateAvg(opts),
      getHRV(opts),
      getSleepHours(opts),
      getActiveCalories(opts),
    ]);

    return {
      date: dateStr,
      steps,
      heart_rate_avg: heartRate,
      hrv,
      sleep_hours: sleep,
      sleep_quality: sleep ? (sleep >= 7 ? 'good' : sleep >= 5 ? 'fair' : 'poor') : null,
      active_calories: calories,
      workouts: [],
    };
  } catch (e) {
    console.error('Apple Health day data error:', e);
    return empty;
  }
}

export async function getDateRange(start: string, end: string): Promise<AppleHealthDay[]> {
  const days: AppleHealthDay[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const day = await getDayData(current.toISOString().split('T')[0]);
    days.push(day);
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export async function syncToBackend(days: AppleHealthDay[]): Promise<{ synced: number } | null> {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const resp = await fetch(`${API_URL}/sync/apple-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.error('Apple Health sync failed:', e);
    return null;
  }
}

// --- Internal helpers ---

function getSteps(opts: any): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getStepCount(opts, (err: any, results: any) => {
      if (err) { resolve(null); return; }
      resolve(results?.value ?? null);
    });
  });
}

function getHeartRateAvg(opts: any): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const avg = results.reduce((sum, r) => sum + (r.value || 0), 0) / results.length;
      resolve(Math.round(avg));
    });
  });
}

function getHRV(opts: any): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateVariabilitySamples(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const avg = results.reduce((sum, r) => sum + (r.value || 0), 0) / results.length;
      resolve(Math.round(avg));
    });
  });
}

function getSleepHours(opts: any): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getSleepSamples(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const asleep = results.filter((r: any) => r.value === 'ASLEEP' || r.value === 'INBED');
      if (!asleep.length) { resolve(null); return; }
      let totalMs = 0;
      for (const s of asleep) {
        totalMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
      }
      resolve(Math.round((totalMs / 3600000) * 10) / 10);
    });
  });
}

function getActiveCalories(opts: any): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const total = results.reduce((sum, r) => sum + (r.value || 0), 0);
      resolve(Math.round(total));
    });
  });
}

export function getConnectionStatus(): { available: boolean; platform: string } {
  return {
    available: isAvailable,
    platform: Platform.OS,
  };
}
