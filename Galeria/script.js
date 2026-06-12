/* =============================================
   DATOS — Colección de obras de arte
============================================= */
const ARTWORKS = [
  { art: '🌊', title: 'La Gran Ola',        year: 'Hokusai · 1831'   },
  { art: '⭐', title: 'Noche Estrellada',   year: 'Van Gogh · 1889'  },
  { art: '🌸', title: 'Flores de Almendro', year: 'Van Gogh · 1890'  },
  { art: '💃', title: 'Las Bailarinas',     year: 'Degas · 1876'     },
  { art: '🎭', title: 'El Grito',           year: 'Munch · 1893'     },
  { art: '🌻', title: 'Los Girasoles',      year: 'Van Gogh · 1888'  },
  { art: '🏔️', title: 'El Caminante',      year: 'Friedrich · 1818' },
  { art: '🌅', title: 'Impresión',          year: 'Monet · 1872'     },
];

/* =============================================
   ESTADO GLOBAL
============================================= */
let centralIdx   = 2;       // Índice de la obra central visible
let cooldown     = false;   // REQUISITO 5: bloqueo temporal (debounce)
let detector     = null;    // Instancia del modelo MoveNet
let running      = false;   // Bandera del bucle principal

// Métricas de FPS
let frameCount = 0;
let lastFpsTs  = performance.now();
let fpsSmooth  = 0;

// REQUISITO 3: Skip Frames — IA corre 1 de cada 3 frames
const SKIP_FRAMES    = 3;
let   aiFrameCounter = 0;
let   lastKeypoints  = null;   // Cache del último resultado de la IA

// REQUISITO 4 y 5: umbral espacial (px) y duración del cooldown (ms)
const THRESHOLD   = 60;
const COOLDOWN_MS = 600;

/* =============================================
   REFERENCIAS AL DOM
============================================= */
const track         = document.getElementById('carousel-track');
const statusDot     = document.getElementById('status-dot');
const statusTxt     = document.getElementById('status-txt');
const fpsCtr        = document.getElementById('fps-counter');
const vid           = document.getElementById('vid');
const canvas        = document.getElementById('cam-canvas');
const ctx           = canvas.getContext('2d');
const camOverlay    = document.getElementById('cam-overlay');
const btnStart      = document.getElementById('btn-start');
const barLw         = document.getElementById('bar-lw');
const barRw         = document.getElementById('bar-rw');
const valLw         = document.getElementById('val-lw');
const valRw         = document.getElementById('val-rw');
const gestureDisp   = document.getElementById('gesture-display');
const cooldownBadge = document.getElementById('cooldown-badge');

/* =============================================
   FUNCIÓN: renderCarousel
   Genera la ventana deslizante de 5 tarjetas.
   La tarjeta del offset 0 recibe la clase .central
   de forma dinámica (REQUISITO 1).
============================================= */
function renderCarousel() {
  const total = ARTWORKS.length;
  const half  = 2; // 2 tarjetas a cada lado del centro
  track.innerHTML = '';

  for (let offset = -half; offset <= half; offset++) {
    const idx = ((centralIdx + offset) % total + total) % total;
    const aw  = ARTWORKS[idx];

    const card = document.createElement('div');

    // REQUISITO 1: clase .central asignada dinámicamente por JS
    card.className = 'card' + (offset === 0 ? ' central' : '');

    card.innerHTML = `
      <div class="card-art">${aw.art}</div>
      <div class="card-title">${aw.title}</div>
      <div class="card-year">${aw.year}</div>
    `;
    track.appendChild(card);
  }
}

/* =============================================
   FUNCIÓN: slide(dir)
   Desplaza el carrusel una posición.
   dir = +1 → siguiente  |  dir = -1 → anterior
   Implementa el REQUISITO 5: cooldown de 600 ms.
============================================= */
function slide(dir) {
  if (cooldown) return;           // REQUISITO 5: ignorar si cooldown activo

  // Activar bloqueo
  cooldown = true;
  cooldownBadge.classList.add('show');
  statusDot.className = 'gesture';

  // Mover índice de forma circular
  const total = ARTWORKS.length;
  centralIdx = ((centralIdx + dir) % total + total) % total;
  renderCarousel();

  gestureDisp.textContent = dir > 0 ? '→  Siguiente' : '←  Anterior';

  // REQUISITO 5: desbloquear exactamente a los 600 ms
  setTimeout(() => {
    cooldown = false;
    cooldownBadge.classList.remove('show');
    statusDot.className = 'ready';
    gestureDisp.textContent = 'En espera…';
  }, COOLDOWN_MS);
}

