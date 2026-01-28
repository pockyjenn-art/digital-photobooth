let sClick;
let titleImg;
let icons = [];
let frames = [];

// UI images
let uiHome, uiCapture, uiOK, uiSave, uiPrint, uiRetake;

let screen = 0;         // 0=start, 1=camera, 2=final
let selectedIcon = -1;  // 0..3

const TARGET_ICON_HEIGHT = 115;

// Frame design size
const FRAME_W = 591;
const FRAME_H = 1772;

// Same holes for all frames
const HOLES = [
  { x: 38.97, y: 35.53,   w: 516.01, h: 371.93 },
  { x: 38.97, y: 407.98,  w: 516.01, h: 371.93 },
  { x: 37.33, y: 783.71,  w: 516.01, h: 371.93 },
  { x: 34.05, y: 1175.85, w: 516.01, h: 371.93 }
];

// Webcam
let video;

// Audio
let sCountdown, sShutter;

// Capture state
let capturing = false;
let capturedShots = [];
let shotIndex = 0;
let nextShotAtMs = 0;
let countdownStartAtMs = 0;

const SHOTS_TOTAL = 4;
const SHOT_INTERVAL_MS = 6000;
const COUNTDOWN_MS = 3000;

const READY_MS = 2400;
let readyStartAtMs = -1;

// Flash effect
let flashAlpha = 0;

// Button hitboxes
const btnBack    = { x: 24,  y: 10,  w: 127, h: 80 };
const btnCapture = { x: 392, y: 260, w: 360, h: 90 };
const btnOK      = { x: 490, y: 201, w: 204, h: 94 };

// Retake button
const btnRetake  = { x: 468, y: 289, w: 244, h: 134 };

const btnSave    = { x: 466, y: 183, w: 244, h: 134 };
const btnPrint   = { x: 466, y: 287, w: 244, h: 134 }; 

let finalStripGfx = null;

// OK / Retake fade-in
let doneButtonsStartAtMs = -1;
const DONE_FADE_MS = 400;

// Save / Print fade-in (final screen)
let finalButtonsStartAtMs = -1;
const FINAL_FADE_MS = 400;

let homePressedAtMs = -1;
let iconPressedAtMs = -1;
const PRESS_FADE_MS = 150;

// ============================
// DEV: drag layout tool
// ============================
let DEV = false;
let devScreen = 1;
let showBoxes = true;

let draggable = [];
let activeDrag = null;
let dragOffX = 0;
let dragOffY = 0;

// draggable frame + countdown
let framePos = { x: 175, y: 30 };
let frameFit = { maxW: 360, maxH: 540 };

let countdownPos = { x: 581, y: 302 };

// frame + countdown handles (for hovering/grabbing)
const devFrameHandle = { x: 0, y: 0, w: 0, h: 0 };
const devCountdownHandle = { x: 0, y: 0, w: 120, h: 120 };

function preload() {
  titleImg = loadImage("assets/title.png");

  for (let i = 1; i <= 4; i++) {
    icons.push(loadImage(`assets/icons/icon${i}.png`));
    frames.push(loadImage(`assets/frames/frame${i}.png`));
  }

  uiHome    = loadImage("assets/ui/btn_home.png");
  uiCapture = loadImage("assets/ui/btn_capture.png");
  uiOK      = loadImage("assets/ui/btn_ok.png");
  uiSave    = loadImage("assets/ui/btn_save.png");
  uiPrint   = loadImage("assets/ui/btn_print.png");
  uiRetake  = loadImage("assets/ui/btn_retake.png");

  // sounds
  sClick     = loadSound("assets/audio/buttonsound.wav");
  sCountdown = loadSound("assets/audio/countdown.mp3");
  sShutter   = loadSound("assets/audio/shutter.mp3");
}

function setup() {
  createCanvas(800, 600);
  textAlign(CENTER, CENTER);

  const constraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user"
  },
  audio: false
};

video = createCapture(constraints);
video.hide();

  // instant restart mode
  if (sClick) sClick.playMode("restart");
  if (sCountdown) sCountdown.playMode("restart");
  if (sShutter) sShutter.playMode("restart");

  draggable = [
    { name: "btnBack", ref: btnBack },
    { name: "btnCapture", ref: btnCapture },
    { name: "btnOK", ref: btnOK },
    { name: "btnRetake", ref: btnRetake },
    { name: "btnSave", ref: btnSave },
    { name: "btnPrint", ref: btnPrint },
  ];
}

