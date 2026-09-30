import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function HomeScreen({
  onOpenVault,
  onOpenProfile,
  onOpenAdd,
  onOpenFamily,
}: {
  onOpenVault?: () => void;
  onOpenDocument?: (id: string) => void;
  onOpenFamily?: () => void;
  onOpenSharing?: () => void;
  onOpenScoreVault?: () => void;
  onOpenReminders?: () => void;
  onOpenProfile?: () => void;
  onOpenAdd?: () => void;
  onOpenMedicines?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [docCount, setDocCount] = useState(0);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErr('Not signed in');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name,email')
        .eq('id', user.id)
        .maybeSingle();
      setName(prof?.full_name || user.email || 'there');

      try {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('owner_user_id', user.id)
          .is('deleted_at', null);
        setDocCount(count || 0);
      } catch {
        setDocCount(0);
      }
    } catch (e: any) {
      console.log('home load', e);
      setErr(e?.message || 'Could not load home');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.muted}>Loading home…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: Math.max(insets.top, 12) }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            setLoading(true);
            load();
          }}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>Bharosa</Text>
        <Text style={styles.hello}>Hello, {name}</Text>
        <Text style={styles.sub}>Your documents, your control</Text>
        <Text style={styles.stat}>{docCount} document{docCount === 1 ? '' : 's'} in vault</Text>
      </View>

      {err ? (
        <View style={styles.card}>
          <Text style={styles.err}>{err}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.section}>Quick actions</Text>
      <TouchableOpacity style={styles.card} onPress={onOpenVault}>
        <Text style={styles.cardTitle}>Open Vault</Text>
        <Text style={styles.cardSub}>IDs, insurance, vehicles, health</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={onOpenAdd}>
        <Text style={styles.cardTitle}>Add document</Text>
        <Text style={styles.cardSub}>Save something important</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={onOpenFamily}>
        <Text style={styles.cardTitle}>Family</Text>
        <Text style={styles.cardSub}>Members & care</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={onOpenProfile}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.cardSub}>Account & privacy</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F5' },
  muted: { marginTop: 10, color: '#8B8790' },
  hero: {
    backgroundColor: '#1A2744',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  brand: { color: '#C4A35A', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  hello: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 8 },
  sub: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  stat: { color: '#C4A35A', fontWeight: '700', marginTop: 14 },
  section: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontWeight: '800',
    color: '#1A2744',
    fontSize: 16,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  cardTitle: { fontWeight: '800', color: '#1A2744', fontSize: 16 },
  cardSub: { color: '#8B8790', marginTop: 4 },
  err: { color: '#C0392B', fontWeight: '600' },
  btn: {
    marginTop: 12,
    backgroundColor: '#C4A35A',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800' },
});
