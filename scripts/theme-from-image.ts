/**
 * Turns a picture (an invitation, a logo, a brand sheet) into an event theme, from the command line.
 *
 *   npx tsx scripts/theme-from-image.ts invitation.png
 *   npx tsx scripts/theme-from-image.ts invitation.png --proposal proposal.json
 *
 * Without --proposal the theme comes from the picture's dominant colours alone (deterministic, no AI). With it, the
 * file is a ThemeProposal (see ThemeProposalSchema in src/lib/platform/theme-fit.ts) written by someone who has looked
 * at the picture, for example Claude following .claude/skills/event-theme-from-invitation. Either way the result goes
 * through fitTheme, so the printed theme is valid and readable. Prints JSON: palette, theme, what was adjusted,
 * the contrast ratios, and the CSS variables to build any matching UI with.
 */
import fs from "node:fs";
import { contrast } from "../src/lib/platform/color";
import { measurePalette } from "../src/lib/platform/theme-design";
import { fitTheme, proposalFromPalette, ThemeProposalSchema } from "../src/lib/platform/theme-fit";
import { resolveColors, themeWrapperStyle } from "../src/lib/platform/theme-rules";

async function main() {
  const [image, ...rest] = process.argv.slice(2);
  if (!image || image.startsWith("--")) {
    console.error("usage: npx tsx scripts/theme-from-image.ts <image> [--proposal proposal.json]");
    process.exit(2);
  }
  const flag = rest.indexOf("--proposal");
  const palette = await measurePalette(fs.readFileSync(image));
  if (palette.length === 0) throw new Error("No colours found in the picture");

  let source: "proposal" | "palette" = "palette";
  let proposal = proposalFromPalette(palette);
  if (flag >= 0) {
    const parsed = ThemeProposalSchema.safeParse(JSON.parse(fs.readFileSync(rest[flag + 1], "utf8")));
    if (!parsed.success) throw new Error(`The proposal does not match ThemeProposalSchema: ${parsed.error.message}`);
    proposal = parsed.data;
    source = "proposal";
  }

  const { theme, adjusted } = fitTheme(proposal);
  const c = resolveColors(theme);
  const { backgroundColor, backgroundImage, backgroundSize, color, minHeight, ...vars } = themeWrapperStyle(theme);
  void backgroundColor, void color, void minHeight;
  console.log(
    JSON.stringify(
      {
        source,
        mood: proposal.mood,
        palette: palette.map((p) => ({ hex: p.hex, share: p.share })),
        theme,
        adjusted,
        contrast: {
          "ink on canvas": Number(contrast(c.ink, c.canvas).toFixed(1)),
          "ink on surface": Number(contrast(c.ink, c.surface).toFixed(1)),
          "muted on canvas": Number(contrast(c.muted, c.canvas).toFixed(1)),
          "accent on canvas": Number(contrast(c.accent, c.canvas).toFixed(1)),
        },
        cssVariables: vars,
        backdrop: { backgroundImage: backgroundImage ?? null, backgroundSize: backgroundSize ?? null },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
