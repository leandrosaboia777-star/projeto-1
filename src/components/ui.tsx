import React from "react";
import {
  View,
  Image,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { X, ArrowRight, House, Sparkles } from "lucide-react-native";
import { useContent } from "../lib/content";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
export const palettes = {
  light: {
    bg: "#F2F7FC",
    card: "#FFFFFF",
    ink: "#203A55",
    muted: "#60758A",
    line: "#DDE8F2",
    accent: "#28649A",
    soft: "#E3EFFA",
    lime: "#DCEFFC",
    danger: "#AC4848",
  },
  dark: {
    bg: "#101D2B",
    card: "#192D41",
    ink: "#E6F1FB",
    muted: "#A4BACD",
    line: "#304A62",
    accent: "#99CCF2",
    soft: "#253F57",
    lime: "#254D70",
    danger: "#FCADAD",
  },
};
export function useTheme() {
  const { dark } = useApp();
  return palettes[dark ? "dark" : "light"];
}
export function Label({ children, style, ...props }: any) {
  const c = useTheme(),
    content = useContent();
  const display = React.Children.map(children, (child) =>
    typeof child === "string" ? content.text(child) : child,
  );
  return (
    <Text
      {...props}
      style={[
        {
          color: c.ink,
          fontSize: 15,
          lineHeight: 22,
          fontFamily: Platform.OS === "ios" ? "System" : undefined,
        },
        style,
      ]}
    >
      {display}
    </Text>
  );
}
export function Heading({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  const c = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <Label
        style={{
          fontSize: 32,
          fontWeight: "600",
          letterSpacing: -1.2,
          lineHeight: 40,
        }}
      >
        {children}
      </Label>
      {sub && <Label style={{ color: c.muted, marginTop: 6 }}>{sub}</Label>}
    </View>
  );
}
export function Card({ children, style }: any) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 22,
          padding: 22,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon: Icon,
  small = false,
}: any) {
  const c = useTheme(),
    content = useContent();
  const displayTitle = typeof title === "string" ? content.text(title) : title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayTitle}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        backgroundColor: danger ? c.danger : secondary ? c.soft : c.accent,
        paddingHorizontal: small ? 14 : 20,
        paddingVertical: small ? 10 : 15,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 44,
      })}
    >
      {Icon && <Icon size={18} color={secondary ? c.ink : "#fff"} />}
      <Text
        style={{
          fontWeight: "600",
          fontSize: small ? 13 : 15,
          color: secondary ? c.ink : useContrast(c, secondary),
        }}
      >
        {displayTitle}
      </Text>
    </Pressable>
  );
}
function useContrast(c: any, secondary: boolean) {
  return secondary ? c.ink : c === palettes.dark ? "#122C43" : "#fff";
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secureTextEntry = false,
  keyboardType = "default",
  placeholder = "",
  ...rest
}: any) {
  const c = useTheme();
  return (
    <View style={{ gap: 7, marginBottom: 15 }}>
      <Label style={{ fontSize: 12, fontWeight: "600", color: c.muted }}>
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        value={String(value ?? "")}
        onChangeText={onChangeText}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={{
          backgroundColor: c.bg,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          color: c.ink,
          fontSize: 15,
          minHeight: multiline ? 95 : 48,
          textAlignVertical: multiline ? "top" : "center",
        }}
        {...rest}
      />
    </View>
  );
}
export function Chips({ options, value, onChange }: any) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      {options.map((o: any) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          style={{
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 15,
            backgroundColor: value === o.value ? c.accent : c.soft,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color:
                value === o.value
                  ? c === palettes.dark
                    ? "#122C43"
                    : "#fff"
                  : c.ink,
            }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Sheet({ visible, title, onClose, children }: any) {
  const c = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0006",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 26,
            width: "100%",
            maxWidth: 680,
            maxHeight: "94%",
            padding: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <Label style={{ fontSize: 23, fontWeight: "600", flex: 1 }}>
              {title}
            </Label>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <X color={c.ink} size={22} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Empty({ title, body, action, icon: Icon = House }: any) {
  const c = useTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 45, gap: 13 }}>
      <View style={{ padding: 20, borderRadius: 28, backgroundColor: c.soft }}>
        <Icon size={32} color={c.accent} />
      </View>
      <Label style={{ fontSize: 21, fontWeight: "600", textAlign: "center" }}>
        {title}
      </Label>
      {body && (
        <Label style={{ color: c.muted, textAlign: "center", maxWidth: 370 }}>
          {body}
        </Label>
      )}
      {action}
    </Card>
  );
}
export function Row({ children, style }: any) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Tag({ children }: any) {
  const c = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: c.soft,
      }}
    >
      <Label style={{ fontSize: 11, fontWeight: "600", color: c.accent }}>
        {children}
      </Label>
    </View>
  );
}
export function Avatar({ name, color, size = 34 }: any) {
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: size / 2,
        backgroundColor: color || "#4F7FA6",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
      }}
    >
      <Text style={{ fontSize: size / 3, fontWeight: "600", color: "#fff" }}>
        {String(name)
          .split(" ")
          .map((s: string) => s[0])
          .slice(0, 2)
          .join("")}
      </Text>
    </View>
  );
}
export function Busy() {
  const c = useTheme();
  return <ActivityIndicator color={c.accent} style={{ margin: 20 }} />;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  const c = useTheme(),
    { language } = useApp(),
    t = translator(language);
  return (
    <Row style={{ gap: 10 }}>
      <Image
        source={require("../../assets/icon.png")}
        accessibilityLabel={
          language === "pt-BR"
            ? "Marca Saboia Cleaning"
            : "Saboia Cleaning logo"
        }
        style={{ width: 44, height: 44, borderRadius: 13 }}
      />
      {!compact && (
        <View>
          <Label
            style={{ fontWeight: "700", fontSize: 18, letterSpacing: -0.5 }}
          >
            saboia
            <Label style={{ fontWeight: "400", fontSize: 18 }}> cleaning</Label>
          </Label>
          <Label style={{ color: c.muted, fontSize: 8, letterSpacing: 1.8 }}>
            {t("brandTag")}
          </Label>
        </View>
      )}
    </Row>
  );
}
