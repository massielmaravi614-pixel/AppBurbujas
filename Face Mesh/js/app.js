const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const faceStatus = document.getElementById("faceStatus");
const faceWidth = document.getElementById("faceWidth");
const faceAngle = document.getElementById("faceAngle");
const fpsEl = document.getElementById("fps");
const glassWidthEl = document.getElementById("glassWidth");

const aviadorBtn = document.getElementById("aviadorBtn");
const retroBtn = document.getElementById("retroBtn");

// =====================
// IMÁGENES
// =====================

const aviador = new Image();
aviador.src = "assets/aviador.png";

const retro = new Image();
retro.src = "assets/retro.svg";

let currentGlasses = aviador;

aviador.onload = () => {
    console.log("Aviador cargado");
};

retro.onload = () => {
    console.log("Retro cargado");
};

aviadorBtn.onclick = () => {
    currentGlasses = aviador;
};

retroBtn.onclick = () => {
    currentGlasses = retro;
};

// =====================
// CANVAS
// =====================

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();

window.addEventListener(
    "resize",
    resizeCanvas
);

// =====================
// FPS
// =====================

let lastTime = performance.now();

// =====================
// UTILIDADES
// =====================

function distance(x1, y1, x2, y2) {

    return Math.sqrt(
        (x2 - x1) * (x2 - x1) +
        (y2 - y1) * (y2 - y1)
    );

}

function drawPoint(x, y, color) {

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        6,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = color;
    ctx.fill();

}

// =====================
// FACEMESH
// =====================

function onResults(results) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const now = performance.now();

    const fps = Math.round(
        1000 / (now - lastTime)
    );

    lastTime = now;

    fpsEl.textContent = fps;

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        faceStatus.textContent = "No";

        return;
    }

    faceStatus.textContent = "Sí";

    const landmarks =
        results.multiFaceLandmarks[0];

    const nose = landmarks[6];
    const leftTemple = landmarks[234];
    const rightTemple = landmarks[454];

    const noseX =
        nose.x * canvas.width;

    const noseY =
        nose.y * canvas.height;

    const leftX =
        leftTemple.x * canvas.width;
    const leftY =
        leftTemple.y * canvas.height;

    const rightX =
        rightTemple.x * canvas.width;

    const rightY =
        rightTemple.y * canvas.height;

    const width =
        distance(
            leftX,
            leftY,
            rightX,
            rightY
        );

    faceWidth.textContent =
        Math.round(width);

    const angle =
        Math.atan2(
            rightY - leftY,
            rightX - leftX
        );

    faceAngle.textContent =
        (
            angle *
            180 /
            Math.PI
        ).toFixed(1);

    // =====================
    // GAFAS
    // =====================

    if (currentGlasses.complete) {

        const glassesWidth =
            width * 0.8;

        glassWidthEl.textContent =
            Math.round(glassesWidth);

        const aspectRatio =
            currentGlasses.height /
            currentGlasses.width;

        const glassesHeight =
            glassesWidth *
            aspectRatio;

        const offsetY =
            -glassesHeight * 0.05;

        ctx.save();

        ctx.translate(
            noseX,
            noseY + offsetY
        );

        ctx.rotate(angle);
        ctx.strokeStyle = "red";

        ctx.strokeRect(
            -glassesWidth / 2,
            -glassesHeight / 2,
            glassesWidth,
            glassesHeight
        );

        ctx.drawImage(
            currentGlasses,
            -glassesWidth / 2,
            -glassesHeight / 2,
            glassesWidth,
            glassesHeight
        );

        ctx.restore();

    }

    // =====================
    // LANDMARKS
    // =====================

    drawPoint(
        noseX,
        noseY,
        "#00ff00"
    );

    drawPoint(
        leftX,
        leftY,
        "#ff0000"
    );

    drawPoint(
        rightX,
        rightY,
        "#0000ff"
    );

}

// =====================
// MEDIAPIPE
// =====================

const faceMesh =
new FaceMesh({

    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }

});

faceMesh.setOptions({

    maxNumFaces: 1,

    refineLandmarks: true,

    minDetectionConfidence: 0.7,

    minTrackingConfidence: 0.7

});

faceMesh.onResults(onResults);

// =====================
// CÁMARA
// =====================

const camera =
new Camera(video, {

    onFrame: async () => {

        await faceMesh.send({
            image: video
        });

    },

    width: 1280,
    height: 720

});

camera.start();