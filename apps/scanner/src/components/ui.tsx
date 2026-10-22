import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme';

type Action = { label: string; onPress: () => void; disabled?: boolean };

export function TopBar({ left, title, right, dark }: { left?: Action; title?: string; right?: Action; dark?: boolean }) {
  const linkColor = dark ? colors.white : colors.primary;
  return (
    <View style={s.topBar}>
      <View style={s.topSide}>
        {left && (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={left.onPress}>
            <Text style={[s.topLink, { color: linkColor }]}>‹ {left.label}</Text>
          </Pressable>
        )}
      </View>
      {title ? (
        <Text numberOfLines={1} style={[s.topTitle, dark && { color: colors.white }]}>
          {title}
        </Text>
      ) : null}
      <View style={[s.topSide, { alignItems: 'flex-end' }]}>
        {right && (
          <Pressable accessibilityRole="button" hitSlop={12} disabled={right.disabled} onPress={right.onPress}>
            <Text style={[s.topLink, { color: linkColor, fontFamily: fonts.semibold, opacity: right.disabled ? 0.4 : 1 }]}>{right.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, style }: Action & { busy?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [s.primary, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 }, style]}
    >
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, dark, style }: Action & { dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.secondary, dark && s.secondaryDark, pressed && { opacity: 0.8 }, disabled && { opacity: 0.45 }, style]}
    >
      <Text style={[s.secondaryText, dark && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress, danger, dark }: Action & { danger?: boolean; dark?: boolean }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
      <Text style={[s.link, danger && { color: colors.danger }, dark && { color: colors.scanLine }]}>{label}</Text>
    </Pressable>
  );
}

export type StatusProps = {
  dark?: boolean;
  icon: string;
  tone?: 'info' | 'ok' | 'danger';
  title: string;
  body?: string;
  progress?: number;
  primary?: Action;
  secondary?: Action;
  onClose?: () => void;
};

/** Pantallas de estado 2b–2h del diseño. */
export function StatusScreen({ dark, icon, tone = 'info', title, body, progress, primary, secondary, onClose }: StatusProps) {
  const iconBg = dark ? '#ffffff1a' : tone === 'ok' ? colors.okTint : tone === 'danger' ? colors.dangerTint : colors.primaryTint;
  const iconColor = dark ? colors.white : tone === 'ok' ? colors.ok : tone === 'danger' ? colors.danger : colors.primary;
  const fg = dark ? colors.white : colors.ink;
  return (
    <SafeAreaView style={[s.status, { backgroundColor: dark ? colors.dark : colors.bg }]}>
      {onClose && (
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={[s.close, dark && { backgroundColor: '#ffffff22' }]}>
          <Text style={{ fontSize: 22, color: fg }}>✕</Text>
        </Pressable>
      )}
      <View style={s.statusBody}>
        <View style={[s.statusIcon, { backgroundColor: iconBg }]}>
          <Text style={{ fontSize: 42, color: iconColor }}>{icon}</Text>
        </View>
        <Text style={[s.statusTitle, { color: fg }]}>{title}</Text>
        {body ? <Text style={[s.statusText, { color: fg }]}>{body}</Text> : null}
        {primary && <PrimaryButton {...primary} style={{ marginTop: 12, paddingHorizontal: 30, alignSelf: 'center' }} />}
        {secondary && <TextLink {...secondary} dark={dark} />}
      </View>
      {progress !== undefined && (
        <View style={s.track}>
          <View style={[s.track, { backgroundColor: dark ? '#ffffff33' : colors.line }]}>
            <View style={[s.fill, { width: `${Math.round(Math.min(1, Math.max(0.04, progress)) * 100)}%` }]} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export type ProgressState = { title: string; body?: string; progress: number; dark?: boolean; icon?: string };

export function ProgressModal({ state }: { state: ProgressState | null }) {
  return (
    <Modal visible={!!state} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {state && <StatusScreen dark={state.dark} icon={state.icon ?? '◌'} title={state.title} body={state.body} progress={state.progress} />}
    </Modal>
  );
}

export function ScreenMessage({ children }: { children: ReactNode }) {
  return <Text style={s.message}>{children}</Text>;
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  topSide: { flex: 1 },
  topLink: { fontFamily: fonts.medium, fontSize: 17 },
  topTitle: { flex: 2, textAlign: 'center', fontFamily: fonts.condSemibold, fontSize: 22, color: colors.ink },
  primary: { height: 64, borderRadius: radius.cta, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryText: { color: colors.white, fontFamily: fonts.condSemibold, fontSize: 24, letterSpacing: 1 },
  secondary: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryDark: { backgroundColor: 'transparent', borderColor: '#ffffff66', height: 60, borderRadius: 30 },
  secondaryText: { fontFamily: fonts.medium, fontSize: 17, color: colors.head },
  link: { fontFamily: fonts.medium, fontSize: 17, color: colors.primary, textAlign: 'center', paddingVertical: 8 },
  status: { flex: 1 },
  close: { position: 'absolute', top: 56, left: 20, zIndex: 2, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statusBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36, gap: 14 },
  statusIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: fonts.condBold, fontSize: 36, lineHeight: 38, textAlign: 'center' },
  statusText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, textAlign: 'center', opacity: 0.75 },
  track: { height: 6, borderRadius: 3, marginHorizontal: 60, marginBottom: 90 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.scanLine },
  message: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.muted, textAlign: 'center' },
});
