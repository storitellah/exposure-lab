/**
 * Guided Beginner Mode lessons. Each lesson explains one idea, sets an
 * interactive task, checks the result and gives cause-and-effect feedback.
 */
import type { ExposureSettings } from '../engine/settings';
import { meterReading } from '../engine/exposure';
import { depthOfField } from '../engine/optics';
import { noiseAmount } from '../engine/noise';
import { subjectBlurPx } from '../engine/scoring';
import { sceneById } from '../scenes/scenes';
import { FULL_FRAME } from '../engine/optics';
import { cameraWhiteBalance, whiteBalanceShift } from '../engine/whitebalance';

export interface LessonCheckContext {
  settings: ExposureSettings;
  sceneEV100: number;
  subjectSpeedPxPerS: number;
}

export interface Lesson {
  id: string;
  sceneId: string;
  /** Which controls the student may change during the task. */
  unlocked: ('aperture' | 'shutter' | 'iso' | 'evComp' | 'focusDistM' | 'focalMm' | 'whiteBalance')[];
  /**
   * Deliberate starting point, applied on top of the scene's default
   * exposure. Lessons begin *away* from the answer so there is something
   * real to solve.
   */
  startPatch?: Partial<ExposureSettings>;
  title: { en: string; sw: string };
  explanation: { en: string; sw: string };
  task: { en: string; sw: string };
  successFeedback: { en: string; sw: string };
  retryFeedback: { en: string; sw: string };
  summary: { en: string; sw: string };
  check: (ctx: LessonCheckContext) => boolean;
}

const meterOk = (c: LessonCheckContext, tol = 0.7) =>
  Math.abs(meterReading(c.sceneEV100, c.settings)) <= tol;

