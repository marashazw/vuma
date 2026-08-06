/**
 * Plays a brief two-tone notification chirp using the Web Audio API.
 * No external audio file needed. Safe to call repeatedly; each call
 * creates and tears down its own short-lived AudioContext.
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(880, now, 0.12);
    playTone(1108, now + 0.12, 0.14);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Notification sounds are a nice-to-have — never let this break the app.
  }
}
