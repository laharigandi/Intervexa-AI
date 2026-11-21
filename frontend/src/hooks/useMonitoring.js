/**
 * useMonitoring.js
 *
 * Real-time face-presence detection + background-noise monitoring for the
 * Smart Interview Coach interview screen.
 *
 * Face detection backend: @tensorflow-models/blazeface (TF.js WebGL)
 *   - Works in all modern browsers (Chrome, Firefox, Edge, Safari).
 *   - Processes live <video> frames locally — nothing is uploaded.
 *   - Detects face COUNT only. No identity / emotion / attribute inference.
 *
 * Noise detection: Web Audio API AnalyserNode
 *   - Dedicated audio-only MediaStream (does not touch the camera stream).
 *   - Active in BOTH text and voice modes when the interview is live.
 *   - RMS amplitude analysis; calibrates ambient floor before alerting.
 *
 * Previous bug: window.FaceDetector (Chrome Shape Detection API) is behind a
 * flag and unavailable in standard Chrome / Firefox / Safari, so detection
 * never ran. This implementation replaces it with BlazeFace which works in
 * all modern browsers without flags.
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Configuration ─────────────────────────────────────────────────────────────
const FACE_RAF_THROTTLE_MS  = 500;  // run detection ~2fps via RAF+timer
const FACE_GRACE_FRAMES     = 4;   // 4 × 500 ms = 2 s before blocking
const FACE_RECOVERY_FRAMES  = 3;   // 3 × 500 ms = 1.5 s of 1-face to unblock
const FACE_CONFIDENCE_MIN   = 0.6; // ignore BlazeFace detections below this
const FACE_INIT_DELAY_MS    = 1200;// wait for video to paint first frames

const NOISE_CALIBRATION_MS  = 2000;// ambient baseline collection window
const NOISE_MODERATE_DELTA  = 0.015;// baseline + delta → "moderate" (amber)
const NOISE_HIGH_ABS        = 0.06; // absolute RMS → "high" (no immediate block)
const NOISE_BLOCK_SECONDS   = 6;   // sustained high noise → block submission
const NOISE_POLL_MS         = 200; // noise analysis interval (5× per second)

// ─── Status enums ──────────────────────────────────────────────────────────────
export const FACE_STATUS = {
  LOADING       : "loading",       // BlazeFace model being loaded
  INITIALIZING  : "initializing",  // model loaded, video warming up
  OK            : "ok",            // exactly one face
  NO_FACE_GRACE : "no_face_grace", // 0 faces, within grace period
  NO_FACE_ALERT : "no_face_alert", // 0 faces sustained → block
  MULTI_GRACE   : "multi_face_grace", // 2+ faces, within grace period
  MULTI_ALERT   : "multi_face_alert", // 2+ faces sustained → block
  UNAVAILABLE   : "unavailable",   // camera off or stream gone
  ERROR         : "error",         // model load / detection error
};

export const NOISE_STATUS = {
  INACTIVE      : "inactive",
  INITIALIZING  : "initializing",
  CALIBRATING   : "calibrating",
  OK            : "ok",
  MODERATE      : "moderate_noise",
  HIGH_ALERT    : "high_noise_alert",
  UNAVAILABLE   : "unavailable",
};

// ─── Shared BlazeFace model (singleton — loaded once per page load) ───────────
let _modelPromise = null;

async function getBlazeFaceModel() {
  if (_modelPromise) return _modelPromise;
  _modelPromise = (async () => {
    // Dynamic imports keep the model out of the initial bundle parse
    const [tf, blazeface] = await Promise.all([
      import("@tensorflow/tfjs-core"),
      import("@tensorflow-models/blazeface"),
    ]);
    // Register the WebGL backend (GPU-accelerated, zero main-thread blocking)
    await import("@tensorflow/tfjs-backend-webgl");
    await tf.ready();
    const model = await blazeface.load();
    return model;
  })();
  return _modelPromise;
}

// ─── RMS helper ──────────────────────────────────────────────────────────────
function computeRms(dataArray) {
  let sumSq = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / dataArray.length);
}

// =============================================================================
export default function useMonitoring({
  videoRef,
  stream,
  isCameraEnabled,
  isInterviewActive,
}) {
  // ── Face state ────────────────────────────────────────────────────────────
  const [faceStatus, setFaceStatus] = useState(FACE_STATUS.LOADING);
  const [faceCount,  setFaceCount]  = useState(0);
  const [faceError,  setFaceError]  = useState(null);

  // ── Noise state ───────────────────────────────────────────────────────────
  const [noiseStatus, setNoiseStatus] = useState(NOISE_STATUS.INACTIVE);
  const [noiseLevel,  setNoiseLevel]  = useState(0);

  // ── Dev diagnostics (safe, no PII) ───────────────────────────────────────
  const [diagInfo, setDiagInfo] = useState({
    modelLoaded     : false,
    videoReady      : false,
    framesProcessed : 0,
    lastFaceCount   : 0,
    lastConfidence  : 0,
    analyserActive  : false,
    currentRms      : 0,
    graceFrames     : 0,
  });

  // ── Internal refs (stable, no re-render) ─────────────────────────────────
  const modelRef             = useRef(null);
  const faceRafRef           = useRef(null);
  const faceLastTickRef      = useRef(0);
  const faceStoppedRef       = useRef(false);
  const faceGraceCountRef    = useRef(0);
  const faceRecoveryCountRef = useRef(0);
  const faceStatusRef        = useRef(FACE_STATUS.LOADING);
  const framesProcessedRef   = useRef(0);

  const audioCtxRef          = useRef(null);
  const analyserRef          = useRef(null);
  const micStreamRef         = useRef(null);
  const noiseIntervalRef     = useRef(null);
  const noiseCalibSamplesRef = useRef([]);
  const noiseBaselineRef     = useRef(null);
  const noiseCalibStartRef   = useRef(null);
  const highNoiseStartRef    = useRef(null);
  const noiseStatusRef       = useRef(NOISE_STATUS.INACTIVE);

  // ─── Derived block flags (no state — computed from state) ─────────────────
  const faceBlocked = isInterviewActive && (
    faceStatus === FACE_STATUS.NO_FACE_ALERT ||
    faceStatus === FACE_STATUS.MULTI_ALERT
  );
  const noiseBlocked    = isInterviewActive && noiseStatus === NOISE_STATUS.HIGH_ALERT;
  const monitoringBlocked = faceBlocked || noiseBlocked;

  // =========================================================================
  // FACE DETECTION — BlazeFace
  // =========================================================================

  /** Advance the face-status state machine given a new raw count */
  const advanceFaceStatus = useCallback((count) => {
    const current = faceStatusRef.current;
    let next = current;

    if (count === 1) {
      if (current === FACE_STATUS.NO_FACE_ALERT || current === FACE_STATUS.MULTI_ALERT) {
        faceRecoveryCountRef.current += 1;
        if (faceRecoveryCountRef.current >= FACE_RECOVERY_FRAMES) {
          faceGraceCountRef.current    = 0;
          faceRecoveryCountRef.current = 0;
          next = FACE_STATUS.OK;
        }
        // else stay in alert until recovery frames accumulate
      } else {
        faceGraceCountRef.current    = 0;
        faceRecoveryCountRef.current = 0;
        next = FACE_STATUS.OK;
      }
    } else {
      faceRecoveryCountRef.current = 0;
      if (count === 0) {
        if (current === FACE_STATUS.NO_FACE_ALERT) {
          // stay
        } else {
          faceGraceCountRef.current += 1;
          next = faceGraceCountRef.current >= FACE_GRACE_FRAMES
            ? FACE_STATUS.NO_FACE_ALERT
            : FACE_STATUS.NO_FACE_GRACE;
        }
      } else {
        // count > 1
        if (current === FACE_STATUS.MULTI_ALERT) {
          // stay
        } else {
          faceGraceCountRef.current += 1;
          next = faceGraceCountRef.current >= FACE_GRACE_FRAMES
            ? FACE_STATUS.MULTI_ALERT
            : FACE_STATUS.MULTI_GRACE;
        }
      }
    }

    if (next !== current) {
      faceStatusRef.current = next;
      setFaceStatus(next);
    }

    setDiagInfo((d) => ({
      ...d,
      lastFaceCount: count,
      graceFrames  : faceGraceCountRef.current,
    }));
  }, []);

  /** RAF loop — throttled to FACE_RAF_THROTTLE_MS between ticks */
  const faceRafLoop = useCallback(() => {
    if (faceStoppedRef.current) return;

    const now   = performance.now();
    const delta = now - faceLastTickRef.current;

    if (delta >= FACE_RAF_THROTTLE_MS) {
      faceLastTickRef.current = now;

      const model = modelRef.current;
      const video = videoRef?.current;

      const videoReady = video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;

      setDiagInfo((d) => ({ ...d, videoReady: !!videoReady, analyserActive: !!analyserRef.current }));

      if (!model || !videoReady || !isCameraEnabled) {
        // Camera disabled mid-interview
        if (!isCameraEnabled && faceStatusRef.current !== FACE_STATUS.UNAVAILABLE) {
          faceStatusRef.current = FACE_STATUS.UNAVAILABLE;
          setFaceStatus(FACE_STATUS.UNAVAILABLE);
          setFaceCount(0);
        }
      } else {
        // Async detect — result handled in .then() so RAF stays non-blocking
        model.estimateFaces(video, false /* returnTensors */)
          .then((predictions) => {
            if (faceStoppedRef.current) return;

            // Filter by confidence threshold
            const confident = predictions.filter(
              (p) => (p.probability?.[0] ?? 1) >= FACE_CONFIDENCE_MIN
            );
            const count = confident.length;
            const bestConf = confident[0]?.probability?.[0] ?? 0;

            framesProcessedRef.current += 1;
            setFaceCount(count);
            setDiagInfo((d) => ({
              ...d,
              framesProcessed: framesProcessedRef.current,
              lastFaceCount  : count,
              lastConfidence : Math.round(bestConf * 100),
            }));

            advanceFaceStatus(count);
          })
          .catch((err) => {
            if (faceStoppedRef.current) return;
            console.warn("[Monitoring] Face detection tick error:", err);
          });
      }
    }

    faceRafRef.current = requestAnimationFrame(faceRafLoop);
  }, [videoRef, isCameraEnabled, advanceFaceStatus]);

  /** Load BlazeFace model and start the RAF loop */
  const startFaceDetection = useCallback(async () => {
    if (faceRafRef.current || modelRef.current) return; // already running

    faceStoppedRef.current       = false;
    faceGraceCountRef.current    = 0;
    faceRecoveryCountRef.current = 0;
    framesProcessedRef.current   = 0;
    faceLastTickRef.current      = 0;

    faceStatusRef.current = FACE_STATUS.LOADING;
    setFaceStatus(FACE_STATUS.LOADING);
    setFaceError(null);
    setDiagInfo((d) => ({ ...d, modelLoaded: false, framesProcessed: 0 }));

    try {
      const model = await getBlazeFaceModel();
      if (faceStoppedRef.current) return; // was stopped while loading

      modelRef.current = model;
      setDiagInfo((d) => ({ ...d, modelLoaded: true }));

      // Brief warm-up delay so the video element can settle
      await new Promise((r) => setTimeout(r, FACE_INIT_DELAY_MS));
      if (faceStoppedRef.current) return;

      faceStatusRef.current = FACE_STATUS.INITIALIZING;
      setFaceStatus(FACE_STATUS.INITIALIZING);

      faceRafRef.current = requestAnimationFrame(faceRafLoop);
    } catch (err) {
      console.error("[Monitoring] BlazeFace model load error:", err);
      faceStatusRef.current = FACE_STATUS.ERROR;
      setFaceStatus(FACE_STATUS.ERROR);
      setFaceError(err?.message || "Face detection model failed to load.");
    }
  }, [faceRafLoop]);

  /** Stop face detection and cancel all pending work */
  const stopFaceDetection = useCallback(() => {
    faceStoppedRef.current = true;
    if (faceRafRef.current) {
      cancelAnimationFrame(faceRafRef.current);
      faceRafRef.current = null;
    }
    // Do NOT nullify modelRef — the model singleton is shared; let it stay cached
    faceGraceCountRef.current    = 0;
    faceRecoveryCountRef.current = 0;
  }, []);

  // =========================================================================
  // NOISE DETECTION — Web Audio API
  // Note: Active in BOTH text and voice modes (fixed bug: previously text-only
  // mode suppressed noise monitoring entirely).
  // =========================================================================

  /** Noise tick — called by setInterval */
  const noiseTickFn = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx      = audioCtxRef.current;
    if (!analyser || !ctx) return;

    // Resume suspended AudioContext (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    const rms = computeRms(dataArray);

    setNoiseLevel(Math.round(rms * 1000) / 1000);
    setDiagInfo((d) => ({ ...d, analyserActive: true, currentRms: Math.round(rms * 1000) / 1000 }));

    const now = Date.now();

    // ── Phase 1: Calibration ──────────────────────────────────────────────
    if (!noiseBaselineRef.current) {
      if (!noiseCalibStartRef.current) noiseCalibStartRef.current = now;
      noiseCalibSamplesRef.current.push(rms);

      const elapsed = now - noiseCalibStartRef.current;
      if (elapsed >= NOISE_CALIBRATION_MS) {
        const sorted = [...noiseCalibSamplesRef.current].sort((a, b) => a - b);
        const p90    = sorted[Math.floor(sorted.length * 0.9)] || 0.008;
        noiseBaselineRef.current = p90;
        console.log(`[Monitoring] Noise baseline calibrated: ${p90.toFixed(4)}`);
        noiseStatusRef.current = NOISE_STATUS.OK;
        setNoiseStatus(NOISE_STATUS.OK);
      } else {
        if (noiseStatusRef.current !== NOISE_STATUS.CALIBRATING) {
          noiseStatusRef.current = NOISE_STATUS.CALIBRATING;
          setNoiseStatus(NOISE_STATUS.CALIBRATING);
        }
      }
      return;
    }

    // ── Phase 2: Monitoring ───────────────────────────────────────────────
    const baseline = noiseBaselineRef.current;
    let next;

    if (rms >= NOISE_HIGH_ABS) {
      if (!highNoiseStartRef.current) highNoiseStartRef.current = now;
      const sustained = (now - highNoiseStartRef.current) / 1000;
      next = sustained >= NOISE_BLOCK_SECONDS
        ? NOISE_STATUS.HIGH_ALERT
        : NOISE_STATUS.MODERATE;
    } else if (rms >= baseline + NOISE_MODERATE_DELTA) {
      highNoiseStartRef.current = null;
      next = NOISE_STATUS.MODERATE;
    } else {
      highNoiseStartRef.current = null;
      next = NOISE_STATUS.OK;
    }

    if (next !== noiseStatusRef.current) {
      noiseStatusRef.current = next;
      setNoiseStatus(next);
    }
  }, []);

  /** Stop noise monitoring and release all audio resources */
  const stopNoiseDetection = useCallback(() => {
    if (noiseIntervalRef.current) {
      clearInterval(noiseIntervalRef.current);
      noiseIntervalRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch {}
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      micStreamRef.current = null;
    }
    noiseCalibSamplesRef.current = [];
    noiseBaselineRef.current     = null;
    noiseCalibStartRef.current   = null;
    highNoiseStartRef.current    = null;
    noiseStatusRef.current       = NOISE_STATUS.INACTIVE;
    setNoiseStatus(NOISE_STATUS.INACTIVE);
    setNoiseLevel(0);
    setDiagInfo((d) => ({ ...d, analyserActive: false, currentRms: 0 }));
  }, []);

  /** Start noise monitoring — acquires a separate audio-only stream */
  const startNoiseDetection = useCallback(async () => {
    if (micStreamRef.current) return; // already running

    if (!navigator?.mediaDevices?.getUserMedia) {
      setNoiseStatus(NOISE_STATUS.UNAVAILABLE);
      noiseStatusRef.current = NOISE_STATUS.UNAVAILABLE;
      return;
    }

    setNoiseStatus(NOISE_STATUS.INITIALIZING);
    noiseStatusRef.current = NOISE_STATUS.INITIALIZING;

    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // raw signal needed for amplitude analysis
          autoGainControl : false,
        },
        video: false,
      });

      micStreamRef.current = mic;

      const ctx     = new (window.AudioContext || window.webkitAudioContext)();
      const src     = ctx.createMediaStreamSource(mic);
      const analyser = ctx.createAnalyser();
      analyser.fftSize            = 512;
      analyser.smoothingTimeConstant = 0.6; // gentle smoothing, reduces spike sensitivity
      src.connect(analyser);

      audioCtxRef.current  = ctx;
      analyserRef.current  = analyser;

      noiseCalibSamplesRef.current = [];
      noiseBaselineRef.current     = null;
      noiseCalibStartRef.current   = null;
      highNoiseStartRef.current    = null;

      noiseStatusRef.current = NOISE_STATUS.CALIBRATING;
      setNoiseStatus(NOISE_STATUS.CALIBRATING);

      // Resume immediately (needed for browsers that start AudioContext suspended)
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      noiseIntervalRef.current = setInterval(noiseTickFn, NOISE_POLL_MS);
    } catch (err) {
      console.warn("[Monitoring] Mic access denied or failed:", err);
      setNoiseStatus(NOISE_STATUS.UNAVAILABLE);
      noiseStatusRef.current = NOISE_STATUS.UNAVAILABLE;
    }
  }, [noiseTickFn]);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  /** Face detection lifecycle */
  useEffect(() => {
    if (!isInterviewActive) {
      stopFaceDetection();
      if (
        faceStatusRef.current !== FACE_STATUS.ERROR &&
        faceStatusRef.current !== FACE_STATUS.LOADING
      ) {
        faceStatusRef.current = FACE_STATUS.LOADING;
        setFaceStatus(FACE_STATUS.LOADING);
      }
      return;
    }

    if (stream && isCameraEnabled) {
      startFaceDetection();
    } else {
      stopFaceDetection();
      faceStatusRef.current = FACE_STATUS.UNAVAILABLE;
      setFaceStatus(FACE_STATUS.UNAVAILABLE);
    }
  }, [isInterviewActive, stream, isCameraEnabled, startFaceDetection, stopFaceDetection]);

  /** Noise detection lifecycle — now active for ALL input modes (fixed bug) */
  useEffect(() => {
    if (!isInterviewActive) {
      stopNoiseDetection();
      return;
    }
    startNoiseDetection();
  }, [isInterviewActive, startNoiseDetection, stopNoiseDetection]);

  /** Full cleanup on unmount */
  useEffect(() => {
    return () => {
      stopFaceDetection();
      stopNoiseDetection();
    };
  }, [stopFaceDetection, stopNoiseDetection]);

  // =========================================================================
  // RETURN
  // =========================================================================
  return {
    // Core monitoring state
    faceStatus,
    faceCount,
    faceError,
    noiseStatus,
    noiseLevel,

    // Submission gate
    monitoringBlocked,
    faceBlocked,
    noiseBlocked,

    // Legacy compat (MonitoringStatusBar reads this)
    isFaceDetectionSupported: faceStatus !== FACE_STATUS.ERROR,

    // Dev diagnostics (displayed in MonitoringStatusBar dev mode)
    diagInfo,
  };
}