/* =============================================
   FUNCIÓN: drawSkeleton(keypoints)
   Dibuja el esqueleto detectado sobre el canvas
   con corrección de espejo.
============================================= */
function drawSkeleton(keypoints) {
  // Escalar de 320×240 (resolución de captura) → 240×180 (canvas en pantalla)
  const scaleX = canvas.width  / 320;
  const scaleY = canvas.height / 240;

  // Convierte un keypoint a coordenada espejada en canvas
  function pt(kp) {
    if (!kp) return null;
    return {
      x: (320 - kp.x) * scaleX,
      y: kp.y * scaleY
    };
  }

  // Pares de conexiones del esqueleto
  const CONNECTIONS = [
    ['left_shoulder',  'right_shoulder'],
    ['left_shoulder',  'left_elbow'],
    ['left_elbow',     'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow',    'right_wrist'],
    ['left_shoulder',  'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip',       'right_hip'],
  ];

  const kpMap = {};
  for (const kp of keypoints) kpMap[kp.name] = kp;

  // Dibujar líneas del esqueleto
  ctx.lineWidth   = 2;
  ctx.strokeStyle = 'rgba(127,119,221,0.65)';
  for (const [a, b] of CONNECTIONS) {
    const pa = pt(kpMap[a]);
    const pb = pt(kpMap[b]);
    if (!pa || !pb) continue;
    if ((kpMap[a].score || 0) < 0.3 || (kpMap[b].score || 0) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // Colores especiales para nariz y muñecas (puntos clave del algoritmo)
  const POINT_COLORS = {
    nose:        '#EF9F27',   // naranja — centro dinámico
    left_wrist:  '#1D9E75',  // verde — muñeca izquierda
    right_wrist: '#1D9E75',  // verde — muñeca derecha
  };

  // Dibujar puntos clave
  for (const kp of keypoints) {
    if ((kp.score || 0) < 0.3) continue;
    const p = pt(kp);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, kp.name === 'nose' ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = POINT_COLORS[kp.name] || 'rgba(127,119,221,0.8)';
    ctx.fill();
  }
}

/* =============================================
   FUNCIÓN: analyzeGesture(keypoints)
   REQUISITO 4: Algoritmo de Detección Espacial.

   Extrae nariz, muñeca izq. y muñeca der.
   Usa la nariz como "Centro Dinámico".
   Compara desplazamientos con el umbral (60 px).
   Ajusta las coordenadas al efecto espejo.
============================================= */
function analyzeGesture(keypoints) {
  const kpMap = {};
  for (const kp of keypoints) kpMap[kp.name] = kp;

  // REQUISITO 4: extraer los 3 puntos clave
  const nose = kpMap['nose'];
  const lw   = kpMap['left_wrist'];
  const rw   = kpMap['right_wrist'];

  // Sin nariz no hay centro de referencia
  if (!nose || (nose.score || 0) < 0.3) {
    gestureDisp.textContent = 'Nariz no visible';
    barLw.style.width = '0%';
    barRw.style.width  = '0%';
    valLw.textContent  = '—';
    valRw.textContent  = '—';
    return;
  }

  // REQUISITO 4: X de la nariz = Centro Dinámico (corregido por espejo)
  const noseMirX = 320 - nose.x;

  let gestureDetected = false;

  // ── Muñeca IZQUIERDA física ──────────────────────────────
  // En pantalla espejada aparece a la DERECHA.
  // Si lwMirX > noseMirX → mano extendida a la derecha → deslizar →
  if (lw && (lw.score || 0) > 0.3) {
    const lwMirX  = 320 - lw.x;
    const lwDelta = Math.max(0, lwMirX - noseMirX);
    const pct     = Math.min(100, (lwDelta / 150) * 100);
    barLw.style.width = pct + '%';
    valLw.textContent = Math.round(lwDelta) + ' px';

    // REQUISITO 4: Deslizar a la Derecha
    if (lwDelta > THRESHOLD && !cooldown) {
      slide(+1);
      gestureDetected = true;
    }
  } else {
    barLw.style.width = '0%';
    valLw.textContent = '—';
  }

  // ── Muñeca DERECHA física ────────────────────────────────
  // En pantalla espejada aparece a la IZQUIERDA.
  // Si rwMirX < noseMirX → mano extendida a la izquierda → deslizar ←
  if (!gestureDetected && rw && (rw.score || 0) > 0.3) {
    const rwMirX  = 320 - rw.x;
    const rwDelta = Math.max(0, noseMirX - rwMirX);
    const pct     = Math.min(100, (rwDelta / 150) * 100);
    barRw.style.width = pct + '%';
    valRw.textContent = Math.round(rwDelta) + ' px';

    // REQUISITO 4: Deslizar a la Izquierda
    if (rwDelta > THRESHOLD && !cooldown) {
      slide(-1);
      gestureDetected = true;
    }
  } else {
    barRw.style.width = '0%';
    valRw.textContent = '—';
  }

  if (!gestureDetected && !cooldown) {
    gestureDisp.textContent = 'Manos al centro';
  }
}

/* =============================================
   FUNCIÓN: initModel()
   REQUISITO 2: TensorFlow.js con backend WebGL.
   REQUISITO 2: Modelo MoveNet Lightning.
============================================= */
async function initModel() {
  setStatus('Forzando backend WebGL…');

  // REQUISITO 2: forzar aceleración por GPU (WebGL)
  await tf.setBackend('webgl');
  await tf.ready();

  setStatus('Cargando MoveNet Lightning…');

  // REQUISITO 2: modelo MoveNet versión Lightning
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
}

/* =============================================
   FUNCIÓN: startCamera()
   REQUISITO 3: resolución ligera 320×240 px.
============================================= */
async function startCamera() {
  setStatus('Solicitando acceso a la cámara…');

  // REQUISITO 3: resolución reducida para menor carga matricial en la IA
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width:      { ideal: 320 },
      height:     { ideal: 240 },
      facingMode: 'user'
    },
    audio: false
  });

  vid.srcObject = stream;
  await new Promise(resolve => (vid.onloadedmetadata = resolve));
  await vid.play();
}

