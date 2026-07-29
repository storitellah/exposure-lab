/** Glossary / Definitions panel with simple and advanced explanations. */
import { useState } from 'react';
import { useI18n } from '../i18n';

interface Entry {
  term: { en: string; sw: string };
  simple: { en: string; sw: string };
  advanced: { en: string; sw: string };
}

const ENTRIES: Entry[] = [
  { term: { en: 'Stop of light', sw: 'Stop ya mwanga' },
    simple: { en: 'One stop = double or half the light.', sw: 'Stop moja = mwanga mara mbili au nusu.' },
    advanced: { en: 'A stop is a factor of 2 in exposure. Aperture stops follow √2 (f/2, f/2.8, f/4…), shutter and ISO double directly. Stops let you trade one control for another with no change in total brightness.', sw: 'Stop ni kipimo cha mara 2 katika mwangaza. Stops za aperture hufuata √2 (f/2, f/2.8, f/4…), shutter na ISO huongezeka mara mbili moja kwa moja.' } },
  { term: { en: 'Reciprocal shutter rule', sw: 'Kanuni ya shutter dhidi ya urefu wa lenzi' },
    simple: { en: 'Handheld, keep the shutter faster than 1/focal length.', sw: 'Bila tripodi, shutter iwe haraka kuliko 1/urefu wa lenzi.' },
    advanced: { en: 'At 50mm (full-frame equivalent) shoot 1/50 or faster to avoid shake blur. Stabilisation buys roughly 3–5 extra stops of slowness.', sw: 'Kwa 50mm, piga kwa 1/50 au haraka zaidi kuepuka mtikisiko. Utulizaji huongeza takriban stops 3–5.' } },
  { term: { en: 'Depth of field', sw: 'Kina cha picha' },
    simple: { en: 'How much of the scene is sharp, front to back.', sw: 'Kiasi gani cha mandhari kiko wazi, mbele hadi nyuma.' },
    advanced: { en: 'Controlled by aperture, focal length, focus distance and sensor size. Near/far limits come from the hyperfocal distance H = f²/(N·c) + f, with c the circle of confusion (sensor diagonal / 1500).', sw: 'Hudhibitiwa na aperture, urefu wa lenzi, umbali wa focus na ukubwa wa sensa. H = f²/(N·c) + f.' } },
  { term: { en: 'Camera shake', sw: 'Mtikisiko wa kamera' },
    simple: { en: 'Blur from your own hands moving during the exposure.', sw: 'Ukungu unaotokana na mikono yako kutikisika wakati wa kupiga.' },
    advanced: { en: 'Shake blur grows with exposure time and focal length. Fixes: faster shutter, stabilisation, bracing, or a tripod.', sw: 'Huongezeka kwa muda wa shutter na urefu wa lenzi. Suluhisho: shutter ya haraka, utulizaji, au tripodi.' } },
  { term: { en: 'Motion blur', sw: 'Ukungu wa mwendo' },
    simple: { en: 'Moving subjects smear while the shutter is open.', sw: 'Vitu vinavyotembea hufifia shutter ikiwa wazi.' },
    advanced: { en: 'Blur length = subject speed × exposure time. It can be a flaw (accidental) or a tool (panning, light trails, silky water).', sw: 'Urefu wa ukungu = kasi ya kitu × muda wa mwangaza. Unaweza kuwa kasoro au zana ya kisanii.' } },
  { term: { en: 'ISO noise', sw: 'Kelele za ISO' },
    simple: { en: 'Grainy speckles that appear at high ISO.', sw: 'Chembechembe zinazoonekana kwa ISO ya juu.' },
    advanced: { en: 'Amplifying a weak signal amplifies its randomness too. Larger sensors and newer designs stay cleaner; noise reduction trades grain for smeared detail.', sw: 'Kukuza ishara dhaifu hukuza pia mchafuko wake. Sensa kubwa hubaki safi zaidi.' } },
  { term: { en: 'Dynamic range', sw: 'Wigo wa mwangaza' },
    simple: { en: 'How much bright-to-dark detail one photo can hold.', sw: 'Kiasi cha maelezo kutoka mwanga hadi giza picha moja inaweza kubeba.' },
    advanced: { en: 'Measured in stops between clipped white and unusable shadow. It shrinks as ISO rises; log profiles preserve more of it for grading.', sw: 'Hupimwa kwa stops kati ya weupe uliopotea na kivuli kisichotumika. Hupungua ISO inapoongezeka.' } },
  { term: { en: 'Focal length & crop factor', sw: 'Urefu wa lenzi na kipimo cha crop' },
    simple: { en: 'Longer lenses magnify; smaller sensors crop the view.', sw: 'Lenzi ndefu hukuza; sensa ndogo hupunguza mwonekano.' },
    advanced: { en: 'Equivalent focal length = focal × crop factor. A 25mm lens on Micro Four Thirds (2×) frames like a 50mm on full frame.', sw: 'Urefu-lingani = urefu × kipimo cha crop. Lenzi ya 25mm kwenye MFT (2×) huonyesha kama 50mm kwenye full frame.' } },
  { term: { en: 'Exposure compensation', sw: 'Fidia ya mwangaza' },
    simple: { en: 'Tell the camera: brighter (+) or darker (−) than it thinks.', sw: 'Mwambie kamera: angavu zaidi (+) au nyeusi zaidi (−) kuliko inavyofikiri.' },
    advanced: { en: 'Shifts the metering target in auto and semi-auto modes. Essential for backlit subjects, snow, and deliberately dark scenes.', sw: 'Huhamisha lengo la upimaji katika hali za otomatiki. Muhimu kwa mwanga wa nyuma na theluji.' } },
  { term: { en: 'Histogram & clipping', sw: 'Histogramu na kupotea kwa mwanga' },
    simple: { en: 'A brightness chart: left = shadows, right = highlights.', sw: 'Chati ya mwangaza: kushoto = vivuli, kulia = mwanga mkali.' },
    advanced: { en: 'Pixels pushed past either edge are clipped: pure black (crushed shadows) or pure white (blown highlights) with no recoverable detail.', sw: 'Pikseli zilizovuka kingo zimepotea: nyeusi kabisa au nyeupe kabisa bila maelezo yanayorejesheka.' } },
  { term: { en: 'White balance', sw: 'Usawa wa weupe' },
    simple: { en: 'Makes white things look white under any light.', sw: 'Hufanya vitu vyeupe vionekane vyeupe chini ya mwanga wowote.' },
    advanced: { en: 'Light sources have colour temperature (warm tungsten ≈ 3200K, daylight ≈ 5600K, shade ≈ 7500K). WB compensates, or is used creatively to warm/cool a scene.', sw: 'Vyanzo vya mwanga vina joto la rangi (tungsten ≈ 3200K, mchana ≈ 5600K). WB hurekebisha au hutumika kisanii.' } },
  { term: { en: 'Neutral density (ND) filter', sw: 'Kichujio cha ND' },
    simple: { en: 'Sunglasses for your lens — cuts light without changing colour.', sw: 'Miwani ya jua ya lenzi yako — hupunguza mwanga bila kubadilisha rangi.' },
    advanced: { en: 'Rated in stops (ND8 = 3 stops). Enables slow shutters in daylight (waterfalls, motion blur) and wide apertures for video at the 180° rule.', sw: 'Hupimwa kwa stops (ND8 = 3). Huwezesha shutter za polepole mchana na aperture pana kwenye video.' } },
  { term: { en: 'Flash synchronisation', sw: 'Usawazishaji wa flashi' },
    simple: { en: 'The fastest shutter speed that works with flash.', sw: 'Kasi ya juu ya shutter inayofanya kazi na flashi.' },
    advanced: { en: 'Above the sync speed (often 1/200–1/250) the shutter curtains never fully open, so the flash lights only a slice of the frame.', sw: 'Zaidi ya kasi ya usawazishaji (mara nyingi 1/200–1/250) mapazia ya shutter hayafunguki kikamilifu.' } },
  { term: { en: 'Shutter angle', sw: 'Pembe ya shutter' },
    simple: { en: 'Video shutter written as part of a spinning circle: 180° looks natural.', sw: 'Shutter ya video kama sehemu ya duara linalozunguka: 180° huonekana asili.' },
    advanced: { en: 'Exposure time = angle ÷ (360 × fps). 180° at 24 fps = 1/48s. Smaller angles look staccato (crisp), larger angles smear.', sw: 'Muda wa mwangaza = pembe ÷ (360 × fps). 180° kwa 24 fps = 1/48s.' } },
  { term: { en: 'T-stop', sw: 'T-stop' },
    simple: { en: 'A cine lens\'s true measured brightness.', sw: 'Mwangaza halisi uliopimwa wa lenzi ya sinema.' },
    advanced: { en: 'f-stops are geometry; T-stops measure actual transmitted light including glass losses. Cinema lenses use T-stops so exposure matches across lenses.', sw: 'f-stops ni jiometri; T-stops hupima mwanga halisi unaopita. Lenzi za sinema hutumia T-stops.' } },
  { term: { en: 'Log video', sw: 'Video ya Log' },
    simple: { en: 'A flat-looking recording that keeps extra detail for editing.', sw: 'Rekodi inayoonekana hafifu inayohifadhi maelezo ya ziada kwa uhariri.' },
    advanced: { en: 'Log curves compress a wide dynamic range into the recorded file. Footage looks washed out until graded, but keeps highlight and shadow detail.', sw: 'Mikunjo ya Log hubana wigo mpana wa mwangaza kwenye faili. Picha huonekana hafifu hadi irekebishwe.' } },
];

export default function Glossary() {
  const { t, pick } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = ENTRIES.filter((e) => !query || pick(e.term).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="content-page">
      <h1>{t('navGlossary')}</h1>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          type="search"
          aria-label={t('navGlossary')}
          placeholder="…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          Advanced explanations
        </label>
      </div>
      <dl>
        {filtered.map((e) => (
          <div key={e.term.en} className="card" style={{ marginBottom: '0.6rem' }}>
            <dt><strong>{pick(e.term)}</strong></dt>
            <dd style={{ margin: '0.2rem 0 0' }}>{pick(advanced ? e.advanced : e.simple)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
