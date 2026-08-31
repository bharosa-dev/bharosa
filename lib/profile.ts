import { supabase } from './supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  user_timezone: string;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, user_timezone')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) {
    console.log('getMyProfile error', error.message);
    return null;
  }
  return data;
}

export async function ensureMyProfile(): Promise<Profile | null> {
  const existing = await getMyProfile();
  if (existing) return existing;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const fullName =
    userData.user.user_metadata?.full_name ||
    userData.user.email?.split('@')[0] ||
    'User';

  const { error } = await supabase.from('profiles').insert({
    id: userData.user.id,
    full_name: fullName,
  });

  if (error) {
    console.log('ensureMyProfile insert error', error.message);
  }

  return getMyProfile();
}