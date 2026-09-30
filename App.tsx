import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ActivityIndicator, StatusBar, LogBox, TouchableOpacity,
} from 'react-native';
import { hasSupabaseConfig, getConfigError, supabase } from './lib/supabase';
import { Colors } from './constants/theme';
import LoginScreen from './screens/LoginScreen';

try {
  LogBox.ignoreLogs([
    'expo-notifications',
    'Push notifications',
    'Constants.installationId',
    'newArchEnabled',
  ]);
} catch {}

type EBProps = { children: ReactNode };
type EBState = { error: Error | null; key: number };

class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { error: null, key: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log('App crash', error?.message, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Bharosa hit an error</Text>
          <Text style={styles.msg}>{String(this.state.error.message || this.state.error)}</Text>
          <Text style={styles.hint}>This screen means a JS crash was caught (app should not close).</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ error: null, key: this.state.key + 1 })}
          >
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: Colors.ink, marginTop: 10 }]}
            onPress={async () => {
              try { await supabase.auth.signOut(); } catch {}
              this.setState({ error: null, key: this.state.key + 1 });
            }}
          >
            <Text style={styles.btnText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

function BootShell() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [cfgErr] = useState<string | null>(getConfigError());
  const [Main, setMain] = useState<React.ComponentType<{ session: any }> | null>(null);
  const [mainErr, setMainErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!hasSupabaseConfig) {
          setReady(true);
          return;
        }
        // Timeout so boot never hangs
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 3500)
          ),
        ]);
        if (!cancelled) setSession(result?.data?.session ?? null);
      } catch (e) {
        console.log('boot session', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    const hard = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4500);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      clearTimeout(hard);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load AppMain only after we have a session — avoids React.lazy native issues
  useEffect(() => {
    if (!session) {
      setMain(null);
      setMainErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('./AppMain');
        if (!cancelled) setMain(() => mod.default);
      } catch (e: any) {
        console.log('AppMain import failed', e);
        if (!cancelled) setMainErr(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.hint}>Starting Bharosa…</Text>
      </View>
    );
  }

  if (cfgErr && !hasSupabaseConfig) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Configuration needed</Text>
        <Text style={styles.msg}>{cfgErr}</Text>
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (mainErr) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Could not load app</Text>
        <Text style={styles.msg}>{mainErr}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.btnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!Main) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.hint}>Opening your vault…</Text>
      </View>
    );
  }

  return <Main session={session} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
        <BootShell />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1A2744', textAlign: 'center' },
  msg: { marginTop: 10, color: '#C0392B', textAlign: 'center', fontWeight: '600' },
  hint: { marginTop: 12, color: '#666', textAlign: 'center', fontSize: 13, lineHeight: 20 },
  btn: {
    marginTop: 16,
    backgroundColor: Colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '800' },
});
