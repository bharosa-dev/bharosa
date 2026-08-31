import { supabase } from './supabase';

export type DocumentRow = {
  id: string;
  owner_user_id: string;
  title: string;
  doc_type: string;
  issuer: string | null;
  expiry_date: string | null; // YYYY-MM-DD
  notes: string | null;
  confirmation_status: 'not_confirmed' | 'user_confirmed';
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  created_at: string;
};

export async function listMyDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, owner_user_id, title, doc_type, issuer, expiry_date, notes, confirmation_status, sensitivity, created_at'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('listMyDocuments', error.message);
    return [];
  }
  return data ?? [];
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

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_user_id: userData.user.id,
      title: input.title.trim(),
      doc_type: input.doc_type?.trim() || 'other',
      issuer: input.issuer?.trim() || null,
      expiry_date: input.expiry_date || null,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, id: data.id };
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

/** Docs expiring within the next `days` (including already expired). */
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