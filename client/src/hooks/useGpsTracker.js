import { useCallback, useEffect, useRef, useState } from "react";
import {
  GPS_CAPTURE_OPTIONS,
  getGpsAccuracyMeters,
  getMovementHeadingDegrees,
  gpsPositionToPoint
} from "../utils";

export function useGpsTracker({ autoStart = false, onError } = {}) {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [currentHeadingDegrees, setCurrentHeadingDegrees] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef(null);
  const lastHeadingPointRef = useRef(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setTracking(false);
    setCurrentHeadingDegrees(null);
    lastHeadingPointRef.current = null;
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      onErrorRef.current?.({ code: "unsupported" });
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = gpsPositionToPoint(position);
        const accuracyMeters = getGpsAccuracyMeters(position);
        const headingDegrees = getMovementHeadingDegrees({
          currentPoint: point,
          previousPoint: lastHeadingPointRef.current,
          gpsPosition: position
        });

        setCurrentPosition(point);
        setCurrentAccuracyMeters(accuracyMeters);

        if (headingDegrees !== null) {
          setCurrentHeadingDegrees(headingDegrees);
          lastHeadingPointRef.current = point;
        } else if (!lastHeadingPointRef.current) {
          lastHeadingPointRef.current = point;
        }
      },
      (geoError) => {
        stopTracking();
        onErrorRef.current?.({
          code: geoError.code === 1 ? "denied" : "failed",
          error: geoError
        });
      },
      GPS_CAPTURE_OPTIONS
    );
  }, [stopTracking]);

  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => stopTracking();
  }, [autoStart, startTracking, stopTracking]);

  return {
    currentPosition,
    currentAccuracyMeters,
    currentHeadingDegrees,
    tracking,
    startTracking,
    stopTracking
  };
}
