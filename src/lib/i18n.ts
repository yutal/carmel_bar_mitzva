import { LANGS, type ImageStyle, type Lang, type MusicStyle } from "@/lib/types";

// To add a language: add it to LANGS in lib/types.ts, then to LANG_INFO and STRINGS here.
export { LANGS, type Lang };

export const LANG_INFO: Record<Lang, { dir: "rtl" | "ltr"; label: string; english: string }> = {
  he: { dir: "rtl", label: "עברית", english: "Hebrew" },
  en: { dir: "ltr", label: "English", english: "English" },
};

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

/** Whether a line of text reads right to left, by its first letter. Hebrew and Arabic count; digits and Latin do not. */
export function isRtlText(text: string): boolean {
  const m = text.match(/[\p{L}]/u);
  return Boolean(m && /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(m[0]));
}

type Strings = {
  station: string;
  heroLines: (name: string) => [string, string];
  intro: (name: string, songs: boolean) => string;
  start: string;
  forwardArrow: string;
  howItWorks: string;
  howSteps: (songs: boolean) => [string, string][];
  meta: (name: string, max: number | null) => string;
  back: string;
  whoTitle: string;
  fullName: string;
  fullNamePlaceholder: string;
  relationshipLegend: (name: string) => string;
  relationships: string[];
  relationshipOther: string;
  quotaReached: (max: number | null) => string;
  storyTitle: string;
  storyNote: (songs: boolean) => [string, string];
  storyHint: string;
  qTogether: (name: string) => string;
  pTogether: string;
  qMemory: string;
  pMemory: string;
  qTalent: (name: string) => string;
  pTalent: string;
  blessingTitle: (name: string) => string;
  blessingHint: (name: string) => string;
  blessingOnly: string;
  blessingOnlyHint: string;
  sendBlessing: string;
  consentScreenBlessing: string;
  blessingPlaceholder: (name: string) => string;
  styleTitle: string;
  styleHint: string;
  styles: Record<ImageStyle, { label: string; hint: string }>;
  songToggle: string;
  songToggleHint: (name: string) => string;
  musicLegend: string;
  musicStyles: Record<MusicStyle, string>;
  photoTitle: string;
  photoHint: (name: string) => string;
  photoAlt: string;
  photoReplace: string;
  selfie: string;
  gallery: string;
  photoConsent: (name: string) => string;
  consentScreen: string;
  consentMarketing: string;
  continue: string;
  create: string;
  sending: string;
  genericError: string;
  // Result page
  loading: string;
  notFound: string;
  creationOf: (name: string) => string;
  ticket: (n: number) => string;
  phases: Record<"queued" | "story" | "painting" | "finishing", string>;
  queueAhead: (ahead: number) => string;
  eta: (seconds: number) => string;
  imageWait: string;
  blessingSaved: string;
  songBy: (name: string) => string;
  songInProduction: string;
  preparingSong: string;
  failed: (what: "image" | "song") => string;
  failedHint: string;
  download: string;
  share: string;
  shareText: string;
  linkCopied: string;
  finish: string;
  thanksTitle: (guest: string) => string;
  thanksBody: (onScreen: boolean) => string;
  close: string;
  closeHint: string;
  backHome: string;
};

