import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { probe } from "@/lib/media/ffmpeg";
import type { ImageProvider, LlmProvider, TranscribeProvider } from "./types";
import type { TranscriptWord } from "@/lib/types";

/** Override with MOCK_FACES='[{"left":0.2,...}]' to try layouts with several people. */
const MOCK_FACES = process.env.MOCK_FACES
  ? (JSON.parse(process.env.MOCK_FACES) as { left: number; top: number; right: number; bottom: number }[])
  : [{ left: 0.32, top: 0.36, right: 0.68, bottom: 0.6 }];

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * The mock painter follows the prompt's "CAST: exactly N" and remembers how many faces it drew in each image,
 * so the face finder and the checker report them. MOCK_EXTRA_PEOPLE=1 makes the first try add a person (as the
 * real model sometimes does), to exercise the repaint. MOCK_FACES fixes the faces instead, for layout tests.
 */
const painted = new Map<string, { faces: Box[]; expected: number }>();
const key = (img: Buffer) => createHash("sha1").update(img).digest("hex");
const rowOfFaces = (n: number): Box[] =>
  Array.from({ length: n }, (_, i) => {
    const w = Math.min(0.3, 0.8 / n);
    const left = 0.5 - (n * w) / 2 + i * w + 0.01;
    return { left, top: 0.3, right: left + w - 0.02, bottom: 0.3 + w * 0.9 };
  });

/** Offline providers for local development and tests (AI_PROVIDER=mock). MOCK_INAPPROPRIATE=1 makes the analysis flag every text. */
export const mockLlm: LlmProvider = {
  async analyze() {
    return {
      themes: ["basketball", "friendship"],
      sharedActivities: ["playing basketball"],
      insideJokes: ["Carmel always wins"],
      emotions: ["pride", "joy"],
      celebrantTraits: ["competitive"],
      visualMotifs: ["basketball court", "trophy"],
      tone: "epic",
      isAppropriate: process.env.MOCK_INAPPROPRIATE !== "1",
    };
  },
  async moderate(texts) {
    return texts.map(() => false);
  },
  async imageConcept(input, _event, guestPhoto) {
    const style = input.imageStyle ?? "movie";
    return {
      genre: "sports drama",
      rationale: "מבוסס על משחקי הכדורסל שלכם, שבהם כרמל תמיד מנצח.",
      titleHebrew: "הגמר של כרמל",
      taglineHebrew: "יש אגדות שנולדות על המגרש",
      coverLines: style === "magazine" ? ["הסוד מאחורי הזריקה המושלמת", "למה אף אחד לא מנצח אותו", "החברים מספרים הכול"] : [],
      stats:
        style === "card"
          ? [
              { label: "זריקות לסל", value: 97 },
              { label: "צחוק", value: 94 },
              { label: "חברות", value: 99 },
              { label: "התמדה", value: 91 },
            ]
          : [],
      guestPhotoPeople: guestPhoto ? ["the guest"] : [],
      celebrantInGuestPhoto: false,
      imagePrompt: "mock",
    };
  },
  async songConcept(input, _a, event) {
    return {
      titleHebrew: `ניצחון של ${event.celebrantName}`,
      sunoPrompt: `Upbeat Israeli pop song in Hebrew for the Bar Mitzvah of ${event.celebrantName}, sung by ${input.fullName} (${input.relationship}). Basketball games in the yard where ${event.celebrantName} always wins. 120 bpm, electric guitar, warm male vocals.`,
      coverPrompt: "mock",
    };
  },
  // The faces mockImage drew, so layouts and head counts can be checked offline.
  async locateFaces(art) {
    return painted.get(key(art))?.faces ?? MOCK_FACES;
  },
  async checkPoster(art) {
    const { faces, expected } = painted.get(key(art)) ?? { faces: MOCK_FACES, expected: MOCK_FACES.length };
    const n = faces.length;
    return {
      peopleCount: n,
      celebrantCopies: 1,
      guestPeopleShown: Math.min(n, expected) - 1,
      extraPeople: Math.max(0, n - expected),
      photographicFaces: 0,
      styleMatches: true,
      textInImage: false,
      notes: "",
    };
  },
  async clipPlan(segments, { maxSeconds }) {
    let last = 0;
    while (last + 1 < segments.length && segments[last + 1].end - segments[0].start <= maxSeconds) last++;
    return { titleHebrew: "ברכה מכל הלב", quoteHebrew: segments[1]?.text ?? segments[0]?.text ?? "", ranges: [{ first: 0, last }] };
  },
};

const MOCK_LINES = [
  "היי כרמל, מזל טוב!",
  "אני כל כך גאה בך ביום הזה",
  "זוכר את המשחק בחצר כשניצחת את כולנו?",
  "שתמיד תמשיך לחייך ככה",
  "ושתגשים את כל החלומות שלך",
  "אוהבים אותך מאוד, מזל טוב!",
];

/** Fake Hebrew lines every four seconds across the real length of the file. */
export const mockTranscribe: TranscribeProvider = {
  async transcribe(file) {
    const { duration } = await probe(file);
    const segments = [];
    const words: TranscriptWord[] = [];
    for (let t = 0, i = 0; t < duration - 0.5; t += 4, i++) {
      const seg = { start: t, end: Math.min(t + 4, duration), text: MOCK_LINES[i % MOCK_LINES.length] };
      segments.push(seg);
      // Words spread evenly over the line, leaving a short pause at its end.
      const list = seg.text.split(" ");
      const step = (seg.end - seg.start - 0.3) / list.length;
      list.forEach((word, k) => words.push({ word, start: seg.start + k * step, end: seg.start + (k + 1) * step }));
    }
    return { duration, segments, words };
  },
};

export const mockImage: ImageProvider = {
  async generate({ prompt, size }) {
    const [w, h] = size === "portrait" ? [1024, 1536] : [1024, 1024];
    const expected = Number(prompt.match(/CAST: exactly (\d+)/)?.[1] ?? 1);
    const extra = /previous attempt/.test(prompt) ? 0 : Number(process.env.MOCK_EXTRA_PEOPLE) || 0;
    const faces = process.env.MOCK_FACES ? MOCK_FACES : rowOfFaces(expected + extra);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset="1" stop-color="#c76b2a"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${faces.map((f) => `<ellipse cx="${((f.left + f.right) / 2) * w}" cy="${((f.top + f.bottom) / 2) * h}" rx="${((f.right - f.left) / 2) * w}" ry="${((f.bottom - f.top) / 2) * h}" fill="#e0a07c" stroke="#222" stroke-width="6"/>`).join("")}</svg>`;
    // MOCK_IMAGE_DELAY_MS stands in for the real model's time per image, e.g. in load tests.
    await new Promise((r) => setTimeout(r, Number(process.env.MOCK_IMAGE_DELAY_MS) || 1500));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    painted.set(key(png), { faces, expected });
    return png;
  },
};
