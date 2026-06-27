export type DailyHadith = {
  text: string;
  source: string;
};

const hadiths: DailyHadith[] = [
  {
    text: "Actions are judged by intentions.",
    source: "Sahih al-Bukhari and Sahih Muslim",
  },
  {
    text: "The best of you are those who have the best manners and character.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "Allah loves those deeds that are consistent, even if they are small.",
    source: "Sahih Muslim",
  },
  {
    text: "The merciful are shown mercy by the Most Merciful. Be merciful to those on the earth.",
    source: "Sunan al-Tirmidhi",
  },
  {
    text: "None of you truly believes until he loves for his brother what he loves for himself.",
    source: "Sahih al-Bukhari and Sahih Muslim",
  },
  {
    text: "Whoever relieves a believer of hardship in this world, Allah will relieve him of hardship on the Day of Resurrection.",
    source: "Sahih Muslim",
  },
  {
    text: "A good word is charity.",
    source: "Sahih al-Bukhari and Sahih Muslim",
  },
];

export function getDailyHadith(): DailyHadith {
  const now = new Date();
  const dayOfYear = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86400000
  );

  return hadiths[dayOfYear % hadiths.length];
}

