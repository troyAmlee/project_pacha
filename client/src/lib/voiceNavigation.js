export function supportsVoiceNavigation() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function shouldSpeakNavigationCue(cue, navigationState) {
  if (
    !navigationState ||
    (navigationState.activeLeg === "route" && !navigationState.snappedToRoute)
  ) {
    return false;
  }

  if (cue.type === "depart") {
    return true;
  }

  if (cue.type === "arrive") {
    return cue.distanceMiles === undefined || cue.distanceMiles <= 0.08;
  }

  if (cue.distanceMiles === undefined) {
    return true;
  }

  return cue.distanceMiles <= 0.25;
}

export function speakNavigationInstruction(text) {
  if (!supportsVoiceNavigation()) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function cancelVoiceNavigation() {
  if (supportsVoiceNavigation()) {
    window.speechSynthesis.cancel();
  }
}
