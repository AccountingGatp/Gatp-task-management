"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg py-10">
      <h1 className="t-title">This page couldn&apos;t load</h1>
      <p className="t-meta mt-2">{error.message || "The server returned an error."}</p>
      <p className="hint mt-1">If it keeps happening, check that the database migration ran and the environment variables are set (see DEPLOYMENT.md).</p>
      <button className="btn btn-primary mt-5" onClick={reset}>Try again</button>
    </div>
  );
}
