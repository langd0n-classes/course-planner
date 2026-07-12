import { NextResponse } from "next/server";
import type { CanonicalRoute, NotImplementedResponse } from "@/lib/redesign-contract";

export function notImplemented(route: CanonicalRoute) {
  return NextResponse.json(
    { error: "not_implemented", route } satisfies NotImplementedResponse,
    { status: 501 },
  );
}
