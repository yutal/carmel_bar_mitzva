/**
 * Every tool the platform offers or plans to, shown as tiles on the admin home page. A licence can only switch on
 * tools whose status is "live"; the others are listed so the organiser sees what is coming.
 */
export const TOOL_IDS = [
  "blessings",
  "screen",
  "album",
  "print",
  "photo_stack",
  "audio_station",
  "stickers",
  "mosaic",
  "characters",
  "comics",
  "tagbox",
  "video",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export type ToolStatus = "live" | "soon" | "research";

export type ToolInfo = { icon: string; name: string; description: string; status: ToolStatus };

export const TOOLS: Record<ToolId, ToolInfo> = {
  blessings: {
    icon: "💌",
    name: "ברכות AI",
    description: "האורח כותב ברכה ומקבל פוסטר אישי עם החוגג, ושיר אם רוצים",
    status: "live",
  },
  screen: { icon: "📺", name: "מסך אולם", description: "מצגת חיה של היצירות והברכות עם QR גדול", status: "live" },
  album: { icon: "📖", name: "אלבום אחרי האירוע", description: "עיצוב אלבום PDF מכל היצירות והברכות, בכמה פריסות", status: "live" },
  print: { icon: "🧲", name: "הדפסה למגנטים", description: "תור הדפסה, קבצים מוכנים בגודל המגנט וגיליונות להדפסה", status: "live" },
  photo_stack: {
    icon: "🎭",
    name: "תמונות AI מסטאק דמויות",
    description: "האורח מצטלם ובוחר דמות מתוך סט קבוע שהאירוע הגדיר",
    status: "soon",
  },
  audio_station: {
    icon: "🎙️",
    name: "עמדת ברכות קוליות",
    description: "ברכה מוקלטת שהופכת לטקסט ולכרטיס מעוצב עם תמונה",
    status: "soon",
  },
  stickers: { icon: "🏷️", name: "סטיקרים לאורחים", description: "חבילת סטיקרים אישית לוואטסאפ מכל יצירה", status: "soon" },
  mosaic: { icon: "🧩", name: "קיר פסיפס", description: "כל תמונה הופכת לאריח בתמונה גדולה שנבנית במהלך הערב", status: "soon" },
  characters: { icon: "🦸", name: "ספריית דמויות AI", description: "קטלוג דמויות מוכנות שהאורח נכנס לתוכן", status: "soon" },
  comics: { icon: "💬", name: "קומיקס", description: "עמוד קומיקס של כמה פריימים מהסיפור של האורח", status: "soon" },
  tagbox: { icon: "🃏", name: "Tagbox: שלוש עמדות", description: "קיר פסיפס, קלפי אספנות וסלפי WiFi", status: "soon" },
  video: { icon: "🎬", name: "וידאו", description: "הפוסטר מתעורר לחיים. בשלב מחקר", status: "research" },
};

export const LIVE_TOOLS = TOOL_IDS.filter((t) => TOOLS[t].status === "live");
