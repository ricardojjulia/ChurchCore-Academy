export default function StudentLoading() {
  return (
    <div className="student-pwa-loading-shell">
      <div className="student-pwa-loading-nav ops-skeleton" />
      <div className="student-pwa-loading-main">
        <div className="ops-skeleton student-pwa-loading-hero" />
        <div className="student-pwa-loading-grid">
          <div className="ops-skeleton student-pwa-loading-card" />
          <div className="ops-skeleton student-pwa-loading-card" />
          <div className="ops-skeleton student-pwa-loading-card" />
          <div className="ops-skeleton student-pwa-loading-card" />
        </div>
      </div>
    </div>
  );
}