function draw() {
  background(255);

  if (DEV) {
    if (devScreen === 0) {
      drawStartScreen();
    } else if (devScreen === 1) {
      if (selectedIcon < 0) selectedIcon = 0;
      drawCameraScreen();
    } else {
      if (selectedIcon < 0) selectedIcon = 0;
      if (!finalStripGfx) finalStripGfx = buildFinalStrip();
      drawFinalScreen();
    }

    if (showBoxes) drawDevBoxes();
  } else {
    if (screen === 0) drawStartScreen();
    else if (screen === 1) drawCameraScreen();
    else drawFinalScreen();

    if (screen === 1 && capturing) runCaptureScheduler();
  }

  // Flash overlay
  if (flashAlpha > 0) {
    noStroke();
    fill(255, flashAlpha);
    rect(0, 0, width, height);
    flashAlpha -= 25;
  }
}

/* ================= START ================= */

function drawStartScreen() {
  const tw = 500;
  const th = (tw * titleImg.height) / titleImg.width;
  image(titleImg, width / 2 - tw / 2, 40, tw, th);

  const box = 140;
  const gap = 40;
  const startX = width / 2 - (box * 2 + gap) / 2;
  const startY = 260;

  for (let i = 0; i < 4; i++) {
    const x = startX + (i % 2) * (box + gap);
    const y = startY + floor(i / 2) * (box + gap);

    const img = icons[i];
    const h = TARGET_ICON_HEIGHT;
    const w = (h * img.width) / img.height;

    let alpha = 255;
    if (iconPressedAtMs > 0) {
      const t = constrain((millis() - iconPressedAtMs) / PRESS_FADE_MS, 0, 1);
      alpha = lerp(120, 255, t);
    }

    push();
    tint(255, alpha);
    image(img, x + (box - w) / 2, y + (box - h) / 2, w, h);
    pop();

    icons[i]._btn = { x, y, w: box, h: box };
  }
}

function resetCameraScreenState() {
  capturing = false;
  capturedShots = [];
  shotIndex = 0;
  finalStripGfx = null;
  flashAlpha = 0;
  readyStartAtMs = -1;
  doneButtonsStartAtMs = -1;
  finalButtonsStartAtMs = -1;

  if (sCountdown && sCountdown.isPlaying()) sCountdown.stop();
}

/* ================= CAMERA ================= */

function drawCameraScreen() {
  let homeAlpha = 255;

  if (homePressedAtMs > 0) {
    const t = constrain((millis() - homePressedAtMs) / PRESS_FADE_MS, 0, 1);
    homeAlpha = lerp(120, 255, t);
  }

  push();
  tint(255, homeAlpha);
  drawImageButton(uiHome, btnBack);
  pop();

  const fit = fitRect(
    FRAME_W,
    FRAME_H,
    frameFit.maxW,
    frameFit.maxH,
    framePos.x,
    framePos.y
  );

  const fx = fit.x,
        fy = fit.y,
        fw = fit.w,
        fh = fit.h;

  const sx = fw / FRAME_W;
  const sy = fh / FRAME_H;

  devFrameHandle.x = fx;
  devFrameHandle.y = fy;
  devFrameHandle.w = fw;
  devFrameHandle.h = fh;

  let liveIndex = capturing ? shotIndex : capturedShots.length;
  liveIndex = constrain(liveIndex, 0, SHOTS_TOTAL - 1);

  for (let i = 0; i < SHOTS_TOTAL; i++) {
    const hole = HOLES[i];
    const hx = fx + hole.x * sx;
    const hy = fy + hole.y * sy;
    const hw = hole.w * sx;
    const hh = hole.h * sy;

    if (capturedShots[i]) {
      image(capturedShots[i], hx, hy, hw, hh);
    } else if (i === liveIndex) {
      drawMirroredVideoCover(video, hx, hy, hw, hh);
    }
  }

  // frame outline
  push();
  noFill();
  stroke(220);
  strokeWeight(3);
  rect(fx - 2, fy - 2, fw + 4, fh + 4, 12);
  pop();

  // frame image
  image(frames[selectedIcon], fx, fy, fw, fh);

  // Capture button + helper text
  if (!capturing && capturedShots.length < SHOTS_TOTAL) {
    push();
    textAlign(CENTER, CENTER);
    textSize(14);
    fill(0, 180);
    noStroke();
    text(
      "click button to start! :3",
      btnCapture.x + btnCapture.w / 2,
      btnCapture.y - 12 + 6
    );
    pop();

    push();
    translate(0, 6);
    drawImageButton(uiCapture, btnCapture);
    pop();
  }

  // OK / Retake fade-in when done
  if (!capturing && capturedShots.length === SHOTS_TOTAL) {
    let alpha = 255;

    if (doneButtonsStartAtMs > 0) {
      const t = constrain((millis() - doneButtonsStartAtMs) / DONE_FADE_MS, 0, 1);
      alpha = 255 * t;
    }

    push();
    tint(255, alpha);
    drawImageButton(uiRetake, btnRetake);
    drawImageButton(uiOK, btnOK);
    pop();
  }

  // READY + FADE COUNTDOWN
  if (capturing) {
    const now = millis();

    if (readyStartAtMs >= 0 && now >= readyStartAtMs && now < countdownStartAtMs) {
      drawReadyAnim(now);
    }

    const remaining = max(0, nextShotAtMs - now);
    if (remaining <= COUNTDOWN_MS) {
      const n = ceil(remaining / 1000);
      const t = 1 - (remaining % 1000) / 1000;
      const alpha = 255 * sin(t * PI);

      push();
      textAlign(CENTER, CENTER);
      textSize(90);
      fill(0, alpha);
      noStroke();
      text(n, countdownPos.x, countdownPos.y);
      pop();
    }
  }

  devCountdownHandle.x = countdownPos.x - devCountdownHandle.w / 2;
  devCountdownHandle.y = countdownPos.y - devCountdownHandle.h / 2;
}

