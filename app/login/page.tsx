import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/ui";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";
import { allowedDomains } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: "That account isn't part of the company workspace. Sign in with your company email.",
  link: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const { user } = await getSession();
  if (user && !error) redirect(next ?? "/");
  const domains = allowedDomains();

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <BrandMark size={36} />
        <h1 className="t-title mt-6">Sign in to GATP accounting work</h1>
        <p className="t-meta mt-2">Your tasks, hours and reviews for every client, in one place.</p>
        {error && ERRORS[error] ? (
          <p className="mt-5 rounded-md border border-coral/40 bg-coral-soft px-3 py-2 text-[0.8125rem] text-brick" role="alert">
            {ERRORS[error]}
          </p>
        ) : null}
        <LoginForm next={next ?? "/"} domainHint={domains.length === 1 ? domains[0] : undefined} />
        <p className="hint mt-8">
          {domains.length ? `Only ${domains.map((d) => "@" + d).join(", ")} accounts can sign in. ` : ""}
          New here? Sign in once, then ask an admin to give you access.
        </p>
      </div>
    </main>
  );
}
