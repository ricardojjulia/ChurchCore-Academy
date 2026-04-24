import Link from "next/link";

interface AcademyShellProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  badge?: string;
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/workflows", label: "Workflow Queue" },
  { href: "/students/stu-maya-bennett", label: "Student Profile" },
  { href: "/programs/prog-biblical-studies", label: "Program Panel" },
  { href: "/faculty", label: "Faculty/Admin" },
];

export function AcademyShell({ title, subtitle, eyebrow, badge, children }: AcademyShellProps) {
  return (
    <div className="academy-app">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand-lockup">
            <div className="brand-seal">CA</div>
            <div>
              <div className="brand-heading">ChurchCore Academy</div>
              <div className="brand-caption">Administrative and academic-record operations, isolated from the LMS</div>
            </div>
          </div>
          <div className="masthead-badge">{badge ?? "ShepherdAI Academy · Explainable workflow recommendations"}</div>
        </div>

        <nav className="academy-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="page-shell">
        <section className="page-hero panel">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <div className="page-hero-row">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="boundary-box">
              <div className="boundary-title">Important boundary</div>
              <p>
                ChurchCore Academy is the administrative and academic-record system, not the LMS. ShepherdAI Academy is product-specific and uses only Academy data.
              </p>
            </div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
