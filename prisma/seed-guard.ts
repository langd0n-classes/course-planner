export function assertSeedForceAllowed(databaseUrl: string | undefined, confirmation?: string): void {
  let url: URL;
  let database: string;
  try {
    url = new URL(databaseUrl ?? "");
    database = decodeURIComponent(url.pathname.slice(1));
    if (!database || !["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("Force seed requires a valid PostgreSQL DATABASE_URL with a database name");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (confirmation === database || (!url.searchParams.has("host") && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname))) return;
  throw new Error(`Refusing force seed on host "${url.hostname}", database "${database}". Set SEED_FORCE_DATABASE to "${database}" to allow deletion.`);
}
