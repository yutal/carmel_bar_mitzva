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
  blessingHint: string;
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
  progress: string[];
  imageWait: string;
  songBy: (name: string) => string;
  songInProduction: string;
  preparingSong: string;
  failed: (what: "image" | "song") => string;
  failedHint: string;
  download: string;
  share: string;
  finish: string;
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
  blessingHint: "הברכה תופיע מילה במילה על היצירה.",
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
  notFound: "היצירה לא נמצאה.",
  creationOf: (name) => `היצירה של ${name}`,
  progress: ["קוראים את הברכה שלך...", "מחפשים את הרגע הכי שלכם...", "כותבים תסריט...", "בוחרים את הסגנון...", "מצלמים את הסצנה...", "מוסיפים את הברכה..."],
  imageWait: "תמונה לוקחת בערך דקה. אפשר לסגור ולחזור לקישור הזה.",
  songBy: (name) => `שיר מאת ${name}`,
  songInProduction: "🎵 השיר שלך בהפקה. הוא יגיע לקישור הזה ולאלבום של בר המצווה אחרי האירוע.",
  preparingSong: "מכינים את השיר...",
  failed: (what) => `משהו לא הסתדר עם ${what === "image" ? "התמונה" : "השיר"} 😕`,
  failedHint: "הצוות יקבל התראה וינסה שוב. הברכה שלך נשמרה.",
  download: "⬇️ הורדה",
  share: "📤 שיתוף",
  finish: "סיום וחזרה לעמוד הבית",
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
  blessingHint: "Your blessing appears word for word on the creation.",
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
  notFound: "This creation was not found.",
  creationOf: (name) => `${name}'s creation`,
  progress: ["Reading your blessing...", "Finding your moment together...", "Writing the script...", "Choosing the look...", "Shooting the scene...", "Adding your blessing..."],
  imageWait: "An image takes about a minute. You can close this page and come back to this link.",
  songBy: (name) => `A song by ${name}`,
  songInProduction: "🎵 Your song is in production. It will arrive at this link and in the Bar Mitzvah album after the party.",
  preparingSong: "Preparing the song...",
  failed: (what) => `Something went wrong with the ${what} 😕`,
  failedHint: "The team has been notified and will try again. Your blessing is saved.",
  download: "⬇️ Download",
  share: "📤 Share",
  finish: "Done, back to the start",
};

export const STRINGS: Record<Lang, Strings> = { he, en };
