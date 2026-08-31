"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Loader2 } from "lucide-react";

type CallState = "idle" | "calling" | "ringing" | "connected" | "declined" | "failed";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface SignalPayload {
  from: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export function InAppCall({
  rideId,
  userId,
  otherPartyId,
  otherPartyLabel,
  canCall,
  disabledReason,
}: {
  rideId: string;
  userId: string;
  otherPartyId: string;
  otherPartyLabel: string;
  canCall: boolean;
  disabledReason?: string;
}) {
  const supabase = createClient();
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const currentCallIdRef = useRef<string | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ephemeral signaling only — nothing here is persisted beyond the
  // ride_calls history row created for eligibility/audit purposes. The
  // channel itself carries no phone numbers or contact details, only
  // WebRTC's own offer/answer/ICE-candidate payloads.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const stateRef = useRef<CallState>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const channel = supabase.channel(`ride-call-${rideId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "offer" }, ({ payload }: { payload: SignalPayload }) => handleIncomingOffer(payload))
      .on("broadcast", { event: "answer" }, ({ payload }: { payload: SignalPayload }) => handleAnswer(payload))
      .on("broadcast", { event: "ice-candidate" }, ({ payload }: { payload: SignalPayload }) => handleRemoteCandidate(payload))
      .on("broadcast", { event: "decline" }, ({ payload }: { payload: SignalPayload }) => handleRemoteDecline(payload))
      .on("broadcast", { event: "hangup" }, ({ payload }: { payload: SignalPayload }) => handleRemoteHangup(payload))
      .subscribe();

    return () => {
      cleanupCall();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  function send(event: string, payload: Omit<SignalPayload, "from">) {
    channelRef.current?.send({ type: "broadcast", event, payload: { from: userId, ...payload } });
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) send("ice-candidate", { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // Most likely cause on the free tier: no TURN server, and one or
        // both parties are behind NAT that STUN alone can't traverse.
        setState("failed");
        cleanupCall();
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function startCall() {
    if (!canCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("offer", { sdp: offer });

      const { data } = await supabase
        .from("ride_calls")
        .insert({ ride_id: rideId, caller_id: userId, callee_id: otherPartyId, status: "initiated" })
        .select()
        .single();
      currentCallIdRef.current = data?.id || null;

      setState("calling");
    } catch {
      setState("failed");
    }
  }

  async function handleIncomingOffer(payload: SignalPayload) {
    if (!payload.sdp || stateRef.current !== "idle") return;
    pendingCandidatesRef.current = [];
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    setState("ringing");
  }

  async function acceptCall() {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("answer", { sdp: answer });

      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      callStartedAtRef.current = Date.now();
      startTimer();
      setState("connected");
    } catch {
      setState("failed");
    }
  }

  function declineCall() {
    send("decline", {});
    cleanupCall();
    setState("idle");
  }

  async function handleAnswer(payload: SignalPayload) {
    if (!payload.sdp || !pcRef.current) return;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    for (const candidate of pendingCandidatesRef.current) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidatesRef.current = [];
    callStartedAtRef.current = Date.now();
    startTimer();
    if (currentCallIdRef.current) {
      await supabase.from("ride_calls").update({ status: "answered" }).eq("id", currentCallIdRef.current);
    }
    setState("connected");
  }

  async function handleRemoteCandidate(payload: SignalPayload) {
    if (!payload.candidate) return;
    const pc = pcRef.current;
    // A candidate can legitimately arrive before the remote description
    // is set (a genuine, well-known WebRTC race, not a bug) — queue it
    // and flush once the offer/answer exchange actually completes.
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } else {
      pendingCandidatesRef.current.push(payload.candidate);
    }
  }

  function handleRemoteDecline(_payload: SignalPayload) {
    if (stateRef.current !== "calling") return;
    setState("declined");
    cleanupCall();
    if (currentCallIdRef.current) {
      supabase.from("ride_calls").update({ status: "declined" }).eq("id", currentCallIdRef.current);
    }
    setTimeout(() => setState("idle"), 2500);
  }

  function handleRemoteHangup(_payload: SignalPayload) {
    endCall(false);
  }

  function startTimer() {
    setCallSeconds(0);
    timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
  }

  function cleanupCall() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    setMuted(false);
  }

  async function endCall(notifyOther = true) {
    if (notifyOther) send("hangup", {});
    if (currentCallIdRef.current) {
      const durationSeconds = callStartedAtRef.current ? Math.round((Date.now() - callStartedAtRef.current) / 1000) : 0;
      await supabase
        .from("ride_calls")
        .update({ status: "ended", ended_at: new Date().toISOString(), duration_seconds: durationSeconds })
        .eq("id", currentCallIdRef.current);
    }
    currentCallIdRef.current = null;
    callStartedAtRef.current = null;
    cleanupCall();
    setState("idle");
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }

  const minutes = Math.floor(callSeconds / 60);
  const seconds = callSeconds % 60;

  return (
    <div>
      <audio ref={remoteAudioRef} autoPlay />

      {state === "idle" && (
        <button className="btn-ghost w-full !text-sm" disabled={!canCall} onClick={startCall} title={disabledReason}>
          <Phone className="w-4 h-4" /> Call {otherPartyLabel} (in-app)
        </button>
      )}

      {!canCall && disabledReason && state === "idle" && <p className="text-xs text-navy-400 text-center mt-1">{disabledReason}</p>}

      {state === "calling" && (
        <div className="card p-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-navy-400" />
          <p className="text-sm text-navy-600">Calling {otherPartyLabel}&hellip;</p>
          <button className="btn-danger !text-sm mt-3" onClick={() => endCall()}>
            <PhoneOff className="w-4 h-4" /> Cancel
          </button>
        </div>
      )}

      {state === "ringing" && (
        <div className="card p-4 text-center bg-jade-50 border-jade-200">
          <PhoneIncoming className="w-5 h-5 mx-auto mb-2 text-jade-600" />
          <p className="text-sm font-semibold text-jade-700">{otherPartyLabel} is calling&hellip;</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary flex-1 !text-sm" onClick={acceptCall}>
              Accept
            </button>
            <button className="btn-danger flex-1 !text-sm" onClick={declineCall}>
              Decline
            </button>
          </div>
        </div>
      )}

      {state === "connected" && (
        <div className="card p-4 text-center bg-navy-800 text-paper">
          <p className="text-sm text-navy-300">In call with {otherPartyLabel}</p>
          <p className="fare-figure text-xl font-bold mt-1">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </p>
          <div className="flex gap-2 mt-3">
            <button className="btn-ghost flex-1 !text-sm !bg-navy-700 !text-paper" onClick={toggleMute}>
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {muted ? "Unmute" : "Mute"}
            </button>
            <button className="btn-danger flex-1 !text-sm" onClick={() => endCall()}>
              <PhoneOff className="w-4 h-4" /> End call
            </button>
          </div>
        </div>
      )}

      {state === "declined" && <p className="text-xs text-coral-600 text-center">Call declined.</p>}

      {state === "failed" && (
        <p className="text-xs text-coral-600 text-center">
          Couldn't connect the call — this can happen on some mobile networks. Try again, or use the app's chat instead.
        </p>
      )}
    </div>
  );
}
