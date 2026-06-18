import { AlertTriangle, BookOpenCheck, CheckCircle2, Clock3, Layers3, Link2, Shapes } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import {
  CourseCatalogReviewModel,
  CourseCoverageReviewItem,
  CourseLmsMappingReviewItem,
  CourseReviewCourseItem,
  CourseReviewItem,
  CourseReviewMetric,
  CourseReviewSectionItem,
  buildCourseCatalogReviewModel,
} from "@/modules/course-catalog/review-view";

export default async function CourseSettingsPage() {
  const { dataset } = await loadProtectedAcademyDataset();
  const model = buildCourseCatalogReviewModel(dataset.courseCatalog);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Course Catalog"
      title="Course setup review"
      subtitle="Read-only review for catalog courses, sections, duration readiness, instructor readiness, and LMS mapping posture."
    >
      <section className="ops-stats-grid">
        {model.metrics.map((metric) => (
          <CourseMetric key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="ops-content-grid course-review-primary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <BookOpenCheck />
              </div>
              <div>
                <CardTitle>Catalog Profile</CardTitle>
                <CardDescription>Tenant-level course rules for records, durations, grade levels, and LMS mapping.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.profile.map((item) => (
              <ReviewRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Shapes />
              </div>
              <div>
                <CardTitle>Course Coverage</CardTitle>
                <CardDescription>Catalog mix across faith-based course types and official record modes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="course-coverage-grid">
            <CoverageGroup title="Course types" items={model.courseCoverage} />
            <CoverageGroup title="Record types" items={model.recordCoverage} />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Clock3 />
              </div>
              <div>
                <CardTitle>Section Readiness</CardTitle>
                <CardDescription>Scheduled offerings tied to academic years, periods, subdivisions, and instructors.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="course-review-stack">
            {model.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="ops-content-grid course-review-secondary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Layers3 />
              </div>
              <div>
                <CardTitle>Courses</CardTitle>
                <CardDescription>Definitions for Bible school modules, children&apos;s classes, practicums, chapel, and future college courses.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="course-card-grid">
            {model.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Link2 />
              </div>
              <div>
                <CardTitle>LMS Mapping</CardTitle>
                <CardDescription>Provider-neutral LMS readiness without committing to Moodle, Canvas, or another adapter.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="course-review-stack">
            {model.lmsMappings.length === 0 ? (
              <span className="course-empty-state">No LMS mappings configured</span>
            ) : (
              model.lmsMappings.map((mapping) => <LmsMappingCard key={mapping.id} mapping={mapping} />)
            )}
          </CardContent>
        </Card>

        <ValidationPanel model={model} />
      </section>
    </AdminShell>
  );
}

function CourseMetric({ metric }: { metric: CourseReviewMetric }) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{metric.label}</div>
        <div className="ops-metric-value institution-metric-value">{metric.value}</div>
        <div className="ops-metric-detail">{metric.detail}</div>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ item }: { item: CourseReviewItem }) {
  return (
    <div className="ops-readiness-row">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
  );
}

function CoverageGroup({ title, items }: { title: string; items: CourseCoverageReviewItem[] }) {
  return (
    <div className="course-coverage-group">
      <div className="course-section-heading">{title}</div>
      {items.map((item) => (
        <div key={item.label} className="course-coverage-row">
          <span>{item.label}</span>
          <Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: CourseReviewSectionItem }) {
  return (
    <div className="course-review-card">
      <div>
        <strong>{section.sectionCode}</strong>
        <span>
          {section.courseCode} · {section.courseTitle}
        </span>
      </div>
      <div className="course-card-meta">
        <Badge variant={section.status === "Open" ? "secondary" : "outline"}>{section.status}</Badge>
        <span>{section.deliveryMode}</span>
        <span>{section.schedule}</span>
      </div>
      <div className="course-detail-grid">
        <Detail label="Period" value={section.period} />
        <Detail label="Academic year" value={section.academicYear} />
        <Detail label="Subdivision" value={section.subdivision} />
        <Detail label="Instructor" value={`${section.instructorRole} · ${section.instructorStatus}`} />
        <Detail label="Capacity" value={section.capacity} />
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CourseReviewCourseItem }) {
  return (
    <div className="course-review-card">
      <div>
        <strong>{course.code}</strong>
        <span>{course.title}</span>
      </div>
      <div className="course-card-meta">
        <Badge variant="outline">{course.type}</Badge>
        <Badge variant="secondary">{course.status}</Badge>
        <span>{course.level}</span>
      </div>
      <div className="course-detail-grid">
        <Detail label="Record" value={course.recordType} />
        <Detail label="Duration" value={course.duration} />
        <Detail label="Subdivision" value={course.subdivision} />
        <Detail label="Grade band" value={course.gradeBand} />
      </div>
    </div>
  );
}

function LmsMappingCard({ mapping }: { mapping: CourseLmsMappingReviewItem }) {
  return (
    <div className="course-review-card">
      <div>
        <strong>{mapping.provider}</strong>
        <span>{mapping.course}</span>
      </div>
      <div className="course-card-meta">
        <Badge variant="outline">{mapping.status}</Badge>
        <span>{mapping.policy}</span>
        <span>{mapping.section}</span>
      </div>
      <div className="course-detail-grid">
        <Detail label="External course" value={mapping.externalCourseKey} />
        <Detail label="External section" value={mapping.externalSectionKey} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="course-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValidationPanel({ model }: { model: CourseCatalogReviewModel }) {
  return (
    <Card className="ops-panel course-validation-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon">{model.validation.length === 0 ? <CheckCircle2 /> : <AlertTriangle />}</div>
          <div>
            <CardTitle>Validation Review</CardTitle>
            <CardDescription>Course setup checks for durations, records, instructor readiness, and LMS guardrails.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="ops-list">
        {model.validation.length === 0 ? (
          <div className="ops-readiness-row">
            <span>No course setup warnings</span>
            <Badge variant="secondary">Clear</Badge>
          </div>
        ) : (
          model.validation.map((warning) => (
            <div key={warning} className="ops-list-item">
              <div className="ops-list-icon">
                <AlertTriangle />
              </div>
              <div>
                <strong>Warning</strong>
                <span>{warning}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
