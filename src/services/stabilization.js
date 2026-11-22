export const DEFAULT_STABILIZER_OPTIONS = {
  windowSize: 8,
  minVotes: 5,
  minConfidence: 0.6,
  cooldownMs: 1500,
};

/**
 * Temporal smoothing for live predictions.
 * A sign becomes stable only after a majority of recent frames agree and the
 * confidence threshold is met. Repeated stable signs are suppressed by a cooldown.
 */
export class GestureStabilizer {
  constructor(options = {}) {
    this.options = { ...DEFAULT_STABILIZER_OPTIONS, ...options };
    this.reset();
  }

  configure(options = {}) {
    this.options = { ...this.options, ...options };
    if (this.history.length > this.options.windowSize) {
      this.history = this.history.slice(-this.options.windowSize);
    }
  }

  reset() {
    this.history = [];
    this.lastStable = null;
    this.lastEmittedAt = 0;
  }

  push(prediction, now = Date.now()) {
    const sign = typeof prediction?.sign === 'string' ? prediction.sign.trim() : '';
    const confidence = Number(prediction?.confidence) || 0;
    const top3 = Array.isArray(prediction?.top3) ? prediction.top3 : [];

    if (!sign || confidence < this.options.minConfidence) {
      this.history = [];
      return {
        status: 'uncertain',
        sign,
        confidence,
        top3,
        votes: 0,
        required: this.options.minVotes,
        isNew: false,
      };
    }

    this.history.push({ sign, confidence });
    if (this.history.length > this.options.windowSize) this.history.shift();

    const counts = new Map();
    const confidenceSums = new Map();
    const lastSeen = new Map();
    this.history.forEach((item, index) => {
      counts.set(item.sign, (counts.get(item.sign) || 0) + 1);
      confidenceSums.set(item.sign, (confidenceSums.get(item.sign) || 0) + item.confidence);
      lastSeen.set(item.sign, index);
    });

    let winner = null;
    let votes = 0;
    let winnerIndex = -1;
    for (const [candidate, count] of counts.entries()) {
      const index = lastSeen.get(candidate);
      // Prefer the newest sign when two candidates tie, so a new gesture takes over quickly.
      if (count > votes || (count === votes && index > winnerIndex)) {
        winner = candidate;
        votes = count;
        winnerIndex = index;
      }
    }
    const averageConfidence = winner ? confidenceSums.get(winner) / votes : 0;

    if (votes < this.options.minVotes) {
      return {
        status: 'stabilizing',
        sign: winner || sign,
        confidence: averageConfidence,
        top3,
        votes,
        required: this.options.minVotes,
        isNew: false,
      };
    }

    const withinCooldown = now - this.lastEmittedAt < this.options.cooldownMs;
    const isNew = winner !== this.lastStable || !withinCooldown;
    if (isNew) {
      this.lastStable = winner;
      this.lastEmittedAt = now;
    }
    return {
      status: 'stable',
      sign: winner,
      confidence: averageConfidence,
      top3,
      votes,
      required: this.options.minVotes,
      isNew,
    };
  }
}
