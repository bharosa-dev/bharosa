import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureMyProfile, getAvatarUrl } from '../lib/profile';
import { computeLifeScore } from '../lib/score';
import { listDocuments } from '../lib/documents';
import { Colors } from '../constants/theme';
import { formatDateIN } from '../lib/expiryStyle';
import { iconForCategory } from '../constants/categoryVisuals';
import ScoreRing from '../components/ScoreRing';
import { listMedications } from '../lib/medications';

function urgency(iso?: string | null): 'red' | 'amber' | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0 || days <= 7) return 'red';
  if (days <= 30) return 'amber';
  return null;
}

const URGENCY = {
  red: { bg: '#fde8e8', text: '#C0392B', label: 'Urgent' },
  amber: { bg: '#fff4d6', text: '#b78100', label: 'Due soon' },
};

export default function HomeScreen({
  onOpenVault, onOpenDocument, onOpenFamily, onOpenSharing, onOpenScoreVault, onOpenAdd,
  onOpenMedicines, onOpenReminders, onOpenProfile,
}: {
  onOpenVault?: () => void;
  onOpenDocument?: (id: string) => void;
  onOpenFamily?: () => void;
  onOpenSharing?: () => void;
  onOpenScoreVault?: () => void;
  onOpenReminders?: () => void;
  onOpenProfile?: () => void;
  onOpenAdd?: () => void;
  onOpenMedicines?: () => void;}) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [score, setScore] = useState<any>(null);
  const [attention, setAttention] = useState<any[]>([])
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medSummary, setMedSummary] = useState<{ active: number; tracking: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, docs] = await Promise.all([
        ensureMyProfile(),
        computeLifeScore(),
        listDocuments('all'),
      ]);
      setProfile(p);
      setScore(s);
      const urgent = (docs || [])
        .map((d: any) => ({ d, u: urgency(d.expiry_date || d.secondary_date) }))
        .filter((x: any) => x.u)
        .sort((a: any, b: any) => {
          const da = new Date(a.d.expiry_date || a.d.secondary_date).getTime();
          const db = new Date(b.d.expiry_date || b.d.secondary_date).getTime();
          return da - db;
        })
        .slice(0, 6)
        .map((x: any) => ({ ...x.d, _u: x.u }));
      setAttention(urgent);
      setDocCount((docs || []).length);
      if (p?.avatar_path) setAvatarUrl(await getAvatarUrl(p.avatar_path));
      else setAvatarUrl(null);
      try {
        const meds = await listMedications();
        const tracking = (meds || []).filter((m: any) => m.tracking_enabled).length;
        if (tracking > 0) setMedSummary({ active: meds.length, tracking });
        else setMedSummary(null);
      } catch { setMedSummary(null); }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.ink} /></View>;
  }

  const exp = score?.expired || 0;
  const soon = score?.dueSoon || 0;
  const ok = score?.ok || 0;
  // If everything OK, ring is full green only
  let okF = 1, soonF = 0, expF = 0;
  if (exp + soon + ok > 0) {
    const t = exp + soon + ok;
    okF = ok / t;
    soonF = soon / t;
    expF = exp / t;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110, paddingTop: 0 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
    >
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => { try { onOpenReminders && onOpenReminders(); } catch (e) { console.log('reminders', e); } }}
            style={{ marginRight: 10, padding: 6 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { try { onOpenProfile && onOpenProfile(); } catch (e) { console.log('profile', e); } }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.heroAvatar} onError={() => setAvatarUrl(null)} />
            ) : (
              <View style={[styles.heroAvatar, styles.avatarPh]}>
                <Ionicons name="person" size={18} color={Colors.gold} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Logo centered above score */}
        <View style={styles.logoBlock}>
          {(() => {
            try {
              const src = require('../assets/logo.png');
              return <Image source={src} style={{ width: 160, height: 64 }} resizeMode="contain" />;
            } catch {
              return <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>Bharosa</Text>;
            }
          })()}
          
          <Text style={styles.hello}>{greeting(profile?.full_name)}</Text>
        </View>

        <TouchableOpacity style={styles.scoreCard} onPress={onOpenScoreVault || onOpenVault} activeOpacity={0.9}>
          <ScoreRing score={score?.total ?? 100} size={118} ok={okF} soon={soonF} expired={expF} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.scoreLabel}>Your Bharosa score</Text>
            <Text style={styles.grade}>{score?.grade || '—'} · next 30 days</Text>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: '#1e8e3e' }]} />
              <Text style={styles.legend}>OK</Text>
              <View style={[styles.dot, { backgroundColor: '#e6a700' }]} />
              <Text style={styles.legend}>≤30d</Text>
              <View style={[styles.dot, { backgroundColor: '#C0392B' }]} />
              <Text style={styles.legend}>Expired</Text>
            </View>
            {(score?.tips || []).slice(0, 1).map((t: string, i: number) => (
              <Text key={i} style={styles.tip}>• {t}</Text>
            ))}
          </View>
        </TouchableOpacity>

        {medSummary ? (
          <TouchableOpacity style={styles.medCard} onPress={onOpenMedicines} activeOpacity={0.9}>
            <Text style={styles.medTitle}>Medicine tracker on</Text>
            <Text style={styles.medSub}>{medSummary.tracking} active · tap for schedule</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoRow}>
        <TouchableOpacity style={[styles.promo, { backgroundColor: '#1A2744' }]} onPress={() => onOpenAdd?.()}>
          <Ionicons name="add-circle" size={22} color={Colors.gold} />
          <Text style={styles.promoTitleLight}>Add anything</Text>
          <Text style={styles.promoSubLight}>Doc · family · vehicle · pet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.promo, { backgroundColor: '#e8f5e9' }]} onPress={() => onOpenFamily?.()}>
          <Ionicons name="people" size={22} color="#2d6a4f" />
          <Text style={styles.promoTitleDark}>My family</Text>
          <Text style={styles.promoSubDark}>People & vaccines</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.promo, { backgroundColor: '#fff4d6' }]} onPress={onOpenVault}>
          <Ionicons name="shield-checkmark" size={22} color="#b78100" />
          <Text style={styles.promoTitleDark}>Vault</Text>
          <Text style={styles.promoSubDark}>IDs & insurance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.promo, { backgroundColor: '#ede7f6' }]} onPress={onOpenSharing}>
          <Ionicons name="share-social" size={22} color="#6a4c93" />
          <Text style={styles.promoTitleDark}>Sharing</Text>
          <Text style={styles.promoSubDark}>With you / by me</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.section}>Needs attention</Text>
      {attention.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={28} color="#1e8e3e" />
          <Text style={styles.emptyText}>All clear for the next 30 days</Text>
        </View>
      ) : (
        attention.map((item) => {
          const u = (item._u || 'amber') as 'red' | 'amber';
          const c = URGENCY[u];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.attRow, { borderLeftColor: c.text }]}
              onPress={() => onOpenDocument?.(item.id)}
            >
              <View style={[styles.attIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={iconForCategory(item.category)} size={18} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attTitle}>{item.title}</Text>
                <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>
                  {formatDateIN(item.expiry_date || item.secondary_date)} · {c.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingTop: 8,
    backgroundColor: '#1A2744',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  docBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  docBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  logoBlock: { alignItems: 'center', marginBottom: 8 },
  logoMark: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  logoB: { color: '#1A2744', fontWeight: '900', fontSize: 36 },
  brand: { color: Colors.gold, fontWeight: '800', fontSize: 12, letterSpacing: 3, marginTop: 8 },
  hello: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  heroAvatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPh: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 12,
  },
  scoreLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  grade: { color: '#c9b896', fontSize: 12, marginTop: 4, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legend: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginRight: 8 },
  tip: { color: '#e8dcc0', fontSize: 11, marginTop: 6 },
  promoRow: { paddingHorizontal: 12, paddingTop: 14, gap: 10 },
  promo: { width: 148, borderRadius: 16, padding: 14, marginRight: 4 },
  promoTitleLight: { color: '#fff', fontWeight: '800', marginTop: 8 },
  promoSubLight: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  promoTitleDark: { color: Colors.ink, fontWeight: '800', marginTop: 8 },
  promoSubDark: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: Colors.ink, marginTop: 18, marginBottom: 8, paddingHorizontal: 16 },
  emptyCard: {
    marginHorizontal: 16, padding: 18, borderRadius: 14, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  emptyText: { color: Colors.muted, marginTop: 6 },
  attRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
  },
  attIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  attTitle: { fontWeight: '700', color: Colors.ink, fontSize: 14 },
  medCard: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12,
  },
  medTitle: { color: '#fff', fontWeight: '800' },
  medSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
});

function greeting(fullName?: string | null) {
  const h = new Date().getHours();
  let g = 'Hello';
  if (h < 12) g = 'Good morning';
  else if (h < 17) g = 'Good afternoon';
  else g = 'Good evening';
  const first = (fullName || '').trim().split(' ')[0];
  return first ? `${g}, ${first}` : g;
}

