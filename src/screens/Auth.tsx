import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { Sparkles, ArrowRight } from "lucide-react-native";
import {
  Brand,
  Heading,
  Label,
  Field,
  Button,
  Card,
  Chips,
  useTheme,
} from "../components/ui";
import { configured, db, authRedirectURL } from "../lib/supabase";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
export function Auth() {
  const { language, setLanguage, setError } = useApp();
  const t = translator(language),
    c = useTheme();
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [business, setBusiness] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit() {
    setBusy(true);
    try {
      if (!email || password.length < 8 || (signup && (!name || !business)))
        throw new Error(
          language === "pt-BR"
            ? "Preencha os campos. A senha precisa de 8 caracteres."
            : "Complete all fields. Password needs at least 8 characters.",
        );
      const { error, data } = signup
        ? await db().auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: authRedirectURL(),
              data: { full_name: name, business_name: business },
            },
          })
        : await db().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (signup && !(data as any)?.session) setNotice(t("checkEmail"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: c.bg,
        padding: 28,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 480, gap: 28 }}>
        <Brand />
        <View style={{ paddingTop: 25 }}>
          <View
            style={{
              alignSelf: "flex-start",
              padding: 15,
              borderRadius: 20,
              backgroundColor: c.lime,
              marginBottom: 24,
            }}
          >
            <Sparkles size={30} color={c.accent} />
          </View>
          <Heading sub={t("authSubtitle")}>{t("welcome")}</Heading>
        </View>
        <Card>
          {configured ? (
            <>
              <Chips
                value={signup ? "signup" : "login"}
                options={[
                  { value: "login", label: t("signIn") },
                  { value: "signup", label: t("signUp") },
                ]}
                onChange={(v: string) => setSignup(v === "signup")}
              />
              {signup && (
                <>
                  <Field
                    label={t("name")}
                    value={name}
                    onChangeText={setName}
                  />
                  <Field
                    label={t("business")}
                    value={business}
                    onChangeText={setBusiness}
                  />
                </>
              )}
              <Field
                label={t("email")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Field
                label={t("password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button
                title={busy ? t("loading") : signup ? t("signUp") : t("signIn")}
                disabled={busy}
                onPress={submit}
                icon={ArrowRight}
              />
              {!signup && (
                <Button
                  title={t("forgot")}
                  secondary
                  onPress={async () => {
                    try {
                      const { error } = await db().auth.resetPasswordForEmail(
                        email,
                        { redirectTo: authRedirectURL() },
                      );
                      if (error) throw error;
                      setNotice(t("checkEmail"));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              )}
              <Label style={{ color: c.accent, marginTop: 12 }}>{notice}</Label>
            </>
          ) : (
            <>
              <Heading>{t("notConfigured")}</Heading>
              <Label>{t("configHelp")}</Label>
            </>
          )}
        </Card>
        <Chips
          value={language}
          onChange={setLanguage}
          options={[
            { value: "en-US", label: "English" },
            { value: "pt-BR", label: "Português" },
          ]}
        />
        <Label style={{ fontSize: 12, color: c.muted, textAlign: "center" }}>
          {t("security")}
        </Label>
      </View>
    </ScrollView>
  );
}
