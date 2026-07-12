import { NextResponse } from "next/server";
import type {
  CanonicalRoute,
  NotImplementedResponse,
  RetiredResponse,
} from "@/lib/redesign-contract";

export function notImplemented(route: CanonicalRoute) {
  return NextResponse.json(
    { error: "not_implemented", route } satisfies NotImplementedResponse,
    { status: 501 },
  );
}

// For obsolete Module/Skill-era routes superseded by the redesigned schema.
// These paths are intentionally NOT part of CanonicalRoute: they are retired,
// not reimplemented.
export function retired(message: string) {
  return NextResponse.json(
    { error: "legacy_route_retired", message } satisfies RetiredResponse,
    { status: 410 },
  );
}
