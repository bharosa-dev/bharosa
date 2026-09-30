# Bharosa — post-login crash fix + DB security

## App crash after sign-in
- Removed React.lazy (unstable in some Expo Go builds)
- AppMain loaded via dynamic import with error UI
- Screen-level ErrorBoundaries
- Consent / push / screenshot deferred; timeouts so boot never hangs
- Logo require guarded

## DB security (already in SQL packs — re-run if unsure)
1. BHAROSA_DPDP_COMPLIANCE.sql (fixed actor_user_id version)
2. BHAROSA_PRODUCT_FEATURES.sql
3. Confirm RLS enabled on: documents, document_shares, profiles, family_people, medications, vaccine_completions

### Manual RLS test (two accounts)
- User A creates a document → User B must NOT see it in list or by id
- A shares to B email with role viewer → B can read, not update
- A revokes → B loses access
- Soft-deleted account cannot use app (deleted_at on profiles)

### Storage
- Private buckets: avatars, documents
- Path prefix should be auth.uid()
- No public policies on document files

### Client
- Only anon key in app (EXPO_PUBLIC_*)
- Never put service_role in the mobile app
