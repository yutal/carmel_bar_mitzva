/**
 * Builds the shared base filename for a submission: full_name_YYYYMMDD_HHMMSS.
 * Hebrew letters are kept; anything that is unsafe in a filename is dropped.
 */
export function submissionBaseName(fullName: string, date: Date, timeZone = "Asia/Jerusalem"): string {
  const name =
    fullName
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40) || "guest";
  return `${name}_${formatStamp(date, timeZone)}`;
}

function formatStamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}
