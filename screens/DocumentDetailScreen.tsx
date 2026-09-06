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
import { supabase } from '../lib/supabase';
import {
  getDocumentById,
  attachFileToDocument,
  getDocumentSignedUrl,
  softDeleteDocument,
  confirmDocumentFields,
  formatExpiryLabel,
  DocumentRow,
} from '../lib/documents';
import {
  getMyFamily,
  listFamilyMembers,
  shareDocumentWithUser,
  FamilyMember,
} from '../lib/family';
import {
  listSharesForDocument,
  getMyPermissionForDocument,
  revokeShare,
  removeSharedDocFromMyVault,
  permissionLabel,
  ShareRow,
} from '../lib/sharing';
import ExpiryDateField from '../components/ExpiryDateField';

type Props = {
  documentId: string;
  initialDoc?: DocumentRow | null;
  onBack: () => void;
  onDeleted: () => void;
};

function formatUpdatedAt(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export default function DocumentDetailScreen({
  documentId,
  initialDoc = null,
  onBack,
  onDeleted,
}: Props) {
  const [doc, setDoc] = useState<DocumentRow | null>(initialDoc);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialDoc);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [myPerm, setMyPerm] = useState<ShareRow | null>(null);

  const [title, setTitle] = useState(initialDoc?.title || '');
  const [issuer, setIssuer] = useState(initialDoc?.issuer || '');
  const [expiryDate, setExpiryDate] = useState(initialDoc?.expiry_date || '');

  const isOwner = !!(doc && myUserId && doc.owner_user_id === myUserId);
  const canEdit = isOwner || !!myPerm?.can_edit;

  const load = async () => {
    if (!initialDoc) setLoading(true);

    const [{ data: userData }, row] = await Promise.all([
      supabase.auth.getUser(),
      getDocumentById(documentId),
    ]);

    const uid = userData.user?.id ?? null;
    setMyUserId(uid);
    setDoc(row);
    if (row) {
      setTitle(row.title || '');
      setIssuer(row.issuer || '');
      setExpiryDate(row.expiry_date || '');
    }

    const ownerNow = !!(row && uid && row.owner_user_id === uid);

    const tasks: Promise<unknown>[] = [
      getMyPermissionForDocument(documentId).then(setMyPerm),
    ];

    if (ownerNow) {
      tasks.push(listSharesForDocument(documentId).then(setShares));
      tasks.push(
        (async () => {
          const family = await getMyFamily();
          if (family) setMembers(await listFamilyMembers(family.id));
          else setMembers([]);
        })()
      );
    } else {
      setShares([]);
      setMembers([]);
    }

    await Promise.all(tasks);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [documentId]);

  useEffect(() => {
    const channel = supabase
      .channel(`doc-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  const runAttach = async (source: 'image' | 'camera' | 'file') => {
    if (!isOwner) {
      Alert.alert('Only the owner can attach files');
      return;
    }
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
      Alert.alert('No file', 'No file attached yet.');
      return;
    }
    if (!isOwner && myPerm && !myPerm.can_download) {
      Alert.alert('Download not allowed', 'Owner shared this as View only.');
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
    if (!canEdit) return;
    if (!title.trim()) {
      Alert.alert('Title is required');
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
      Alert.alert('Could not save', result.message);
      return;
    }
    await load();
    Alert.alert('Saved', 'Details updated.');
  };

  const onShare = () => {
    if (!isOwner) return;
    if (members.length === 0) {
      Alert.alert('No family members', 'Add a member on the Family tab first.');
      return;
    }

    (async () => {
      const ids = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);

      const pickMember = members.filter((m) => m.user_id !== myUserId);

      const memberButtons = pickMember.map((m) => {
        const p = profiles?.find((x) => x.id === m.user_id);
        const label = p?.full_name || p?.email || m.user_id.slice(0, 8);
        return {
          text: `${label} (${m.role})`,
          onPress: () => {
            Alert.alert('Access level', `Sharing with ${label}`, [
              {
                text: 'View only',
                onPress: async () => {
                  const result = await shareDocumentWithUser(
                    documentId,
                    m.user_id,
                    {
                      can_view: true,
                      can_download: false,
                      can_edit: false,
                    }
                  );
                  if (!result.ok) Alert.alert('Share failed', result.message);
                  else {
                    await load();
                    Alert.alert('Shared', 'View only');
                  }
                },
              },
              {
                text: 'View + Download',
                onPress: async () => {
                  const result = await shareDocumentWithUser(
                    documentId,
                    m.user_id,
                    {
                      can_view: true,
                      can_download: true,
                      can_edit: false,
                    }
                  );
                  if (!result.ok) Alert.alert('Share failed', result.message);
                  else {
                    await load();
                    Alert.alert('Shared', 'View + Download');
                  }
                },
              },
              {
                text: 'Edit (includes download)',
                onPress: async () => {
                  const result = await shareDocumentWithUser(
                    documentId,
                    m.user_id,
                    {
                      can_view: true,
                      can_download: true,
                      can_edit: true,
                    }
                  );
                  if (!result.ok) Alert.alert('Share failed', result.message);
                  else {
                    await load();
                    Alert.alert('Shared', 'Edit access granted');
                  }
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          },
        };
      });

      Alert.alert('Share with family member', 'Choose member', [
        ...memberButtons,
        { text: 'Cancel', style: 'cancel' },
      ]);
    })();
  };

  const onRevoke = (share: ShareRow) => {
    Alert.alert(
      'Stop sharing?',
      `Remove access for ${share.full_name || share.email || 'this member'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const result = await revokeShare(share.id);
            if (!result.ok) Alert.alert('Error', result.message);
            else await load();
          },
        },
      ]
    );
  };

  const onDelete = () => {
    if (!doc) return;
    if (isOwner) {
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
    } else {
      Alert.alert('Remove from your vault?', 'The owner keeps their copy.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove for me',
          style: 'destructive',
          onPress: async () => {
            const result = await removeSharedDocFromMyVault(doc.id);
            if (!result.ok) Alert.alert('Error', result.message);
            else onDeleted();
          },
        },
      ]);
    }
  };

  if (loading && !doc) {
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
        {isOwner ? 'You own this document' : 'Shared with you'}
      </Text>
      {!!formatUpdatedAt(doc.updated_at || doc.created_at) && (
        <Text style={styles.updated}>
          Last updated: {formatUpdatedAt(doc.updated_at || doc.created_at)}
        </Text>
      )}

      {!isOwner && myPerm && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Shared by</Text>
          <Text style={styles.cardValue}>
            {myPerm.full_name || myPerm.email || 'Family member'}
          </Text>
          <Text style={styles.cardLabel}>Your access</Text>
          <Text style={styles.cardValue}>{permissionLabel(myPerm)}</Text>
          <Pressable
            style={[styles.secondaryBtn, { marginTop: 12 }]}
            onPress={onOpen}
          >
            <Text style={styles.secondaryBtnText}>
              {!doc.file_path
                ? 'No file attached'
                : myPerm.can_download
                ? 'Open / Download file'
                : 'View only — download blocked'}
            </Text>
          </Pressable>
        </View>
      )}

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

      {isOwner && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Shared with</Text>
          {shares.length === 0 ? (
            <Text style={styles.help}>Not shared with anyone yet.</Text>
          ) : (
            shares.map((s) => (
              <View key={s.id} style={styles.shareRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardValue}>
                    {s.full_name || s.email || s.user_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.help}>{permissionLabel(s)}</Text>
                </View>
                <Pressable onPress={() => onRevoke(s)}>
                  <Text style={styles.revoke}>Revoke</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {canEdit && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {isOwner ? 'Confirm details' : 'Edit details'}
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
          <ExpiryDateField value={expiryDate} onChange={setExpiryDate} />
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={onConfirm}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>Save details</Text>
          </Pressable>
        </View>
      )}

      {isOwner && (
        <Pressable style={styles.secondaryBtn} onPress={onShare}>
          <Text style={styles.secondaryBtnText}>Share with family</Text>
        </Pressable>
      )}

      {isOwner && (
        <Pressable
          style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
          onPress={onAttach}
          disabled={busy}
        >
          <Text style={styles.secondaryBtnText}>
            {doc.file_path ? 'Replace file' : 'Attach file'}
          </Text>
        </Pressable>
      )}

      {isOwner && !!doc.file_path && (
        <Pressable style={styles.secondaryBtn} onPress={onOpen}>
          <Text style={styles.secondaryBtnText}>Open file</Text>
        </Pressable>
      )}

      <Pressable style={styles.dangerBtn} onPress={onDelete}>
        <Text style={styles.dangerBtnText}>
          {isOwner ? 'Remove document' : 'Remove from my vault'}
        </Text>
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
  },
  updated: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 12,
    marginTop: 4,
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
    marginTop: 6,
  },
  cardValue: { fontSize: 16, color: '#152447' },
  help: { fontSize: 13, color: '#5C5C5C', marginBottom: 4 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  revoke: { color: '#A96A2A', fontWeight: '600' },
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