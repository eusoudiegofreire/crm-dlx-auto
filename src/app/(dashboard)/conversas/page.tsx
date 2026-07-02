import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "@/lib/conversas/mock-data";
import type { MockMessage } from "@/lib/conversas/mock-data";
import { ConversasClient } from "@/components/conversas";

export default function ConversasPage() {
  const messagesByConv = MOCK_MESSAGES.reduce<Record<string, MockMessage[]>>(
    (acc, msg) => {
      if (!acc[msg.conversationId]) acc[msg.conversationId] = [];
      acc[msg.conversationId].push(msg);
      return acc;
    },
    {}
  );

  return (
    <ConversasClient
      conversations={MOCK_CONVERSATIONS}
      messagesByConv={messagesByConv}
    />
  );
}
