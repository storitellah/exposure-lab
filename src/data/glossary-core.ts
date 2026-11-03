/**
 * Glossary building blocks: types, categories and the entry helper for
 * photography and video terms, each explained twice — in
 * plain words for a beginner, and in depth for someone ready for the detail.
 * English and Kiswahili.
 */

export type GlossaryCategory =
  | 'exposure' | 'modes' | 'lens' | 'focus' | 'motion' | 'sensor' | 'wb' | 'light' | 'flash' | 'video';

export interface GlossaryEntry {
  id: string;
  category: GlossaryCategory;
  term: { en: string; sw: string };
  simple: { en: string; sw: string };
  advanced: { en: string; sw: string };
}

type Pair = [string, string];

export function entry(category: GlossaryCategory, id: string, term: Pair, simple: Pair, advanced: Pair): GlossaryEntry {
  return {
    id, category,
    term: { en: term[0], sw: term[1] },
    simple: { en: simple[0], sw: simple[1] },
    advanced: { en: advanced[0], sw: advanced[1] },
  };
}

export const CATEGORY_LABELS: Record<GlossaryCategory, { en: string; sw: string }> = {
  exposure: { en: 'Exposure', sw: 'Mwangaza' },
  modes: { en: 'Camera modes', sw: 'Hali za kamera' },
  lens: { en: 'Lenses', sw: 'Lenzi' },
  focus: { en: 'Focus and sharpness', sw: 'Focus na uwazi' },
  motion: { en: 'Motion and shutter', sw: 'Mwendo na shutter' },
  sensor: { en: 'Sensor and files', sw: 'Sensa na mafaili' },
  wb: { en: 'White balance', sw: 'Usawa wa weupe' },
  light: { en: 'Light and colour', sw: 'Mwanga na rangi' },
  flash: { en: 'Flash', sw: 'Flashi' },
  video: { en: 'Video', sw: 'Video' },
};

