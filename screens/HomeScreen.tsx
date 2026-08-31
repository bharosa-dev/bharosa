import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Profile } from '../lib/profile';
import {
  listMyDocuments,
  getAttentionDocuments,
  formatExpiryLabel,
  DocumentRow,
} from '../lib/documents';

type Props = {
  profile: Profile | null;
  onSignOut: () => void;
  onOpenVault: () => void;
};

export default function HomeScreen({ profile, onSignOut, onOpenVault }: Props) {
  const [attention, setAttention] = useState<DocumentRow[]>([]);
  const [recent, setRecent] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = profile?.full_name || 'there';

  const load = async () => {
    setLoading(true);
    const docs = await listMyDocuments();
    setAttention(getAttentionDocuments(docs, 30));
    setRecent(docs.slice(0, 3));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.home}>
      <Text style={styles.brand}>Bharosa</Text>
      <Text style={styles.hello}>Welcome back, {displayName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Needs your attention</Text>
        {loading ? (
          <ActivityIndicator color="#AD8438" />
        ) : attention.length === 0 ? (
          <Text style={styles.cardBody}>
            Nothing due in the next 30 days. Add expiry dates in Vault.
          </Text>
        ) : (
          attention.map((d) => (
            <View key={d.id} style={styles.attentionRow}>
              <Text style={styles.attentionTitle}>{d.title}</Text>
              <Text style={styles.attentionMeta}>
                {formatExpiryLabel(d.expiry_date)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recently added</Text>
        {loading ? (
          <ActivityIndicator color="#AD8438" />
        ) : recent.length === 0 ? (
          <Text style={styles.cardBody}>Your vault is empty.</Text>
        ) : (
          recent.map((d) => (
            <Text key={d.id} style={styles.recentLine}>
              • {d.title}
            </Text>
          ))
        )}
      </View>

      <Pressable style={styles.primaryBtn} onPress={onOpenVault}>
        <Text style={styles.primaryBtnText}>Open Vault</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={onSignOut}>
        <Text style={styles.secondaryBtnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  home: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  brand: { fontSize: 28, fontWeight: '700', color: '#152447' },
  hello: { fontSize: 16, color: '#5C5C5C', marginBottom: 24, marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 8,
  },
  cardBody: { fontSize: 14, color: '#5C5C5C', lineHeight: 20 },
  attentionRow: { marginBottom: 10 },
  attentionTitle: { fontSize: 15, fontWeight: '600', color: '#152447' },
  attentionMeta: { fontSize: 13, color: '#A96A2A', marginTop: 2 },
  recentLine: { fontSize: 14, color: '#5C5C5C', marginBottom: 4 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#AD8438',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#AD8438',
  },
  secondaryBtnText: { color: '#AD8438', fontSize: 16, fontWeight: '600' },
});