/* =============================================
   FUNCIÓN: loop()
   REQUISITO 3: bucle de renderizado optimizado.
   - Canvas dibuja a ~60 FPS.
   - IA escanea 1 de cada 3 frames (skip frames).
============================================= */
function loop() {
  if (!running) return;

  // Calcular FPS con suavizado exponencial
  const now = performance.now();
  const dt  = now - lastFpsTs;
  lastFpsTs  = now;
  fpsSmooth  = fpsSmooth * 0.9 + (1000 / dt) * 0.1;
  frameCount++;
  if (frameCount % 20 === 0) {
    fpsCtr.textContent = `FPS: ${Math.round(fpsSmooth)}`;
  }

  // Dibujar frame de cámara espejado a ~60 FPS
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // REQUISITO 3: Skip Frames — IA solo procesa 1 de cada 3 frames
  aiFrameCounter = (aiFrameCounter + 1) % SKIP_FRAMES;
  const runAI = aiFrameCounter === 0;

  if (runAI && detector) {
    // Estimación asíncrona: no bloquea el hilo de renderizado
    detector.estimatePoses(vid)
      .then(poses => {
        if (!poses || poses.length === 0) {
          gestureDisp.textContent = 'Sin persona detectada';
          barLw.style.width = '0%';
          barRw.style.width  = '0%';
          valLw.textContent  = '—';
          valRw.textContent  = '—';
          lastKeypoints = null;
          return;
        }
        lastKeypoints = poses[0].keypoints;
        analyzeGesture(lastKeypoints);
        drawSkeleton(lastKeypoints);
      })
      .catch(() => {});
  } else if (lastKeypoints) {
    // Reutilizar el último resultado cacheado en frames intermedios
    drawSkeleton(lastKeypoints);
  }

  requestAnimationFrame(loop);
}

/* =============================================
   UTILIDAD: setStatus(txt, dotClass)
============================================= */
function setStatus(txt, dotClass) {
  statusTxt.textContent = txt;
  if (dotClass) statusDot.className = dotClass;
}

/* =============================================
   EVENTO: clic en "Activar cámara"
============================================= */
btnStart.addEventListener('click', async () => {
  btnStart.disabled    = true;
  btnStart.textContent = 'Inicializando…';

  try {
    await initModel();
    await startCamera();

    // Ocultar overlay y arrancar el bucle
    camOverlay.classList.add('hidden');
    setStatus('Detección activa — gestos habilitados', 'ready');
    gestureDisp.textContent = 'En espera…';

    running = true;
    requestAnimationFrame(loop);

  } catch (err) {
    // Mostrar error claro (permisos de cámara, WebGL no disponible, etc.)
    setStatus('Error: ' + (err.message || err), 'error');
    btnStart.disabled    = false;
    btnStart.textContent = 'Reintentar';
    console.error('[Coveflow]', err);
  }
});

/* =============================================
   INICIO — Render inicial del carrusel
============================================= */
renderCarousel();
setStatus('Listo — presiona "Activar cámara"');