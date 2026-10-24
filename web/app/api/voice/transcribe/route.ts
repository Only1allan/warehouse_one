import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { checkTranscript, TRANSCRIPT_MESSAGES } from "@/lib/domain/transcript";
import { AppError } from "@/lib/errors";
import { handleAuthed } from "@/lib/http";

const MAX_BYTES = 10 * 1024 * 1024;

export function POST(request: Request) {
  return handleAuthed("ask", async () => {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 100) throw new AppError("invalid_request", "No audio was received. Try again.");
    if (bytes.length > MAX_BYTES) throw new AppError("invalid_request", "That recording is too long. Keep it short.");
    const { text } = await getModelPort().transcribe(bytes);
    const check = checkTranscript(text);
    if (!check.ok) {
      return Response.json({ text: "", ok: false, reason: check.reason, message: TRANSCRIPT_MESSAGES[check.reason!] });
    }
    return Response.json({ text: check.text, ok: true });
  });
}
