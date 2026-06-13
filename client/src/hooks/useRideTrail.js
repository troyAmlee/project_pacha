import { useCallback, useEffect, useMemo, useState } from "react";
import { computePathMiles, shouldAddGpsPoint } from "../utils";

export function useRideTrail({ currentPosition, tracking }) {
  const [trail, setTrail] = useState([]);
  const [rideStartedAt, setRideStartedAt] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (!tracking || !currentPosition) {
      return;
    }

    setTrail((current) =>
      shouldAddGpsPoint(current, currentPosition) ? [...current, currentPosition] : current
    );
  }, [tracking, currentPosition]);

  useEffect(() => {
    if (!rideStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMinutes(Math.max(1, Math.round((Date.now() - rideStartedAt) / 60000)));
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [rideStartedAt]);

  const trailMiles = useMemo(() => computePathMiles(trail), [trail]);

  const startRide = useCallback(() => {
    setRideStartedAt(Date.now());
    setElapsedMinutes(1);
  }, []);

  const resetRide = useCallback(() => {
    setTrail([]);
    setRideStartedAt(null);
    setElapsedMinutes(0);
  }, []);

  return { trail, trailMiles, rideStartedAt, elapsedMinutes, startRide, resetRide };
}
