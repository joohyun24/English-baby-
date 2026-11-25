export interface ExpressionItem {
  id: string;
  phrase: string;
  movie: string;
  note: string;
}

export interface CharacterConfig {
  name: string;
  origin: string;
  role: string;
  outfit: string;
}

export type VisualStyleId =
  | '3d-vivid-color'
  | '3d-pastel-garden'
  | '3d-sunset-songdo'
  | '3d-bw';

export interface SceneConfig {
  place: string;
  situation: string;
  characterA: CharacterConfig;
  characterB: CharacterConfig;
  style: VisualStyleId;
  authorName: string;
}

export type BeatId = 'hook' | 'problem' | 'turn' | 'close';

export type CameraCue =
  | 'wide-cafe'
  | 'street-walk-spill'
  | 'two-shot-apology'
  | 'doorway-realization';

export type MoodCue = 'calm' | 'clumsy' | 'earnest' | 'playful';

export interface DialogueLine {
  speaker: 'A' | 'B';
  speakerName: string;
  text: string;
}

export interface StoryboardBeat {
  id: BeatId;
  label: string;
  timeRange: string;
  startSec: number;
  endSec: number;
  sceneDescription: string;
  lines: DialogueLine[];
  subtitles: string[];
  targetExpressions: string[];
  cameraCue: CameraCue;
  moodCue: MoodCue;
}

export interface BeatAudioData {
  beatId: BeatId;
  audioDataUrl: string;
  durationSec: number;
  voiceSignature: string;
}

export interface StyleOption {
  id: VisualStyleId;
  name: string;
  tagline: string;
  description: string;
  swatches: string[];
  palette: {
    bgTop: string;
    bgBottom: string;
    midground: string;
    towerA: string;
    towerB: string;
    treeLeaf: string;
    treeHighlight: string;
    blossom: string;
    ground: string;
    accent: string;
    awningA: string;
    awningB: string;
    cafeWall: string;
    tableWood: string;
    charAShirt: string;
    charAVest: string;
    charAPants: string;
    charBCoat: string;
    charBBag: string;
    latteColor: string;
    skinTone: string;
    outline: string;
    isMonochrome: boolean;
  };
}

