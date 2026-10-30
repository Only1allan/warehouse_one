import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { handleAuthed } from "@/lib/http";

export function POST() {
  return handleAuthed("ask", async () => {
    await getModelPort().warmSpeech();
    return Response.json({ ready: true });
  });
}
