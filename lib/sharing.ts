import { supabase } from './supabase';

export type ShareRow = {
  id: string;
  document_id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_share: boolean;
  can_download: boolean;
  granted_by: string | null;
  revoked_at: string | null;
  full_name?: string | null;
  email?: string | null;
};

export async function listSharesForDocument(
  documentId: string
): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from('document_permissions')
    .select(
      'id, document_id, user_id, can_view, can_edit, can_share, can_download, granted_by, revoked_at'
    )
    .eq('document_id', documentId)
    .is('revoked_at', null);

  if (error) {
    console.log('listSharesForDocument', error.message);
    return [];
  }

  const rows = data ?? [];
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.user_id, r.granted_by].filter(Boolean) as string[]))
  );

  let profiles: { id: string; full_name: string | null; email: string | null }[] =
    [];
  if (ids.length) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    profiles = p ?? [];
  }

  return rows.map((r) => {
    const u = profiles.find((x) => x.id === r.user_id);
    return {
      ...r,
      full_name: u?.full_name ?? null,
      email: u?.email ?? null,
    };
  });
}

export async function getMyPermissionForDocument(
  documentId: string
): Promise<ShareRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('document_permissions')
    .select(
      'id, document_id, user_id, can_view, can_edit, can_share, can_download, granted_by, revoked_at'
    )
    .eq('document_id', documentId)
    .eq('user_id', userData.user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !data) return null;

  let grantorName: string | null = null;
  let grantorEmail: string | null = null;
  if (data.granted_by) {
    const { data: p } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', data.granted_by)
      .maybeSingle();
    grantorName = p?.full_name ?? null;
    grantorEmail = p?.email ?? null;
  }

  return {
    ...data,
    full_name: grantorName,
    email: grantorEmail,
  };
}

export async function revokeShare(
  permissionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('document_permissions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', permissionId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removeSharedDocFromMyVault(
  documentId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: 'Not signed in' };

  const { error } = await supabase
    .from('document_permissions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('document_id', documentId)
    .eq('user_id', userData.user.id)
    .is('revoked_at', null);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function permissionLabel(p: {
  can_view: boolean;
  can_edit: boolean;
  can_download: boolean;
}): string {
  const parts: string[] = [];
  if (p.can_view) parts.push('View');
  if (p.can_edit) parts.push('Edit');
  if (p.can_download) parts.push('Download');
  return parts.length ? parts.join(' · ') : 'No access';
}
/** Document ids owned by me that have at least one active share */
export async function listMySharedOutDocumentIds(
    myUserId: string,
    documentIds: string[]
  ): Promise<Set<string>> {
    const result = new Set<string>();
    if (!documentIds.length) return result;
  
    const { data, error } = await supabase
      .from('document_permissions')
      .select('document_id')
      .in('document_id', documentIds)
      .is('revoked_at', null);
  
    if (error) {
      console.log('listMySharedOutDocumentIds', error.message);
      return result;
    }
  
    for (const row of data ?? []) {
      result.add(row.document_id);
    }
    return result;
  }