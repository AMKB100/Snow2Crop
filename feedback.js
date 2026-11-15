function createInteractionFeedback(readVolume) {
  let audioContext;
  let lastTick = -Infinity;

  function prepareSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || readVolume() === 0) return null;
    try {
      audioContext ||= new Audio();
      if (audioContext.state === 'running') return Promise.resolve(audioContext);
      return audioContext.resume().then(() => audioContext).catch(() => null);
    } catch {
      return null;
    }
  }

  function play(kind) {
    const tick = kind !== 'tap';
    const nowMs = performance.now();
    const throttled = tick && nowMs - lastTick < 65;
    const touchRelease = kind === 'touch-release';
    if (throttled && (!touchRelease || audioContext?.state === 'running' || readVolume() === 0)) return;
    if (tick) lastTick = nowMs;
    if (!throttled && typeof navigator.vibrate === 'function') navigator.vibrate(tick ? 6 : 12);

    const pending = prepareSound();
    if (!pending) return;
    const started = performance.now();
    pending.then((context) => {
      const volume = readVolume() / 100;
      if (!context || context.state !== 'running' || !volume || performance.now() - started > 150) return;

      const now = context.currentTime;
      const duration = tick ? 0.022 : 0.036;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(tick ? 1320 : 980, now);
      oscillator.frequency.exponentialRampToValueAtTime(tick ? 920 : 560, now + duration);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * (tick ? 0.13 : 0.22), now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + duration);
    });
  }

  return { play };
}
