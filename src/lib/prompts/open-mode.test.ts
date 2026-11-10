// Open events (no celebrant): the prompts must never mention or draw one, for every style and group size.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_EVENT, IMAGE_STYLES, type GuestInput, type ImageStyle } from "@/lib/types";
import { IMAGE_CONCEPT_SYSTEM_OPEN, guestContext, imageConceptInput } from "./index";
import { buildImagePrompt, castMismatch, headCount, sendsGuestPhoto, type Cast } from "./image";

const STYLES = Object.keys(IMAGE_STYLES) as ImageStyle[];
const event = { ...DEFAULT_EVENT, eventTitle: "Tech Summit", celebrantLook: "SECRET-LOOK should never appear in an open event" };
const cast = (people: string[]): Cast => ({ open: true, hasGuestPhoto: true, guestPeople: people, celebrantInGuestPhoto: false });

const guest = (style: ImageStyle): GuestInput => ({
  fullName: "Dana Levi",
  relationship: "",
  together: "climbing",
  memory: "reaching the summit of Everest",
  talent: "patience",
  blessing: "",
  experience: "image",
  imageStyle: style,
  musicStyle: "auto",
  consentPhoto: true,
  consentScreen: true,
  consentMarketing: false,
  lang: "en",
});

describe("open event prompts", () => {
  it("count exactly the people in the guest photo", () => {
    assert.equal(headCount(cast(["woman"])), 1);
    assert.equal(headCount(cast(["woman", "man", "girl"])), 3);
    assert.equal(sendsGuestPhoto(cast(["woman"])), true);
    assert.match(castMismatch(4, cast(["a", "b"])) ?? "", /instead of 2/);
  });

  for (const style of STYLES) {
    it(`${style}: no celebrant, no celebrant look, the right head count`, () => {
      const prompt = buildImagePrompt({
        style,
        scene: "A scene.",
        references: [{ role: "guest" }],
        cast: cast(["woman, 30s, red hair", "man, 30s, beard"]),
        celebrantLook: event.celebrantLook,
      });
      assert.doesNotMatch(prompt, /celebrant/i);
      assert.doesNotMatch(prompt, /SECRET-LOOK/);
      assert.match(prompt, /exactly 2 people/);
      assert.match(prompt, /Reference image 1: the guest photo/);
    });

    it(`${style}: the concept input has no celebrant and says the photo is attached`, () => {
      const input = imageConceptInput(guest(style), event, true, false, "open");
      assert.doesNotMatch(input, /celebrant|Bar Mitzvah/i);
      assert.match(input, /guest photo is attached/);
      assert.match(input, /Tech Summit/);
    });
  }

  it("the concept instructions are for the guest as hero and demand a photo", () => {
    assert.match(IMAGE_CONCEPT_SYSTEM_OPEN, /hero of their own story/);
    assert.match(IMAGE_CONCEPT_SYSTEM_OPEN, /celebrantInGuestPhoto to false/);
    assert.doesNotMatch(guestContext(guest("movie"), event, { mode: "open" }), /Bar Mitzvah|13-year-old/);
  });
});
