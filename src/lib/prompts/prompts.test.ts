// Run with `npm test`. Checks every image style, photo case and language without calling any model.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lang } from "@/lib/i18n";
import { DEFAULT_EVENT, IMAGE_STYLES, ImageConceptSchema, LANGS, type GuestInput, type ImageStyle } from "@/lib/types";
import { IMAGE_CONCEPT_SYSTEM, imageConceptInput } from "./index";
import { buildCoverPrompt, buildImagePrompt, castMismatch, headCount, sendsGuestPhoto, type Cast, type Reference } from "./image";
import { STYLE_BRIEFS, STYLE_RENDER } from "./styles";

const STYLES = Object.keys(IMAGE_STYLES) as ImageStyle[];
const CELEBRANT_REFS: Reference[] = [{ role: "celebrant" }, { role: "celebrant" }, { role: "celebrant" }, { role: "celebrant" }];
const event = { ...DEFAULT_EVENT, celebrantLook: "short curly brown hair, brown eyes" };

const CASES: { name: string; cast: Cast; people: number }[] = [
  { name: "no photo", cast: { hasGuestPhoto: false, guestPeople: [], celebrantInGuestPhoto: false }, people: 1 },
  { name: "one person", cast: { hasGuestPhoto: true, guestPeople: ["woman, 40s, long black hair"], celebrantInGuestPhoto: false }, people: 2 },
  {
    name: "group of three",
    cast: { hasGuestPhoto: true, guestPeople: ["man, 70s, bald", "woman, 70s, grey bob", "girl, 8, ponytail"], celebrantInGuestPhoto: false },
    people: 4,
  },
  {
    name: "selfie with the celebrant",
    cast: { hasGuestPhoto: true, guestPeople: ["man, 40s, beard", "woman, 40s, glasses"], celebrantInGuestPhoto: true },
    people: 3,
  },
  { name: "only the celebrant in the photo", cast: { hasGuestPhoto: true, guestPeople: [], celebrantInGuestPhoto: true }, people: 1 },
];

const guest = (style: ImageStyle, lang: Lang): GuestInput => ({
  fullName: lang === "en" ? "Dana Levi" : "דנה לוי",
  relationship: lang === "en" ? "Aunt" : "דודה",
  together: "basketball on Fridays",
  memory: "the time he beat everyone at the park",
  talent: "three-pointers",
  blessing: "SECRET-BLESSING-TEXT that must never reach the image",
  experience: "image",
  imageStyle: style,
  musicStyle: "auto",
  consentPhoto: true,
  consentScreen: true,
  consentMarketing: false,
  lang,
});

const count = (text: string, part: string) => text.split(part).length - 1;

describe("image prompt, every style × photo case × language", () => {
  for (const style of STYLES) {
    for (const c of CASES) {
      for (const lang of LANGS) {
        it(`${style} · ${c.name} · ${lang}`, () => {
          const refs = c.cast.hasGuestPhoto ? [...CELEBRANT_REFS, { role: "guest" as const }] : CELEBRANT_REFS;
          const prompt = buildImagePrompt({ style, scene: `Scene for ${lang}.`, references: refs, cast: c.cast, celebrantLook: event.celebrantLook });

          // The exact head count, said at the start of the cast and repeated at the end.
          assert.equal(headCount(c.cast), c.people);
          assert.equal(count(prompt, `CAST: exactly ${c.people} ${c.people === 1 ? "person" : "people"} in the image`), 2);
          assert.match(prompt, /Nobody else appears anywhere in the frame/);
          assert.match(prompt, /no second copy of anyone/);
          // People the story mentions (a team, everyone cheering) are not drawn.
          assert.match(prompt, /If the scene below mentions anyone else .* they stay out of the picture/);

          // Four photos of the celebrant are one boy, drawn once.
          assert.match(prompt, /Reference images 1, 2, 3, 4: all of them show the SAME boy/);
          assert.match(prompt, /draw him exactly once/);

          if (c.cast.hasGuestPhoto) {
            assert.match(prompt, /Reference image 5: the guest photo/);
            for (const p of c.cast.guestPeople) assert.ok(prompt.includes(p), `missing guest description "${p}"`);
          } else {
            assert.doesNotMatch(prompt, /Reference image 5/);
            assert.match(prompt, /No guest, friend or family member appears, not even from behind/);
          }
          if (c.cast.celebrantInGuestPhoto) assert.match(prompt, /draw him once, not twice/);

          // Nothing that invites a hidden or extra guest.
          assert.doesNotMatch(prompt, /as a silhouette|only from behind|may appear|if shown/i);

          // Style first and last; no text in the art.
          assert.ok(prompt.startsWith(`ART STYLE, the most important instruction: ${STYLE_RENDER[style]}`));
          assert.ok(prompt.endsWith(`Remember: the whole image is ${STYLE_RENDER[style]}`));
          assert.match(prompt, /Absolutely no text, letters, numbers/);

          if (style === "animation") {
            assert.match(prompt, /nobody keeps a photographic face/);
            if (c.cast.hasGuestPhoto) assert.match(prompt, /draw them as 3D animated characters, like the celebrant/);
          } else {
            assert.doesNotMatch(prompt, /3D animated character/);
          }
        });
      }
    }
  }
});

