"use client";

import { useEffect, useRef } from "react";
import type { RideMessage } from "@/lib/types";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function RideChat({
  messages,
  currentUserId,
  text,
  onTextChange,
  onSend,
  sending,
}: {
  messages: RideMessage[];
  currentUserId: string | null;
  text: string;
  onTextChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-72">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {!messages.length && <p className="text-xs text-navy-400 text-center pt-8">No messages yet — say hello.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  mine ? "bg-navy-800 text-paper" : "bg-navy-50 text-navy-700"
                }`}
              >
                <p>{m.body}</p>
                <p className={`text-[10px] mt-1 ${mine ? "text-navy-300" : "text-navy-400"}`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-navy-100 mt-3">
        <input
          className="input !py-2 text-sm"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <button className="btn-primary !py-2 !px-3" onClick={onSend} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
