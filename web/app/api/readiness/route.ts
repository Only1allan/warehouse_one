import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { handle } from "@/lib/http";

export function GET() {
  return handle(async () => {
    const port = getModelPort();
    return Response.json({ models: await port.readiness(), warm: port.warmState() });
  });
}

export function POST() {
  return handle(() => {
    const port = getModelPort();
    port.warmUp();
    return Response.json({ started: true, warm: port.warmState() });
  });
}
