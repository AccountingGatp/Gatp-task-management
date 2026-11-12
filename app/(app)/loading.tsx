export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-2 h-7 w-56 rounded-md bg-rule-soft" />
      <div className="mb-8 h-4 w-80 rounded bg-rule-soft" />
      <div className="mb-8 h-24 rounded-lg bg-rule-soft" />
      <div className="h-64 rounded-lg bg-rule-soft" />
    </div>
  );
}
