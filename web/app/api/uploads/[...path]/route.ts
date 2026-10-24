import { handleAuthed } from "@/lib/http";
import { readUpload } from "@/lib/services/uploads";

export function GET(_request: Request, route: RouteContext<"/api/uploads/[...path]">) {
  return handleAuthed(null, async () => {
    const { path } = await route.params;
    const { bytes, contentType } = readUpload(`uploads/${path.join("/")}`);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
    });
  });
}
