/**
 * Challenge Mode definitions. Goals describe the creative aim without
 * revealing the answer; scoring accepts any settings that achieve it.
 */
import type { ChallengeGoal } from '../engine/scoring';

export interface Challenge {
  id: string;
  sceneId: string;
  video?: boolean;
  title: { en: string; sw: string };
  brief: { en: string; sw: string };
  hint: { en: string; sw: string };
  goal: ChallengeGoal;
  badge?: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'freeze-footballer', sceneId: 'football', badge: 'motion-freezer',
    title: { en: 'Freeze the footballer', sw: 'Msimamishe mchezaji wa mpira' },
    brief: { en: 'A player sprints across the pitch. Capture them perfectly sharp, mid-stride, with a balanced exposure.', sw: 'Mchezaji anakimbia uwanjani. Mnase akiwa wazi kabisa, katikati ya hatua, na mwangaza uliosawazishwa.' },
    hint: { en: 'Fast movement needs a very short moment of capture. What pays for that lost light?', sw: 'Mwendo wa kasi unahitaji muda mfupi sana wa kunasa. Nini hulipia mwanga uliopotea?' },
    goal: { motion: { maxBlurPx: 4 }, noise: { max: 0.5 } },
  },
  {
    id: 'moving-bicycle', sceneId: 'cyclist', badge: 'motion-freezer',
    title: { en: 'Photograph a moving bicycle', sw: 'Piga picha baiskeli inayotembea' },
    brief: { en: 'Catch the cyclist clearly as they ride past in the golden evening light.', sw: 'Mnase mwendesha baiskeli kwa uwazi anapopita kwenye mwanga wa dhahabu wa jioni.' },
    hint: { en: 'The rider moves fast, but slower than a sprinter. Balance sharpness against the fading light.', sw: 'Mwendeshaji ana kasi, ila si kama mkimbiaji. Linganisha uwazi na mwanga unaofifia.' },
    goal: { motion: { maxBlurPx: 6 } },
  },
  {
    id: 'light-trails', sceneId: 'moving-vehicle', badge: 'low-light-solver',
    title: { en: 'Create light trails at night', sw: 'Tengeneza michirizi ya mwanga usiku' },
    brief: { en: 'Let the moving car paint streaks of light across the frame. The street itself should stay recognisable.', sw: 'Acha gari linalotembea lichore michirizi ya mwanga kwenye picha. Mtaa ubaki unaotambulika.' },
    hint: { en: 'Trails need time. How do you stop all that time overexposing the frame?', sw: 'Michirizi inahitaji muda. Utazuiaje muda huo wote usiangaze picha kupita kiasi?' },
    goal: { motion: { minBlurPx: 40 }, exposure: [-1, 1] },
  },
  {
    id: 'blurry-background', sceneId: 'outdoor-portrait', badge: 'aperture-explorer',
    title: { en: 'Make the background blurry', sw: 'Fifisha mandharinyuma' },
    brief: { en: 'A classic portrait: your subject pin-sharp, the trees behind them melting into softness.', sw: 'Picha ya kawaida ya mtu: mhusika wazi kabisa, miti nyuma yake ikiyeyuka kuwa laini.' },
    hint: { en: 'Depth of field shrinks as the lens opening grows.', sw: 'Kina cha picha hupungua tundu la lenzi linavyoongezeka.' },
    goal: { dof: { maxTotalM: 1.2 }, focus: { subjectDistM: 2.5, toleranceM: 0.8 } },
  },
  {
    id: 'sharp-landscape', sceneId: 'landscape', badge: 'aperture-explorer',
    title: { en: 'Keep a landscape sharp front to back', sw: 'Weka mandhari wazi mbele hadi nyuma' },
    brief: { en: 'From the flowers near your feet to the far mountains — everything sharp.', sw: 'Kuanzia maua karibu na miguu yako hadi milima ya mbali — kila kitu wazi.' },
    hint: { en: 'The opposite of a portrait: a small opening and a clever focus distance.', sw: 'Kinyume cha picha ya mtu: tundu dogo na umbali wa focus wa busara.' },
    goal: { dof: { minTotalM: 50 }, exposure: [-0.7, 0.7] },
  },
  {
    id: 'indoor-clean', sceneId: 'low-light-interior', badge: 'low-light-solver',
    title: { en: 'Photograph indoors without excessive noise', sw: 'Piga picha ndani bila kelele nyingi' },
    brief: { en: 'A dim room, a quiet moment. Expose it well while keeping the image clean.', sw: 'Chumba hafifu, wakati tulivu. Weka mwangaza mzuri huku picha ikibaki safi.' },
    hint: { en: 'Before amplifying, ask: can the lens or the shutter collect more real light?', sw: 'Kabla ya kukuza, jiulize: lenzi au shutter inaweza kukusanya mwanga halisi zaidi?' },
    goal: { noise: { max: 0.2 }, exposure: [-0.7, 0.7] },
  },
  {
    id: 'handheld-street', sceneId: 'street', badge: 'manual-mode-starter',
    title: { en: 'A sharp handheld street photograph', sw: 'Picha wazi ya mtaani bila tripodi' },
    brief: { en: 'No tripod, people moving. Get a sharp, well-exposed street moment.', sw: 'Bila tripodi, watu wanatembea. Pata picha ya mtaani iliyo wazi na yenye mwangaza mzuri.' },
    hint: { en: 'Your own hands shake. There is a rule of thumb linking shutter speed and focal length.', sw: 'Mikono yako hutetemeka. Kuna kanuni inayohusisha kasi ya shutter na urefu wa lenzi.' },
    goal: { motion: { maxBlurPx: 6 }, exposure: [-0.7, 0.7] },
  },
  {
    id: 'intentional-blur', sceneId: 'waterfall', badge: 'motion-freezer',
    title: { en: 'Create intentional motion blur', sw: 'Tengeneza ukungu wa makusudi' },
    brief: { en: 'Turn the waterfall into silk. The rocks and trees must stay sharp.', sw: 'Geuza maporomoko kuwa hariri. Mawe na miti vibaki wazi.' },
    hint: { en: 'Silky water is time made visible. Beware of too much light flooding in.', sw: 'Maji ya hariri ni muda unaoonekana. Tahadhari na mwanga mwingi kufurika.' },
    goal: { motion: { minBlurPx: 30 }, exposure: [-1, 1] },
  },
  {
    id: 'backlit-subject', sceneId: 'backlit', badge: 'histogram-reader',
    title: { en: 'Photograph a backlit subject', sw: 'Piga picha mtu mwenye mwanga nyuma' },
    brief: { en: 'The sun is behind them. Choose: expose for the person, not the sky.', sw: 'Jua liko nyuma yake. Chagua: weka mwangaza kwa ajili ya mtu, si anga.' },
    hint: { en: 'The meter will beg you to darken. Who is in charge here?', sw: 'Kipimo kitakusihi upunguze mwanga. Nani anaamua hapa?' },
    goal: { exposure: [0.8, 2.5] },
  },
  {
    id: 'window-balance', sceneId: 'window-portrait', badge: 'histogram-reader',
    title: { en: 'Balance a bright window with an indoor subject', sw: 'Sawazisha dirisha angavu na mtu ndani' },
    brief: { en: 'Keep detail in the window light while your subject stays bright enough to see.', sw: 'Hifadhi maelezo ya mwanga wa dirisha huku mhusika akibaki na mwangaza wa kuonekana.' },
    hint: { en: 'Somewhere between the window\'s brightness and the room\'s darkness lies your answer.', sw: 'Kati ya mwangaza wa dirisha na giza la chumba ndipo jibu lako lilipo.' },
    goal: { exposure: [-0.7, 1], noise: { max: 0.4 } },
  },
  {
    id: 'film-24fps', sceneId: 'walking-video', video: true, badge: 'video-exposure-starter',
    title: { en: 'Film natural movement at 24 fps', sw: 'Rekodi mwendo wa asili kwa 24 fps' },
    brief: { en: 'Cinema look: 24 frames per second with motion that feels natural to the eye.', sw: 'Muonekano wa sinema: fremu 24 kwa sekunde na mwendo unaohisi wa asili machoni.' },
    hint: { en: 'There is a famous rule about shutter angle. 180 degrees of it, to be precise.', sw: 'Kuna kanuni maarufu ya shutter angle. Digrii 180, kwa usahihi.' },
    goal: {
      exposure: [-1, 1],
      creative: (s) => {
        const angle = s.shutter * 360 * 24;
        return Math.max(0, 100 - Math.abs(angle - 180) * 1.2);
      },
    },
  },
  {
    id: 'slowmo-120', sceneId: 'slow-motion', video: true, badge: 'video-exposure-starter',
    title: { en: 'Film slow motion at 120 fps', sw: 'Rekodi mwendo wa polepole kwa 120 fps' },
    brief: { en: 'Shoot at 120 fps for buttery slow motion. Every frame needs its own short slice of time.', sw: 'Rekodi kwa fps 120 kwa mwendo laini wa polepole. Kila fremu inahitaji kipande chake kifupi cha muda.' },
    hint: { en: 'At 120 fps a frame lasts only 1/120 s — your shutter must fit inside it.', sw: 'Kwa fps 120 fremu huchukua 1/120 s tu — shutter yako lazima itoshee ndani yake.' },
    goal: {
      exposure: [-1.2, 1.2],
      creative: (s) => (s.shutter <= 1 / 120 ? 100 : Math.max(0, 100 - (s.shutter - 1 / 120) * 4000)),
    },
  },
];

export const CHALLENGE_IDS: ReadonlySet<string> = new Set(CHALLENGES.map((c) => c.id));

export function challengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
