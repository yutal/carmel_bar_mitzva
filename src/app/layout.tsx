import type { Metadata, Viewport } from "next";
import { David_Libre, Frank_Ruhl_Libre, Heebo, Rubik, Secular_One, Suez_One, Varela_Round } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
// Event themes pick from these; each is a CSS variable, so only the events that choose one use it.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"] });
const suez = Suez_One({ variable: "--font-suez", subsets: ["hebrew", "latin"], weight: "400" });
const varela = Varela_Round({ variable: "--font-varela", subsets: ["hebrew", "latin"], weight: "400" });
const frank = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"], weight: ["500", "700", "900"] });
// Not preloaded: the browser fetches these only on pages of an event whose theme uses them.
const david = David_Libre({ variable: "--font-david", subsets: ["hebrew", "latin"], weight: ["400", "500", "700"], preload: false });
const secular = Secular_One({ variable: "--font-secular", subsets: ["hebrew", "latin"], weight: "400", preload: false });

export const metadata: Metadata = {
  title: "ברכות AI",
  description: "תכתבו ברכה, וה-AI יהפוך אותה לפוסטר או לשיר אישי",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f6ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable} ${rubik.variable} ${suez.variable} ${varela.variable} ${david.variable} ${secular.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
