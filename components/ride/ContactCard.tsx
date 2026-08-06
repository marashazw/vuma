"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RideChat } from "@/components/chat/RideChat";
import { playNotificationSound } from "@/lib/sound";
import type { RideMessage } from "@/lib/types";
import { Phone, MessageCircle, ChevronDown, ChevronUp, PhoneOff } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export function ContactCard({
  rideId,
  otherUserId,
  otherRoleLabel,
}: {
  rideId: string;
  otherUserId: string;
  otherRoleLabel: string; // "driver" or "rider"
}) {
  const supabase = createClient();
  const modal = useModal();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("ride_messages")
      .select("*")
      .eq("ride_id", rideId)
      .order("created_at", { ascending: true });
    setMessages((data as RideMessage[]) || []);
  }, [rideId, supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", otherUserId).single();
      setName(data?.full_name || null);
      setPhone(data?.phone || null);
    })();

    loadMessages();

    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_messages", filter: `ride_id=eq.${rideId}` },
        (payload) => {
          const msg = payload.new as RideMessage;
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, otherUserId, loadMessages, supabase]);

  // Track unread count: any message from the other person that arrives
  // while the chat panel is collapsed counts as unread. Opening the panel
  // clears it.
  useEffect(() => {
    if (!userId || !messages.length) return;
    const latest = messages[messages.length - 1];
    if (latest.sender_id !== userId && !chatOpen) {
      setUnreadCount((c) => c + 1);
      playNotificationSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  function toggleChat() {
    setChatOpen((v) => {
      const next = !v;
      if (next) setUnreadCount(0);
      return next;
    });
  }

  async function send() {
    if (!text.trim() || !userId) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("ride_messages").insert({ ride_id: rideId, sender_id: userId, body });
    if (error) {
      console.error("[ContactCard] failed to send message:", error);
      await modal.alert(`Could not send message: ${error.message}`);
    }
    setSending(false);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="label mb-1">Your {otherRoleLabel}</p>
          <p className="font-semibold">{name || "Loading…"}</p>
        </div>
        {phone ? (
          <a href={`tel:${phone}`} className="btn-dark !py-2 !px-4">
            <Phone className="w-4 h-4" /> Call
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-navy-300">
            <PhoneOff className="w-3.5 h-3.5" /> No phone on file
          </span>
        )}
      </div>

      <button className="btn-ghost w-full justify-between relative" onClick={toggleChat}>
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Chat
          {unreadCount > 0 && (
            <span className="pill bg-[#B22222] text-white font-semibold !text-[10px] !py-0.5">
              {unreadCount} new message{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </span>
        {chatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {chatOpen && (
        <div className="mt-4 pt-4 border-t border-navy-100">
          <RideChat
            messages={messages}
            currentUserId={userId}
            text={text}
            onTextChange={setText}
            onSend={send}
            sending={sending}
          />
        </div>
      )}
    </div>
  );
}
