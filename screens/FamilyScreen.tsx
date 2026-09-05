import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  getMyFamily,
  createFamily,
  addFamilyMemberByEmail,
  listFamilyMembers,
  Family,
  FamilyMember,
} from '../lib/family';

type MemberRow = {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

type Props = { onBack: () => void };

export default function FamilyScreen({ onBack }: Props) {
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyName, setFamilyName] = useState('My Family');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const f = await getMyFamily();
    setFamily(f);

    if (f) {
      const m = await listFamilyMembers(f.id);
      const ids = m.map((x) => x.user_id);
      let profiles: { id: string; full_name: string | null; email: string | null }[] = [];

      if (ids.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);
        profiles = data ?? [];
      }

      const merged: MemberRow[] = m.map((row) => {
        const p = profiles.find((x) => x.id === row.user_id);
        return {
          id: row.id,
          family_id: row.family_id,
          user_id: row.user_id,
          role: row.role,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
        };
      });
      setMembers(merged);
    } else {
      setMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!familyName.trim()) {
      Alert.alert('Enter a family name');
      return;
    }
    setBusy(true);
    const result = await createFamily(familyName.trim());
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not create', result.message);
      return;
    }
    await load();
  };

  const onInvite = async () => {
    if (!family) return;
    setBusy(true);
    const result = await addFamilyMemberByEmail(family.id, inviteEmail);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Invite failed', result.message);
      return;
    }
    setInviteEmail('');
    await load();
    Alert.alert('Added', 'Member added. Share documents from document detail.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#AD8438" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Home</Text>
      </Pressable>
      <Text style={styles.title}>Family</Text>

      {!family ? (
        <View style={styles.card}>
          <Text style={styles.label}>Create your family</Text>
          <TextInput
            style={styles.input}
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="Family name"
            placeholderTextColor="#8A8A8A"
          />
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={onCreate}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>Create family</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>{family.name}</Text>
            <Text style={styles.help}>
              Other person must sign up in Bharosa first. Then add their email here.
            </Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="member@email.com"
              placeholderTextColor="#8A8A8A"
            />
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={onInvite}
              disabled={busy}
            >
              <Text style={styles.primaryBtnText}>Add member</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Members</Text>
          <FlatList
            data={members}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={
              <Text style={styles.help}>No members yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>
                  {item.full_name || item.email || 'Member'}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.email || 'No email on profile'} · {item.role}
                </Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F5',
  },
  back: { color: '#1A5F9E', fontSize: 16, marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 8,
  },
  help: { fontSize: 13, color: '#5C5C5C', marginBottom: 10, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    color: '#152447',
  },
  primaryBtn: {
    backgroundColor: '#AD8438',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 8,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  rowTitle: { fontSize: 15, color: '#152447', fontWeight: '600' },
  rowMeta: { fontSize: 13, color: '#5C5C5C', marginTop: 2 },
});