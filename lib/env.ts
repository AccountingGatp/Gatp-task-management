// Central place for environment variables, so a missing value fails with a clear message.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  return key;
}

export function assertPublicEnv() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See DEPLOYMENT.md, step 4.",
    );
  }
}

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const domains = allowedDomains();
  if (domains.length === 0) return true;
  const domain = (email ?? "").split("@")[1]?.toLowerCase();
  return !!domain && domains.includes(domain);
}
