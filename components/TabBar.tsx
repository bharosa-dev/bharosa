import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

type Tab = 'home' | 'vault' | 'family';

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'vault', label: 'Vault', icon: 'lock-closed-outline', iconActive: 'lock-closed' },
  { key: 'family', label: 'Family', icon: 'people-outline', iconActive: 'people' },
];

export default function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((item) => {
        const isActive = active === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => onChange(item.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? item.iconActive : item.icon}
              size={24}
              color={isActive ? Colors.ink : Colors.muted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 10,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '500',
    marginTop: 3,
  },
  labelActive: {
    color: Colors.ink,
    fontWeight: '700',
  },
});