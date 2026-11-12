import Link from "next/link";
import { BrandMark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5">
      <div className="max-w-sm">
        <BrandMark size={32} />
        <h1 className="t-title mt-5">This page doesn&apos;t exist</h1>
        <p className="t-meta mt-2">It may have been removed, or you may not have access to it.</p>
        <Link href="/" className="btn btn-primary mt-5">Go to my dashboard</Link>
      </div>
    </main>
  );
}
