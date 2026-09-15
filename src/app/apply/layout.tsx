export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="apply-portal">
      {children}
    </div>
  );
}
