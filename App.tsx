import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import VaultScreen from './screens/VaultScreen';
import DocumentDetailScreen from './screens/DocumentDetailScreen';
import { ensureMyProfile, Profile } from './lib/profile';

type Screen = 'home' | 'vault' | 'detail';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const loadSessionAndProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const hasSession = !!data.session;
    setSession(hasSession);
    if (hasSession) {
      const p = await ensureMyProfile();
      setProfile(p);
    } else {
      setProfile(null);
      setScreen('home');
      setSelectedDocId(null);
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
          setScreen('home');
          setSelectedDocId(null);
        }
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    setSession(false);
    setProfile(null);
    setScreen('home');
    setSelectedDocId(null);
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

  return (
    <>
      <StatusBar style="dark" />
      {screen === 'home' && (
        <HomeScreen
          profile={profile}
          onSignOut={signOut}
          onOpenVault={() => setScreen('vault')}
        />
      )}
      {screen === 'vault' && (
        <VaultScreen
          onBack={() => setScreen('home')}
          onOpenDocument={(id) => {
            setSelectedDocId(id);
            setScreen('detail');
          }}
        />
      )}
      {screen === 'detail' && selectedDocId && (
        <DocumentDetailScreen
          documentId={selectedDocId}
          onBack={() => {
            setSelectedDocId(null);
            setScreen('vault');
          }}
          onDeleted={() => {
            setSelectedDocId(null);
            setScreen('vault');
          }}
        />
      )}
    </>
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
});