const videoElement =
document.getElementById("video");

const canvasElement =
document.getElementById("drawCanvas");

const estadoEl =
document.getElementById("estado");

const manoEl =
document.getElementById("mano");

const coordXEl =
document.getElementById("coordX");

const coordYEl =
document.getElementById("coordY");

const distanciaEl =
document.getElementById("distancia");

const fpsEl =
document.getElementById("fps");

const ctx =
canvasElement.getContext("2d");

function resizeCanvas(){

    canvasElement.width =
    window.innerWidth;

    canvasElement.height =
    window.innerHeight;

}

resizeCanvas();

window.addEventListener(
    "resize",
    resizeCanvas
);

ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.lineWidth = 6;
ctx.strokeStyle = "#8253f0";

const PINCH_THRESHOLD = 0.05;
const ERASER_RADIUS = 30;
const SMOOTHING = 0.30;

let prevX = null;
let prevY = null;

let smoothX = null;
let smoothY = null;

let lastTime =
performance.now();

let fps = 0;

function resetDrawing(){

    prevX = null;
    prevY = null;

}

function distance(p1,p2){

    return Math.sqrt(

        Math.pow(
            p1.x-p2.x,
            2
        )

        +

        Math.pow(
            p1.y-p2.y,
            2
        )

    );

}

function draw(x,y){

    if(prevX === null){

        prevX = x;
        prevY = y;

        return;

    }

    ctx.beginPath();

    ctx.moveTo(
        prevX,
        prevY
    );

    ctx.lineTo(
        x,
        y
    );

    ctx.stroke();

    prevX = x;
    prevY = y;

}
// FUNCION BORRADOR
function erase(x,y){

    ctx.save();

    ctx.globalCompositeOperation =
    "destination-out";

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        ERASER_RADIUS,
        0,
        Math.PI*2
    );

    ctx.fill();

    ctx.restore();

}
//DETECCION
function isIndexExtended(
    landmarks
){

    const tip =
    landmarks[8];

    const pip =
    landmarks[6];

    return tip.y < pip.y;

}
// FUNCION PRINCIPAL 
function onResults(results){

    const now =
    performance.now();

    fps =
    Math.round(
        1000/(now-lastTime)
    );

    lastTime = now;

    fpsEl.textContent =
    fps;

    if(
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ){

        estadoEl.textContent =
        "⏸ Reposo";

        manoEl.textContent =
        "No";

        resetDrawing();

        return;
    }

    const landmarks =
    results.multiHandLandmarks[0];

    const thumbTip =
    landmarks[4];

    const indexTip =
    landmarks[8];

    const pinchDistance =
    distance(
        thumbTip,
        indexTip
    );

    let x =
    (1-indexTip.x)
    * canvasElement.width;

    let y =
    indexTip.y
    * canvasElement.height;

    if(smoothX === null){

        smoothX = x;
        smoothY = y;

    }

    smoothX =
    SMOOTHING*x +
    (1-SMOOTHING)*smoothX;

    smoothY =
    SMOOTHING*y +
    (1-SMOOTHING)*smoothY;

    x = smoothX;
    y = smoothY;

    coordXEl.textContent =
    Math.round(x);

    coordYEl.textContent =
    Math.round(y);

    distanciaEl.textContent =
    pinchDistance.toFixed(3);

    manoEl.textContent =
    "Sí";

    if(
        pinchDistance <
        PINCH_THRESHOLD
    ){

        estadoEl.textContent =
        "🧽 Borrador";

        erase(x,y);

        resetDrawing();

        return;
    }

    if(
        isIndexExtended(
            landmarks
        )
    ){

        estadoEl.textContent =
        "✏️ Pincel";

        draw(x,y);

        return;
    }

    estadoEl.textContent =
    "⏸ Reposo";

    resetDrawing();

}
//MEDIA PIPE
const hands = new Hands({

    locateFile:(file)=>{

        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

    }

});

hands.setOptions({

    maxNumHands:1,

    modelComplexity:1,

    minDetectionConfidence:0.7,

    minTrackingConfidence:0.7

});

hands.onResults(onResults);
//CAMARA
const camera =
new Camera(
    videoElement,
    {

        onFrame:async()=>{

            await hands.send({

                image:videoElement

            });

        },

        width:1280,
        height:720

    }
);

camera.start();
//LIMPIAR PIZARRA
document
.getElementById("clearBtn")
.addEventListener(
"click",
()=>{

    ctx.clearRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

});