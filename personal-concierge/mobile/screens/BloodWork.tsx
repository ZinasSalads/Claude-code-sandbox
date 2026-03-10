import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  getBiomarkers,
  getFlaggedBiomarkers,
  getBloodWorkDelta,
  getBloodWorkUploads,
  uploadBloodWork,
} from '../lib/api';
import type { Biomarker, BloodWorkUpload, DeltaReport } from '../lib/api';

type Tab = 'dashboard' | 'upload' | 'trends' | 'delta';

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    optimal: '#4CAF50',
    suboptimal: '#FFC107',
    high: '#F44336',
    low: '#2196F3',
  };
  return (
    <View
      style={[
        dotStyles.dot,
        { backgroundColor: colors[status || ''] || 'rgba(255,255,255,0.3)' },
      ]}
    />
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
});

function BiomarkerCard({ bm }: { bm: Biomarker }) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <StatusDot status={bm.optimal_status} />
        <Text style={cardStyles.name} numberOfLines={1}>
          {bm.name}
        </Text>
        <Text style={cardStyles.value}>
          {bm.value} <Text style={cardStyles.unit}>{bm.unit}</Text>
        </Text>
      </View>
      {(bm.optimal_min != null || bm.optimal_max != null) && (
        <Text style={cardStyles.range}>
          Optimal: {bm.optimal_min ?? '—'} – {bm.optimal_max ?? '—'} {bm.unit}
        </Text>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  unit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '400',
  },
  range: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 16,
  },
});

