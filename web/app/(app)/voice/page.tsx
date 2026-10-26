import { AskChat } from "@/components/ask-chat";
import { PageHeader } from "@/components/ui";

export default function VoicePage() {
  return (
    <>
      <PageHeader
        title="Hands-free"
        description="Hold the big button, ask your question, let go. You will see what was heard before it is answered."
      />
      <AskChat
        voiceFirst
        examples={["Where is item A340?", "What stock is below minimum levels?", "Show today's receiving schedule."]}
        introTitle="Say things like"
        introText="Speech is turned into text on this device. Nothing is recorded or sent anywhere."
      />
    </>
  );
}
