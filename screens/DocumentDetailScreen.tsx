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
  TextInput,
} from 'react-native';
import {
  getDocumentById,
  attachFileToDocument,
  getDocumentSignedUrl,
  softDeleteDocument,
  confirmDocumentFields,
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

  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const load = async () => {
    setLoading(true);
    const row = await getDocumentById(documentId);
    setDoc(row);
    if (row) {
      setTitle(row.title || '');
      setIssuer(row.issuer || '');
      setExpiryDate(row.expiry_date || '');
    }
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

  const onConfirm = async () => {
    if (!title.trim()) {
      Alert.alert('Title is required');
      return;
    }
    if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      Alert.alert('Expiry must be YYYY-MM-DD');
      return;
    }
    setBusy(true);
    const result = await confirmDocumentFields(documentId, {
      title,
      issuer,
      expiry_date: expiryDate || null,
    });
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not confirm', result.message);
      return;
    }
    await load();
    Alert.alert('Confirmed', 'Details saved as user confirmed.');
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
      <Text style={styles.status}>
        {doc.confirmation_status === 'user_confirmed'
          ? 'Status: User confirmed'
          : 'Status: Not confirmed'}
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

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Confirm details</Text>
        <Text style={styles.help}>
          Check these fields. Later OCR will fill them automatically.
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#8A8A8A"
        />
        <TextInput
          style={styles.input}
          value={issuer}
          onChangeText={setIssuer}
          placeholder="Issuer"
          placeholderTextColor="#8A8A8A"
        />
        <TextInput
          style={styles.input}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="Expiry YYYY-MM-DD"
          placeholderTextColor="#8A8A8A"
        />
        <Pressable
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          onPress={onConfirm}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>Confirm & save</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
        onPress={onAttach}
        disabled={busy}
      >
        <Text style={styles.secondaryBtnText}>
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
  meta: { fontSize: 15, color: '#5C5C5C', marginTop: 4 },
  status: {
    fontSize: 13,
    color: '#1F6F54',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 16,
  },
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
  help: { fontSize: 13, color: '#5C5C5C', marginBottom: 10, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 16,
    color: '#152447',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#AD8438',
    borderRadius: 12,
    paddingVertical: 14,
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