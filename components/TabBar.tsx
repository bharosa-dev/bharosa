import { View, Text, Pressable, StyleSheet } from 'react-native';

type Tab = 'home' | 'vault';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export default function TabBar({ active, onChange }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.item} onPress={() => onChange('home')}>
        <Text style={[styles.label, active === 'home' && styles.active]}>
          Home
        </Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => onChange('vault')}>
        <Text style={[styles.label, active === 'vault' && styles.active]}>
          Vault
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center' },
  label: { fontSize: 14, color: '#5C5C5C', fontWeight: '600' },
  active: { color: '#AD8438' },
});