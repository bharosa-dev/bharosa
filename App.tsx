import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import { ensureMyProfile, Profile } from './lib/profile';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadSessionAndProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const hasSession = !!data.session;
    setSession(hasSession);

    if (hasSession) {
      const p = await ensureMyProfile();
      setProfile(p);
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessionAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        const hasSession = !!s;
        setSession(hasSession);
        if (hasSession) {
          const p = await ensureMyProfile();
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    setSession(false);
    setProfile(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#AD8438" />
        <Text style={styles.hint}>Bharosa</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLoggedIn={() => loadSessionAndProfile()} />
      </>
    );
  }

  const displayName = profile?.full_name || 'there';

  return (
    <View style={styles.home}>
      <StatusBar style="dark" />

      <Text style={styles.brand}>Bharosa</Text>
      <Text style={styles.hello}>Welcome back, {displayName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Needs your attention</Text>
        <Text style={styles.cardBody}>
          No items yet. Documents and reminders will show here.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recently added</Text>
        <Text style={styles.cardBody}>
          Your vault is empty. Next we add documents.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your profile</Text>
        <Text style={styles.cardBody}>
          Timezone: {profile?.user_timezone || 'Asia/Kolkata'}
        </Text>
      </View>

      <Pressable style={styles.secondaryBtn} onPress={signOut}>
        <Text style={styles.secondaryBtnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 12,
    fontSize: 18,
    color: '#152447',
    fontWeight: '700',
  },
  home: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#152447',
  },
  hello: {
    fontSize: 16,
    color: '#5C5C5C',
    marginBottom: 24,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#152447',
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 14,
    color: '#5C5C5C',
    lineHeight: 20,
  },
  secondaryBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#AD8438',
  },
  secondaryBtnText: {
    color: '#AD8438',
    fontSize: 16,
    fontWeight: '600',
  },
});