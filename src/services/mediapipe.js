import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

let landmarkerPromise = null;

export function loadHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

/**
 * Detect up to two hands. Returns an array of hands (each 21 {x,y,z} points),
 * or an empty array when no hand is visible.
 */
export function detectHands(landmarker, video, timestampMs) {
  if (!landmarker || !video || video.readyState < 2) return [];
  try {
    const result = landmarker.detectForVideo(video, timestampMs);
    return (result?.landmarks || []).map((points) =>
      points.map((point) => ({ x: point.x, y: point.y, z: point.z })),
    );
  } catch {
    return [];
  }
}

/**
 * Convert detected hands to the model's two-hand frame format: (2, 21, 3).
 * Hands are ordered by wrist x (left-most first) to match the dataset
 * normalisation; a single hand is placed in the channel matching its side.
 */
export function handsToFrame(hands) {
  const frame = [
    Array.from({ length: 21 }, () => [0, 0, 0]),
    Array.from({ length: 21 }, () => [0, 0, 0]),
  ];
  if (!hands?.length) return frame;
  const ordered = [...hands].sort((a, b) => (a?.[0]?.x ?? 0) - (b?.[0]?.x ?? 0));
  const encode = (hand) => hand.map((point) => [point.x, point.y, point.z]);
  if (ordered.length === 1) {
    const index = (ordered[0]?.[0]?.x ?? 0.5) < 0.5 ? 0 : 1;
    frame[index] = encode(ordered[0]);
    return frame;
  }
  frame[0] = encode(ordered[0]);
  frame[1] = encode(ordered[1]);
  return frame;
}

function paintHand(context, landmarks, width, height) {
  for (const [start, end] of HAND_CONNECTIONS) {
    const from = landmarks[start];
    const to = landmarks[end];
    if (!from || !to) continue;
    context.beginPath();
    context.moveTo(from.x * width, from.y * height);
    context.lineTo(to.x * width, to.y * height);
    context.stroke();
  }
  for (const point of landmarks) {
    context.beginPath();
    context.arc(point.x * width, point.y * height, Math.max(3, width / 180), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}

export function drawHands(canvas, hands) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!hands?.length) return;
  const width = canvas.width;
  const height = canvas.height;
  context.lineWidth = Math.max(2, width / 320);
  context.strokeStyle = '#6D28D9';
  context.fillStyle = '#DDD6FE';
  context.shadowColor = 'rgba(109, 40, 217, 0.35)';
  context.shadowBlur = 6;
  for (const landmarks of hands) paintHand(context, landmarks, width, height);
  context.shadowBlur = 0;
}

export function drawHand(canvas, landmarks) {
  drawHands(canvas, landmarks?.length ? [landmarks] : []);
}

export function clearCanvas(canvas) {
  if (!canvas) return;
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}
