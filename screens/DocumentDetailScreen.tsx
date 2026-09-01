import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import {
  getDocumentById,
  attachFileToDocument,
  getDocumentSignedUrl,
  softDeleteDocument,
  formatExpiryLabel,
  DocumentRow,
} from '../lib/documents';

type Props = {
  documentId: string;
  onBack: () => void;
  onDeleted: () => void;
};

export default function DocumentDetailScreen({
  documentId,
  onBack,
  onDeleted,
}: Props) {
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const row = await getDocumentById(documentId);
    setDoc(row);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [documentId]);

  const runAttach = async (source: 'image' | 'camera' | 'file') => {
    setBusy(true);
    const result = await attachFileToDocument(documentId, source);
    setBusy(false);
    if (!result.ok && result.message !== 'Cancelled') {
      Alert.alert('Upload failed', result.message);
      return;
    }
    if (result.ok) {
      await load();
      Alert.alert('Attached', 'File saved.');
    }
  };

  const onAttach = () => {
    Alert.alert('Attach file', 'Choose source', [
      { text: 'Camera', onPress: () => runAttach('camera') },
      { text: 'Photo library', onPress: () => runAttach('image') },
      { text: 'Document (PDF etc.)', onPress: () => runAttach('file') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onOpen = async () => {
    if (!doc?.file_path) {
      Alert.alert('No file', 'Attach a file first.');
      return;
    }
    const url = await getDocumentSignedUrl(doc.file_path);
    if (!url) {
      Alert.alert('Could not open file');
      return;
    }
    Linking.openURL(url);
  };

  const onDelete = () => {
    if (!doc) return;
    Alert.alert('Remove document?', doc.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await softDeleteDocument(doc.id);
          if (!result.ok) Alert.alert('Error', result.message);
          else onDeleted();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#AD8438" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>Document not found</Text>
        <Pressable onPress={onBack}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>← Vault</Text>
      </Pressable>

      <Text style={styles.title}>{doc.title}</Text>
      <Text style={styles.meta}>
        {doc.doc_type}
        {doc.issuer ? ` · ${doc.issuer}` : ''}
      </Text>

      {!!doc.expiry_date && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Expiry</Text>
          <Text style={styles.cardValue}>
            {formatExpiryLabel(doc.expiry_date)} ({doc.expiry_date})
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>File</Text>
        <Text style={styles.cardValue}>
          {doc.file_path ? 'File attached' : 'No file yet'}
        </Text>
      </View>

      {!!doc.notes && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Notes</Text>
          <Text style={styles.cardValue}>{doc.notes}</Text>
        </View>
      )}

      <Pressable
        style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
        onPress={onAttach}
        disabled={busy}
      >
        <Text style={styles.primaryBtnText}>
          {doc.file_path ? 'Replace file' : 'Attach file'}
        </Text>
      </Pressable>

      {!!doc.file_path && (
        <Pressable style={styles.secondaryBtn} onPress={onOpen}>
          <Text style={styles.secondaryBtnText}>Open file</Text>
        </Pressable>
      )}

      <Pressable style={styles.dangerBtn} onPress={onDelete}>
        <Text style={styles.dangerBtnText}>Remove document</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  pad: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLink: { color: '#1A5F9E', fontSize: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#152447' },
  meta: { fontSize: 15, color: '#5C5C5C', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5C5C',
    marginBottom: 4,
  },
  cardValue: { fontSize: 16, color: '#152447' },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#AD8438',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#AD8438',
  },
  secondaryBtnText: { color: '#AD8438', fontSize: 16, fontWeight: '600' },
  dangerBtn: { marginTop: 24, alignItems: 'center', padding: 12 },
  dangerBtnText: { color: '#A96A2A', fontSize: 16, fontWeight: '600' },
  missing: { fontSize: 16, color: '#5C5C5C', marginBottom: 12 },
});