/* ================= FINAL ================= */

function drawFinalScreen() {
  let homeAlpha = 255;

  if (homePressedAtMs > 0) {
    const t = constrain((millis() - homePressedAtMs) / PRESS_FADE_MS, 0, 1);
    homeAlpha = lerp(120, 255, t);
  }

  push();
  tint(255, homeAlpha);
  drawImageButton(uiHome, btnBack);
  pop();

  if (!finalStripGfx) finalStripGfx = buildFinalStrip();

  const fit = fitRect(FRAME_W, FRAME_H, frameFit.maxW, frameFit.maxH, framePos.x, framePos.y);
  image(finalStripGfx, fit.x, fit.y, fit.w, fit.h);

  let alpha = 255;
  if (finalButtonsStartAtMs > 0) {
    const t = constrain((millis() - finalButtonsStartAtMs) / FINAL_FADE_MS, 0, 1);
    alpha = 255 * t;
  }

  push();
  tint(255, alpha);
  drawImageButton(uiSave, btnSave);
  drawImageButton(uiPrint, btnPrint);
  pop();
}

/* ================= CAPTURE ================= */

function startCaptureSequence() {
  capturing = true;
  capturedShots = [];
  shotIndex = 0;
  finalStripGfx = null;

  scheduleNextShot();
}

function scheduleNextShot() {
  nextShotAtMs = millis() + SHOT_INTERVAL_MS;
  countdownStartAtMs = nextShotAtMs - COUNTDOWN_MS;

  // Ready text starts IMMEDIATELY after pressing Capture (first shot only)
  if (shotIndex === 0) {
    readyStartAtMs = millis();
  } else {
    readyStartAtMs = -1;
  }

  if (sCountdown && sCountdown.isPlaying()) sCountdown.stop();
}

function runCaptureScheduler() {
  const now = millis();

  if (now >= countdownStartAtMs && now < nextShotAtMs && sCountdown && !sCountdown.isPlaying()) {
    safePlay(sCountdown);
  }

  if (now >= nextShotAtMs) {
    takeShot(shotIndex++);
    if (shotIndex >= SHOTS_TOTAL) {
      capturing = false;
      doneButtonsStartAtMs = millis();
      if (sCountdown && sCountdown.isPlaying()) sCountdown.stop();
    } else {
      scheduleNextShot();
    }
  }
}

function takeShot(i) {
  if (sShutter) safePlay(sShutter);
  flashAlpha = 220;

  const hole = HOLES[i];
  const g = createGraphics(hole.w, hole.h);
  g.translate(hole.w, 0);
  g.scale(-1, 1);
  drawVideoCoverToGraphics(g, video, 0, 0, hole.w, hole.h);
  capturedShots[i] = g.get();
}

function buildFinalStrip() {
  const g = createGraphics(FRAME_W, FRAME_H);
  g.clear();

  for (let i = 0; i < SHOTS_TOTAL; i++) {
    if (capturedShots[i]) {
      g.image(capturedShots[i], HOLES[i].x, HOLES[i].y, HOLES[i].w, HOLES[i].h);
    }
  }
  g.image(frames[selectedIcon], 0, 0, FRAME_W, FRAME_H);
  return g;
}

/* ================= READY ANIM ================= */

