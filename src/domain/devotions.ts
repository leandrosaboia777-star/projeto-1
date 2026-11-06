import { format, addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { expandSchedule } from "./schedule";
import type { Data } from "./schema";
import type { Language } from "../lib/i18n";
export type DevotionPeriod = "morning" | "evening";
// Short Scripture excerpts, with our own clearly separate reflections. English
// excerpts use the public-domain KJV; Portuguese uses modernized Almeida wording.
const readings = [
  {
    ref: ["Salmos 118:24", "Psalm 118:24"],
    verse: [
      "Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.",
      "This is the day which the LORD hath made; we will rejoice and be glad in it.",
    ],
    meaning: [
      "Cada dia é uma nova oportunidade. Comece com gratidão e cuide de uma tarefa de cada vez, sem carregar todo o dia de uma só vez.",
      "Each day is a new opportunity. Begin with gratitude and care for one task at a time, without carrying the whole day at once.",
    ],
  },
  {
    ref: ["Provérbios 16:3", "Proverbs 16:3"],
    verse: [
      "Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.",
      "Commit thy works unto the LORD, and thy thoughts shall be established.",
    ],
    meaning: [
      "Entregar seus planos a Deus não dispensa o esforço: ajuda a trabalhar com propósito, responsabilidade e um coração mais tranquilo.",
      "Entrusting your plans to God does not replace effort. It helps you work with purpose, responsibility, and a calmer heart.",
    ],
  },
  {
    ref: ["Filipenses 4:13", "Philippians 4:13"],
    verse: [
      "Posso todas as coisas naquele que me fortalece.",
      "I can do all things through Christ which strengtheneth me.",
    ],
    meaning: [
      "Paulo fala de encontrar força em Cristo em diferentes circunstâncias. Isso não exige fazer tudo sozinha: pedir ajuda e respeitar seus limites também é sabedoria.",
      "Paul speaks of finding strength in Christ through different circumstances. This does not require doing everything alone: asking for help and respecting your limits are also wise.",
    ],
  },
  {
    ref: ["Salmos 23:1", "Psalm 23:1"],
    verse: [
      "O Senhor é o meu pastor; nada me faltará.",
      "The LORD is my shepherd; I shall not want.",
    ],
    meaning: [
      "A imagem do pastor lembra cuidado e direção. Você pode enfrentar o dia com confiança, procurando o próximo passo com serenidade.",
      "The image of a shepherd speaks of care and guidance. You can face the day with trust and seek your next step calmly.",
    ],
  },
  {
    ref: ["Colossenses 3:23", "Colossians 3:23"],
    verse: [
      "Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor.",
      "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;",
    ],
    meaning: [
      "Seu trabalho tem valor. Capricho, honestidade e cuidado nas pequenas coisas dão dignidade ao que você faz, mesmo quando ninguém está olhando.",
      "Your work has value. Care, honesty, and attention to small things give dignity to what you do, even when no one is watching.",
    ],
  },
  {
    ref: ["Isaías 40:31", "Isaiah 40:31"],
    verse: [
      "Os que esperam no Senhor renovarão as suas forças.",
      "But they that wait upon the LORD shall renew their strength;",
    ],
    meaning: [
      "Esperar em Deus é cultivar confiança. Faça pausas quando precisar e lembre que perseverar não significa ignorar o cansaço.",
      "Waiting on God means cultivating trust. Take breaks when you need them, and remember that perseverance does not mean ignoring tiredness.",
    ],
  },
  {
    ref: ["Provérbios 3:6", "Proverbs 3:6"],
    verse: [
      "Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.",
      "In all thy ways acknowledge him, and he shall direct thy paths.",
    ],
    meaning: [
      "Busque orientação nas escolhas de hoje. Você não precisa prever tudo: pode agir com prudência, ajustar os planos e seguir em paz.",
      "Seek guidance in today's choices. You do not have to predict everything: you can act wisely, adjust your plans, and move forward peacefully.",
    ],
  },
  {
    ref: ["Mateus 11:28", "Matthew 11:28"],
    verse: [
      "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.",
      "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    ],
    meaning: [
      "Jesus acolhe quem está cansado. Ao encerrar o trabalho, permita-se descansar: seu valor não depende de continuar produzindo sem parar.",
      "Jesus welcomes those who are tired. As you finish work, allow yourself to rest: your worth does not depend on producing without stopping.",
    ],
  },
  {
    ref: ["Salmos 4:8", "Psalm 4:8"],
    verse: [
      "Em paz também me deitarei e dormirei, porque só tu, Senhor, me fazes habitar em segurança.",
      "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.",
    ],
    meaning: [
      "Este salmo é uma oração de confiança. Solte as preocupações que não pode resolver agora e acolha o descanso como parte do cuidado com a sua vida.",
      "This psalm is a prayer of trust. Release the worries you cannot resolve now and welcome rest as part of caring for your life.",
    ],
  },
  {
    ref: ["Salmos 107:1", "Psalm 107:1"],
    verse: [
      "Louvai ao Senhor, porque ele é bom; porque a sua benignidade dura para sempre.",
      "O give thanks unto the LORD, for he is good: for his mercy endureth for ever.",
    ],
    meaning: [
      "A gratidão ajuda a reconhecer o bem que esteve presente no dia. Pense em algo simples pelo qual agradecer, mesmo que o trabalho tenha sido difícil.",
      "Gratitude helps you recognize the good that was present today. Think of one simple thing to be thankful for, even if work was difficult.",
    ],
  },
  {
    ref: ["Gálatas 6:9", "Galatians 6:9"],
    verse: [
      "Não nos cansemos de fazer o bem.",
      "And let us not be weary in well doing:",
    ],
    meaning: [
      "O cuidado que você oferece tem importância, mesmo sem reconhecimento imediato. Celebre o bem que fez hoje e recupere suas forças para continuar.",
      "The care you offer matters, even without immediate recognition. Appreciate the good you did today and recover your strength to continue.",
    ],
  },
  {
    ref: ["Filipenses 4:6", "Philippians 4:6"],
    verse: [
      "Não estejais inquietos por coisa alguma.",
      "Be careful for nothing;",
    ],
    meaning: [
      "O contexto convida a levar as preocupações a Deus em oração e gratidão. Não é uma cobrança para nunca sentir ansiedade: é um convite a não enfrentar tudo sozinha.",
      "The surrounding passage invites us to bring worries to God in prayer and gratitude. It is not a demand to never feel anxious, but an invitation not to face everything alone.",
    ],
  },
  {
    ref: ["Salmos 46:1", "Psalm 46:1"],
    verse: [
      "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.",
      "God is our refuge and strength, a very present help in trouble.",
    ],
    meaning: [
      "A fé pode ser um lugar de amparo nos dias difíceis. Você pode buscar apoio em Deus e também nas pessoas que cuidam de você.",
      "Faith can offer shelter on difficult days. You can seek support in God and also in the people who care for you.",
    ],
  },
  {
    ref: ["Números 6:24", "Numbers 6:24"],
    verse: [
      "O Senhor te abençoe e te guarde.",
      "The LORD bless thee, and keep thee:",
    ],
    meaning: [
      "Esta bênção expressa um desejo de cuidado e paz. Ao terminar o dia, receba esse carinho e leve a mesma gentileza para você e sua família.",
      "This blessing expresses a wish for care and peace. As you finish the day, receive that kindness and extend it to yourself and your family.",
    ],
  },
] as const;
export function devotionFor(
  day: string,
  period: DevotionPeriod,
  language: Language,
) {
  const stamp = Date.parse(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(stamp))
    throw new Error("INVALID_DATE");
  const index =
    (((Math.floor(stamp / 86400000) % 7) + 7) % 7) +
    (period === "evening" ? 7 : 0);
  const r = readings[index]!,
    locale = language === "pt-BR" ? 0 : 1;
  return {
    day,
    period,
    reference: r.ref[locale],
    verse: r.verse[locale],
    reflection: r.meaning[locale],
    title:
      period === "morning"
        ? locale === 0
          ? "Uma palavra para começar o dia"
          : "A word to begin your day"
        : locale === 0
          ? "Seu trabalho de hoje está concluído"
          : "Today's work is complete",
  };
}
export function businessDay(data: Pick<Data, "timezone">, now = new Date()) {
  return format(toZonedTime(now, data.timezone), "yyyy-MM-dd");
}
export function completedWorkday(data: Data, now = new Date()): boolean {
  const day = businessDay(data, now),
    next = format(addDays(new Date(`${day}T12:00:00`), 1), "yyyy-MM-dd");
  const jobs = expandSchedule(
    data.series,
    data.exceptions,
    fromZonedTime(`${day}T00:00:00`, data.timezone),
    fromZonedTime(`${next}T00:00:00`, data.timezone),
    data.timezone,
  );
  const status = (o: (typeof jobs)[number]) =>
    data.visits.find(
      (v) => v.series_id === o.series_id && v.original_date === o.original_date,
    )?.status;
  const active = jobs.filter((o) => status(o) !== "canceled");
  return active.length > 0 && active.every((o) => status(o) === "completed");
}
