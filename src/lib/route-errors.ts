import { serverError } from "./api-helpers";

export function unexpectedRouteError(error: unknown) {
  console.error("Unexpected API error", error);
  return serverError();
}
