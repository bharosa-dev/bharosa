import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  value: string; // YYYY-MM-DD or ''
  onChange: (yyyyMmDd: string) => void;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ExpiryDateField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + 'T12:00:00') : new Date();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Expiry date</Text>
      <Pressable style={styles.box} onPress={() => setOpen(true)}>
        <Text style={styles.text}>{value || 'Tap to choose date'}</Text>
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange('')}>
          <Text style={styles.clear}>Clear date</Text>
        </Pressable>
      ) : null}
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, selected) => {
            setOpen(Platform.OS === 'ios');
            if (selected) onChange(toYmd(selected));
            if (Platform.OS === 'android') setOpen(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5C5C',
    marginBottom: 4,
  },
  box: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  text: { fontSize: 16, color: '#152447' },
  clear: { marginTop: 6, color: '#1A5F9E', fontSize: 13 },
});