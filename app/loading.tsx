export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading memories">
      <h1>Aangan</h1>
      <p className="sub">Memory Lane — our family timeline.</p>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </main>
  );
}
