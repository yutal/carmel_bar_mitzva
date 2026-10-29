import "server-only";
import sharp from "sharp";
import type { ImageProvider, LlmProvider } from "./types";

/** Offline providers for local development and tests (AI_PROVIDER=mock). */
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
      isAppropriate: true,
    };
  },
  async imageConcept(input) {
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
      guestPhotoPeople: [],
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
};

export const mockImage: ImageProvider = {
  async generate({ size }) {
    const [w, h] = size === "portrait" ? [1024, 1536] : [1024, 1024];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset="1" stop-color="#c76b2a"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${w / 4}" fill="#e08a2c" stroke="#222" stroke-width="8"/></svg>`;
    await new Promise((r) => setTimeout(r, 1500));
    return sharp(Buffer.from(svg)).png().toBuffer();
  },
};
