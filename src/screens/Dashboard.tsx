import React, { useState } from "react";
import { View, Pressable, Linking, useWindowDimensions } from "react-native";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import {
  ArrowUpRight,
  ArrowRight,
  House,
  Users,
  CalendarDays,
  Mic,
  Volume2,
  MapPin,
  Sun,
  Sparkles,
  Plus,
  MessageSquare,
} from "lucide-react-native";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { expandSchedule } from "../domain/schedule";
import { makeBriefing } from "../domain/briefing";
import { speak } from "../lib/voice";
import {
  Card,
  Label,
  Heading,
  Row,
  Tag,
  Button,
  Sheet,
  Empty,
  useTheme,
} from "../components/ui";
import { AppointmentCard } from "./Calendar";
import { Requests } from "./Requests";
export function HouseArt({ size = 200 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.875} viewBox="0 0 220 190">
      <Circle cx="112" cy="100" r="78" fill="#D5E5C5" />
      <Path
        d="M31 96L111 29L190 96"
        stroke="#315E4F"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M48 91V163H175V91L111 43Z" fill="#F4F5E8" />
      <Path d="M48 91L111 43L175 91" fill="#E5EBD8" />
      <Rect x="94" y="111" width="35" height="52" rx="4" fill="#73977C" />
      <Rect x="61" y="103" width="22" height="27" rx="3" fill="#C1D9BE" />
      <Rect x="141" y="103" width="22" height="27" rx="3" fill="#C1D9BE" />
      <Path
        d="M72 103V130M61 116H83M152 103V130M141 116H163"
        stroke="#F4F5E8"
        strokeWidth="2"
      />
      <Circle cx="121" cy="138" r="2" fill="#F0F3DB" />
      <Path
        d="M33 164H188"
        stroke="#52775D"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M181 45L184 33L187 45L199 48L187 51L184 63L181 51L169 48Z"
        fill="#52775D"
      />
      <Path
        d="M33 64L35 57L37 64L44 66L37 68L35 75L33 68L26 66Z"
        fill="#7B9A67"
      />
      <Path
        d="M192 148Q202 118 188 117Q178 123 192 148M192 149Q216 133 211 124Q201 121 192 149"
        fill="#88A178"
      />
      <Path d="M30 154Q12 131 19 124Q30 125 30 154" fill="#88A178" />
    </Svg>
  );
}
export function Dashboard({ navigate }: { navigate: (page: string) => void }) {
  const app = useApp(),
    { data, language } = app,
    t = translator(language),
    c = useTheme(),
    { width } = useWindowDimensions();
  const [brief, setBrief] = useState(false),
    [requests, setRequests] = useState(false);
  const today = startOfDay(new Date()),
    items = expandSchedule(
      data.series,
      data.exceptions,
      today,
      addDays(today, 1),
      data.timezone,
    ),
    week = expandSchedule(
      data.series,
      data.exceptions,
      startOfWeek(today, { weekStartsOn: 1 }),
      addDays(startOfWeek(today, { weekStartsOn: 1 }), 7),
      data.timezone,
    );
  const next = items.find((o) => +new Date(o.ends_at) > Date.now()),
    nextHouse = data.houses.find((h) => h.id === next?.house_id);
  const pending = data.requests.filter((r) => r.status === "pending");
  return (
    <>
      <Row style={{ justifyContent: "space-between", marginBottom: 22 }}>
        <View>
          <Label
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: c.muted,
              marginBottom: 8,
            }}
          >
            {t("welcomeBack")}
            {app.profile?.full_name
              ? `, ${app.profile.full_name.split(" ")[0]?.toUpperCase()}`
              : ""}
          </Label>
          <Label
            style={{
              fontSize: 34,
              lineHeight: 42,
              fontWeight: "600",
              letterSpacing: -1.5,
            }}
          >
            {t("goodMorning")}
          </Label>
          <Label style={{ color: c.muted, marginTop: 7 }}>
            {t("subtitle")}
          </Label>
        </View>
        <Tag>
          {today.toLocaleDateString(language, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </Tag>
      </Row>
      <View
        style={{
          backgroundColor: c.lime,
          padding: 24,
          borderRadius: 25,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <Row style={{ marginBottom: 16 }}>
          <Sun size={16} color={c.accent} />
          <Label
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              fontWeight: "700",
              color: c.ink,
            }}
          >
            {t("briefing").toUpperCase()}
          </Label>
        </Row>
        <Row style={{ flexWrap: "nowrap", gap: 8 }}>
          <View style={{ flex: 1, gap: 12 }}>
            <Label
              style={{
                fontSize: width < 600 ? 23 : 27,
                fontWeight: "600",
                letterSpacing: -0.7,
                lineHeight: 31,
              }}
            >
              {language === "pt-BR"
                ? `${items.length} casas.\nSeu dia em ordem.`
                : `${items.length} homes.\nYour day, in order.`}
            </Label>
            <Label style={{ fontSize: 13, color: c.ink }}>
              {nextHouse
                ? `${t("nextHouse")}: ${nextHouse.nickname}`
                : t("noAppointments")}
            </Label>
          </View>
          <HouseArt size={width < 600 ? 112 : 190} />
        </Row>
        <View style={{ alignSelf: "flex-start", marginTop: 18 }}>
          <Button
            small
            title={t("readBriefing")}
            icon={Volume2}
            onPress={() => {
              setBrief(true);
              speak(makeBriefing(data, language), language);
            }}
          />
        </View>
      </View>
      <Row style={{ gap: 12, marginBottom: 28 }}>
        {[
          { label: t("today"), value: items.length, icon: House },
          { label: t("week"), value: week.length, icon: CalendarDays },
          {
            label: t("teamCount"),
            value: data.employees.filter((e) => e.active).length,
            icon: Users,
          },
        ].map((s) => (
          <Card
            key={s.label}
            style={{ flex: 1, minWidth: 100, padding: 18, minHeight: 146 }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <s.icon size={19} color={c.muted} />
              <ArrowUpRight size={14} color={c.muted} />
            </Row>
            <Label
              style={{
                fontSize: 32,
                lineHeight: 42,
                fontWeight: "500",
                marginTop: 14,
              }}
            >
              {s.value.toString().padStart(2, "0")}
            </Label>
            <Label style={{ fontSize: 11, color: c.muted }}>{s.label}</Label>
          </Card>
        ))}
      </Row>
      <Row style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <Label style={{ fontSize: 21, fontWeight: "600", letterSpacing: -0.4 }}>
          {t("today")}
          <Label style={{ color: c.muted, fontSize: 15 }}>
            {" "}
            · {items.length}
          </Label>
        </Label>
        <Pressable onPress={() => navigate("calendar")}>
          <Row>
            <Label style={{ fontSize: 12, color: c.accent }}>
              {t("viewAll")}
            </Label>
            <ArrowRight size={14} color={c.accent} />
          </Row>
        </Pressable>
      </Row>
      {items.length ? (
        items.map((o) => (
          <AppointmentCard
            key={o.key}
            o={o}
            onPress={() => navigate("calendar")}
          />
        ))
      ) : (
        <Empty
          title={t("noAppointments")}
          body={t("emptyHousesBody")}
          action={
            app.manager && (
              <Button
                secondary
                title={t("addHouse")}
                icon={Plus}
                onPress={() => navigate("houses")}
              />
            )
          }
        />
      )}
      <View style={{ height: 18 }} />
      <Pressable onPress={() => navigate("assistant")}>
        <Card
          style={{
            backgroundColor: c.accent,
            borderColor: c.accent,
            marginBottom: 18,
          }}
        >
          <Row>
            <View
              style={{
                backgroundColor: "#ffffff20",
                borderRadius: 17,
                padding: 13,
              }}
            >
              <Mic size={25} color={app.dark ? "#193220" : "#fff"} />
            </View>
            <View style={{ flex: 1 }}>
              <Label
                style={{
                  color: app.dark ? "#193220" : "#fff",
                  fontSize: 19,
                  fontWeight: "500",
                }}
              >
                {t("assistantTitle")}
              </Label>
              <Label
                style={{
                  color: app.dark ? "#264030" : "#E0E8DE",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {t("assistantSubtitle")}
              </Label>
            </View>
            <ArrowUpRight color={app.dark ? "#193220" : "#fff"} size={22} />
          </Row>
        </Card>
      </Pressable>
      {app.manager && (
        <Pressable onPress={() => setRequests(true)}>
          <Card>
            <Row>
              <MessageSquare size={22} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: "600" }}>{t("requests")}</Label>
                <Label style={{ fontSize: 12, color: c.muted }}>
                  {pending.length
                    ? `${pending.length} ${t("pending").toLowerCase()}`
                    : t("noRequests")}
                </Label>
              </View>
              <ArrowRight size={18} color={c.muted} />
            </Row>
          </Card>
        </Pressable>
      )}
      <Sheet
        visible={brief}
        title={t("briefing")}
        onClose={() => setBrief(false)}
      >
        <Label>{makeBriefing(data, language)}</Label>
        <View style={{ height: 22 }} />
        <Button
          title={t("listenBriefing")}
          icon={Volume2}
          onPress={() => speak(makeBriefing(data, language), language)}
        />
        <Label style={{ marginTop: 25, fontWeight: "600" }}>{t("route")}</Label>
        <Label style={{ fontSize: 12, color: c.muted, marginVertical: 10 }}>
          {t("routeHelp")}
        </Label>
        {items.map((o) => {
          const h = data.houses.find((h) => h.id === o.house_id);
          return (
            <Button
              key={o.key}
              secondary
              title={h?.nickname ?? "—"}
              icon={MapPin}
              onPress={() =>
                Linking.openURL(
                  `https://maps.apple.com/?q=${encodeURIComponent([h?.address, h?.city, h?.state].join(" "))}`,
                )
              }
            />
          );
        })}
      </Sheet>
      <Sheet
        visible={requests}
        title={t("requests")}
        onClose={() => setRequests(false)}
      >
        <Requests />
      </Sheet>
    </>
  );
}
