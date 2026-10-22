import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../theme';

/** Alert.prompt solo existe en iOS: este modal sirve en las dos plataformas. */
export function RenameModal({ visible, initial, onCancel, onSave }: { visible: boolean; initial: string; onCancel: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);
  const valid = value.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Renombrar documento</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={() => valid && onSave(value)}
            style={s.input}
            accessibilityLabel="Nombre del documento"
          />
          <View style={s.row}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={s.button}>
              <Text style={s.cancel}>Cancelar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!valid} onPress={() => onSave(value)} style={s.button}>
              <Text style={[s.save, !valid && { opacity: 0.4 }]}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, gap: 14 },
  title: { fontFamily: fonts.condSemibold, fontSize: 24, color: colors.head },
  input: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 14, paddingVertical: 10 },
  cancel: { fontFamily: fonts.medium, fontSize: 17, color: colors.muted },
  save: { fontFamily: fonts.semibold, fontSize: 17, color: colors.primary },
});
