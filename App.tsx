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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
    });

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
        <LoginScreen onLoggedIn={() => setSession(true)} />
      </>
    );
  }

  return (
    <View style={styles.home}>
      <StatusBar style="dark" />

      <Text style={styles.brand}>Bharosa</Text>
      <Text style={styles.hello}>Welcome back</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Needs your attention</Text>
        <Text style={styles.cardBody}>
          No items yet. Documents and reminders will show here.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recently added</Text>
        <Text style={styles.cardBody}>Your vault is empty. Next we add documents.</Text>
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