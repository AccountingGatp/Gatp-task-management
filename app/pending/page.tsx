import { redirect } from "next/navigation";
import { BrandMark } from "@/components/ui";
import { getSession } from "@/lib/auth";

export default async function PendingPage() {
  const { user, employee } = await getSession();
  if (!user) redirect("/login");
  if (employee?.active) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[400px]">
        <BrandMark size={36} />
        <h1 className="t-title mt-6">Waiting for access</h1>
        <p className="t-meta mt-2">
          You&apos;re signed in as <span className="font-medium text-ink">{user.email}</span>. An admin needs to add you to the team before you can see tasks.
        </p>
        <p className="t-meta mt-3">Ask an admin to open Team and approve your request. Then reload this page.</p>
        <div className="mt-6 flex gap-2">
          <a href="/pending" className="btn btn-primary">Reload</a>
          <form action="/auth/signout" method="post">
            <button className="btn">Use a different account</button>
          </form>
        </div>
      </div>
    </main>
  );
}
