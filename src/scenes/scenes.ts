/**
 * Scene definitions. Every scene is an original layered illustration with a
 * light level (EV at ISO 100), subject distance and movement information so
 * the exposure engine can simulate brightness, depth of field, motion blur,
 * noise and light trails.
 */
import {
  type Ctx, REF_W, REF_H, skyGradient, ground, sun, mountains, building, tree,
  person, ball, bicycle, car, bird, waterfall, streetlamp, window_, marketStall,
  stageLight, plate, mulberry32,
} from './primitives';
import { ISOS, nearest, type ExposureSettings } from '../engine/settings';
import { solveIso } from '../engine/exposure';

export interface SceneLayer {
  /** Distance from the camera in metres — drives depth-of-field blur. */
  distanceM: number;
  /** Movement in reference px/second — drives motion blur and trails. */
  speed: { x: number; y: number };
  /** Emissive layer: bright points that clip and leave light trails. */
  lights?: boolean;
  draw: (ctx: Ctx) => void;
}

export interface SceneDef {
  id: string;
  en: string;
  sw: string;
  /** Scene light level: EV at ISO 100. Sunny ≈ 15, night street ≈ 4. */
  ev100: number;
  subjectDistM: number;
  subjectSpeedPxPerS: number;
  /**
   * Starting aperture and shutter chosen for the scene's creative intent
   * (sports get a fast shutter, portraits a wide aperture). The ISO that
   * balances the exposure is solved from these — see `startSettingsFor`.
   */
  start: { aperture: number; shutter: number };
  /** True for scenes intended for the video simulator too. */
  video?: boolean;
  layers: SceneLayer[];
}

const SKIN = { deep: '#5C3A21', dark: '#8D5524', medium: '#C68642', tan: '#E0AC69', light: '#F1C27D' };

function grass(ctx: Ctx, colour = '#5B8C4A'): void { ground(ctx, colour); }

