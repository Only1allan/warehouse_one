import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { handleAuthed } from "@/lib/http";

export function GET() {
  return handleAuthed("readiness", async () => {
    const port = getModelPort();
    return Response.json({ models: await port.readiness(), warm: port.warmState() });
  });
}

export function POST() {
  return handleAuthed("readiness", () => {
    const port = getModelPort();
    port.warmUp();
    return Response.json({ started: true, warm: port.warmState() });
  });
}
