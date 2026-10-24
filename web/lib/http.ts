import { connection } from "next/server";
import { AppError, errorResponse } from "./errors";

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("invalid_request", "The request body must be valid JSON.");
  }
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    await connection();
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}
