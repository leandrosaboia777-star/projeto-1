import React, { useState, useEffect } from "react";
import { View, Pressable, Platform } from "react-native";
import {
  Mic,
  Send,
  Sparkles,
  Square,
  Volume2,
  Check,
} from "lucide-react-native";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { db, checked } from "../lib/supabase";
import { proposalSchema, type Proposal } from "../domain/schema";
import { listen, stop, speak } from "../lib/voice";
import {
  Card,
  Label,
  Heading,
  Field,
  Button,
  Row,
  Tag,
  useTheme,
} from "../components/ui";
export function Assistant({ initialText = "" }: { initialText?: string }) {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const [text, setText] = useState(initialText),
    [history, setHistory] = useState<
      { role: "user" | "assistant"; content: string }[]
    >([]),
    [proposal, setProposal] = useState(""),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false);
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setProposal("");
    const messages = [
      ...history,
      { role: "user" as const, content: text.trim() },
    ];
    setHistory(messages);
    setText("");
    try {
      const result = await checked(
        db().functions.invoke("assistant", {
          body: {
            messages: messages.slice(-12),
            language: app.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      );
      const p = proposalSchema.parse(result.proposal);
      if (p.action === "answer" || p.action === "clarify") {
        const reply = p.action === "answer" ? p.answer : p.question;
        setHistory([...messages, { role: "assistant", content: reply }]);
        speak(reply, app.language);
      } else {
        setProposal(JSON.stringify(p, null, 2));
        setHistory([...messages, { role: "assistant", content: t("review") }]);
      }
    } catch (e) {
      app.setError(`${t("assistantUnavailable")} ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ maxWidth: 780, width: "100%", alignSelf: "center" }}>
      <Heading sub={t("assistantSubtitle")}>{t("assistantTitle")}</Heading>
      <Card
        style={{ alignItems: "center", paddingVertical: 35, marginBottom: 20 }}
      >
        <Tag>SABOIA AI</Tag>
        <Pressable
          accessibilityLabel={t(recording ? "stop" : "listen")}
          onPress={async () => {
            if (recording) {
              stop();
              setRecording(false);
              return;
            }
            try {
              setRecording(true);
              await listen(
                app.language,
                (v) => setText(v),
                () => setRecording(false),
              );
            } catch (e) {
              setRecording(false);
              app.setError(`${t("notSupported")} ${(e as Error).message}`);
            }
          }}
          style={{
            marginVertical: 26,
            backgroundColor: recording ? c.danger : c.accent,
            width: 94,
            height: 94,
            borderRadius: 47,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 9,
            borderColor: c.soft,
          }}
        >
          {recording ? (
            <Square color="#fff" size={28} />
          ) : (
            <Mic color={app.dark ? "#17301F" : "#fff"} size={31} />
          )}
        </Pressable>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          {t(recording ? "recording" : "assistantPlaceholder")}
        </Label>
      </Card>
      {history.map((m, i) => (
        <View
          key={i}
          style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "92%",
            backgroundColor: m.role === "user" ? c.soft : c.card,
            padding: 17,
            borderRadius: 18,
            marginBottom: 12,
          }}
        >
          <Label>{m.content}</Label>
          {m.role === "assistant" && (
            <Pressable
              accessibilityLabel={t("listenBriefing")}
              onPress={() => speak(m.content, app.language)}
              style={{ marginTop: 8 }}
            >
              <Volume2 size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      ))}
      {proposal && (
        <Card style={{ marginVertical: 16 }}>
          <Heading sub={t("proposalHelp")}>{t("review")}</Heading>
          <Field
            label={t("editJson")}
            value={proposal}
            onChangeText={setProposal}
            multiline
            style={{
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              minHeight: 320,
              color: c.ink,
              padding: 14,
              backgroundColor: c.bg,
              borderRadius: 12,
            }}
          />
          <Row>
            <Button
              title={busy ? t("loading") : t("confirm")}
              disabled={busy || !app.manager}
              icon={Check}
              onPress={async () => {
                setBusy(true);
                try {
                  const p = proposalSchema.parse(JSON.parse(proposal));
                  await app.commitProposal(p);
                  setProposal("");
                  setHistory((h) => [
                    ...h,
                    { role: "assistant", content: t("saved") },
                  ]);
                } catch (e) {
                  app.setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              secondary
              title={t("cancel")}
              onPress={() => setProposal("")}
            />
          </Row>
        </Card>
      )}
      <Card>
        <Field
          label={t("assistant")}
          placeholder={t("assistantPlaceholder")}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Button
          title={busy ? t("loading") : t("send")}
          icon={Send}
          disabled={busy || !text.trim()}
          onPress={send}
        />
      </Card>
    </View>
  );
}
