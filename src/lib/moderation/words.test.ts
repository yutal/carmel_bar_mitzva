// Run with `npm test`. The harsh-word list must catch the worst words in both languages and leave ordinary blessings alone.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { harshWords } from "./words";

const blocked = [
  "אתה בן זונה",
  "כוסעמק של משחק",
  "כוס אמק",
  "הזונה הזאת",
  "זיון",
  "you are a motherfucker",
  "what the fuuuuck",
  "fuck-you very much",
  "a piece of Fucking work",
  "stupid nigger",
  "You cunt!",
];

const allowed = [
  "מזל טוב כרמל! אתה אלוף, הזריקה שלך קטלנית והיית פצצה במגרש",
  "אנחנו מזינים את הכדורסל בכל שישי",
  "מזונות והוצאות הכל על אבא",
  "כוס מים קרים אחרי המשחק, ואז עוד כוס",
  "חרא של יום אבל הצלחת, אידיוט שלי",
  "הוא זינק מהמקום והמשיך לרוץ",
  "הילד מפגר אחרי כולם בריצה לפעמים",
  "Congrats! You absolutely killed it, that shot was sick, a total bomb. What a beast!",
  "This is bullshit funny, damn, you are an ass but we love you",
  "Scunthorpe, Dickens and a classic cocktail, the assistant class",
];

describe("harsh words", () => {
  for (const text of blocked) it(`blocks: ${text}`, () => assert.ok(harshWords(text).length > 0));
  for (const text of allowed) it(`allows: ${text}`, () => assert.deepEqual(harshWords(text), []));
  it("names the word found", () => assert.deepEqual(harshWords("מה זה, בן זונה"), ["זונה"]));
});
