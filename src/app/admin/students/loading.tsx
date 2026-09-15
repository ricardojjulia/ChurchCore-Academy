export default function Loading() {
  return (
    <div className="ops-loading-shell">
      <div className="ops-loading-main">
        <div className="ops-loading-header">
          <div className="ops-skeleton ops-loading-eyebrow" />
          <div className="ops-skeleton ops-loading-title" />
        </div>
        <div className="ops-skeleton ops-loading-table" />
      </div>
    </div>
  );
}
