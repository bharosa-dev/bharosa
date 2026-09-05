import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  listMyDocuments,
  createDocument,
  updateDocument,
  softDeleteDocument,
  formatExpiryLabel,
  DocumentRow,
} from '../lib/documents';
import { removeSharedDocFromMyVault } from '../lib/sharing';

type Props = {
  onBack: () => void;
  onOpenDocument: (id: string) => void;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'id', label: 'ID' },
  { key: 'bill', label: 'Bills' },
  { key: 'health', label: 'Health' },
  { key: 'other', label: 'Other' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matchesFilter(doc: DocumentRow, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const t = (doc.doc_type || '').toLowerCase();
  if (filter === 'insurance')
    return t.includes('insurance') || t.includes('policy');
  if (filter === 'id') {
    return (
      t.includes('id') ||
      t.includes('aadhaar') ||
      t.includes('aadhar') ||
      t.includes('pan') ||
      t.includes('passport') ||
      t.includes('license') ||
      t.includes('licence')
    );
  }
  if (filter === 'bill')
    return t.includes('bill') || t.includes('utility') || t.includes('invoice');
  if (filter === 'health')
    return t.includes('health') || t.includes('medical') || t.includes('lab');
  if (filter === 'other') {
    return (
      !matchesFilter(doc, 'insurance') &&
      !matchesFilter(doc, 'id') &&
      !matchesFilter(doc, 'bill') &&
      !matchesFilter(doc, 'health')
    );
  }
  return true;
}

export default function VaultScreen({ onBack, onOpenDocument }: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [issuer, setIssuer] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [editDoc, setEditDoc] = useState<DocumentRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setMyUserId(userData.user?.id ?? null);
    const rows = await listMyDocuments();
    setDocs(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (!matchesFilter(d, filter)) return false;
      if (!q) return true;
      const hay = `${d.title} ${d.doc_type} ${d.issuer || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [docs, query, filter]);

  const sections = useMemo(() => {
    const mine = filtered.filter(
      (d) => myUserId && d.owner_user_id === myUserId
    );
    const shared = filtered.filter(
      (d) => myUserId && d.owner_user_id !== myUserId
    );
    const out: { title: string; data: DocumentRow[] }[] = [];
    out.push({ title: 'My documents', data: mine });
    out.push({ title: 'Shared with me', data: shared });
    return out;
  }, [filtered, myUserId]);

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
    setShowAdd(false);
    await load();
    Alert.alert('Saved', 'Document added.');
  };

  const openEdit = (doc: DocumentRow) => {
    if (myUserId && doc.owner_user_id !== myUserId) {
      Alert.alert('Shared document', 'Only the owner can edit details.');
      return;
    }
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
      Alert.alert('Expiry must be YYYY-MM-DD');
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

  const onDeleteOwned = (id: string, name: string) => {
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

  const onRemoveShared = (id: string, name: string) => {
    Alert.alert(
      'Remove from your vault?',
      `"${name}" will disappear for you only. The owner keeps their copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove for me',
          style: 'destructive',
          onPress: async () => {
            const result = await removeSharedDocFromMyVault(id);
            if (!result.ok) Alert.alert('Error', result.message);
            else await load();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Vault</Text>
          <Pressable
            style={styles.addHeaderBtn}
            onPress={() => {
              setShowAdd((v) => !v);
              if (showAdd) resetForm();
            }}
          >
            <Text style={styles.addHeaderBtnText}>
              {showAdd ? 'Close' : '+ Add'}
            </Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search title, type, issuer..."
        placeholderTextColor="#8A8A8A"
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showAdd && (
        <View style={styles.form}>
          <Text style={styles.label}>New document</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#8A8A8A"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Type (insurance, id, bill...)"
            placeholderTextColor="#8A8A8A"
            value={docType}
            onChangeText={setDocType}
          />
          <TextInput
            style={styles.input}
            placeholder="Issuer (optional)"
            placeholderTextColor="#8A8A8A"
            value={issuer}
            onChangeText={setIssuer}
          />
          <TextInput
            style={styles.input}
            placeholder="Expiry YYYY-MM-DD"
            placeholderTextColor="#8A8A8A"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <Pressable
            style={[styles.addBtn, saving && { opacity: 0.6 }]}
            onPress={onAdd}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Save to vault</Text>
            )}
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#AD8438" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            const isShared = section.title === 'Shared with me';
            return (
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
                  {isShared ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onRemoveShared(item.id, item.title);
                      }}
                    >
                      <Text style={styles.delete}>Remove for me</Text>
                    </Pressable>
                  ) : (
                    <>
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
                          onDeleteOwned(item.id, item.title);
                        }}
                      >
                        <Text style={styles.delete}>Remove</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No documents found.</Text>
          }
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#152447' },
  addHeaderBtn: {
    backgroundColor: '#AD8438',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addHeaderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  chips: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#152447', borderColor: '#152447' },
  chipText: { fontSize: 13, color: '#5C5C5C', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: '#F7F7F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#152447' },
  sectionCount: { fontSize: 13, color: '#5C5C5C', fontWeight: '600' },
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