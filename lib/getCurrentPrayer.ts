export function getCurrentPrayer(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const total = hour * 60 + minute;

  // Rough UK prayer windows (can refine later)
  if (total >= 300 && total < 720) return "fajr";      // 5:00 – 12:00
  if (total >= 720 && total < 900) return "dhuhr";     // 12:00 – 15:00
  if (total >= 900 && total < 1080) return "asr";      // 15:00 – 18:00
  if (total >= 1080 && total < 1260) return "maghrib"; // 18:00 – 21:00
  return "isha";                                       // 21:00+
}

