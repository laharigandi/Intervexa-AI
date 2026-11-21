import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useWebcamMedia Hook
 * 
 * Provides robust media stream lifecycle management for the mock interview webcam experience.
 * Manages video/audio tracks, permission states ('prompt' | 'granted' | 'denied' | 'unavailable' | 'unsupported'),
 * hardware toggles, error handling, and leak-free teardown.
 */
export function useWebcamMedia() {
  const [stream, setStream] = useState(null);
  const [permissionState, setPermissionState] = useState("prompt");
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [availableDevices, setAvailableDevices] = useState({ cameras: [], mics: [] });

  const streamRef = useRef(null);

  // Helper to enumerate available hardware devices
  const updateDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setAvailableDevices({ cameras, mics });
    } catch {
      // enumeration errors are non-fatal
    }
  }, []);

  // Stop all active tracks and reset stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore error on stop
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
  }, []);

  // Request user media stream with progressive fallback
  const startStream = useCallback(
    async ({ withAudio = false } = {}) => {
      // Check browser support
      if (!navigator?.mediaDevices?.getUserMedia) {
        setPermissionState("unsupported");
        setErrorMessage("Webcam access is not supported in this browser environment.");
        return null;
      }

      setErrorMessage(null);

      // Stop any existing stream first
      stopStream();

      let mediaStream = null;

      // 1. Primary attempt: Video (ideal 720p) + requested audio
      try {
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: withAudio,
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // If combined video+audio failed, retry with video only (some devices lack mic hardware)
        if (withAudio && (err.name === "NotFoundError" || err.name === "OverconstrainedError" || err.name === "NotAllowedError")) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user" },
              audio: false,
            });
          } catch (fallbackErr) {
            err = fallbackErr;
          }
        }

        if (!mediaStream) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setPermissionState("denied");
            setErrorMessage("Camera access was blocked. Please grant camera permission in your browser address bar.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setPermissionState("unavailable");
            setErrorMessage("No camera was detected on this device. You can continue without a camera.");
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            setPermissionState("unavailable");
            setErrorMessage("Camera is currently in use by another application. Please close other camera apps and retry.");
          } else {
            setPermissionState("denied");
            setErrorMessage(err.message || "Unable to access camera.");
          }
          return null;
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPermissionState("granted");

      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      setIsCameraEnabled(Boolean(videoTrack && videoTrack.enabled));
      setIsMicEnabled(Boolean(audioTrack && audioTrack.enabled));

      // Refresh device list now that permissions are granted (gives full labels)
      updateDeviceList();

      return mediaStream;
    },
    [stopStream, updateDeviceList]
  );

  // Toggle Video Track On/Off
  const toggleCamera = useCallback(() => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;

    const nextState = !videoTracks[0].enabled;
    videoTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setIsCameraEnabled(nextState);
  }, []);

  // Toggle Audio Track On/Off
  const toggleMic = useCallback(() => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextState = !audioTracks[0].enabled;
    audioTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setIsMicEnabled(nextState);
  }, []);

  // Handle device change events (plug / unplug)
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      updateDeviceList();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    updateDeviceList();

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [updateDeviceList]);

  // Teardown stream on component unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    stream,
    permissionState,
    isCameraEnabled,
    isMicEnabled,
    errorMessage,
    availableDevices,
    startStream,
    stopStream,
    toggleCamera,
    toggleMic,
    setPermissionState,
  };
}
