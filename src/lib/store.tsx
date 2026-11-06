import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { db, supabase, checked } from "./supabase";
import {
  emptyData,
  type Data,
  type Profile,
  type HouseInput,
  type Employee,
  type Series,
  type Occurrence,
  type Visit,
  type Proposal,
  proposalSchema,
} from "../domain/schema";
import type { Language } from "./i18n";
import { expandSchedule, conflicts } from "../domain/schedule";
import { addDays } from "date-fns";
type Context = {
  session: Session | null;
  profile: Profile | null;
  data: Data;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  refresh: () => Promise<void>;
  language: Language;
  setLanguage: (l: Language) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  manager: boolean;
  saveHouse: (
    input: HouseInput,
    id?: string,
    access?: string,
  ) => Promise<string>;
  removeHouse: (id: string) => Promise<void>;
  saveEmployee: (input: Partial<Employee>, id?: string) => Promise<void>;
  saveSeries: (
    input: Omit<Series, "id" | "business_id" | "until_at">,
  ) => Promise<void>;
  changeSchedule: (
    o: Occurrence,
    scope: string,
    start: string,
    cancel: boolean,
  ) => Promise<void>;
  updateVisit: (o: Occurrence, changes: Partial<Visit>) => Promise<void>;
  commitProposal: (p: Proposal) => Promise<void>;
};
const C = createContext<Context>(null!);
export function useApp() {
  return useContext(C);
}
export function Provider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [data, setData] = useState<Data>(emptyData),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [language, setLang] = useState<Language>(
    Intl.DateTimeFormat().resolvedOptions().locale.startsWith("pt")
      ? "pt-BR"
      : "en-US",
  );
  const [dark, setDarkState] = useState(Appearance.getColorScheme() === "dark");
  useEffect(() => {
    AsyncStorage.multiGet(["language", "dark"]).then((values) => {
      if (values[0]?.[1]) setLang(values[0][1] as Language);
      if (values[1]?.[1]) setDarkState(values[1][1] === "true");
    });
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setData(emptyData);
      return;
    }
    setLoading(true);
    try {
      const p = (await checked(
        db().from("profiles").select("*").eq("id", session.user.id).single(),
      )) as Profile;
      setProfile(p);
      const tables = [
        "houses",
        "employees",
        "cleaning_series",
        "schedule_exceptions",
        "visits",
        "client_requests",
        "photos",
        "notifications",
      ];
      const values = await Promise.all(
        tables.map((table) => checked(db().from(table).select("*"))),
      );
      const business = await checked(
        db()
          .from("businesses")
          .select("timezone")
          .eq("id", p.business_id)
          .single(),
      );
      setData({
        timezone: business!.timezone,
        houses: values[0] ?? [],
        employees: values[1] ?? [],
        series: values[2] ?? [],
        exceptions: values[3] ?? [],
        visits: values[4] ?? [],
        requests: values[5] ?? [],
        photos: values[6] ?? [],
        notifications: values[7] ?? [],
      } as Data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const channel = db()
      .channel("workspace-updates")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void db().removeChannel(channel);
    };
  }, [session?.user.id, refresh]);
  const manager = profile?.role === "manager";
  const requireManager = () => {
    if (!manager)
      throw new Error(
        language === "pt-BR" ? "Somente gestores." : "Managers only.",
      );
  };
  async function saveHouse(input: HouseInput, id?: string, access?: string) {
    requireManager();
    const result = await checked(
      id
        ? db().from("houses").update(input).eq("id", id).select().single()
        : db()
            .from("houses")
            .insert({ ...input, business_id: profile!.business_id })
            .select()
            .single(),
    );
    if (access !== undefined) {
      await checked(
        db().functions.invoke("private-access", {
          body: { action: "save", house_id: result.id, value: access },
        }),
      );
    }
    await refresh();
    return result.id as string;
  }
  async function removeHouse(id: string) {
    requireManager();
    await checked(db().from("houses").delete().eq("id", id));
    await refresh();
  }
  async function saveEmployee(input: Partial<Employee>, id?: string) {
    requireManager();
    await checked(
      id
        ? db().from("employees").update(input).eq("id", id)
        : db()
            .from("employees")
            .insert({ ...input, business_id: profile!.business_id }),
    );
    await refresh();
  }
  async function saveSeries(
    input: Omit<Series, "id" | "business_id" | "until_at">,
  ) {
    requireManager();
    await checked(db().rpc("save_cleaning_series", { payload: input }));
    await refresh();
  }
  async function changeSchedule(
    o: Occurrence,
    scope: string,
    start: string,
    cancel: boolean,
  ) {
    requireManager();
    await checked(
      db().rpc("change_schedule", {
        p_series_id: o.series_id,
        p_original_date: o.original_date,
        p_scope: scope,
        p_starts_at: start,
        p_canceled: cancel,
      }),
    );
    await refresh();
  }
  async function updateVisit(o: Occurrence, changes: Partial<Visit>) {
    await checked(
      db().rpc("update_cleaning_visit", {
        p_series_id: o.series_id,
        p_original_date: o.original_date,
        p_changes: changes,
      }),
    );
    await refresh();
  }
  async function commitProposal(raw: Proposal) {
    requireManager();
    const p = proposalSchema.parse(raw);
    await checked(
      db().functions.invoke("confirm-proposal", { body: { proposal: p } }),
    );
    await refresh();
  }
  return (
    <C.Provider
      value={{
        session,
        profile,
        data,
        loading,
        error,
        setError,
        refresh,
        language,
        setLanguage: (l) => {
          setLang(l);
          void AsyncStorage.setItem("language", l);
        },
        dark,
        setDark: (d) => {
          setDarkState(d);
          void AsyncStorage.setItem("dark", String(d));
        },
        manager,
        saveHouse,
        removeHouse,
        saveEmployee,
        saveSeries,
        changeSchedule,
        updateVisit,
        commitProposal,
      }}
    >
      {children}
    </C.Provider>
  );
}
