export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-2 h-10 w-40" />
      <div className="skeleton mb-2 h-40" />
      <div className="skeleton h-40" />
    </div>
  );
}
