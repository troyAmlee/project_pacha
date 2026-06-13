import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelVoiceNavigation,
  shouldSpeakNavigationCue,
  speakNavigationInstruction,
  supportsVoiceNavigation
} from "../lib/voiceNavigation";

export function useVoiceNavigation({ navigationState, tracking, t, onUnsupported }) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(() => t("rideScreen.voiceStatusOff"));
  const lastSpokenCueRef = useRef("");
  const onUnsupportedRef = useRef(onUnsupported);

  useEffect(() => {
    onUnsupportedRef.current = onUnsupported;
  }, [onUnsupported]);

  useEffect(() => () => cancelVoiceNavigation(), []);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    if (!tracking) {
      setVoiceStatus("Voice guidance waits for GPS tracking.");
      return;
    }

    const cue = navigationState?.cue;

    if (!cue?.voiceInstruction || !shouldSpeakNavigationCue(cue, navigationState)) {
      return;
    }

    const voiceKey = cue.voiceKey ?? `${navigationState.activeLeg}:${cue.primary}`;

    if (lastSpokenCueRef.current === voiceKey) {
      return;
    }

    lastSpokenCueRef.current = voiceKey;
    setVoiceStatus(cue.voiceInstruction);
    speakNavigationInstruction(cue.voiceInstruction);
  }, [
    navigationState?.activeLeg,
    navigationState?.cue,
    navigationState?.snappedToRoute,
    tracking,
    voiceEnabled
  ]);

  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      setVoiceStatus(t("rideScreen.voiceStatusOff"));
      lastSpokenCueRef.current = "";
      cancelVoiceNavigation();
      return;
    }

    if (!supportsVoiceNavigation()) {
      const message = t("rideScreen.voiceUnsupported");
      setVoiceStatus(message);
      onUnsupportedRef.current?.(message);
      return;
    }

    setVoiceEnabled(true);
    setVoiceStatus(t("rideScreen.voiceStatusOn"));
    speakNavigationInstruction(t("rideScreen.voiceStatusOn"));
  }, [voiceEnabled, t]);

  return { voiceEnabled, voiceStatus, toggleVoice };
}