const he: Strings = {
  station: "עמדת הברכות",
  heroLines: (name) => ["הבר מצווה", `של ${name}`],
  intro: (name, songs) =>
    `כתבו ל${name} ברכה, ספרו זיכרון משותף, וה-AI יהפוך אותה ליצירה בסגנון שתבחרו: פוסטר של סרט, שער מגזין, כרטיס שחקן ועוד${songs ? ", ואפשר גם שיר" : ""}.`,
  start: "בואו נתחיל",
  forwardArrow: "←",
  howItWorks: "איך זה עובד",
  howSteps: (songs) => [
    ["כותבים ברכה", "וזיכרון משותף"],
    ["ה-AI יוצר", songs ? "תמונה ושיר" : "תמונה בסגנון שבחרתם"],
    ["מקבלים מזכרת", "מורידים ומשתפים"],
  ],
  meta: (name, max) =>
    ["לוקח בערך 2 דקות", max && `עד ${max === 1 ? "יצירה אחת" : `${max} יצירות`} לכל אורח`, `כל היצירות נשמרות באלבום של ${name}`].filter(Boolean).join(" · "),
  back: "→ חזרה",
  whoTitle: "מי אתם?",
  fullName: "שם מלא",
  fullNamePlaceholder: "למשל: דנה כהן",
  relationshipLegend: (name) => `מה הקשר שלכם ל${name}?`,
  relationships: ["משפחה", "חבר מהכיתה", "חבר מהחוג", "חברים של ההורים", "שכנים"],
  relationshipOther: "או כתבו בעצמכם: סבתא, הדוד מחיפה...",
  quotaReached: (max) => `כבר יצרת ${max} יצירות, וזה המקסימום לאורח. תודה שבירכת!`,
  storyTitle: "ספרו לנו עליכם",
  storyNote: (songs) => ["מהתשובות כאן נבנית התמונה שלכם:", `הסצנה, הכותרת והפרטים שבה${songs ? ", וגם השיר אם תבחרו בו" : ""}.`],
  storyHint: "ככל שתהיו ספציפיים, התוצאה תהיה אישית יותר. מספיק לענות על אחת.",
  qTogether: (name) => `מה הכי אוהבים לעשות יחד עם ${name}?`,
  pTogether: "כדורסל בחצר, פיפ״א, טיולים...",
  qMemory: "זיכרון משותף או סיפור מצחיק",
  pMemory: "הפעם ההיא ש...",
  qTalent: (name) => `במה ${name} הכי טוב?`,
  pTalent: "לנצח אותי בכל משחק",
  blessingTitle: (name) => `הברכה שלכם ל${name}`,
  blessingHint: (name) => `הברכה נשמרת מילה במילה באלבום של ${name}, ומוצגת ליד היצירה.`,
  blessingOnly: "רק ברכה, בלי תמונה",
  blessingOnlyHint: "כותבים ברכה, והיא נשמרת באלבום. דקה אחת.",
  sendBlessing: "שליחת הברכה ✦",
  consentScreenBlessing: "אפשר להציג את הברכה שלי על המסך באולם",
  blessingPlaceholder: (name) => `${name} יקר, מאחלים לך...`,
  styleTitle: "באיזה סגנון?",
  styleHint: "הסיפור שלכם, בסגנון שתבחרו.",
  styles: {
    movie: { label: "פוסטר קולנועי", hint: "אתם בכיכוב סרט שנולד מהסיפור שלכם" },
    animation: { label: "סרט אנימציה", hint: "דמויות תלת־ממד, כמו בסרט מצויר" },
    comic: { label: "גיבורי־על", hint: "שער של חוברת קומיקס צבעונית" },
    magazine: { label: "שער מגזין", hint: "על השער, עם כותרות עליכם" },
    card: { label: "כרטיס שחקן", hint: "כרטיס אספנות עם ציון ותכונות" },
    toy: { label: "בובה בקופסה", hint: "בובת אקשן באריזה, עם אביזרים מהסיפור" },
  },
  songToggle: "🎵 וגם שיר אישי",
  songToggleHint: (name) => `שיר שנוצר במיוחד ל${name} מהזיכרונות שלכם`,
  musicLegend: "איזה סגנון שיר?",
  musicStyles: { auto: "תבחר אתה", emotional: "מרגש", upbeat: "קצבי ושמח", funny: "מצחיק", hiphop: "היפ הופ", rock: "רוק", mizrahi: "מזרחי" },
  photoTitle: "רוצים להופיע בתמונה?",
  photoHint: (name) => `צלמו סלפי או בחרו תמונה ברורה של הפנים, ותופיעו ביצירה לצד ${name}. אפשר גם לדלג.`,
  photoAlt: "התמונה שבחרתם",
  photoReplace: "החלפה",
  selfie: "📸 סלפי",
  gallery: "🖼️ מהגלריה",
  photoConsent: (name) => `בלחיצה על "צור לי" אתם מאשרים שהתמונה תישלח לשירות AI (OpenAI) כדי ליצור את היצירה, ותישמר רק לצורך האלבום של ${name}.`,
  consentScreen: "אפשר להציג את היצירה שלי על המסך באולם",
  consentMarketing: "אפשר להשתמש ביצירה שלי (כולל התמונה והברכה) כדוגמה לפרסום ושיווק של עמדת הברכות",
  continue: "המשך",
  create: "צור לי ✦",
  sending: "שולחים...",
  genericError: "משהו השתבש, נסו שוב",
  loading: "טוען...",
  notFound: "היצירה לא נמצאה, או שתוקף הקישור עבר.",
  creationOf: (name) => `היצירה של ${name}`,
  ticket: (n) => `יצירה מס׳ ${n}`,
  phases: { queued: "בתור ליצירה", story: "קוראים את הסיפור שלכם", painting: "מציירים את הסצנה", finishing: "מוסיפים כותרת וחתימה" },
  queueAhead: (n) => (n === 0 ? "אתם הבאים בתור" : n === 1 ? "יצירה אחת לפניכם" : `${n} יצירות לפניכם`),
  eta: (s) => (s < 90 ? "מוכן בעוד כדקה" : `מוכן בעוד כ-${Math.ceil(s / 60)} דקות`),
  imageWait: "אפשר לסגור את הדף ולחזור לקישור הזה בהמשך הערב.",
  blessingSaved: "הברכה נשמרה 💛",
  songBy: (name) => `שיר מאת ${name}`,
  songInProduction: "🎵 השיר שלך בהפקה. הוא יגיע לקישור הזה ולאלבום של בר המצווה אחרי האירוע.",
  preparingSong: "מכינים את השיר...",
  failed: (what) => `משהו לא הסתדר עם ${what === "image" ? "התמונה" : "השיר"} 😕`,
  failedHint: "הצוות יקבל התראה וינסה שוב. הברכה שלך נשמרה.",
  download: "⬇️ הורדה",
  share: "📤 שיתוף",
  shareText: "היצירה שלי לבר המצווה",
  linkCopied: "הקישור הועתק",
  finish: "סיום",
  thanksTitle: (guest) => `תודה, ${guest}!`,
  thanksBody: (onScreen) => `הברכה שלכם נשמרה באלבום של בר המצווה${onScreen ? ", ועוד רגע היא תופיע על המסך באולם" : ""}.`,
  close: "סגירה",
  closeHint: "אפשר לסגור את הלשונית 🙂",
  backHome: "לעמוד הראשי",
};