function drawReadyAnim(now) {
  if (readyStartAtMs < 0) return;

  const t = (now - readyStartAtMs) / READY_MS;
  if (t < 0 || t > 1) return;

  const easeOut = 1 - pow(1 - t, 3);
  const y = countdownPos.y - 70 - (1 - easeOut) * 12;
  const a = 255 * sin(t * PI);

  push();
  textAlign(CENTER, CENTER);
  noStroke();
  fill(0, a);

  textSize(44);
  text("Ready?", countdownPos.x, y);

  textSize(24);
  text("Get ready to pose!", countdownPos.x, y + 65);
  pop();
}

/* ================= INPUT ================= */

function mousePressed() {
  unlockAudioNow();      // unlock before any logic
  normalMousePressed();  // your existing button logic
  return false;
}

function normalMousePressed() {
  if (screen === 0) {
    icons.forEach((ic, i) => {
      if (inside(mouseX, mouseY, ic._btn)) {
        playClick(); // 🔊 icon click
        iconPressedAtMs = millis();
        selectedIcon = i;
        screen = 1;
        resetCameraScreenState();
      }
    });
  } else if (screen === 1) {
    if (inside(mouseX, mouseY, btnBack)) {
      playClick(); // 🔊 home
      homePressedAtMs = millis();
      screen = 0;
      return;
    }

    if (!capturing && inside(mouseX, mouseY, btnCapture)) {
      playClick(); // 🔊 capture
      startCaptureSequence();
      return;
    }

    if (!capturing && capturedShots.length === SHOTS_TOTAL && inside(mouseX, mouseY, btnRetake)) {
      playClick(); // 🔊 retake
      resetCameraScreenState();
      return;
    }

    if (!capturing && capturedShots.length === SHOTS_TOTAL && inside(mouseX, mouseY, btnOK)) {
      playClick(); // 🔊 ok
      screen = 2;
      finalButtonsStartAtMs = millis();
      return;
    }
  } else if (screen === 2) {
    if (inside(mouseX, mouseY, btnBack)) {
      playClick(); // 🔊 home
      homePressedAtMs = millis();
      screen = 0;
      return;
    }

    if (inside(mouseX, mouseY, btnSave)) {
  playClick();
  if (!finalStripGfx) finalStripGfx = buildFinalStrip();
  saveFinalStripAsPDF(finalStripGfx);
  return;
}

if (inside(mouseX, mouseY, btnPrint)) {
  playClick();
  if (!finalStripGfx) finalStripGfx = buildFinalStrip();
  printFinalStripPDF(finalStripGfx);
  return;
}
  }
}

/* ================= DEV HELPERS ================= */

function drawDevBoxes() {
  noFill();
  stroke(0, 180);
  strokeWeight(2);

  rect(btnBack.x, btnBack.y, btnBack.w, btnBack.h);
  rect(btnCapture.x, btnCapture.y, btnCapture.w, btnCapture.h);
  rect(btnRetake.x, btnRetake.y, btnRetake.w, btnRetake.h);
  rect(btnOK.x, btnOK.y, btnOK.w, btnOK.h);

  rect(btnSave.x, btnSave.y, btnSave.w, btnSave.h);
  rect(btnPrint.x, btnPrint.y, btnPrint.w, btnPrint.h);

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text("btnBack", btnBack.x + 4, btnBack.y + 4);
  text("btnCapture", btnCapture.x + 4, btnCapture.y + 4);
  text("btnRetake", btnRetake.x + 4, btnRetake.y + 4);
  text("btnOK", btnOK.x + 4, btnOK.y + 4);
  text("btnSave", btnSave.x + 4, btnSave.y + 4);
  text("btnPrint", btnPrint.x + 4, btnPrint.y + 4);
}

function findDraggableAt(mx, my) {
  if (devScreen === 1 && inside(mx, my, devCountdownHandle)) {
    return { kind: "countdown", name: "countdownPos" };
  }
  if ((devScreen === 1 || devScreen === 2) && inside(mx, my, devFrameHandle)) {
    return { kind: "frame", name: "framePos" };
  }
  if (inside(mx, my, btnBack)) return { ref: btnBack, name: "btnBack" };
  if (inside(mx, my, btnCapture)) return { ref: btnCapture, name: "btnCapture" };
  if (inside(mx, my, btnRetake)) return { ref: btnRetake, name: "btnRetake" };
  if (inside(mx, my, btnOK)) return { ref: btnOK, name: "btnOK" };
  if (inside(mx, my, btnSave)) return { ref: btnSave, name: "btnSave" };
  if (inside(mx, my, btnPrint)) return { ref: btnPrint, name: "btnPrint" };
  return null;
}

