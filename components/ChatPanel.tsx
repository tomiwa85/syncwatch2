import { useEffect, useRef, useState } from "react";
import type { ChatMessagePayload } from "@syncwatch/shared";
import { Card } from "../design-system/components/Card.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { MessageIcon } from "../design-system/icons.js";

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  myUserId?: string;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, myUserId, onSend }: ChatPanelProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <Card className="flex h-80 flex-col gap-2 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <MessageIcon size={16} /> Chat
      </h2>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === myUserId;
            return (
              <div key={m.id} className={"flex items-start gap-2 " + (mine ? "flex-row-reverse" : "")}>
                {!mine && <Avatar name={m.displayName} size="sm" />}
                <div className={"max-w-[80%] rounded-sw px-3 py-1.5 text-sm " + (mine ? "bg-accent text-accent-fg" : "bg-surface-raised text-text")}>
                  {!mine && <p className="text-[11px] font-medium text-muted">{m.displayName}</p>}
                  <p className="break-words">{m.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          maxLength={1000}
          className="h-9 flex-1 rounded-sw border border-border bg-surface px-3 text-sm text-text placeholder:text-muted/50 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sw-ring)]"
        />
        <button
          type="submit"
          className="rounded-sw bg-brand px-3 text-sm font-medium text-white transition hover:brightness-110"
        >
          Send
        </button>
      </form>
    </Card>
  );
}
