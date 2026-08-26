import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X } from "lucide-react";

import logoAsset from "@/assets/tgo-logo-light.png.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

const SUGGESTIONS = [
  "How many active employees do we have?",
  "Who joined in the last 3 months?",
  "Which department has the most people?",
];

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && !busy) textareaRef.current?.focus();
  }, [open, busy]);

  function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setInput("");
    void sendMessage({ text: value });
  }

  return (
    <>
      <Button
        size="icon"
        aria-label={open ? "Close support chat" : "Open support chat"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 size-12 rounded-full shadow-lg"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>

      <div
        className={cn(
          "fixed bottom-20 right-5 z-40 flex h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-xl transition-all",
          open ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <img src={logoAsset.url} alt="" aria-hidden className="h-6 w-auto object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Workforce Support</p>
            <p className="truncate text-xs text-muted-foreground">
              Ask about employees, hiring and the portal
            </p>
          </div>
        </div>

        <Conversation className="flex-1">
          <ConversationContent className="gap-4 p-3">
            {messages.length === 0 && (
              <div className="space-y-3 py-4 text-sm text-muted-foreground">
                <p>Hi! I can answer questions about your TGO workforce data.</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-md border px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const text = message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              if (!text) return null;
              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    <MessageResponse>{text}</MessageResponse>
                  </MessageContent>
                </Message>
              );
            })}

            {status === "submitted" && <Shimmer className="text-sm">Thinking...</Shimmer>}
            {error && (
              <p className="text-sm text-destructive">
                Something went wrong. Please try again in a moment.
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-2">
          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your workforce..."
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() || busy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}
