type AuthEnvironment = Readonly<Record<string, string | undefined>>;

export function getPreviewAuthEmail(
  env: AuthEnvironment = process.env,
): string | null {
  if (
    env.VERCEL_ENV !== "preview" ||
    env.COURSE_PLANNER_PREVIEW_AUTH !== "true"
  ) {
    return null;
  }

  return env.COURSE_PLANNER_PREVIEW_EMAIL?.trim() || null;
}

export function isSignInEmailAllowed(
  email: string | null | undefined,
  env: AuthEnvironment = process.env,
): boolean {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = (env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((allowedEmail) => allowedEmail.trim())
    .filter(Boolean);

  const previewEmail = getPreviewAuthEmail(env);
  return (
    allowedEmails.includes(normalizedEmail) || previewEmail === normalizedEmail
  );
}
