import { notImplemented } from "../redesign-stub";
import type { CreateTermRequest, CreateTermResponse, ListTermsResponse } from "@/lib/redesign-contract";

export type { CreateTermRequest, CreateTermResponse, ListTermsResponse };

export async function GET() {
  return notImplemented("/api/terms");
}

export async function POST() {
  return notImplemented("/api/terms");
}