const en: Strings = {
  station: "BLESSING STATION",
  heroLines: (name) => [`${name}'s`, "Bar Mitzvah"],
  intro: (name, songs) =>
    `Write ${name} a blessing, share a memory together, and AI turns it into a creation in the style you choose: a movie poster, a magazine cover, a player card and more${songs ? ", or even a song" : ""}.`,
  start: "Let's start",
  forwardArrow: "→",
  howItWorks: "HOW IT WORKS",
  howSteps: (songs) => [
    ["Write a blessing", "and a shared memory"],
    ["AI creates", songs ? "an image and a song" : "an image in your style"],
    ["Keep the memory", "download and share"],
  ],
  meta: (name, max) =>
    ["Takes about 2 minutes", max && `up to ${max === 1 ? "one creation" : `${max} creations`} per guest`, `every creation is saved in ${name}'s album`].filter(Boolean).join(" · "),
  back: "← Back",
  whoTitle: "Who are you?",
  fullName: "Full name",
  fullNamePlaceholder: "e.g. Dana Cohen",
  relationshipLegend: (name) => `How do you know ${name}?`,
  relationships: ["Family", "Classmate", "Friend from a club", "Parents' friends", "Neighbours"],
  relationshipOther: "Or write your own: grandma, uncle from Haifa...",
  quotaReached: (max) => `You have already made ${max} creations, the most each guest can make. Thank you for your blessing!`,
  storyTitle: "Tell us about you",
  storyNote: (songs) => ["Your image is built from these answers:", `the scene, the title and the details${songs ? ", and the song too if you pick one" : ""}.`],
  storyHint: "The more specific you are, the more personal the result. Answering one is enough.",
  qTogether: (name) => `What do you love doing together with ${name}?`,
  pTogether: "Basketball in the yard, FIFA, hiking...",
  qMemory: "A shared memory or a funny story",
  pMemory: "That time when...",
  qTalent: (name) => `What is ${name} best at?`,
  pTalent: "Beating me at every game",
  blessingTitle: (name) => `Your blessing for ${name}`,
  blessingHint: (name) => `Your blessing is kept word for word in ${name}'s album and shown next to your creation.`,
  blessingOnly: "Just a blessing, no image",
  blessingOnlyHint: "Write a blessing and it is saved in the album. One minute.",
  sendBlessing: "Send my blessing ✦",
  consentScreenBlessing: "My blessing may be shown on the screen at the party",
  blessingPlaceholder: (name) => `Dear ${name}, we wish you...`,
  styleTitle: "Which style?",
  styleHint: "Your story, in the style you pick.",
  styles: {
    movie: { label: "Movie poster", hint: "Starring in a film born from your story" },
    animation: { label: "Animated film", hint: "3D characters, like a cartoon movie" },
    comic: { label: "Superheroes", hint: "The cover of a colourful comic book" },
    magazine: { label: "Magazine cover", hint: "On the cover, with headlines about you" },
    card: { label: "Player card", hint: "A collectible card with a rating and stats" },
    toy: { label: "Boxed figure", hint: "An action figure in its box, with props from your story" },
  },
  songToggle: "🎵 And a personal song",
  songToggleHint: (name) => `A song made just for ${name} from your memories`,
  musicLegend: "What kind of song?",
  musicStyles: { auto: "You choose", emotional: "Moving", upbeat: "Upbeat", funny: "Funny", hiphop: "Hip hop", rock: "Rock", mizrahi: "Mizrahi" },
  photoTitle: "Want to be in the picture?",
  photoHint: (name) => `Take a selfie or pick a clear photo of your face, and you will appear next to ${name}. You can also skip this.`,
  photoAlt: "Your photo",
  photoReplace: "Change",
  selfie: "📸 Selfie",
  gallery: "🖼️ From gallery",
  photoConsent: (name) => `By tapping "Create" you agree that the photo is sent to an AI service (OpenAI) to make the creation, and is kept only for ${name}'s album.`,
  consentScreen: "My creation may be shown on the screen at the party",
  consentMarketing: "My creation (including the photo and blessing) may be used as an example to advertise the blessing station",
  continue: "Continue",
  create: "Create ✦",
  sending: "Sending...",
  genericError: "Something went wrong, please try again",
  loading: "Loading...",
  notFound: "This creation was not found, or the link has expired.",
  creationOf: (name) => `${name}'s creation`,
  ticket: (n) => `Creation #${n}`,
  phases: { queued: "In line", story: "Reading your story", painting: "Painting the scene", finishing: "Adding the title and signature" },
  queueAhead: (n) => (n === 0 ? "You're next" : n === 1 ? "1 creation ahead of you" : `${n} creations ahead of you`),
  eta: (s) => (s < 90 ? "Ready in about a minute" : `Ready in about ${Math.ceil(s / 60)} minutes`),
  imageWait: "You can close this page and come back to this link later this evening.",
  blessingSaved: "Your blessing is saved 💛",
  songBy: (name) => `A song by ${name}`,
  songInProduction: "🎵 Your song is in production. It will arrive at this link and in the Bar Mitzvah album after the party.",
  preparingSong: "Preparing the song...",
  failed: (what) => `Something went wrong with the ${what} 😕`,
  failedHint: "The team has been notified and will try again. Your blessing is saved.",
  download: "⬇️ Download",
  share: "📤 Share",
  shareText: "My creation for the Bar Mitzvah",
  linkCopied: "Link copied",
  finish: "Done",
  thanksTitle: (guest) => `Thank you, ${guest}!`,
  thanksBody: (onScreen) => `Your blessing is saved in the Bar Mitzvah album${onScreen ? ", and in a moment it will appear on the screen at the party" : ""}.`,
  close: "Close",
  closeHint: "You can close this tab now 🙂",
  backHome: "Back to the start",
};

export const STRINGS: Record<Lang, Strings> = { he, en };
