type DemoEnvironment = Readonly<Record<string, string | undefined>>;

type DemoDatabase = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
};

const SIGN_IN_VARIABLES = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ALLOWED_EMAIL",
  "COURSE_PLANNER_PREVIEW_AUTH",
  "COURSE_PLANNER_PREVIEW_EMAIL",
] as const;

export class DemoModeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoModeConfigError";
  }
}

export function demoModeConfig(
  env: DemoEnvironment = process.env,
): { enabled: boolean } {
  if (env.COURSE_PLANNER_DEMO !== "true") {
    return { enabled: false };
  }

  const conflicts = SIGN_IN_VARIABLES.filter((name) => env[name]?.trim());
  if (conflicts.length > 0) {
    throw new DemoModeConfigError(
      `Demo mode conflicts with sign-in configuration: ${conflicts.join(", ")}`,
    );
  }

  return { enabled: true };
}

export function isDemoMode(env: DemoEnvironment = process.env): boolean {
  return demoModeConfig(env).enabled;
}

export const DEMO_MARKER_TABLE = "_demo_marker";

export async function hasDemoMarker(db: DemoDatabase): Promise<boolean> {
  const [row] = await db.$queryRaw<{ marker: string | null }[]>`
    SELECT to_regclass('public._demo_marker')::text AS marker
  `;
  // A missing row is treated as a missing marker, so the guard stays closed.
  return (row?.marker ?? null) !== null;
}

export async function assertDemoDatabase(
  db: DemoDatabase,
  env: DemoEnvironment = process.env,
): Promise<void> {
  if (!isDemoMode(env)) {
    throw new DemoModeConfigError("Demo mode is not enabled.");
  }
  if (!(await hasDemoMarker(db))) {
    throw new DemoModeConfigError("Demo database marker is absent.");
  }
}
