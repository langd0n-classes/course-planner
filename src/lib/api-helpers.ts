import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return ok(data, 201);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 409 });
}

export function unauthorized(message = "Unauthorized", details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 401 });
}

export function forbidden(message = "Forbidden", details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 403 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function handleZodError(error: ZodError) {
  return badRequest("Validation failed", error.flatten().fieldErrors);
}
