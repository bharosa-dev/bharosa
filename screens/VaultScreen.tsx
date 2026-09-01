import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  listMyDocuments,
  createDocument,
  updateDocument,
  softDeleteDocument,
  formatExpiryLabel,
  DocumentRow,
} from '../lib/documents';

type Props = {
  onBack: () => void;
  onOpenDocument: (id: string) => void;
};

export default function VaultScreen({ onBack, onOpenDocument }: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [issuer, setIssuer] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [editDoc, setEditDoc] = useState<DocumentRow | null>(null);

  const load = async () => {
    setLoading(true);
    const rows = await listMyDocuments();
    setDocs(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const hay = `${d.title} ${d.doc_type} ${d.issuer || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [docs, query]);

  const resetForm = () => {
    setTitle('');
    setDocType('other');
    setIssuer('');
    setExpiryDate('');
  };

  const onAdd = async () => {
    if (!title.trim()) {
      Alert.alert('Enter a document title');
      return;
    }
    if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      Alert.alert('Expiry must be YYYY-MM-DD', 'Example: 2027-03-31');
      return;
    }
    setSaving(true);
    const result = await createDocument({
      title,
      doc_type: docType || 'other',
      issuer,
      expiry_date: expiryDate || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('Could not save', result.message);
      return;
    }
    resetForm();
    await load();
    Alert.alert('Saved', 'Document added. Open it to attach a photo.');
  };

  const openEdit = (doc: DocumentRow) => {
    setEditDoc(doc);
    setTitle(doc.title);
    setDocType(doc.doc_type);
    setIssuer(doc.issuer || '');
    setExpiryDate(doc.expiry_date || '');
  };

  const onSaveEdit = async () => {
    if (!editDoc) return;
    if (!title.trim()) {
      Alert.alert('Enter a document title');
      return;
    }
    if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      Alert.alert('Expiry must be YYYY-MM-DD', 'Example: 2027-03-31');
      return;
    }
    setSaving(true);
    const result = await updateDocument(editDoc.id, {
      title,
      doc_type: docType,
      issuer,
      expiry_date: expiryDate || null,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('Could not update', result.message);
      return;
    }
    setEditDoc(null);
    resetForm();
    await load();
  };

  const onDelete = (id: string, name: string) => {
    Alert.alert('Remove document?', name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await softDeleteDocument(id);
          if (!result.ok) Alert.alert('Error', result.message);
          else await load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <Text style={styles.title}>Vault</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search title, type, issuer..."
        placeholderTextColor="#8A8A8A"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.form}>
        <Text style={styles.label}>Add document</Text>
        <TextInput
          style={styles.input}
          placeholder="Title (e.g. Car insurance)"
          placeholderTextColor="#8A8A8A"
          value={title}
          onChangeText={setTitle}
          editable={!editDoc}
        />
        <TextInput
          style={styles.input}
          placeholder="Type (insurance, id, bill...)"
          placeholderTextColor="#8A8A8A"
          value={docType}
          onChangeText={setDocType}
          editable={!editDoc}
        />
        <TextInput
          style={styles.input}
          placeholder="Issuer (optional)"
          placeholderTextColor="#8A8A8A"
          value={issuer}
          onChangeText={setIssuer}
          editable={!editDoc}
        />
        <TextInput
          style={styles.input}
          placeholder="Expiry YYYY-MM-DD (optional)"
          placeholderTextColor="#8A8A8A"
          value={expiryDate}
          onChangeText={setExpiryDate}
          editable={!editDoc}
        />
        {!editDoc && (
          <Pressable
            style={[styles.addBtn, saving && { opacity: 0.6 }]}
            onPress={onAdd}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Add to vault</Text>
            )}
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#AD8438" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(row) => row.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No documents found.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onOpenDocument(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {item.doc_type}
                  {item.issuer ? ` · ${item.issuer}` : ''}
                  {item.file_path ? ' · File' : ''}
                </Text>
                {!!item.expiry_date && (
                  <Text style={styles.rowExpiry}>
                    {formatExpiryLabel(item.expiry_date)}
                  </Text>
                )}
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openEdit(item);
                  }}
                >
                  <Text style={styles.edit}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onDelete(item.id, item.title);
                  }}
                >
                  <Text style={styles.delete}>Remove</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!editDoc} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit document</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#8A8A8A"
            />
            <TextInput
              style={styles.input}
              value={docType}
              onChangeText={setDocType}
              placeholder="Type"
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
              style={[styles.addBtn, saving && { opacity: 0.6 }]}
              onPress={onSaveEdit}
              disabled={saving}
            >
              <Text style={styles.addBtnText}>Save changes</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setEditDoc(null);
                resetForm();
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5', paddingTop: 56 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  back: { color: '#1A5F9E', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#152447' },
  search: {
    marginHorizontal: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#152447',
  },
  form: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#152447',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 16,
    color: '#152447',
    backgroundColor: '#fff',
  },
  addBtn: {
    backgroundColor: '#AD8438',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: {
    textAlign: 'center',
    color: '#5C5C5C',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#152447' },
  rowMeta: { fontSize: 13, color: '#5C5C5C', marginTop: 2 },
  rowExpiry: {
    fontSize: 13,
    color: '#A96A2A',
    marginTop: 4,
    fontWeight: '600',
  },
  rowActions: { alignItems: 'flex-end', gap: 10 },
  edit: { color: '#1A5F9E', fontWeight: '600' },
  delete: { color: '#A96A2A', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#F7F7F5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 12,
  },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelText: { color: '#5C5C5C', fontSize: 16 },
});