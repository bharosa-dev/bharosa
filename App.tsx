import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import VaultScreen from './screens/VaultScreen';
import DocumentDetailScreen from './screens/DocumentDetailScreen';
import FamilyScreen from './screens/FamilyScreen';
import TabBar from './components/TabBar';
import { ensureMyProfile, Profile } from './lib/profile';
import { DocumentRow } from './lib/documents';

type Screen = 'home' | 'vault' | 'family' | 'detail';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [preloadedDoc, setPreloadedDoc] = useState<DocumentRow | null>(null);

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
      setPreloadedDoc(null);
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
          setPreloadedDoc(null);
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
    setPreloadedDoc(null);
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

  const showTabs =
    screen === 'home' || screen === 'vault' || screen === 'family';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.body}>
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
            onOpenDocument={(id, doc) => {
              setSelectedDocId(id);
              setPreloadedDoc(doc);
              setScreen('detail');
            }}
          />
        )}
        {screen === 'family' && (
          <FamilyScreen onBack={() => setScreen('home')} />
        )}
        {screen === 'detail' && selectedDocId && (
          <DocumentDetailScreen
            documentId={selectedDocId}
            initialDoc={preloadedDoc}
            onBack={() => {
              setSelectedDocId(null);
              setPreloadedDoc(null);
              setScreen('vault');
            }}
            onDeleted={() => {
              setSelectedDocId(null);
              setPreloadedDoc(null);
              setScreen('vault');
            }}
          />
        )}
      </View>
      {showTabs && (
        <TabBar
          active={
            screen === 'vault'
              ? 'vault'
              : screen === 'family'
              ? 'family'
              : 'home'
          }
          onChange={(tab) => {
            setSelectedDocId(null);
            setPreloadedDoc(null);
            setScreen(tab);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F5' },
  body: { flex: 1 },
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