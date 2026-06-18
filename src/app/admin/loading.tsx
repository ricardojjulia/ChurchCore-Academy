export default function AdminLoading() {
  return (
    <div className="ops-loading-shell">
      <div className="ops-loading-sidebar">
        <div className="ops-loading-logo ops-skeleton" />
        <div className="ops-loading-nav-group">
          <div className="ops-skeleton ops-loading-nav-label" />
          <div className="ops-skeleton ops-loading-nav-item" />
          <div className="ops-skeleton ops-loading-nav-item" />
          <div className="ops-skeleton ops-loading-nav-item" />
        </div>
        <div className="ops-loading-nav-group">
          <div className="ops-skeleton ops-loading-nav-label" />
          <div className="ops-skeleton ops-loading-nav-item" />
          <div className="ops-skeleton ops-loading-nav-item" />
        </div>
      </div>
      <div className="ops-loading-main">
        <div className="ops-loading-header">
          <div className="ops-skeleton ops-loading-eyebrow" />
          <div className="ops-skeleton ops-loading-title" />
        </div>
        <div className="ops-loading-stats">
          <div className="ops-skeleton ops-loading-stat" />
          <div className="ops-skeleton ops-loading-stat" />
          <div className="ops-skeleton ops-loading-stat" />
          <div className="ops-skeleton ops-loading-stat" />
        </div>
        <div className="ops-skeleton ops-loading-table" />
      </div>
    </div>
  );
}
