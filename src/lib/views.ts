import type { Lang } from "@/lib/i18n";
import type { StageState, Submission } from "@/lib/types";

/** What a guest (or the hall screen) may see of a submission. */
export type PublicSubmission = {
  publicId: string;
  number?: number;
  lang: Lang;
  fullName: string;
  relationship: string;
  blessing: string;
  experience: Submission["input"]["experience"];
  /** Whether it goes up on the hall screen once ready. */
  onScreen: boolean;
  stages: { analysis: StageState["status"]; image?: StageState["status"]; song?: StageState["status"] };
  /** While waiting for a free slot: creations ahead and a rough estimate. */
  queue?: { ahead: number; etaSeconds: number };
  /** While the image is being made: which part of the work is under way. */
  phase?: "story" | "painting" | "finishing";
  image?: { title: string; tagline: string; rationale: string; url?: string };
  song?: { title: string; coverUrl?: string; audioUrl?: string };
};

function imagePhase(s: Submission): PublicSubmission["phase"] {
  if (s.stages.image?.status !== "running" && s.stages.analysis.status !== "running") return undefined;
  if (!s.imageConcept) return "story";
  return s.files.imageRaw ? "finishing" : "painting";
}

export function toPublic(s: Submission, queue?: PublicSubmission["queue"]): PublicSubmission {
  const base = `/api/s/${s.publicId}/file`;
  return {
    publicId: s.publicId,
    number: s.number,
    lang: s.input.lang ?? "he",
    fullName: s.input.fullName,
    relationship: s.input.relationship,
    blessing: s.input.blessing,
    experience: s.input.experience,
    onScreen: s.input.consentScreen && !s.hidden,
    ...(queue && { queue }),
    phase: imagePhase(s),
    stages: {
      analysis: s.stages.analysis.status,
      image: s.stages.image?.status,
      song: s.stages.song?.status,
    },
    image: s.imageConcept && {
      title: s.imageConcept.titleHebrew,
      tagline: s.imageConcept.taglineHebrew,
      rationale: s.imageConcept.rationale,
      url: s.files.image && `${base}/image`,
    },
    song: s.songConcept && {
      title: s.songConcept.titleHebrew,
      coverUrl: s.files.cover && `${base}/cover`,
      audioUrl: s.files.mp3 && `${base}/mp3`,
    },
  };
}
