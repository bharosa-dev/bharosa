import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const TYPES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'id', label: 'ID / KYC' },
  { value: 'bill', label: 'Bill / Invoice' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function DocTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Document type</Text>
      <View style={styles.box}>
        <Picker selectedValue={value} onValueChange={onChange}>
          {TYPES.map((t) => (
            <Picker.Item key={t.value} label={t.label} value={t.value} />
          ))}
        </Picker>
      </View>
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
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
});