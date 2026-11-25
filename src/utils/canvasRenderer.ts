import {
  VISUAL_STYLES,
  type SceneConfig,
  type StoryboardBeat,
  type StyleOption,
} from '../types';

export function getStyleOption(styleId: SceneConfig['style']): StyleOption {
  return VISUAL_STYLES.find((s) => s.id === styleId) || VISUAL_STYLES[0];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface CharacterDrawOpts {
  x: number;
  y: number;
  scale: number;
  facing: 1 | -1;
  role: 'A' | 'B';
  pose: 'sitting' | 'standing' | 'walking' | 'stumble' | 'bowing' | 'gesture' | 'surprised';
  progress: number;
  speaking: boolean;
  hasCoffeeCup: boolean;
  hasShirtStain: boolean;
  label: string;
  palette: StyleOption['palette'];
}

function drawStylized3DCharacter(
  ctx: CanvasRenderingContext2D,
  opts: CharacterDrawOpts
) {
  const {
    x,
    y,
    scale,
    facing,
    role,
    pose,
    progress,
    speaking,
    hasCoffeeCup,
    hasShirtStain,
    palette,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  const bob =
    pose === 'walking'
      ? Math.abs(Math.sin(progress * Math.PI * 8)) * 5
      : Math.sin(progress * Math.PI * 2) * 1.5;

  // Ground contact shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, pose === 'stumble' ? 42 : 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let tilt = 0;
  if (pose === 'stumble') {
    tilt = Math.sin(Math.min(1, progress * 1.6) * Math.PI) * 0.28;
  } else if (pose === 'bowing') {
    tilt = 0.16;
  } else if (pose === 'surprised') {
    tilt = -0.06;
  }

  ctx.translate(0, -bob);
  ctx.rotate(tilt);

  const legStride =
    pose === 'walking'
      ? Math.sin(progress * Math.PI * 8) * 18
      : pose === 'stumble'
        ? 16
        : 0;

  // Legs
  if (pose !== 'sitting') {
    ctx.lineCap = 'round';
    ctx.strokeStyle = role === 'A' ? palette.charAPants : palette.outline;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-8, -58);
    ctx.lineTo(-10 - legStride * 0.7, -4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, -58);
    ctx.lineTo(10 + legStride * 0.7, -4);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = palette.outline;
    drawRoundedRect(ctx, -18 - legStride * 0.7, -8, 22, 10, 5);
    ctx.fill();
    drawRoundedRect(ctx, 2 + legStride * 0.7, -8, 22, 10, 5);
    ctx.fill();
  } else {
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.charAPants;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(4, -56);
    ctx.lineTo(36, -50);
    ctx.lineTo(38, -6);
    ctx.stroke();
    ctx.fillStyle = palette.outline;
    drawRoundedRect(ctx, 30, -10, 22, 10, 5);
    ctx.fill();
  }

  // Torso (3D gradient shading)
  const torsoGrad = ctx.createLinearGradient(-26, -125, 28, -50);
  if (role === 'A') {
    torsoGrad.addColorStop(0, palette.charAShirt);
    torsoGrad.addColorStop(1, '#DCE4EE');
  } else {
    torsoGrad.addColorStop(0, palette.charBCoat);
    torsoGrad.addColorStop(1, palette.outline);
  }

  ctx.fillStyle = torsoGrad;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, -24, -126, 48, 72, 18);
  ctx.fill();
  ctx.stroke();

  if (role === 'A') {
    // Colorful Vest over crisp dress shirt
    const vestGrad = ctx.createLinearGradient(-22, -118, 22, -55);
    vestGrad.addColorStop(0, palette.charAVest);
    vestGrad.addColorStop(1, palette.outline);
    ctx.fillStyle = vestGrad;
    drawRoundedRect(ctx, -22, -118, 44, 60, 14);
    ctx.fill();

    // Crisp V-neck white shirt opening
    ctx.fillStyle = palette.charAShirt;
    ctx.beginPath();
    ctx.moveTo(-11, -122);
    ctx.lineTo(11, -122);
    ctx.lineTo(2, -92);
    ctx.closePath();
    ctx.fill();

    // Latte stain on shirt after spill
    if (hasShirtStain) {
      ctx.save();
      ctx.fillStyle = palette.latteColor;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.ellipse(4, -102, 7.5, 10.5, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-2, -94, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Trench coat collar & belt + colorful crossbody bag
    ctx.fillStyle = palette.charAShirt;
    ctx.beginPath();
    ctx.moveTo(-9, -124);
    ctx.lineTo(9, -124);
    ctx.lineTo(0, -96);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.outline;
    drawRoundedRect(ctx, -24, -84, 48, 7, 3);
    ctx.fill();

    // Crossbody strap & bag pouch
    ctx.strokeStyle = palette.charBBag;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-16, -124);
    ctx.lineTo(18, -62);
    ctx.stroke();

    ctx.fillStyle = palette.charBBag;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 10, -72, 18, 16, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Front Arm + Prop
  ctx.save();
  ctx.translate(10, -112);
  let armAngle = 0.2;
  if (pose === 'sitting') armAngle = -0.35;
  if (pose === 'walking') armAngle = -0.55;
  if (pose === 'stumble') armAngle = -1.2 + Math.sin(progress * 10) * 0.2;
  if (pose === 'gesture') armAngle = -0.95 + Math.sin(progress * Math.PI * 3) * 0.15;
  if (pose === 'surprised') armAngle = -1.35;
  if (pose === 'bowing') armAngle = 0.45;
  ctx.rotate(armAngle);

  ctx.strokeStyle = role === 'A' ? palette.charAShirt : palette.charBCoat;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(26, 22);
  ctx.stroke();

  ctx.fillStyle = palette.skinTone;
  ctx.beginPath();
  ctx.arc(28, 24, 6.5, 0, Math.PI * 2);
  ctx.fill();

  if (hasCoffeeCup) {
    ctx.save();
    ctx.translate(31, 18);
    ctx.rotate(-armAngle);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -6, -12, 13, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.awningA;
    ctx.fillRect(-6, -6, 13, 6);
    ctx.restore();
  }

  if (pose === 'surprised' && role === 'B') {
    ctx.strokeStyle = palette.skinTone;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(28, 22);
    ctx.lineTo(31, 9);
    ctx.stroke();
  }
  ctx.restore();

  // Neck
  ctx.fillStyle = palette.skinTone;
  ctx.fillRect(-6, -138, 12, 14);

  // 3D Sculpted Head
  const headGrad = ctx.createRadialGradient(-8, -166, 5, 0, -158, 30);
  headGrad.addColorStop(0, '#FFFFFF');
  headGrad.addColorStop(0.35, palette.skinTone);
  headGrad.addColorStop(1, palette.isMonochrome ? palette.midground : '#E5B293');

  ctx.fillStyle = headGrad;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -158, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rosy cheek accent in colorful modes
  if (!palette.isMonochrome) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.beginPath();
    ctx.ellipse(6, -150, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hair
  ctx.fillStyle = palette.isMonochrome ? palette.outline : role === 'A' ? '#292524' : '#3F2E26';
  if (role === 'A') {
    ctx.beginPath();
    ctx.arc(-2, -164, 25, Math.PI * 0.92, Math.PI * 2.02);
    ctx.quadraticCurveTo(18, -184, -4, -186);
    ctx.quadraticCurveTo(-24, -184, -24, -160);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-2, -160, 26, Math.PI * 0.85, Math.PI * 2.1);
    ctx.lineTo(14, -138);
    ctx.lineTo(-22, -135);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes
  const blink = (progress * 10) % 4 < 0.14;
  ctx.fillStyle = palette.outline;
  if (blink) {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(6, -160);
    ctx.lineTo(14, -160);
    ctx.stroke();
  } else {
    const eyeRadius = pose === 'surprised' || pose === 'stumble' ? 3.5 : 2.8;
    ctx.beginPath();
    ctx.arc(10, -160, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(11, -161, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyebrow
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (pose === 'surprised' || pose === 'stumble') {
    ctx.moveTo(5, -170);
    ctx.lineTo(15, -172);
  } else if (pose === 'bowing') {
    ctx.moveTo(5, -167);
    ctx.lineTo(15, -169);
  } else {
    ctx.moveTo(5, -167);
    ctx.lineTo(15, -166);
  }
  ctx.stroke();

  // Mouth
  const mouthOpen = speaking ? 2.5 + Math.abs(Math.sin(progress * 26)) * 4.5 : 0;
  ctx.strokeStyle = palette.outline;
  ctx.fillStyle = palette.isMonochrome ? palette.outline : '#9F1239';
  ctx.lineWidth = 2;
  if (mouthOpen > 1) {
    ctx.beginPath();
    ctx.ellipse(11, -145, 4.5, mouthOpen * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose === 'stumble' || pose === 'surprised') {
    ctx.beginPath();
    ctx.arc(11, -145, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(9, -147, 5, 0.15, Math.PI * 0.65);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSongdoBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: StyleOption['palette'],
  cameraCue: StoryboardBeat['cameraCue'],
  progress: number
) {
  // Multi-color Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  skyGrad.addColorStop(0, palette.bgTop);
  skyGrad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft sun/moon halo
  ctx.save();
  const sunGrad = ctx.createRadialGradient(w * 0.78, h * 0.18, 8, w * 0.78, h * 0.18, 120);
  sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  sunGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
  sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.18, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Colorful Songdo skyline towers
  const panOffset =
    cameraCue === 'street-walk-spill' ? -progress * 55 : -progress * 14;
  ctx.save();
  ctx.translate(panOffset, 0);
  const towers = [
    { x: 60, w: 72, h: 250, color: palette.towerA },
    { x: 145, w: 58, h: 310, color: palette.towerB },
    { x: 220, w: 85, h: 210, color: palette.midground },
    { x: 890, w: 76, h: 270, color: palette.towerB },
    { x: 980, w: 92, h: 330, color: palette.towerA },
    { x: 1090, w: 68, h: 230, color: palette.midground },
  ];
  for (const t of towers) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = t.color;
    drawRoundedRect(ctx, t.x, h * 0.72 - t.h, t.w, t.h, 8);
    ctx.fill();

    // Subtle sunlit glass window stripes
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#FFFFFF';
    for (let wy = h * 0.72 - t.h + 20; wy < h * 0.68; wy += 26) {
      ctx.fillRect(t.x + 12, wy, t.w - 24, 8);
    }
  }
  ctx.restore();

  // Lush Moonlight Festival Park trees + colorful blossoms
  const treeSway = Math.sin(progress * Math.PI * 3) * 4;
  const treePositions = [170, 390, 960, 1140];
  for (let idx = 0; idx < treePositions.length; idx++) {
    const tx = treePositions[idx];
    ctx.save();
    ctx.fillStyle = palette.tableWood;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(tx - 6 + panOffset * 0.5, h * 0.54, 12, 138);

    // Canopy shadow & highlight layers
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = palette.treeLeaf;
    ctx.beginPath();
    ctx.arc(tx + treeSway + panOffset * 0.5, h * 0.5, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.treeHighlight;
    ctx.beginPath();
    ctx.arc(tx - 10 + treeSway + panOffset * 0.5, h * 0.48, 28, 0, Math.PI * 2);
    ctx.fill();

    // Blossoms
    ctx.fillStyle = palette.blossom;
    for (let b = 0; b < 4; b++) {
      ctx.beginPath();
      ctx.arc(
        tx + ((b - 1.5) * 16) + treeSway + panOffset * 0.5,
        h * 0.49 + ((b % 2) * 14 - 7),
        5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // Sidewalk & Street horizon
  const groundGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
  groundGrad.addColorStop(0, palette.isMonochrome ? palette.midground : '#CBD5E1');
  groundGrad.addColorStop(0.24, palette.ground);
  groundGrad.addColorStop(1, palette.outline);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.lineTo(w, h * 0.72);
  ctx.stroke();

  if (cameraCue === 'wide-cafe' || cameraCue === 'two-shot-apology') {
    ctx.save();
    ctx.fillStyle = palette.cafeWall;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, 70, 140, 330, 380, 12);
    ctx.fill();
    ctx.stroke();

    // Warm sunlit café window
    ctx.fillStyle = palette.bgBottom;
    drawRoundedRect(ctx, 110, 210, 250, 190, 8);
    ctx.fill();
    ctx.stroke();

    // Window flower box with multi-color blooms
    ctx.fillStyle = palette.tableWood;
    drawRoundedRect(ctx, 118, 386, 234, 24, 5);
    ctx.fill();
    const flowerColors = [palette.blossom, palette.charBBag, palette.treeLeaf, palette.accent];
    for (let f = 0; f < 8; f++) {
      ctx.fillStyle = flowerColors[f % flowerColors.length];
      ctx.beginPath();
      ctx.arc(138 + f * 28, 382, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Colorful Striped Café Awning
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? palette.awningA : palette.awningB;
      ctx.beginPath();
      ctx.moveTo(55 + i * 45, 130);
      ctx.lineTo(100 + i * 45, 130);
      ctx.lineTo(108 + i * 45, 182);
      ctx.lineTo(47 + i * 45, 182);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Warm Wood Bistro table
    ctx.save();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(475, 425);
    ctx.lineTo(475, 535);
    ctx.stroke();
    ctx.fillStyle = palette.tableWood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(475, 422, 58, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (cameraCue === 'street-walk-spill') {
    ctx.save();
    const shopColors = [palette.cafeWall, palette.awningB];
    for (let s = 0; s < 2; s++) {
      const sx = 120 + s * 410 + panOffset * 0.7;
      ctx.fillStyle = shopColors[s % shopColors.length];
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, sx, 165, 320, 345, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.bgBottom;
      drawRoundedRect(ctx, sx + 28, 210, 264, 210, 6);
      ctx.fill();
      ctx.stroke();

      // Colorful shop awning accent
      ctx.fillStyle = s === 0 ? palette.awningA : palette.accent;
      drawRoundedRect(ctx, sx - 6, 152, 332, 30, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  if (cameraCue === 'doorway-realization') {
    ctx.save();
    ctx.fillStyle = palette.cafeWall;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, 790, 125, 360, 395, 12);
    ctx.fill();
    ctx.stroke();

    // Colored apartment door
    ctx.fillStyle = palette.accent;
    drawRoundedRect(ctx, 885, 195, 170, 325, 8);
    ctx.fill();
    ctx.stroke();

    // Warm golden sconce glow
    const glow = ctx.createRadialGradient(845, 250, 4, 845, 250, 75);
    glow.addColorStop(0, palette.isMonochrome ? 'rgba(255, 255, 255, 0.85)' : 'rgba(253, 224, 71, 0.85)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(845, 250, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBurnedInSubtitles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  subtitleText: string
) {
  const scrim = ctx.createLinearGradient(0, h * 0.74, 0, h);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(0.55, 'rgba(0, 0, 0, 0.58)');
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0.84)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);

  if (!subtitleText.trim()) return;

  const lines = subtitleText.split('\n').slice(0, 2);
  ctx.save();
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const lineHeight = 44;
  const startY = lines.length === 1 ? h - 64 : h - 86;

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    ctx.strokeStyle = 'rgba(10, 14, 18, 0.92)';
    ctx.lineWidth = 7;
    ctx.strokeText(line, w / 2, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, w / 2, y);
  });

  ctx.restore();
}

export function renderBeatFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  beat: StoryboardBeat,
  scene: SceneConfig,
  beatProgress: number,
  activeSubtitle: string,
  isSpeaking: boolean
) {
  const style = getStyleOption(scene.style);
  const { palette } = style;

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  const zoom =
    beat.cameraCue === 'wide-cafe'
      ? 1 + beatProgress * 0.04
      : beat.cameraCue === 'two-shot-apology'
        ? 1.03 - beatProgress * 0.02
        : 1 + beatProgress * 0.03;
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  drawSongdoBackdrop(ctx, w, h, palette, beat.cameraCue, beatProgress);

  const baselineY = h * 0.76;

  if (beat.id === 'hook') {
    drawStylized3DCharacter(ctx, {
      x: 410,
      y: baselineY,
      scale: 1.32,
      facing: 1,
      role: 'A',
      pose: 'sitting',
      progress: beatProgress,
      speaking: isSpeaking,
      hasCoffeeCup: true,
      hasShirtStain: false,
      label: scene.characterA.name,
      palette,
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 3; s++) {
      const sy = 385 - ((beatProgress * 90 + s * 22) % 48);
      const sx = 468 + Math.sin(beatProgress * 10 + s) * 6 + s * 6;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + 5, sy - 8, sx - 2, sy - 16);
      ctx.stroke();
    }
    ctx.restore();
  } else if (beat.id === 'problem') {
    const walkX = 240 + Math.min(1, beatProgress * 1.15) * 355;
    const isStumble = beatProgress > 0.45 && beatProgress < 0.78;
    const hasSpilled = beatProgress >= 0.62;

    drawStylized3DCharacter(ctx, {
      x: 780,
      y: baselineY,
      scale: 1.32,
      facing: -1,
      role: 'A',
      pose: hasSpilled ? 'surprised' : 'standing',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress < 0.35,
      hasCoffeeCup: false,
      hasShirtStain: hasSpilled,
      label: scene.characterA.name,
      palette,
    });

    drawStylized3DCharacter(ctx, {
      x: walkX,
      y: baselineY,
      scale: 1.32,
      facing: 1,
      role: 'B',
      pose: isStumble ? 'stumble' : beatProgress >= 0.78 ? 'bowing' : 'walking',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress >= 0.35,
      hasCoffeeCup: !hasSpilled,
      hasShirtStain: false,
      label: scene.characterB.name,
      palette,
    });

    if (beatProgress >= 0.5 && beatProgress <= 0.76) {
      const splashT = (beatProgress - 0.5) / 0.26;
      ctx.save();
      ctx.fillStyle = palette.latteColor;
      for (let d = 0; d < 7; d++) {
        const dx = 625 + splashT * (145 + d * 8);
        const dy =
          410 -
          Math.sin(splashT * Math.PI) * (55 + (d % 3) * 18) +
          splashT * (d * 6);
        ctx.beginPath();
        ctx.arc(dx, dy, 4.5 - (d % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (beat.id === 'turn') {
    drawStylized3DCharacter(ctx, {
      x: 475,
      y: baselineY,
      scale: 1.42,
      facing: 1,
      role: 'A',
      pose: beatProgress > 0.55 ? 'standing' : 'surprised',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress > 0.5,
      hasCoffeeCup: false,
      hasShirtStain: true,
      label: scene.characterA.name,
      palette,
    });

    drawStylized3DCharacter(ctx, {
      x: 720,
      y: baselineY,
      scale: 1.42,
      facing: -1,
      role: 'B',
      pose: beatProgress < 0.4 ? 'bowing' : 'gesture',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress <= 0.5,
      hasCoffeeCup: false,
      hasShirtStain: false,
      label: scene.characterB.name,
      palette,
    });
  } else {
    drawStylized3DCharacter(ctx, {
      x: 465,
      y: baselineY,
      scale: 1.42,
      facing: 1,
      role: 'A',
      pose: 'standing',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress > 0.65,
      hasCoffeeCup: false,
      hasShirtStain: true,
      label: scene.characterA.name,
      palette,
    });

    drawStylized3DCharacter(ctx, {
      x: 740,
      y: baselineY,
      scale: 1.42,
      facing: -1,
      role: 'B',
      pose: 'surprised',
      progress: beatProgress,
      speaking: isSpeaking && beatProgress <= 0.65,
      hasCoffeeCup: false,
      hasShirtStain: false,
      label: scene.characterB.name,
      palette,
    });

    if (beatProgress > 0.15 && beatProgress < 0.85) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (beatProgress - 0.15) * 4) * 0.92;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(845, 240, 62, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(845, 228, 11, 0, Math.PI * 2);
      ctx.fill();
      drawRoundedRect(ctx, 830, 242, 30, 20, 8);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(20, 24, 28, 0.72)';
  ctx.font = '600 18px "Outfit", system-ui, sans-serif';
  ctx.fillText(`${beat.label} · ${beat.timeRange}`, 36, 42);
  ctx.restore();

  drawBurnedInSubtitles(ctx, w, h, activeSubtitle);
}

export function renderEndCreditFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: SceneConfig,
  fadeProgress: number
) {
  const style = getStyleOption(scene.style);
  const { palette } = style;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, palette.accent);
  grad.addColorStop(0.5, palette.charAVest);
  grad.addColorStop(1, palette.outline);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = Math.min(1, fadeProgress * 1.4);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "Outfit", system-ui, sans-serif';
  ctx.fillText('Shall we play?', w / 2, h / 2 - 24);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Made with Google AI Studio · Script by ${scene.authorName || 'joo hyun jun'}`,
    w / 2,
    h / 2 + 28
  );
  ctx.restore();
}

export function renderCharacterStylePreview(
  canvas: HTMLCanvasElement,
  scene: SceneConfig
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const style = getStyleOption(scene.style);
  const { palette } = style;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  skyGrad.addColorStop(0, palette.bgTop);
  skyGrad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle green park tree silhouettes behind characters
  ctx.save();
  ctx.fillStyle = palette.treeLeaf;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.56, 38, 0, Math.PI * 2);
  ctx.arc(w * 0.84, h * 0.54, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  drawStylized3DCharacter(ctx, {
    x: w * 0.34,
    y: h * 0.8,
    scale: 1.12,
    facing: 1,
    role: 'A',
    pose: 'standing',
    progress: 0.2,
    speaking: false,
    hasCoffeeCup: true,
    hasShirtStain: false,
    label: scene.characterA.name,
    palette,
  });

  drawStylized3DCharacter(ctx, {
    x: w * 0.66,
    y: h * 0.8,
    scale: 1.12,
    facing: -1,
    role: 'B',
    pose: 'standing',
    progress: 0.2,
    speaking: false,
    hasCoffeeCup: true,
    hasShirtStain: false,
    label: scene.characterB.name,
    palette,
  });
}
