import { AskChat } from "@/components/ask-chat";
import { PageHeader } from "@/components/ui";

const SAFETY_QUESTIONS = [
  "What PPE is required in Zone C?",
  "How should chemicals be stored?",
  "Forklift inspection checklist?",
  "How do I clean up a spill?",
  "How much can one person lift?",
  "What do I do when the fire alarm goes off?",
];

export default function SafetyPage() {
  return (
    <>
      <PageHeader
        title="Safety"
        description="PPE, chemicals, forklifts, lifting and emergencies. Every answer comes from the safety procedures and names the one it used."
      />
      <AskChat
        examples={SAFETY_QUESTIONS}
        introTitle="Common safety questions"
        introText="If there is no procedure for your question, the copilot says so instead of guessing. Ask your supervisor when in doubt."
      />
    </>
  );
}