export const LESSONS: Lesson[] = [
  {
    id: 'what-is-exposure', sceneId: 'outdoor-portrait', unlocked: ['shutter'], startPatch: { aperture: 2.8, shutter: 1 / 500, iso: 100 },
    title: { en: 'What exposure means', sw: 'Maana ya mwangaza (exposure)' },
    explanation: {
      en: 'Exposure is how bright or dark your photograph is. Your camera collects light — too little makes the image dark, too much makes it washed out. The meter at the bottom shows when the light is balanced.',
      sw: 'Exposure ni jinsi picha yako ilivyo na mwanga au giza. Kamera hukusanya mwanga — mwanga mdogo hufanya picha kuwa nyeusi, mwanga mwingi huifanya kufifia. Kipimo (meter) kinaonyesha mwanga ukiwa sawa.',
    },
    task: { en: 'Move the shutter speed until the meter reads 0.', sw: 'Badilisha kasi ya shutter hadi kipimo kionyeshe 0.' },
    successFeedback: { en: 'Balanced! The meter reads close to 0, so the photo is neither too dark nor too bright.', sw: 'Umefanikiwa! Kipimo kiko karibu na 0, kwa hiyo picha si nyeusi wala si angavu mno.' },
    retryFeedback: { en: 'Not yet — watch the meter. If it shows minus, the photo is too dark: let in more light with a slower shutter.', sw: 'Bado — angalia kipimo. Kikionyesha minus, picha ni nyeusi mno: ruhusu mwanga zaidi kwa shutter ya polepole.' },
    summary: { en: 'Exposure = the total light the camera records. The meter helps you balance it.', sw: 'Exposure = jumla ya mwanga kamera inayorekodi. Kipimo kinakusaidia kuusawazisha.' },
    check: (c) => meterOk(c),
  },
  {
    id: 'aperture-light', sceneId: 'window-portrait', unlocked: ['aperture'], startPatch: { aperture: 8, shutter: 1 / 60, iso: 200 },
    title: { en: 'Aperture and light', sw: 'Aperture na mwanga' },
    explanation: {
      en: 'The aperture is the opening inside the lens. A small f-number like f/2 is a wide opening that lets in lots of light. A big f-number like f/16 is a tiny opening.',
      sw: 'Aperture ni tundu ndani ya lenzi. Namba ndogo kama f/2 ni tundu pana linaloruhusu mwanga mwingi. Namba kubwa kama f/16 ni tundu dogo.',
    },
    task: { en: 'This room is dim. Open the aperture until the meter reads 0.', sw: 'Chumba hiki kina mwanga hafifu. Fungua aperture hadi kipimo kionyeshe 0.' },
    successFeedback: { en: 'You opened the aperture and let in more light — the portrait is now correctly exposed.', sw: 'Umefungua aperture na kuruhusu mwanga zaidi — sasa picha ina mwangaza sahihi.' },
    retryFeedback: { en: 'Remember: smaller f-number = bigger opening = brighter photo.', sw: 'Kumbuka: namba ndogo ya f = tundu kubwa = picha angavu zaidi.' },
    summary: { en: 'Each full stop (f/2 → f/2.8) halves the light. Small number, big opening.', sw: 'Kila stop kamili (f/2 → f/2.8) hupunguza mwanga nusu. Namba ndogo, tundu kubwa.' },
    check: (c) => meterOk(c) && c.settings.aperture <= 2.8,
  },
  {
    id: 'aperture-dof', sceneId: 'outdoor-portrait', unlocked: ['aperture', 'shutter'], startPatch: { aperture: 11, shutter: 1 / 250, iso: 200 },
    title: { en: 'Aperture and depth of field', sw: 'Aperture na kina cha picha' },
    explanation: {
      en: 'Aperture also controls depth of field: how much of the scene is sharp. Wide apertures (f/1.8) blur the background beautifully. Narrow apertures (f/11) keep everything sharp.',
      sw: 'Aperture pia hudhibiti kina cha picha: sehemu ngapi ya mandhari iko wazi. Aperture pana (f/1.8) huficha mandharinyuma kwa uzuri. Aperture nyembamba (f/11) huweka kila kitu wazi.',
    },
    task: { en: 'Blur the background: use f/2.8 or wider, and keep the exposure balanced with the shutter.', sw: 'Fifisha mandharinyuma: tumia f/2.8 au pana zaidi, na usawazishe mwangaza kwa shutter.' },
    successFeedback: { en: 'The trees melt into soft shapes while your subject stays sharp — that is shallow depth of field.', sw: 'Miti inageuka maumbo laini huku mhusika akibaki wazi — hicho ndicho kina kifupi cha picha.' },
    retryFeedback: { en: 'The background is still sharp. Try opening the aperture (smaller f-number), then fix brightness with a faster shutter.', sw: 'Mandharinyuma bado iko wazi. Jaribu kufungua aperture (namba ndogo), kisha rekebisha mwangaza kwa shutter ya haraka.' },
    summary: { en: 'Wide aperture = shallow focus. Narrow aperture = deep focus.', sw: 'Aperture pana = kina kifupi. Aperture nyembamba = kina kirefu.' },
    check: (c) => meterOk(c, 1) && c.settings.aperture <= 2.8,
  },
  {
    id: 'shutter-light', sceneId: 'landscape', unlocked: ['shutter'], startPatch: { aperture: 11, shutter: 1 / 60, iso: 100 },
    title: { en: 'Shutter speed and light', sw: 'Kasi ya shutter na mwanga' },
    explanation: {
      en: 'The shutter is a curtain that opens for a moment. The longer it stays open, the more light reaches the sensor. 1/60 collects twice the light of 1/125 — one full stop more.',
      sw: 'Shutter ni pazia linalofunguka kwa muda mfupi. Likikaa wazi muda mrefu zaidi, mwanga zaidi hufika kwenye sensa. 1/60 hukusanya mwanga mara mbili ya 1/125 — stop moja kamili zaidi.',
    },
    task: { en: 'This landscape is bright. Choose a shutter speed that balances the meter.', sw: 'Mandhari hii ina mwanga mwingi. Chagua kasi ya shutter inayosawazisha kipimo.' },
    successFeedback: { en: 'The exposure is balanced using only shutter speed.', sw: 'Mwangaza umesawazishwa kwa kutumia kasi ya shutter pekee.' },
    retryFeedback: { en: 'Too bright? Use a faster shutter (bigger bottom number). Too dark? Slow it down.', sw: 'Angavu mno? Tumia shutter ya haraka zaidi. Nyeusi mno? Ipunguze kasi.' },
    summary: { en: 'Longer shutter = more light. Each halving/doubling is one stop.', sw: 'Shutter ndefu = mwanga zaidi. Kila kupunguza/kuongeza mara mbili ni stop moja.' },
    check: (c) => meterOk(c),
  },
  {
    id: 'shutter-motion', sceneId: 'football', unlocked: ['shutter', 'iso'], startPatch: { aperture: 4, shutter: 1 / 125, iso: 100 },
    title: { en: 'Shutter speed and movement', sw: 'Kasi ya shutter na mwendo' },
    explanation: {
      en: 'While the shutter is open, anything that moves paints a smear across the image. Fast shutters like 1/1000 freeze a sprinting player. Slow shutters like 1/30 turn motion into blur.',
      sw: 'Shutter ikiwa wazi, kitu chochote kinachotembea huchora mkwaruzo kwenye picha. Shutter za haraka kama 1/1000 husimamisha mchezaji anayekimbia. Shutter za polepole kama 1/30 hugeuza mwendo kuwa ukungu.',
    },
    task: { en: 'Freeze the footballer: use 1/500 or faster and keep the meter balanced (raise ISO if needed).', sw: 'Msimamishe mchezaji: tumia 1/500 au zaidi na usawazishe kipimo (ongeza ISO ikihitajika).' },
    successFeedback: { en: 'Frozen mid-stride! A fast shutter caught the action with no blur.', sw: 'Amesimamishwa katikati ya hatua! Shutter ya haraka imenasa mchezo bila ukungu.' },
    retryFeedback: { en: 'The player is still blurred or the image is dark. Speed up the shutter, then raise ISO to bring brightness back.', sw: 'Mchezaji bado ana ukungu au picha ni nyeusi. Ongeza kasi ya shutter, kisha ongeza ISO kurudisha mwangaza.' },
    summary: { en: 'Fast shutter freezes action; you often pay for it with higher ISO.', sw: 'Shutter ya haraka husimamisha mwendo; mara nyingi hulipia kwa ISO ya juu.' },
    check: (c) => meterOk(c, 1) && c.settings.shutter <= 1 / 500,
  },
  {
    id: 'iso-brightness', sceneId: 'low-light-interior', unlocked: ['iso'], startPatch: { aperture: 2.8, shutter: 1 / 60, iso: 100 },
    title: { en: 'ISO and brightness', sw: 'ISO na mwangaza' },
    explanation: {
      en: 'ISO is how strongly the camera amplifies the light it collected. Doubling ISO (400 → 800) brightens the image by one stop without changing aperture or shutter.',
      sw: 'ISO ni kiwango kamera inavyokuza mwanga ilioukusanya. Kuongeza ISO mara mbili (400 → 800) huangaza picha kwa stop moja bila kubadilisha aperture au shutter.',
    },
    task: { en: 'This room is dark. Raise the ISO until the meter reads 0.', sw: 'Chumba hiki ni cheusi. Ongeza ISO hadi kipimo kionyeshe 0.' },
    successFeedback: { en: 'Brightened with ISO alone. Look closely — some grain is appearing.', sw: 'Umeangaza kwa ISO pekee. Angalia kwa makini — chembechembe zinaanza kuonekana.' },
    retryFeedback: { en: 'Still dark — keep raising the ISO. Each doubling adds one stop of brightness.', sw: 'Bado giza — endelea kuongeza ISO. Kila mara mbili huongeza stop moja ya mwangaza.' },
    summary: { en: 'ISO brightens without more real light — amplification, not collection.', sw: 'ISO huangaza bila mwanga halisi zaidi — ni ukuzaji, si ukusanyaji.' },
    check: (c) => meterOk(c),
  },
  {
    id: 'iso-noise', sceneId: 'night-street', unlocked: ['iso', 'shutter'], startPatch: { aperture: 2.8, shutter: 1 / 500, iso: 25600 },
    title: { en: 'ISO and image noise', sw: 'ISO na kelele za picha' },
    explanation: {
      en: 'Amplification has a price: noise. High ISO makes the image grainy and eats fine detail. Good photographers use the lowest ISO that still lets them get the shot.',
      sw: 'Ukuzaji una gharama: kelele (noise). ISO ya juu hufanya picha kuwa na chembechembe na kupoteza maelezo madogo. Wapigapicha wazuri hutumia ISO ya chini kabisa inayowawezesha kupata picha.',
    },
    task: { en: 'Expose this night street correctly while keeping ISO at 6400 or below. A slower shutter can help.', sw: 'Pata mwangaza sahihi wa mtaa huu wa usiku huku ISO ikibaki 6400 au chini. Shutter ya polepole inaweza kusaidia.' },
    successFeedback: { en: 'Clean night shot! You traded shutter time for a lower, cleaner ISO.', sw: 'Picha safi ya usiku! Umebadilisha muda wa shutter kwa ISO ya chini na safi zaidi.' },
    retryFeedback: { en: 'Either the shot is dark or the ISO is very high and noisy. Slow the shutter to collect real light instead.', sw: 'Ama picha ni nyeusi au ISO iko juu sana na ina kelele. Punguza kasi ya shutter kukusanya mwanga halisi badala yake.' },
    summary: { en: 'Raise ISO last, and only as far as you must.', sw: 'Ongeza ISO mwishoni, na kwa kiwango unachohitaji tu.' },
    check: (c) => meterOk(c, 1) && c.settings.iso <= 6400,
  },
  {
    id: 'balancing', sceneId: 'street', unlocked: ['aperture', 'shutter', 'iso'], startPatch: { aperture: 16, shutter: 1 / 1000, iso: 3200 },
    title: { en: 'Balancing all three settings', sw: 'Kusawazisha mipangilio yote mitatu' },
    explanation: {
      en: 'Aperture, shutter and ISO form a triangle. Change one and you must rebalance with another. Each has a side effect: depth of field, motion blur, or noise. That trade is the creative decision.',
      sw: 'Aperture, shutter na ISO huunda pembetatu. Ukibadilisha kimoja, lazima usawazishe kwa kingine. Kila kimoja kina athari: kina cha picha, ukungu wa mwendo, au kelele. Ubadilishanaji huo ndio uamuzi wa kisanii.',
    },
    task: { en: 'Balance this street scene with ISO 800 or lower AND a shutter of 1/125 or faster.', sw: 'Sawazisha mtaa huu kwa ISO 800 au chini NA shutter ya 1/125 au zaidi.' },
    successFeedback: { en: 'A balanced exposure with low noise and no motion blur — you used all three controls together.', sw: 'Mwangaza uliosawazishwa wenye kelele kidogo na bila ukungu — umetumia vidhibiti vyote vitatu pamoja.' },
    retryFeedback: { en: 'Check each corner of the triangle: is the shutter fast enough? Is ISO low? Is the aperture doing the balancing?', sw: 'Kagua kila pembe ya pembetatu: shutter ina kasi ya kutosha? ISO iko chini? Aperture inasawazisha?' },
    summary: { en: 'Every exposure is a three-way trade. You choose what matters most.', sw: 'Kila mwangaza ni mabadilishano ya njia tatu. Wewe huchagua kipi ni muhimu zaidi.' },
    check: (c) => meterOk(c, 0.8) && c.settings.iso <= 800 && c.settings.shutter <= 1 / 125,
  },
  {
    id: 'stops', sceneId: 'landscape', unlocked: ['aperture', 'shutter', 'iso'], startPatch: { aperture: 8, shutter: 1 / 500, iso: 100 },
    title: { en: 'Understanding stops of light', sw: 'Kuelewa stops za mwanga' },
    explanation: {
      en: 'A "stop" is photography\'s unit of light: one stop = double or half. f/4→f/5.6 is −1 stop. 1/60→1/30 is +1 stop. ISO 200→400 is +1 stop. Stops let you trade settings evenly.',
      sw: 'Stop ni kipimo cha mwanga cha upigaji picha: stop moja = mara mbili au nusu. f/4→f/5.6 ni −1 stop. 1/60→1/30 ni +1 stop. ISO 200→400 ni +1 stop. Stops hukuwezesha kubadilishana mipangilio kwa usawa.',
    },
    task: { en: 'The scene is balanced at f/8, 1/500, ISO 100. Reach a balanced exposure at f/4 by trading exactly two stops elsewhere.', sw: 'Mandhari imesawazishwa kwa f/8, 1/500, ISO 100. Fikia mwangaza sawa kwa f/4 kwa kubadilisha stops mbili kamili kwingineko.' },
    successFeedback: { en: 'Perfect trade! Opening f/8→f/4 added two stops, and you removed two stops elsewhere to stay balanced.', sw: 'Mabadilishano kamili! Kufungua f/8→f/4 kuliongeza stops mbili, na umeondoa stops mbili kwingineko kubaki sawa.' },
    retryFeedback: { en: 'f/8 → f/4 adds two stops of light. Take two stops away with a faster shutter (or lower ISO).', sw: 'f/8 → f/4 huongeza stops mbili za mwanga. Ondoa stops mbili kwa shutter ya haraka (au ISO ya chini).' },
    summary: { en: 'Same total light, different look — that is the power of stops.', sw: 'Mwanga uleule, muonekano tofauti — hiyo ndiyo nguvu ya stops.' },
    check: (c) => meterOk(c, 0.5) && c.settings.aperture <= 4.2,
  },
  {
    id: 'meter', sceneId: 'backlit', unlocked: ['evComp', 'shutter', 'aperture', 'iso'],
    title: { en: 'Using the exposure meter', sw: 'Kutumia kipimo cha mwangaza' },
    explanation: {
      en: 'The meter suggests a "correct" exposure, but it can be fooled. A backlit subject often comes out as a silhouette because the bright sky pushes the meter down. Exposure compensation (+/−) tells the camera you know better.',
      sw: 'Kipimo hupendekeza mwangaza "sahihi", lakini kinaweza kudanganywa. Mtu mwenye mwanga nyuma mara nyingi hutokea kama kivuli kwa sababu anga angavu hushusha kipimo. Fidia ya mwangaza (+/−) humwambia kamera kuwa wewe unajua zaidi.',
    },
    task: { en: 'Brighten this backlit portrait: set exposure compensation to +1 or more, then balance the meter.', sw: 'Angaza picha hii yenye mwanga nyuma: weka fidia ya mwangaza +1 au zaidi, kisha sawazisha kipimo.' },
    successFeedback: { en: 'The face is now visible against the bright sky. You overruled the meter on purpose.', sw: 'Sasa uso unaonekana dhidi ya anga angavu. Umekipinga kipimo kwa makusudi.' },
    retryFeedback: { en: 'Push exposure compensation up (+) and rebalance. The subject should brighten against the sky.', sw: 'Ongeza fidia ya mwangaza (+) kisha sawazisha tena. Mhusika anapaswa kung\'aa dhidi ya anga.' },
    summary: { en: 'The meter is a guide, not a law. Compensation is how you take charge.', sw: 'Kipimo ni mwongozo, si sheria. Fidia ndiyo njia ya kuchukua uamuzi.' },
    check: (c) => c.settings.evComp >= 1 && Math.abs(meterReading(c.sceneEV100, c.settings)) <= 0.7,
  },
  {
    id: 'histogram', sceneId: 'night-street', unlocked: ['aperture', 'shutter', 'iso'], startPatch: { aperture: 2.8, shutter: 1 / 60, iso: 400 },
    title: { en: 'Reading a histogram', sw: 'Kusoma histogramu' },
    explanation: {
      en: 'A histogram is a bar chart of brightness: shadows on the left, highlights on the right. Bars slammed against the left edge mean crushed shadows; against the right edge, blown highlights. A night scene should lean left — but not fall off it.',
      sw: 'Histogramu ni chati ya mwangaza: vivuli kushoto, mwanga mkali kulia. Michirizi iliyobanwa ukingo wa kushoto humaanisha vivuli vilivyopotea; upande wa kulia, mwanga uliopotea. Mandhari ya usiku inapaswa kuegemea kushoto — lakini isianguke nje yake.',
    },
    task: { en: 'Expose the night street so the meter is within ±1 stop and the histogram is not clipped hard at either edge.', sw: 'Weka mwangaza wa mtaa wa usiku ili kipimo kiwe ndani ya ±1 stop na histogramu isibanwe kwenye kingo.' },
    successFeedback: { en: 'A healthy night histogram: dark tones dominate but detail survives at both ends.', sw: 'Histogramu nzuri ya usiku: rangi nyeusi zinaongoza lakini maelezo yamebaki pande zote.' },
    retryFeedback: { en: 'Watch the clipping warnings. Pull exposure back from whichever edge is flashing.', sw: 'Angalia tahadhari za kubanwa. Rudisha mwangaza kutoka ukingo unaowaka.' },
    summary: { en: 'Trust the histogram over the screen — it never lies about clipping.', sw: 'Amini histogramu kuliko skrini — haidanganyi kuhusu mwanga uliopotea.' },
    check: (c) => Math.abs(meterReading(c.sceneEV100, c.settings)) <= 1,
  },
  {
    id: 'white-balance', sceneId: 'food', unlocked: ['whiteBalance'], startPatch: { whiteBalance: 'shade' },
    title: { en: 'White balance: the colour of light', sw: 'Usawa wa weupe: rangi ya mwanga' },
    explanation: {
      en: 'Light has a colour. Household bulbs are orange, midday sun is neutral, and shade is blue. Our eyes adjust without us noticing, but the camera needs to be told. White balance tells it what colour of light to expect so that white things look white. Colour temperature is measured in Kelvin (K): low numbers are warm, high numbers are cool.',
      sw: 'Mwanga una rangi. Taa za nyumbani ni za rangi ya machungwa, jua la mchana halina upande, na kivuli ni cha buluu. Macho yetu hujirekebisha bila sisi kujua, lakini kamera lazima iambiwe. Usawa wa weupe huiambia kamera rangi gani ya mwanga itarajie ili vitu vyeupe vionekane vyeupe. Joto la rangi hupimwa kwa Kelvin (K): namba ndogo ni za joto, namba kubwa ni baridi.',
    },
    task: {
      en: 'This meal is lit by warm restaurant bulbs and the camera is set to Shade, so everything looks orange. Change the white balance until the plate looks white.',
      sw: 'Chakula hiki kinamulikwa na taa za joto za mgahawa na kamera imewekwa kwa Kivuli, kwa hiyo kila kitu kinaonekana cha machungwa. Badilisha usawa wa weupe hadi sahani ionekane nyeupe.',
    },
    successFeedback: {
      en: 'Neutral! The setting now matches the warm light, so the camera cancels the orange and the plate looks white.',
      sw: 'Sawa kabisa! Mpangilio sasa unalingana na mwanga wa joto, kwa hiyo kamera inaondoa rangi ya machungwa na sahani inaonekana nyeupe.',
    },
    retryFeedback: {
      en: 'Still a cast. Bulbs are warm (about 3300K): choose Tungsten, or Custom with a low Kelvin value. Auto keeps a little warmth on purpose.',
      sw: 'Bado kuna rangi. Taa ni za joto (karibu 3300K): chagua Taa ya ndani, au Maalum na thamani ndogo ya Kelvin. Otomatiki huacha joto kidogo kwa makusudi.',
    },
    summary: {
      en: 'Match the white balance to the light for true colours, or mismatch it on purpose to warm up or cool down a mood.',
      sw: 'Linganisha usawa wa weupe na mwanga kupata rangi halisi, au usiulinganishe kwa makusudi ili kuongeza joto au ubaridi wa hisia.',
    },
    check: (c) => {
      const light = sceneById('food').light;
      const shift = whiteBalanceShift(light, cameraWhiteBalance(c.settings.whiteBalance, c.settings.wbKelvin, light));
      return Math.abs(shift.mired) <= 20 && Math.abs(shift.tint) <= 0.15;
    },
  },
  {
    id: 'creative', sceneId: 'cyclist', unlocked: ['aperture', 'shutter', 'iso', 'focalMm', 'focusDistM'], startPatch: { aperture: 5.6, shutter: 1 / 125, iso: 100 },
    title: { en: 'Choosing settings creatively', sw: 'Kuchagua mipangilio kisanii' },
    explanation: {
      en: 'There is no single right answer. Freeze the cyclist at 1/1000, or pan at 1/30 for speed streaks — both are correct if they match your intention. From now on, you decide what the picture should feel like.',
      sw: 'Hakuna jibu moja sahihi. Msimamishe mwendesha baiskeli kwa 1/1000, au fuata mwendo kwa 1/30 kupata michirizi ya kasi — yote ni sahihi yakilingana na nia yako. Kuanzia sasa, wewe huamua picha ijisikieje.',
    },
    task: { en: 'Make a deliberate choice: either freeze the cyclist (1/500+) or show speed with motion blur (1/60 or slower). Keep the exposure within ±1 stop.', sw: 'Fanya uamuzi wa makusudi: msimamishe mwendeshaji (1/500+) au onyesha kasi kwa ukungu (1/60 au polepole). Mwangaza ubaki ndani ya ±1 stop.' },
    successFeedback: { en: 'A clear creative decision, well exposed. You are no longer guessing — you are choosing.', sw: 'Uamuzi wa kisanii ulio wazi, wenye mwangaza mzuri. Hukisii tena — unachagua.' },
    retryFeedback: { en: 'Commit to one look: very fast shutter to freeze, or slow shutter to blur. Then balance the light.', sw: 'Amua muonekano mmoja: shutter ya haraka sana kusimamisha, au ya polepole kufifisha. Kisha sawazisha mwanga.' },
    summary: { en: 'Three controls. One creative decision. That is the whole craft.', sw: 'Vidhibiti vitatu. Uamuzi mmoja wa kisanii. Huo ndio ufundi wote.' },
    check: (c) =>
      Math.abs(meterReading(c.sceneEV100, c.settings)) <= 1 &&
      (c.settings.shutter <= 1 / 500 ||
        subjectBlurPx(c.subjectSpeedPxPerS, c.settings.shutter) > 8),
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** Convenience used by lesson pages to build a check context. */
export function lessonContext(lesson: Lesson, settings: ExposureSettings): LessonCheckContext {
  const scene = sceneById(lesson.sceneId);
  return { settings, sceneEV100: scene.ev100, subjectSpeedPxPerS: scene.subjectSpeedPxPerS };
}

export const LESSON_SENSOR = FULL_FRAME;

/** Depth-of-field helper used in lesson demo text. */
export function lessonDof(settings: ExposureSettings) {
  return depthOfField(settings.focalMm, settings.aperture, settings.focusDistM, FULL_FRAME);
}

export function lessonNoise(iso: number): number {
  return noiseAmount(iso);
}
