import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export type ExtractedField = {
  value: string;
  confidence: number | null;
  source: 'user' | 'ocr';
};

export type ExtractedFields = {
  title?: ExtractedField;
  issuer?: ExtractedField;
  expiry_date?: ExtractedField;
  [key: string]: ExtractedField | undefined;
};

export type DocumentRow = {
  id: string;
  owner_user_id: string;
  title: string;
  doc_type: string;
  issuer: string | null;
  expiry_date: string | null;
  notes: string | null;
  confirmation_status: 'not_confirmed' | 'user_confirmed';
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  file_path: string | null;
  file_mime: string | null;
  file_size_bytes: number | null;
  extracted_fields: ExtractedFields;
  created_at: string;
  updated_at?: string | null;
};

export async function listMyDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, owner_user_id, title, doc_type, issuer, expiry_date, notes, confirmation_status, sensitivity, file_path, file_mime, file_size_bytes, extracted_fields, created_at, updated_at'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('listMyDocuments', error.message);
    return [];
  }
  return (data as DocumentRow[]) ?? [];
}

export async function getDocumentById(
  id: string
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, owner_user_id, title, doc_type, issuer, expiry_date, notes, confirmation_status, sensitivity, file_path, file_mime, file_size_bytes, extracted_fields, created_at'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.log('getDocumentById', error.message);
    return null;
  }
  return data as DocumentRow | null;
}

export async function createDocument(input: {
  title: string;
  doc_type?: string;
  issuer?: string;
  expiry_date?: string;
  notes?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: 'Not signed in' };
  }

  const { data, error } = await supabase.rpc('create_my_document', {
    p_title: input.title.trim(),
    p_doc_type: input.doc_type?.trim() || 'other',
    p_issuer: input.issuer?.trim() || null,
    p_expiry_date: input.expiry_date || null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      message: `${error.message} | ${error.code ?? ''} | ${error.details ?? ''}`,
    };
  }

  if (!data) {
    return { ok: false, message: 'No document id returned' };
  }

  return { ok: true, id: String(data) };
}

export async function updateDocument(
  id: string,
  input: {
    title: string;
    doc_type?: string;
    issuer?: string;
    expiry_date?: string | null;
    notes?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('documents')
    .update({
      title: input.title.trim(),
      doc_type: input.doc_type?.trim() || 'other',
      issuer: input.issuer?.trim() || null,
      expiry_date: input.expiry_date || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Save user-confirmed fields (manual now; OCR later writes same shape). */
export async function confirmDocumentFields(
  id: string,
  fields: {
    title: string;
    issuer?: string;
    expiry_date?: string | null;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const extracted_fields: ExtractedFields = {
    title: { value: fields.title.trim(), confidence: null, source: 'user' },
  };
  if (fields.issuer?.trim()) {
    extracted_fields.issuer = {
      value: fields.issuer.trim(),
      confidence: null,
      source: 'user',
    };
  }
  if (fields.expiry_date) {
    extracted_fields.expiry_date = {
      value: fields.expiry_date,
      confidence: null,
      source: 'user',
    };
  }

  const { error } = await supabase
    .from('documents')
    .update({
      title: fields.title.trim(),
      issuer: fields.issuer?.trim() || null,
      expiry_date: fields.expiry_date || null,
      extracted_fields,
      confirmation_status: 'user_confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function softDeleteDocument(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function getAttentionDocuments(
  docs: DocumentRow[],
  days = 30
): DocumentRow[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);

  return docs
    .filter((d) => d.expiry_date)
    .filter((d) => {
      const exp = new Date(d.expiry_date + 'T00:00:00');
      return exp <= limit;
    })
    .sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1));
}

export function formatExpiryLabel(expiryDate: string | null): string {
  if (!expiryDate) return '';
  const exp = new Date(expiryDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return `Expired ${Math.abs(diffDays)} day(s) ago`;
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  return `Expires in ${diffDays} days`;
}

async function uploadUriToStorage(params: {
  userId: string;
  documentId: string;
  uri: string;
  mime: string;
  fileName: string;
}): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const ext = params.fileName.split('.').pop() || 'bin';
  const path = `${params.userId}/${params.documentId}/${Date.now()}.${ext}`;

  const response = await fetch(params.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from('documents').upload(path, blob, {
    contentType: params.mime,
    upsert: false,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, path };
}

export type AttachSource = 'image' | 'camera' | 'file';

export async function attachFileToDocument(
  documentId: string,
  source: AttachSource
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: 'Not signed in' };
  }

  let uri = '';
  let mime = 'application/octet-stream';
  let fileName = 'file.bin';

  if (source === 'image') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, message: 'Photo permission is required' };
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      return { ok: false, message: 'Cancelled' };
    }
    uri = picked.assets[0].uri;
    mime = picked.assets[0].mimeType || 'image/jpeg';
    fileName = picked.assets[0].fileName || 'photo.jpg';
  } else if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, message: 'Camera permission is required' };
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (picked.canceled || !picked.assets?.[0]) {
      return { ok: false, message: 'Cancelled' };
    }
    uri = picked.assets[0].uri;
    mime = picked.assets[0].mimeType || 'image/jpeg';
    fileName = picked.assets[0].fileName || 'camera.jpg';
  } else {
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      return { ok: false, message: 'Cancelled' };
    }
    uri = picked.assets[0].uri;
    mime = picked.assets[0].mimeType || 'application/octet-stream';
    fileName = picked.assets[0].name || 'document.bin';
  }

  const uploaded = await uploadUriToStorage({
    userId: userData.user.id,
    documentId,
    uri,
    mime,
    fileName,
  });

  if (!uploaded.ok) return uploaded;

  const { error } = await supabase
    .from('documents')
    .update({
      file_path: uploaded.path,
      file_mime: mime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getDocumentSignedUrl(
  filePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 60 * 5);

  if (error) {
    console.log('signed url error', error.message);
    return null;
  }
  return data.signedUrl;
}