export const SCENES: SceneDef[] = [
  {
    id: 'outdoor-portrait', en: 'Outdoor portrait', sw: 'Picha ya nje ya mtu', ev100: 14,
    subjectDistM: 2.5, subjectSpeedPxPerS: 0, start: { aperture: 2.8, shutter: 1 / 2000 },
    layers: [
      { distanceM: 4000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#8FC7EB', '#DCEEF7'); sun(c, 660, 90, 34); } },
      { distanceM: 60, speed: { x: 0, y: 0 }, draw: (c) => { grass(c); mountains(c, '#7FA96B', REF_H * 0.62, 11); tree(c, 120, 340, 190); tree(c, 690, 330, 150); } },
      { distanceM: 12, speed: { x: 0, y: 0 }, draw: (c) => { tree(c, 560, 430, 240, '#4A7C42'); } },
      { distanceM: 2.5, speed: { x: 0, y: 0 }, draw: (c) => person(c, 390, 470, 330, { skin: SKIN.dark, top: '#FBB03B', bottom: '#33415C', hair: '#141414' }) },
    ],
  },
  {
    id: 'window-portrait', en: 'Indoor portrait near a window', sw: 'Picha ya ndani karibu na dirisha', ev100: 8,
    subjectDistM: 1.8, subjectSpeedPxPerS: 0, start: { aperture: 2.8, shutter: 1 / 60 },
    layers: [
      { distanceM: 8, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#4A3F35'; c.fillRect(0, 0, REF_W, REF_H); c.fillStyle = '#3A322A'; c.fillRect(0, REF_H * 0.75, REF_W, REF_H * 0.25); } },
      { distanceM: 3, speed: { x: 0, y: 0 }, lights: true, draw: (c) => window_(c, 520, 60, 200, 260) },
      { distanceM: 1.8, speed: { x: 0, y: 0 }, draw: (c) => person(c, 320, 470, 340, { skin: SKIN.deep, top: '#F3F1EC', bottom: '#5B4A6B', hair: '#0e0e0e' }) },
    ],
  },
  {
    id: 'street', en: 'Street photography', sw: 'Upigaji picha mtaani', ev100: 13,
    subjectDistM: 6, subjectSpeedPxPerS: 90, start: { aperture: 8, shutter: 1 / 250 },
    layers: [
      { distanceM: 2000, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#A8CFE8', '#E8F0F2') },
      { distanceM: 80, speed: { x: 0, y: 0 }, draw: (c) => { building(c, 0, 320, 150, 260, '#8A7F76', 'rgba(210,220,230,0.7)', 0.35, 4); building(c, 170, 320, 120, 200, '#A39485', 'rgba(210,220,230,0.7)', 0.3, 9); building(c, 640, 320, 160, 240, '#7C7268', 'rgba(210,220,230,0.7)', 0.4, 6); ground(c, '#9A938B', 0.64); } },
      { distanceM: 15, speed: { x: -35, y: 0 }, draw: (c) => person(c, 620, 400, 130, { skin: SKIN.tan, top: '#3C82F6', bottom: '#2b2b2b' }) },
      { distanceM: 6, speed: { x: 90, y: 0 }, draw: (c) => person(c, 330, 460, 240, { skin: SKIN.medium, top: '#C63C3C', bottom: '#33415C', pose: 'run', facing: 1 }) },
    ],
  },
  {
    id: 'football', en: 'Football sprint', sw: 'Mchezaji wa mpira akikimbia', ev100: 14,
    subjectDistM: 12, subjectSpeedPxPerS: 420, start: { aperture: 4, shutter: 1 / 1000 }, video: true,
    layers: [
      { distanceM: 3000, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#9CD0EE', '#E4F2F8') },
      { distanceM: 120, speed: { x: 0, y: 0 }, draw: (c) => { grass(c, '#4E8A3F'); c.fillStyle = '#E9E7DE'; c.fillRect(0, REF_H * 0.6, REF_W, 4); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(60, 250, 8, 70); c.fillRect(60, 250, 180, 8); } },
      { distanceM: 25, speed: { x: 0, y: 0 }, draw: (c) => { person(c, 700, 350, 110, { skin: SKIN.light, top: '#F3F1EC', bottom: '#2b2b2b' }); person(c, 90, 355, 105, { skin: SKIN.deep, top: '#2E9B62', bottom: '#F3F1EC' }); } },
      { distanceM: 12, speed: { x: 420, y: 0 }, draw: (c) => { person(c, 380, 450, 230, { skin: SKIN.dark, top: '#FBB03B', bottom: '#171717', pose: 'run' }); ball(c, 470, 440, 26); } },
    ],
  },
  {
    id: 'cyclist', en: 'Cyclist in motion', sw: 'Mwendesha baiskeli', ev100: 13,
    subjectDistM: 8, subjectSpeedPxPerS: 300, start: { aperture: 5.6, shutter: 1 / 500 }, video: true,
    layers: [
      { distanceM: 2000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#F7C873', '#FBE4B8', 0.6); sun(c, 130, 120, 40, '#FBD98A'); } },
      { distanceM: 100, speed: { x: 0, y: 0 }, draw: (c) => { mountains(c, '#B08968', REF_H * 0.6, 5); ground(c, '#8D826F', 0.6); c.fillStyle = '#6E655A'; c.fillRect(0, REF_H * 0.78, REF_W, REF_H * 0.1); } },
      { distanceM: 8, speed: { x: 300, y: 0 }, draw: (c) => { bicycle(c, 380, 445, 170); person(c, 372, 405, 190, { skin: SKIN.medium, top: '#3C82F6', bottom: '#171717', pose: 'ride' }); } },
    ],
  },
  {
    id: 'market', en: 'Busy market', sw: 'Soko lenye shughuli nyingi', ev100: 12,
    subjectDistM: 5, subjectSpeedPxPerS: 60, start: { aperture: 5.6, shutter: 1 / 250 },
    layers: [
      { distanceM: 500, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#BFE0EE', '#F1EDDF', 0.5) },
      { distanceM: 40, speed: { x: 0, y: 0 }, draw: (c) => { ground(c, '#B49A72', 0.5); marketStall(c, 150, 330, 200, '#C63C3C', 5); marketStall(c, 650, 330, 200, '#2E9B62', 8); } },
      { distanceM: 12, speed: { x: -40, y: 0 }, draw: (c) => { person(c, 590, 420, 170, { skin: SKIN.deep, top: '#F2D24B', bottom: '#6B4A2F', facing: -1 }); person(c, 130, 425, 175, { skin: SKIN.dark, top: '#8E4EC6', bottom: '#33415C' }); } },
      { distanceM: 5, speed: { x: 60, y: 0 }, draw: (c) => { marketStall(c, 400, 490, 300, '#FBB03B', 12); person(c, 250, 500, 260, { skin: SKIN.medium, top: '#2E9B62', bottom: '#171717' }); } },
    ],
  },
  {
    id: 'classroom', en: 'Classroom', sw: 'Darasani', ev100: 7,
    subjectDistM: 3.5, subjectSpeedPxPerS: 20, start: { aperture: 2.8, shutter: 1 / 125 },
    layers: [
      { distanceM: 10, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#5B6B5E'; c.fillRect(0, 0, REF_W, REF_H); c.fillStyle = '#274E33'; c.fillRect(120, 60, 380, 180); c.strokeStyle = '#C9B98A'; c.lineWidth = 8; c.strokeRect(120, 60, 380, 180); c.fillStyle = '#3A4440'; c.fillRect(0, REF_H * 0.72, REF_W, REF_H * 0.28); } },
      { distanceM: 6, speed: { x: 0, y: 0 }, lights: true, draw: (c) => window_(c, 600, 70, 150, 190, '#EAF4E7') },
      { distanceM: 3.5, speed: { x: 20, y: 0 }, draw: (c) => { person(c, 300, 480, 250, { skin: SKIN.dark, top: '#3C82F6', bottom: '#33415C' }); c.fillStyle = '#7A5A3A'; c.fillRect(80, 420, 240, 20); } },
    ],
  },
  {
    id: 'landscape', en: 'Landscape', sw: 'Mandhari', ev100: 15,
    subjectDistM: 40, subjectSpeedPxPerS: 0, start: { aperture: 11, shutter: 1 / 250 },
    layers: [
      { distanceM: 10000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#8FC7EB', '#EAF4F8', 0.55); sun(c, 620, 90, 30); } },
      { distanceM: 3000, speed: { x: 0, y: 0 }, draw: (c) => mountains(c, '#8FA6B5', REF_H * 0.55, 3) },
      { distanceM: 400, speed: { x: 0, y: 0 }, draw: (c) => { mountains(c, '#6E8F5E', REF_H * 0.62, 9); ground(c, '#79A05F', 0.62); } },
      { distanceM: 40, speed: { x: 0, y: 0 }, draw: (c) => { tree(c, 620, 420, 200); c.fillStyle = '#8A7A5A'; c.fillRect(0, 470, REF_W, 8); } },
      { distanceM: 4, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#5B8C4A'; c.beginPath(); c.ellipse(120, 510, 220, 60, 0, 0, Math.PI * 2); c.fill(); tree(c, 90, 500, 130, '#3E7C4F'); } },
    ],
  },
  {
    id: 'night-street', en: 'Night street', sw: 'Mtaa usiku', ev100: 4,
    subjectDistM: 10, subjectSpeedPxPerS: 40, start: { aperture: 2.8, shutter: 1 / 60 }, video: true,
    layers: [
      { distanceM: 2000, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#101423', '#232B45') },
      { distanceM: 90, speed: { x: 0, y: 0 }, draw: (c) => { building(c, 20, 340, 160, 280, '#1B2233', 'rgba(255,224,140,0.9)', 0.5, 2); building(c, 620, 340, 170, 300, '#161C2B', 'rgba(255,224,140,0.9)', 0.45, 7); ground(c, '#20242E', 0.68); } },
      { distanceM: 20, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { streetlamp(c, 240, 420, 180); streetlamp(c, 560, 420, 180); } },
      { distanceM: 10, speed: { x: 40, y: 0 }, draw: (c) => person(c, 400, 455, 200, { skin: SKIN.deep, top: '#B8C0CC', bottom: '#33415C' }) },
    ],
  },
  {
    id: 'concert', en: 'Concert', sw: 'Tamasha la muziki', ev100: 5,
    subjectDistM: 15, subjectSpeedPxPerS: 120, start: { aperture: 2.8, shutter: 1 / 125 }, video: true,
    layers: [
      { distanceM: 60, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#12101C'; c.fillRect(0, 0, REF_W, REF_H); } },
      { distanceM: 30, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { stageLight(c, 200, 0, 0.35, 'rgba(60,130,246,0.5)'); stageLight(c, 600, 0, -0.35, 'rgba(251,176,59,0.5)'); stageLight(c, 400, 0, 0, 'rgba(198,60,188,0.4)'); } },
      { distanceM: 15, speed: { x: 120, y: 0 }, draw: (c) => { c.fillStyle = '#241F33'; c.fillRect(120, 350, 560, 60); person(c, 400, 355, 220, { skin: SKIN.dark, top: '#FBB03B', bottom: '#171717', pose: 'run' }); } },
      { distanceM: 5, speed: { x: 20, y: 0 }, draw: (c) => { c.fillStyle = '#0B0A12'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(40 + i * 68, 500, 34, Math.PI, 0); c.fill(); } } },
    ],
  },
  {
    id: 'wildlife', en: 'Wildlife', sw: 'Wanyamapori', ev100: 13,
    subjectDistM: 60, subjectSpeedPxPerS: 100, start: { aperture: 5.6, shutter: 1 / 500 },
    layers: [
      { distanceM: 8000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#F3C77B', '#FAE7C0', 0.58); sun(c, 680, 110, 44, '#F7B554'); } },
      { distanceM: 1000, speed: { x: 0, y: 0 }, draw: (c) => { mountains(c, '#B98A54', REF_H * 0.58, 8); ground(c, '#C9A868', 0.58); } },
      { distanceM: 150, speed: { x: 0, y: 0 }, draw: (c) => { tree(c, 130, 330, 170, '#6B7F3E'); tree(c, 700, 340, 140, '#6B7F3E'); } },
      { distanceM: 60, speed: { x: 100, y: 0 }, draw: (c) => { // stylised antelope
        c.strokeStyle = '#7A5230'; c.fillStyle = '#9A6B3F'; c.lineWidth = 8; c.lineCap = 'round';
        c.beginPath(); c.ellipse(400, 400, 65, 32, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(345, 415); c.lineTo(330, 465); c.moveTo(375, 418); c.lineTo(372, 468); c.moveTo(430, 418); c.lineTo(438, 468); c.moveTo(455, 412); c.lineTo(470, 460); c.stroke();
        c.beginPath(); c.moveTo(455, 385); c.lineTo(495, 355); c.stroke();
        c.fillStyle = '#8A5E36'; c.beginPath(); c.arc(505, 348, 16, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#4A3520'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(500, 335); c.lineTo(492, 310); c.moveTo(512, 335); c.lineTo(520, 310); c.stroke();
      } },
    ],
  },
  {
    id: 'bird-flight', en: 'Bird in flight', sw: 'Ndege akiruka', ev100: 14,
    subjectDistM: 30, subjectSpeedPxPerS: 500, start: { aperture: 5.6, shutter: 1 / 2000 },
    layers: [
      { distanceM: 8000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#7FB8E0', '#D5EAF6', 0.85); sun(c, 140, 100, 30); } },
      { distanceM: 300, speed: { x: 0, y: 0 }, draw: (c) => { ground(c, '#7FA96B', 0.85); tree(c, 700, 470, 180); } },
      { distanceM: 30, speed: { x: 500, y: -40 }, draw: (c) => bird(c, 380, 200, 90) },
    ],
  },
  {
    id: 'waterfall', en: 'Waterfall', sw: 'Maporomoko ya maji', ev100: 12,
    subjectDistM: 20, subjectSpeedPxPerS: 260, start: { aperture: 8, shutter: 1 / 125 }, video: true,
    layers: [
      { distanceM: 1000, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#A5CBDD', '#E1EFF3', 0.4) },
      { distanceM: 80, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#5E7A52'; c.fillRect(0, REF_H * 0.4, 260, REF_H * 0.6); c.fillRect(540, REF_H * 0.4, 260, REF_H * 0.6); tree(c, 120, 320, 160, '#43663B'); tree(c, 680, 330, 150, '#43663B'); } },
      { distanceM: 20, speed: { x: 0, y: 260 }, lights: true, draw: (c) => waterfall(c, 270, REF_H * 0.32, 260, REF_H * 0.5) },
      { distanceM: 12, speed: { x: 30, y: 0 }, draw: (c) => { c.fillStyle = '#6D9DB8'; c.fillRect(0, REF_H * 0.82, REF_W, REF_H * 0.18); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(250, REF_H * 0.82, 300, 10); } },
    ],
  },
  {
    id: 'moving-vehicle', en: 'Moving vehicle', sw: 'Gari likitembea', ev100: 12,
    subjectDistM: 15, subjectSpeedPxPerS: 480, start: { aperture: 5.6, shutter: 1 / 250 }, video: true,
    layers: [
      { distanceM: 2000, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#B8D8E8', '#EDF3F0', 0.55) },
      { distanceM: 200, speed: { x: 0, y: 0 }, draw: (c) => { building(c, 60, 275, 130, 190, '#93867B', 'rgba(220,228,235,0.8)', 0.3, 12); building(c, 560, 275, 180, 210, '#7E736A', 'rgba(220,228,235,0.8)', 0.35, 15); ground(c, '#8B8B8B', 0.55); c.fillStyle = '#6E6E6E'; c.fillRect(0, REF_H * 0.66, REF_W, REF_H * 0.2); c.fillStyle = '#F2D24B'; for (let i = 0; i < 9; i++) c.fillRect(i * 100, REF_H * 0.755, 46, 6); } },
      { distanceM: 15, speed: { x: 480, y: 0 }, lights: true, draw: (c) => car(c, 400, 435, 260, '#C63C3C') },
    ],
  },
  {
    id: 'backlit', en: 'Backlit subject', sw: 'Mtu mwenye mwanga nyuma', ev100: 13,
    subjectDistM: 3, subjectSpeedPxPerS: 0, start: { aperture: 4, shutter: 1 / 1000 },
    layers: [
      { distanceM: 9000, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { skyGradient(c, '#F7B36A', '#FBE3B8', 0.7); sun(c, 400, 210, 62, '#FFF0C0'); } },
      { distanceM: 600, speed: { x: 0, y: 0 }, draw: (c) => { ground(c, '#B58B5A', 0.7); mountains(c, '#C9995F', REF_H * 0.7, 14); } },
      { distanceM: 3, speed: { x: 0, y: 0 }, draw: (c) => person(c, 400, 490, 350, { skin: '#3B2A1E', top: '#4A3B32', bottom: '#33302B', hair: '#141210' }) },
    ],
  },
  {
    id: 'low-light-interior', en: 'Low-light interior', sw: 'Chumba chenye mwanga hafifu', ev100: 5,
    subjectDistM: 2.5, subjectSpeedPxPerS: 10, start: { aperture: 2.8, shutter: 1 / 60 },
    layers: [
      { distanceM: 8, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#2A2320'; c.fillRect(0, 0, REF_W, REF_H); c.fillStyle = '#1F1A17'; c.fillRect(0, REF_H * 0.74, REF_W, REF_H * 0.26); } },
      { distanceM: 4, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { const g = c.createRadialGradient(560, 200, 8, 560, 200, 120); g.addColorStop(0, 'rgba(255,214,140,0.95)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.fillRect(430, 80, 260, 260); c.fillStyle = '#E8C27A'; c.beginPath(); c.arc(560, 200, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5A4A3A'; c.lineWidth = 5; c.beginPath(); c.moveTo(560, 80); c.lineTo(560, 188); c.stroke(); } },
      { distanceM: 2.5, speed: { x: 10, y: 0 }, draw: (c) => person(c, 310, 480, 300, { skin: SKIN.medium, top: '#6B4A6B', bottom: '#33302B' }) },
    ],
  },
  {
    id: 'product', en: 'Product photograph', sw: 'Picha ya bidhaa', ev100: 9,
    subjectDistM: 0.8, subjectSpeedPxPerS: 0, start: { aperture: 8, shutter: 1 / 60 },
    layers: [
      { distanceM: 3, speed: { x: 0, y: 0 }, draw: (c) => { const g = c.createLinearGradient(0, 0, 0, REF_H); g.addColorStop(0, '#EFECE4'); g.addColorStop(1, '#CFC8BA'); c.fillStyle = g; c.fillRect(0, 0, REF_W, REF_H); } },
      { distanceM: 0.8, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#B7B0A4'; c.beginPath(); c.ellipse(400, 430, 220, 34, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FBB03B'; c.beginPath(); c.roundRect(330, 210, 140, 210, 18); c.fill(); c.fillStyle = '#171717'; c.fillRect(348, 250, 104, 60); c.fillStyle = '#F3F1EC'; c.font = 'bold 28px sans-serif'; c.fillText('TATU', 362, 292); } },
    ],
  },
  {
    id: 'food', en: 'Food photograph', sw: 'Picha ya chakula', ev100: 8,
    subjectDistM: 0.6, subjectSpeedPxPerS: 0, start: { aperture: 4, shutter: 1 / 60 },
    layers: [
      { distanceM: 2.5, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#5A4634'; c.fillRect(0, 0, REF_W, REF_H); c.fillStyle = '#6E5640'; c.fillRect(0, 0, REF_W, REF_H * 0.4); window_(c, 560, 40, 180, 140, '#F6EBD2'); } },
      { distanceM: 1.4, speed: { x: 0, y: 0 }, draw: (c) => { plate(c, 620, 400, 90); c.fillStyle = '#8A6E52'; c.fillRect(0, 350, REF_W, 12); } },
      { distanceM: 0.6, speed: { x: 0, y: 0 }, draw: (c) => plate(c, 330, 420, 190) },
    ],
  },
  {
    id: 'group', en: 'Group photograph', sw: 'Picha ya kikundi', ev100: 12,
    subjectDistM: 4, subjectSpeedPxPerS: 15, start: { aperture: 8, shutter: 1 / 250 },
    layers: [
      { distanceM: 1000, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#A8CFE8', '#EAF2EE', 0.5); ground(c, '#7FA96B', 0.5); } },
      { distanceM: 30, speed: { x: 0, y: 0 }, draw: (c) => { tree(c, 100, 330, 190); building(c, 570, 300, 200, 190, '#B49A72', 'rgba(240,240,235,0.9)', 0.25, 21); } },
      { distanceM: 5.5, speed: { x: 0, y: 0 }, draw: (c) => { person(c, 200, 470, 240, { skin: SKIN.deep, top: '#2E9B62', bottom: '#33415C' }); person(c, 610, 470, 235, { skin: SKIN.light, top: '#8E4EC6', bottom: '#2b2b2b' }); } },
      { distanceM: 4, speed: { x: 15, y: 0 }, draw: (c) => { person(c, 330, 485, 260, { skin: SKIN.dark, top: '#FBB03B', bottom: '#171717' }); person(c, 470, 485, 250, { skin: SKIN.medium, top: '#3C82F6', bottom: '#6B4A2F' }); } },
    ],
  },
  {
    id: 'interview', en: 'Documentary interview', sw: 'Mahojiano ya kumbukumbu', ev100: 7, video: true,
    subjectDistM: 2, subjectSpeedPxPerS: 8, start: { aperture: 2.8, shutter: 1 / 60 },
    layers: [
      { distanceM: 6, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#3B3630'; c.fillRect(0, 0, REF_W, REF_H); c.fillStyle = '#4A443C'; c.fillRect(0, 0, REF_W, REF_H * 0.5); c.fillStyle = '#332E28'; c.fillRect(60, 120, 130, 260); tree(c, 660, 430, 140, '#41563E'); } },
      { distanceM: 3.5, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { const g = c.createRadialGradient(620, 120, 10, 620, 120, 110); g.addColorStop(0, 'rgba(255,238,200,0.9)'); g.addColorStop(1, 'rgba(255,238,200,0)'); c.fillStyle = g; c.fillRect(500, 20, 240, 220); } },
      { distanceM: 2, speed: { x: 8, y: 0 }, draw: (c) => person(c, 350, 490, 330, { skin: SKIN.dark, top: '#33415C', bottom: '#22262E' }) },
    ],
  },
  {
    id: 'walking-video', en: 'Walking video subject', sw: 'Mtu anayetembea (video)', ev100: 12, video: true,
    subjectDistM: 5, subjectSpeedPxPerS: 140, start: { aperture: 11, shutter: 1 / 50 },
    layers: [
      { distanceM: 1500, speed: { x: 0, y: 0 }, draw: (c) => skyGradient(c, '#9CC8E8', '#EAF0EC', 0.58) },
      { distanceM: 60, speed: { x: 0, y: 0 }, draw: (c) => { building(c, 40, 290, 170, 210, '#9A8C7E', 'rgba(230,235,240,0.8)', 0.3, 31); building(c, 600, 290, 160, 230, '#847768', 'rgba(230,235,240,0.8)', 0.35, 33); ground(c, '#96908A', 0.58); } },
      { distanceM: 5, speed: { x: 140, y: 0 }, draw: (c) => person(c, 370, 465, 260, { skin: SKIN.medium, top: '#2E9B62', bottom: '#33415C', pose: 'run' }) },
    ],
  },
  {
    id: 'slow-motion', en: 'Slow-motion action', sw: 'Mwendo wa polepole', ev100: 13, video: true,
    subjectDistM: 6, subjectSpeedPxPerS: 380, start: { aperture: 5.6, shutter: 1 / 250 },
    layers: [
      { distanceM: 800, speed: { x: 0, y: 0 }, draw: (c) => { skyGradient(c, '#F2B968', '#FAE1B2', 0.62); sun(c, 640, 120, 36, '#FBD98A'); } },
      { distanceM: 80, speed: { x: 0, y: 0 }, draw: (c) => { ground(c, '#C9A868', 0.62); tree(c, 110, 340, 170, '#6B7F3E'); } },
      { distanceM: 6, speed: { x: 380, y: -60 }, draw: (c) => { person(c, 380, 430, 260, { skin: SKIN.deep, top: '#C63C3C', bottom: '#F3F1EC', pose: 'run' }); ball(c, 480, 330, 24); } },
    ],
  },
  {
    id: 'video-interview', en: 'Video interview', sw: 'Mahojiano ya video', ev100: 8, video: true,
    subjectDistM: 1.8, subjectSpeedPxPerS: 6, start: { aperture: 2.8, shutter: 1 / 50 },
    layers: [
      { distanceM: 7, speed: { x: 0, y: 0 }, draw: (c) => { c.fillStyle = '#2E3440'; c.fillRect(0, 0, REF_W, REF_H); building(c, 80, 420, 120, 260, '#252B36', 'rgba(120,160,220,0.5)', 0.4, 41); c.fillStyle = '#232833'; c.fillRect(0, REF_H * 0.78, REF_W, REF_H * 0.22); } },
      { distanceM: 3, speed: { x: 0, y: 0 }, lights: true, draw: (c) => { const g = c.createRadialGradient(180, 110, 8, 180, 110, 100); g.addColorStop(0, 'rgba(190,214,255,0.9)'); g.addColorStop(1, 'rgba(190,214,255,0)'); c.fillStyle = g; c.fillRect(60, 10, 240, 210); } },
      { distanceM: 1.8, speed: { x: 6, y: 0 }, draw: (c) => person(c, 430, 495, 340, { skin: SKIN.tan, top: '#5B4A6B', bottom: '#22262E' }) },
    ],
  },
];

export const SCENE_IDS: ReadonlySet<string> = new Set(SCENES.map((s) => s.id));

export function sceneById(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? (SCENES[0] as SceneDef);
}

/**
 * A sensible starting exposure for a scene: the scene's creative aperture
 * and shutter, with the ISO solved so the meter reads about zero — like
 * picking up a camera that was just used in this light.
 */
export function startSettingsFor(scene: SceneDef): Partial<ExposureSettings> {
  const iso = nearest(ISOS, solveIso(scene.ev100, scene.start.aperture, scene.start.shutter));
  return {
    aperture: scene.start.aperture,
    shutter: scene.start.shutter,
    iso,
    evComp: 0,
    ndStops: 0,
    focusDistM: scene.subjectDistM,
    focusPoint: { x: 0.5, y: 0.45 },
  };
}

/** Small deterministic star field used by the night scene backdrop. */
export function stars(ctx: Ctx, count = 60, seed = 19): void {
  const rnd = mulberry32(seed);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < count; i++) {
    ctx.fillRect(rnd() * REF_W, rnd() * REF_H * 0.5, 1.6, 1.6);
  }
}