// ---- Dashboard Tab ----
function DashboardTab() {
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [flagged, setFlagged] = useState<Biomarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [bm, fl] = await Promise.all([getBiomarkers(), getFlaggedBiomarkers()]);
    setBiomarkers(bm);
    setFlagged(fl);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={tabStyles.center}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (biomarkers.length === 0) {
    return (
      <View style={tabStyles.center}>
        <Text style={tabStyles.empty}>No blood work uploaded yet.</Text>
        <Text style={tabStyles.emptyHint}>
          Upload a lab PDF to see your biomarkers here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={tabStyles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6C63FF" />
      }
    >
      {flagged.length > 0 && (
        <>
          <Text style={tabStyles.sectionTitle}>NEEDS ATTENTION</Text>
          {flagged.map((bm, i) => (
            <BiomarkerCard key={`fl-${i}`} bm={bm} />
          ))}
        </>
      )}
      <Text style={tabStyles.sectionTitle}>ALL BIOMARKERS ({biomarkers.length})</Text>
      {biomarkers.map((bm, i) => (
        <BiomarkerCard key={`bm-${i}`} bm={bm} />
      ))}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ---- Upload Tab ----
function UploadTab() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    biomarkers_found: number;
    biomarkers_saved: number;
    lab_name: string;
    test_date: string;
  } | null>(null);
  const [uploads, setUploads] = useState<BloodWorkUpload[]>([]);

  useEffect(() => {
    getBloodWorkUploads().then(setUploads);
  }, [result]);

  const handlePick = useCallback(async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (doc.canceled || !doc.assets?.length) return;
      const asset = doc.assets[0];

      setUploading(true);
      setResult(null);
      const res = await uploadBloodWork({
        uri: asset.uri,
        name: asset.name,
        type: 'application/pdf',
      });
      if (res) {
        setResult(res);
      } else {
        Alert.alert('Upload Failed', 'Could not process the PDF. Make sure it contains lab results.');
      }
    } catch {
      Alert.alert('Error', 'File picker failed.');
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <ScrollView style={tabStyles.scroll}>
      <TouchableOpacity
        style={uploadStyles.button}
        onPress={handlePick}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={uploadStyles.buttonText}>Upload Lab PDF</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={uploadStyles.resultCard}>
          <Text style={uploadStyles.resultTitle}>Upload Complete</Text>
          <Text style={uploadStyles.resultText}>
            Lab: {result.lab_name || 'Unknown'}
          </Text>
          <Text style={uploadStyles.resultText}>
            Date: {result.test_date}
          </Text>
          <Text style={uploadStyles.resultText}>
            Biomarkers found: {result.biomarkers_found}
          </Text>
          <Text style={uploadStyles.resultText}>
            Saved: {result.biomarkers_saved}
          </Text>
        </View>
      )}

      {uploads.length > 0 && (
        <>
          <Text style={tabStyles.sectionTitle}>PREVIOUS UPLOADS</Text>
          {uploads.map((u) => (
            <View key={u.id} style={uploadStyles.uploadRow}>
              <View style={{ flex: 1 }}>
                <Text style={uploadStyles.uploadName}>{u.pdf_filename}</Text>
                <Text style={uploadStyles.uploadMeta}>
                  {u.lab_name || 'Lab'} · {u.test_date} · {u.biomarker_count} markers
                </Text>
              </View>
              <View
                style={[
                  uploadStyles.statusBadge,
                  {
                    backgroundColor:
                      u.processing_status === 'completed'
                        ? '#4CAF5020'
                        : '#FFC10720',
                  },
                ]}
              >
                <Text
                  style={[
                    uploadStyles.statusText,
                    {
                      color:
                        u.processing_status === 'completed'
                          ? '#4CAF50'
                          : '#FFC107',
                    },
                  ]}
                >
                  {u.processing_status}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const uploadStyles = StyleSheet.create({
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  resultTitle: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  uploadRow: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

// ---- Trends Tab (placeholder showing latest) ----
function TrendsTab() {
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBiomarkers().then((bm) => {
      setBiomarkers(bm);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={tabStyles.center}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (biomarkers.length === 0) {
    return (
      <View style={tabStyles.center}>
        <Text style={tabStyles.empty}>No data yet.</Text>
      </View>
    );
  }

  // Group by optimal status
  const groups: Record<string, Biomarker[]> = {};
  for (const bm of biomarkers) {
    const status = bm.optimal_status || 'unknown';
    if (!groups[status]) groups[status] = [];
    groups[status].push(bm);
  }

  const order = ['high', 'low', 'suboptimal', 'optimal', 'unknown'];

  return (
    <ScrollView style={tabStyles.scroll}>
      {order.map((status) => {
        const items = groups[status];
        if (!items || items.length === 0) return null;
        return (
          <View key={status}>
            <Text style={tabStyles.sectionTitle}>
              {status.toUpperCase()} ({items.length})
            </Text>
            {items.map((bm, i) => (
              <BiomarkerCard key={`${status}-${i}`} bm={bm} />
            ))}
          </View>
        );
      })}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ---- Delta Tab ----
function DeltaTab() {
  const [report, setReport] = useState<DeltaReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBloodWorkDelta().then((r) => {
      setReport(r);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={tabStyles.center}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (!report || report.error) {
    return (
      <View style={tabStyles.center}>
        <Text style={tabStyles.empty}>
          {report?.error || 'No comparison data available.'}
        </Text>
        <Text style={tabStyles.emptyHint}>
          Upload at least two lab reports to see changes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={tabStyles.scroll}>
      <View style={deltaStyles.header}>
        <Text style={deltaStyles.headerText}>
          {report.date_old} → {report.date_new}
        </Text>
        <Text style={deltaStyles.headerSub}>
          {report.total_markers} markers compared
        </Text>
      </View>
      {report.deltas.map((d, i) => {
        const changeColor =
          d.direction === 'improved'
            ? '#4CAF50'
            : d.direction === 'worsened'
            ? '#F44336'
            : 'rgba(255,255,255,0.5)';
        return (
          <View key={i} style={deltaStyles.row}>
            <Text style={deltaStyles.name} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={deltaStyles.values}>
              <Text style={deltaStyles.oldVal}>{d.old_value ?? '—'}</Text>
              <Text style={deltaStyles.arrow}>→</Text>
              <Text style={deltaStyles.newVal}>{d.new_value ?? '—'}</Text>
              {d.change != null && (
                <Text style={[deltaStyles.change, { color: changeColor }]}>
                  {d.change > 0 ? '+' : ''}
                  {d.change} ({d.change_pct != null ? `${d.change_pct}%` : ''})
                </Text>
              )}
            </View>
          </View>
        );
      })}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const deltaStyles = StyleSheet.create({
  header: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  headerText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldVal: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  arrow: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  newVal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 'auto',
  },
});

// ---- Main Screen ----
export default function BloodWork() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['dashboard', 'upload', 'trends', 'delta'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'delta' ? 'Delta' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'upload' && <UploadTab />}
        {tab === 'trends' && <TrendsTab />}
        {tab === 'delta' && <DeltaTab />}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  empty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#6C63FF',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
});