export const VISUAL_STYLES: StyleOption[] = [
  {
    id: '3d-vivid-color',
    name: '3D Vivid Multi-Color',
    tagline: 'Recommended · Bright multi-color Songdo cinema',
    description:
      'Rich 3D animation with azure sky, lush park greens, terracotta café awning, cobalt vest, and coral trench coat.',
    swatches: ['#60A5FA', '#34D399', '#F59E0B', '#E11D48', '#1E3A8A'],
    palette: {
      bgTop: '#7DD3FC',
      bgBottom: '#E0F2FE',
      midground: '#93C5FD',
      towerA: '#60A5FA',
      towerB: '#38BDF8',
      treeLeaf: '#22C55E',
      treeHighlight: '#86EFAC',
      blossom: '#FB7185',
      ground: '#64748B',
      accent: '#2563EB',
      awningA: '#EA580C',
      awningB: '#FEF3C7',
      cafeWall: '#FFF7ED',
      tableWood: '#B45309',
      charAShirt: '#FFFFFF',
      charAVest: '#1E40AF',
      charAPants: '#475569',
      charBCoat: '#E11D48',
      charBBag: '#F59E0B',
      latteColor: '#92400E',
      skinTone: '#FCD5B5',
      outline: '#1E293B',
      isMonochrome: false,
    },
  },
  {
    id: '3d-pastel-garden',
    name: '3D Pastel Rainbow',
    tagline: 'Soft multi-color spring palette',
    description:
      'Gentle sky blue, mint park trees, lavender glass towers, peach café brick, and sage & berry outfits.',
    swatches: ['#A5B4FC', '#6EE7B7', '#FDE68A', '#F9A8D4', '#2DD4BF'],
    palette: {
      bgTop: '#C7D2FE',
      bgBottom: '#FCE7F3',
      midground: '#A5B4FC',
      towerA: '#818CF8',
      towerB: '#5EEAD4',
      treeLeaf: '#34D399',
      treeHighlight: '#A7F3D0',
      blossom: '#F472B6',
      ground: '#7C8594',
      accent: '#0D9488',
      awningA: '#14B8A6',
      awningB: '#FEF9C3',
      cafeWall: '#FFF1F2',
      tableWood: '#D97706',
      charAShirt: '#FFFFFF',
      charAVest: '#4338CA',
      charAPants: '#64748B',
      charBCoat: '#DB2777',
      charBBag: '#FBBF24',
      latteColor: '#A16207',
      skinTone: '#FDE2C8',
      outline: '#334155',
      isMonochrome: false,
    },
  },
  {
    id: '3d-sunset-songdo',
    name: '3D Golden Sunset',
    tagline: 'Warm multi-color twilight glow',
    description:
      'Amber and rose sunset sky over Songdo with teal park accents, emerald awning, and plum & ochre wardrobe.',
    swatches: ['#FB923C', '#F43F5E', '#14B8A6', '#FACC15', '#7E22CE'],
    palette: {
      bgTop: '#FB923C',
      bgBottom: '#FDE68A',
      midground: '#F472B6',
      towerA: '#A855F7',
      towerB: '#EC4899',
      treeLeaf: '#0D9488',
      treeHighlight: '#5EEAD4',
      blossom: '#FACC15',
      ground: '#57534E',
      accent: '#D97706',
      awningA: '#0F766E',
      awningB: '#FFEDD5',
      cafeWall: '#FEF3C7',
      tableWood: '#9A3412',
      charAShirt: '#FFFBEB',
      charAVest: '#6D28D9',
      charAPants: '#44403C',
      charBCoat: '#0284C7',
      charBBag: '#EA580C',
      latteColor: '#78350F',
      skinTone: '#F8CAA0',
      outline: '#292524',
      isMonochrome: false,
    },
  },
  {
    id: '3d-bw',
    name: '3D Black & White',
    tagline: 'Classic monochrome contrast',
    description:
      'Sculpted black and white cinema look with soft charcoal depth and crisp highlights.',
    swatches: ['#FFFFFF', '#CBD5E1', '#64748B', '#334155', '#0F172A'],
    palette: {
      bgTop: '#EAECEF',
      bgBottom: '#CFD5DC',
      midground: '#9AA3AE',
      towerA: '#B0B7C0',
      towerB: '#9AA3AE',
      treeLeaf: '#8B949E',
      treeHighlight: '#C9D1D9',
      blossom: '#FFFFFF',
      ground: '#3E444C',
      accent: '#181C20',
      awningA: '#1E242B',
      awningB: '#FFFFFF',
      cafeWall: '#F1F3F5',
      tableWood: '#495057',
      charAShirt: '#F7F8FA',
      charAVest: '#252A30',
      charAPants: '#1E2228',
      charBCoat: '#4B525C',
      charBBag: '#343A40',
      latteColor: '#2F343A',
      skinTone: '#DDE1E6',
      outline: '#16191D',
      isMonochrome: true,
    },
  },
];

export const DEFAULT_EXPRESSIONS: ExpressionItem[] = [
  {
    id: 'expr-1',
    phrase: 'bittersweet',
    movie: '미나리 (Minari)',
    note: 'Rich aroma and quiet afternoon reflection at the café',
  },
  {
    id: 'expr-2',
    phrase: 'browse',
    movie: '노팅힐 (Notting Hill)',
    note: 'Walking past street shops while holding a warm latte',
  },
  {
    id: 'expr-3',
    phrase: 'just over the street',
    movie: '노팅힐 (Notting Hill)',
    note: 'Rene lives nearby near Songdo Moonlight Festival Park',
  },
  {
    id: 'expr-4',
    phrase: 'get cleaned up',
    movie: '노팅힐 (Notting Hill)',
    note: 'Offering to wash the spilled latte off Marius’s dress shirt',
  },
  {
    id: 'expr-5',
    phrase: 'flatmate',
    movie: '노팅힐 (Notting Hill)',
    note: 'Setting polite boundaries because she shares an apartment',
  },
];

export const DEFAULT_SCENE: SceneConfig = {
  place: '2026 Incheon, Songdo · small café near Moonlight Festival Park',
  situation:
    'They have never met before. While walking down the street browsing shops with a latte, Rene slips on the sidewalk and accidentally spills her drink onto Marius’s crisp dress shirt.',
  characterA: {
    name: 'Marius',
    origin: 'France',
    role: 'Thoughtful visitor enjoying coffee outside',
    outfit: 'Crisp white dress shirt & cobalt-navy vest',
  },
  characterB: {
    name: 'Rene',
    origin: 'Italy',
    role: 'Lawyer living in Songdo',
    outfit: 'Tailored coral trench coat & golden shoulder bag',
  },
  style: '3d-vivid-color',
  authorName: 'joo hyun jun',
};
