"use client";

import { useCallback, useRef, useState } from "react";
import { createEnquiryFromChatAction, sendEnquiryChatMessageAction } from "../actions";
import type { EnquiryChatTurn } from "../orchestrator/enquiry-draft";
import type { DraftEnquiryOutput } from "../tools/draft-enquiry";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatPhase = "IDLE" | "THINKING" | "ERROR";

/**
 * State of the enquiry intake chat. The conversation lives here, in the browser, for the session: the durable record is the enquiry,
 * not the chat. Nothing is saved until `create` is called (the "Create enquiry draft" button).
 */
export function useEnquiryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turn, setTurn] = useState<EnquiryChatTurn | null>(null);
  const [created, setCreated] = useState<DraftEnquiryOutput | null>(null);
  const [phase, setPhase] = useState<ChatPhase>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const busy = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy.current) return;
      busy.current = true;
      setStarted(true);
      setError(null);
      setPhase("THINKING");
      setTurn(null);
      const history = messages;
      setMessages([...history, { role: "user", content: message }]);
      try {
        const result = await sendEnquiryChatMessageAction({ history, message });
        if (result.ok) {
          setMessages((current) => [...current, { role: "assistant", content: result.data.reply }]);
          setTurn(result.data);
          setPhase("IDLE");
        } else {
          setError(result.message);
          setPhase("ERROR");
        }
      } catch {
        setError("The assistant could not be reached. Try again.");
        setPhase("ERROR");
      } finally {
        busy.current = false;
      }
    },
    [messages],
  );

  const create = useCallback(async () => {
    if (!turn?.summary || busy.current) return;
    busy.current = true;
    setError(null);
    setPhase("THINKING");
    try {
      const result = await createEnquiryFromChatAction({ summary: turn.summary, requesterName: turn.requesterName, requesterEmail: turn.requesterEmail });
      if (result.ok) {
        setCreated(result.data);
        setTurn(null);
        setPhase("IDLE");
      } else {
        setError(result.message);
        setPhase("ERROR");
      }
    } catch {
      setError("The enquiry could not be saved. Try again.");
      setPhase("ERROR");
    } finally {
      busy.current = false;
    }
  }, [turn]);

  const reset = useCallback(() => {
    setMessages([]);
    setTurn(null);
    setCreated(null);
    setError(null);
    setPhase("IDLE");
    setStarted(false);
  }, []);

  const start = useCallback(() => setStarted(true), []);

  return { messages, turn, created, phase, error, started, send, create, reset, start };
}

export type EnquiryChat = ReturnType<typeof useEnquiryChat>;