describe("image concept input and rules", () => {
  for (const style of STYLES) {
    for (const lang of LANGS) {
      for (const photo of [false, true]) {
        it(`${style} · ${lang} · ${photo ? "with" : "without"} photo`, () => {
          const input = imageConceptInput(guest(style, lang), event, photo);
          assert.doesNotMatch(input, /SECRET-BLESSING-TEXT/, "the blessing must not reach the image concept");
          assert.match(input, new RegExp(`Poster language: ${lang === "en" ? "English" : "Hebrew"}`));
          assert.match(input, new RegExp(`Art style picked by the guest: ${style}`));
          assert.ok(input.includes(STYLE_BRIEFS[style]));
          assert.match(input, photo ? /The guest photo is attached/ : /NO guest photo is provided: the celebrant is the only person/);
          assert.match(input, /How the celebrant looks: short curly brown hair/);
        });
      }
    }
  }

  it("concept rules fix the cast and leave the celebrant out of the guest list", () => {
    assert.match(IMAGE_CONCEPT_SYSTEM, /Do NOT list the celebrant there/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /The cast of the image is fixed/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /no guest, not even from behind or as a silhouette/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /never describe the celebrant twice/);
    assert.doesNotMatch(IMAGE_CONCEPT_SYSTEM, /show the guest only from behind/);
  });

  it("the concept compares the guest photo with a photo of the celebrant", () => {
    const input = imageConceptInput(guest("magazine", "en"), event, true, true);
    assert.match(input, /Image 1 is the celebrant, only to compare faces with/);
    assert.match(input, /Image 2 is the guest photo/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /compare every face with the celebrant photo/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /Another child of a similar age, hair or build is a guest/);
    assert.match(IMAGE_CONCEPT_SYSTEM, /When unsure, list the person and set false/);
    assert.doesNotMatch(imageConceptInput(guest("magazine", "en"), event, false, true), /Image 1/);
  });

  it("the concept schema asks whether the celebrant is in the guest photo", () => {
    const shape = ImageConceptSchema.shape;
    assert.ok("celebrantInGuestPhoto" in shape);
    assert.match(shape.guestPhotoPeople.description ?? "", /NOT including the celebrant/);
  });

  it("no style brief invites extra or hidden people", () => {
    for (const style of STYLES) {
      const text = STYLE_BRIEFS[style] + STYLE_RENDER[style];
      assert.doesNotMatch(text, /may appear from behind|if shown|stadium or arena|an athlete in action/i, style);
    }
  });
});

describe("head count after painting", () => {
  const one: Cast = { hasGuestPhoto: true, guestPeople: ["woman"], celebrantInGuestPhoto: false };
  const none: Cast = { hasGuestPhoto: false, guestPeople: [], celebrantInGuestPhoto: false };
  it("the right number of faces passes", () => {
    assert.equal(castMismatch(2, one), null);
    assert.equal(castMismatch(1, none), null);
  });
  it("an extra or repeated person is caught", () => {
    assert.match(castMismatch(3, one)!, /added or repeated/);
    assert.match(castMismatch(2, none)!, /added or repeated/);
  });
  it("a missing guest is caught", () => {
    assert.match(castMismatch(1, one)!, /only 1 of the 2/);
  });
  it("no photo and no face found is not a reason to paint again", () => {
    assert.equal(castMismatch(0, none), null);
  });
});

describe("which photos the image model gets", () => {
  it("a guest photo of other people is sent", () => {
    for (const c of CASES.filter((c) => c.cast.guestPeople.length)) assert.equal(sendsGuestPhoto(c.cast), true, c.name);
  });
  it("a guest photo of only the celebrant is not sent, so he is not drawn twice", () => {
    assert.equal(sendsGuestPhoto({ hasGuestPhoto: true, guestPeople: [], celebrantInGuestPhoto: true }), false);
  });
  it("a photo whose people were not described is still sent", () => {
    assert.equal(sendsGuestPhoto({ hasGuestPhoto: true, guestPeople: [], celebrantInGuestPhoto: false }), true);
  });
  it("no photo, nothing to send", () => {
    assert.equal(sendsGuestPhoto({ hasGuestPhoto: false, guestPeople: [], celebrantInGuestPhoto: false }), false);
  });
});

describe("song cover", () => {
  it("shows the celebrant once and no text", () => {
    const prompt = buildCoverPrompt("A stage with lights.", CELEBRANT_REFS, event.celebrantLook);
    assert.match(prompt, /draw him exactly once/);
    assert.match(prompt, /Absolutely no text/);
  });
});
