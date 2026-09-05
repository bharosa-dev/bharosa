import { supabase } from './supabase';

export type Family = {
  id: string;
  name: string;
  created_by: string;
};

export type FamilyMember = {
    id: string;
    family_id: string;
    user_id: string;
    role: string;
    email?: string | null;
  };

export async function getMyFamily(): Promise<Family | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userData.user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.family_id) {
    const { data } = await supabase
      .from('families')
      .select('id, name, created_by')
      .eq('id', membership.family_id)
      .maybeSingle();
    return data;
  }

  const { data: owned } = await supabase
    .from('families')
    .select('id, name, created_by')
    .eq('created_by', userData.user.id)
    .limit(1)
    .maybeSingle();

  return owned;
}

export async function createFamily(
  name: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: 'Not signed in' };

  const { data, error } = await supabase
    .from('families')
    .insert({ name: name.trim(), created_by: userData.user.id })
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };

  const { error: memErr } = await supabase.from('family_members').insert({
    family_id: data.id,
    user_id: userData.user.id,
    role: 'owner',
  });

  if (memErr) return { ok: false, message: memErr.message };
  return { ok: true, id: data.id };
}

/** Add member by their auth user id (they must already have a Bharosa account). */
export async function addFamilyMemberByEmail(
  familyId: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@')) {
    return { ok: false, message: 'Enter a valid email' };
  }

  // Look up profile via a simple RPC-free approach:
  // We store email only on auth.users (not readable from client).
  // Practical MVP: member must sign up first; owner pastes their user UUID from support,
  // OR we use a profiles.email column. Add email on profiles for invites.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', clean)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!profile) {
    return {
      ok: false,
      message:
        'No Bharosa user with that email. They must sign up first, then you can add them.',
    };
  }

  const { error: insErr } = await supabase.from('family_members').insert({
    family_id: familyId,
    user_id: profile.id,
    role: 'member',
  });

  if (insErr) {
    if (insErr.message.includes('duplicate')) {
      return { ok: false, message: 'Already a family member' };
    }
    return { ok: false, message: insErr.message };
  }
  return { ok: true };
}

export async function listFamilyMembers(
  familyId: string
): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role')
    .eq('family_id', familyId);

  if (error) {
    console.log('listFamilyMembers', error.message);
    return [];
  }
  return data ?? [];
}

export async function shareDocumentWithUser(
    documentId: string,
    targetUserId: string,
    access: {
      can_view?: boolean;
      can_edit?: boolean;
      can_download?: boolean;
    } = {}
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, message: 'Not signed in' };
  
    const can_view = access.can_view !== false;
    const can_edit = !!access.can_edit;
    const can_download = access.can_download !== false || can_edit;
  
    const { error } = await supabase.from('document_permissions').upsert(
      {
        document_id: documentId,
        user_id: targetUserId,
        can_view,
        can_edit,
        can_download,
        can_share: false,
        granted_by: userData.user.id,
        revoked_at: null,
      },
      { onConflict: 'document_id,user_id' }
    );
  
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }
