export type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "unknown_actor"
  | "forbidden"
  | "unauthenticated"
  | "invalid_credentials"
  | "model_unavailable";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json(
    { error: { code: "internal", message } },
    { status: 500 },
  );
}
