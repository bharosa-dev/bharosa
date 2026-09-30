import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Colors } from './constants/theme';
import HomeScreen from './screens/HomeScreen';
import VaultScreen from './screens/VaultScreen';
import DocumentDetailScreen from './screens/DocumentDetailScreen';
import FamilyScreen from './screens/FamilyScreen';
import ProfileScreen from './screens/ProfileScreen';
import RemindersScreen from './screens/RemindersScreen';
import SupportScreen from './screens/SupportScreen';
import DataRightsScreen from './screens/DataRightsScreen';
import SharingScreen from './screens/SharingScreen';
import MedicinesScreen from './screens/MedicinesScreen';
import TabBar, { Tab } from './components/TabBar';
import AddActionSheet, { AddAction } from './components/AddActionSheet';

class ScreenBoundary extends Component<
  { children: ReactNode; name: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.log('Screen crash', this.props.name, error?.message);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.boot}>
          <Text style={styles.bootTitle}>{this.props.name} error</Text>
          <Text style={styles.bootText}>{String(this.state.error.message)}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => this.setState({ error: null })}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function AppMain({ session }: { session: any }) {
  const [tab, setTab] = useState<Tab>('home');
  const [ready, setReady] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailPreload, setDetailPreload] = useState<any>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showDataRights, setShowDataRights] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [showMeds, setShowMeds] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [openVehicleAdd, setOpenVehicleAdd] = useState(false);
  const [openVaccines, setOpenVaccines] = useState(false);

  useEffect(() => {
    // No second privacy gate — LoginScreen already requires consent checkbox.
    // Deferred side effects only; never block first paint.
    const t = setTimeout(() => setReady(true), 50);
    const t2 = setTimeout(() => {
      try {
        const { enableScreenshotGuard } = require('./lib/screenshotGuard');
        enableScreenshotGuard(true)?.catch?.(() => {});
      } catch {}
      try {
        const { registerForPushNotifications } = require('./lib/notifications');
        registerForPushNotifications()?.catch?.(() => {});
      } catch {}
    }, 2000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [session?.user?.id]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.bootText}>Opening Bharosa…</Text>
      </View>
    );
  }

  const openDocument = (id: string, preload?: any) => {
    setDetailId(id);
    setDetailPreload(preload || null);
  };

  const closeOverlays = () => {
    setDetailId(null);
    setDetailPreload(null);
    setShowFamily(false);
    setShowSupport(false);
    setShowDataRights(false);
    setShowSharing(false);
    setShowMeds(false);
  };

  const handleAddAction = (action: AddAction) => {
    setShowAddSheet(false);
    if (action === 'document') {
      closeOverlays();
      setTab('vault');
      setTimeout(() => setOpenAdd(true), 100);
    } else if (action === 'family') {
      setShowFamily(true);
    } else if (action === 'vaccines') {
      closeOverlays();
      setTab('vault');
      setOpenVaccines(true);
    } else if (action === 'medicine') {
      setShowMeds(true);
    } else {
      closeOverlays();
      setTab('vault');
      setOpenVehicleAdd(true);
    }
  };

  let body: React.ReactNode = (
    <ScreenBoundary name="Home">
      <HomeScreen
        onOpenVault={() => setTab('vault')}
        onOpenDocument={(id) => openDocument(id)}
        onOpenReminders={() => {
          closeOverlays();
          setTab('reminders');
        }}
        onOpenProfile={() => {
          closeOverlays();
          setTab('profile');
        }}
        onOpenFamily={() => setShowFamily(true)}
        onOpenSharing={() => setShowSharing(true)}
        onOpenScoreVault={() => setTab('vault')}
        onOpenAdd={() => setShowAddSheet(true)}
        onOpenMedicines={() => setShowMeds(true)}
      />
    </ScreenBoundary>
  );

  try {
    if (detailId) {
      body = (
        <ScreenBoundary name="Document">
          <DocumentDetailScreen
            documentId={detailId}
            preload={detailPreload}
            onBack={() => {
              setDetailId(null);
              setDetailPreload(null);
            }}
          />
        </ScreenBoundary>
      );
    } else if (showFamily) {
      body = (
        <ScreenBoundary name="Family">
          <FamilyScreen onBack={() => setShowFamily(false)} />
        </ScreenBoundary>
      );
    } else if (showSupport) {
      body = (
        <ScreenBoundary name="Support">
          <SupportScreen onBack={() => setShowSupport(false)} />
        </ScreenBoundary>
      );
    } else if (showDataRights) {
      body = (
        <ScreenBoundary name="Data rights">
          <DataRightsScreen onBack={() => setShowDataRights(false)} />
        </ScreenBoundary>
      );
    } else if (showSharing) {
      body = (
        <ScreenBoundary name="Sharing">
          <SharingScreen
            onBack={() => setShowSharing(false)}
            onOpenDocument={(id) => {
              setShowSharing(false);
              openDocument(id);
            }}
          />
        </ScreenBoundary>
      );
    } else if (showMeds) {
      body = (
        <ScreenBoundary name="Medicines">
          <MedicinesScreen />
        </ScreenBoundary>
      );
    } else if (tab === 'vault') {
      body = (
        <ScreenBoundary name="Vault">
          <VaultScreen
            onOpenDocument={(id, preload) => openDocument(id, preload)}
            openAdd={openAdd}
            onAddConsumed={() => setOpenAdd(false)}
            openAssetAdd={openVehicleAdd}
            onAssetAddConsumed={() => setOpenVehicleAdd(false)}
            openVaccines={openVaccines}
            onVaccinesConsumed={() => setOpenVaccines(false)}
            onOpenMedicines={() => setShowMeds(true)}
          />
        </ScreenBoundary>
      );
    } else if (tab === 'reminders') {
      body = (
        <ScreenBoundary name="Reminders">
          <RemindersScreen onOpenDocument={(id) => openDocument(id)} />
        </ScreenBoundary>
      );
    } else if (tab === 'profile') {
      body = (
        <ScreenBoundary name="Profile">
          <ProfileScreen
            onOpenFamily={() => setShowFamily(true)}
            onOpenSupport={() => setShowSupport(true)}
            onOpenDataRights={() => setShowDataRights(true)}
            onOpenSharing={() => setShowSharing(true)}
            onOpenMedicines={() => setShowMeds(true)}
          />
        </ScreenBoundary>
      );
    }
  } catch (e: any) {
    body = (
      <View style={styles.boot}>
        <Text style={styles.bootTitle}>Screen failed</Text>
        <Text style={styles.bootText}>{e?.message || String(e)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>{body}</View>
      <TabBar
        active={tab}
        onChange={(t) => {
          setTab(t);
          closeOverlays();
        }}
        onAdd={() => setShowAddSheet(true)}
      />
      <AddActionSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelect={handleAddAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  bootTitle: { fontSize: 18, fontWeight: '800', color: Colors.ink, textAlign: 'center' },
  bootText: { marginTop: 10, color: Colors.muted, textAlign: 'center' },
  retry: {
    marginTop: 16,
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '800' },
});
