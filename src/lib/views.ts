import type { StageState, Submission } from "@/lib/types";

/** What a guest (or the hall screen) may see of a submission. */
export type PublicSubmission = {
  publicId: string;
  fullName: string;
  relationship: string;
  blessing: string;
  experience: Submission["input"]["experience"];
  stages: { analysis: StageState["status"]; image?: StageState["status"]; song?: StageState["status"] };
  image?: { title: string; tagline: string; rationale: string; url?: string };
  song?: { title: string; lyrics: string; coverUrl?: string; audioUrl?: string };
};

export function toPublic(s: Submission): PublicSubmission {
  const base = `/api/s/${s.publicId}/file`;
  return {
    publicId: s.publicId,
    fullName: s.input.fullName,
    relationship: s.input.relationship,
    blessing: s.input.blessing,
    experience: s.input.experience,
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
      lyrics: s.songConcept.lyricsHebrew,
      coverUrl: s.files.cover && `${base}/cover`,
      audioUrl: s.files.mp3 && `${base}/mp3`,
    },
  };
}
