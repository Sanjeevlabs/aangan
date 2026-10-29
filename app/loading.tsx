export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="pt-6">
      <div className="skeleton mb-3 h-9 w-48" />
      <div className="skeleton h-[420px] rounded-hero" />
    </div>
  );
}