/* ================= UI + HELPERS ================= */

function drawImageButton(img, b) {
  const s = min(b.w / img.width, b.h / img.height);
  const w = img.width * s;
  const h = img.height * s;
  image(img, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h);
}

function inside(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function fitRect(rw, rh, mw, mh, x, y) {
  const s = min(mw / rw, mh / rh);
  return { x, y, w: rw * s, h: rh * s };
}

 function drawMirroredVideoCover(v, x, y, w, h) {
  const vw = v.width || 1;
  const vh = v.height || 1;

  const videoAR = vw / vh;
  const holeAR  = w / h;

  let sw, sh, sx, sy;

  if (videoAR > holeAR) {
    sh = vh;
    sw = vh * holeAR;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    sw = vw;
    sh = vw / holeAR;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  const ZOOM_OUT = 0.98;
  sw *= ZOOM_OUT;
  sh *= ZOOM_OUT;
  sx = (vw - sw) / 2;
  sy = (vh - sh) / 2;
  sx = constrain(sx, 0, vw - sw);
  sy = constrain(sy, 0, vh - sh);

  push();
  translate(x + w, y);
  scale(-1, 1);
  image(v, 0, 0, w, h, sx, sy, sw, sh);
  pop();
}

function drawVideoCoverToGraphics(g, v, x, y, w, h) {
  const vw = v.width || 1;
  const vh = v.height || 1;

  const videoAR = vw / vh;
  const holeAR  = w / h;

  let sw, sh, sx, sy;

  if (videoAR > holeAR) {
    sh = vh;
    sw = vh * holeAR;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    sw = vw;
    sh = vw / holeAR;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  const ZOOM_OUT = 0.98;
  sw *= ZOOM_OUT;
  sh *= ZOOM_OUT;
  sx = (vw - sw) / 2;
  sy = (vh - sh) / 2;
  sx = constrain(sx, 0, vw - sw);
  sy = constrain(sy, 0, vh - sh);

  g.image(v, x, y, w, h, sx, sy, sw, sh);
}

function safePlay(s) {
  try { s.stop(); s.play(); } catch (e) {}
}

// ultra-fast click setup
let audioUnlocked = false;
let clickPrimed = false;
const CLICK_VOL = 0.55; // softer (0.4–0.7)

function unlockAudioNow() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  try {
    userStartAudio();
    const ctx = getAudioContext();
    if (ctx && ctx.state !== "running") ctx.resume();

    // prime click once so first real click isn't late
    if (sClick && !clickPrimed) {
      sClick.playMode("restart");
      sClick.play(0, 1, 0, 0); // silent warm-up
      sClick.stop();
      clickPrimed = true;
    }
  } catch (e) {}
}

function playClick() {
  if (!sClick) return;

  try {
    sClick.playMode("restart");
    sClick.stop();
    sClick.play(0, 1, CLICK_VOL, 0); // immediate start + softer volume
  } catch (e) {}
}

// Print helper (unchanged)
function printFinalStrip(gfx) {
  const dataUrl = gfx.canvas.toDataURL("image/png");

  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(`
    <html>
      <head>
        <title>Print Photobooth</title>
        <style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; }
          img { max-width: 100%; height: auto; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <img src="${dataUrl}"
             onload="window.print(); window.onafterprint = () => window.close();" />
      </body>
    </html>
  `);
  w.document.close();
}

function saveFinalStripAsPDF(gfx) {
  const { jsPDF } = window.jspdf;

  // Phomemo M834 works great with A4 / Letter
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: "a4"
  });

  const imgData = gfx.canvas.toDataURL("image/png");

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // keep aspect ratio
  const imgAR = gfx.width / gfx.height;
  let drawW = pageW;
  let drawH = drawW / imgAR;

  if (drawH > pageH) {
    drawH = pageH;
    drawW = drawH * imgAR;
  }

  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  pdf.addImage(imgData, "PNG", x, y, drawW, drawH);

  pdf.save("photobooth.pdf");
}

function printFinalStripPDF(gfx) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: "a4"
  });

  const imgData = gfx.canvas.toDataURL("image/png");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgAR = gfx.width / gfx.height;
  let drawW = pageW;
  let drawH = drawW / imgAR;

  if (drawH > pageH) {
    drawH = pageH;
    drawW = drawH * imgAR;
  }

  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  pdf.addImage(imgData, "PNG", x, y, drawW, drawH);

  // open PDF in new tab → system print → choose Phomemo
  window.open(pdf.output("bloburl"), "_blank");
}

  