/**
 * LMS UI SPECIFICATION v1.0 — IMPLEMENTATION GUIDE
 * 
 * This guide shows how to apply the specification to existing pages
 * in the ChurchCore Academy application.
 * 
 * SECTIONS:
 * 1. Typography Scale
 * 2. Color Token Enforcement
 * 3. Navigation with Role-Based Visibility
 * 4. Page Templates
 * 5. Responsive Behavior
 * 6. Accessibility
 */

/**
 * ============================================================================
 * SECTION 1: TYPOGRAPHY SCALE
 * ============================================================================
 * 
 * The specification defines a strict typography scale.
 * Apply these classes instead of arbitrary font sizes.
 * 
 * HIERARCHY:
 * - Page titles:           text-3xl font-extrabold (30px, 800 weight)
 * - Section headings:      text-2xl font-extrabold (24px, 800 weight)
 * - Subsection headings:   text-xl font-bold (20px, 700 weight)
 * - Card headers:          text-lg font-bold (18px, 700 weight)
 * - Body text:             text-base font-normal (16px, 400 weight)
 * - Form labels:           text-sm font-semibold (14px, 600 weight)
 * - Helper text:           text-xs font-normal (12px, 400 weight)
 * 
 * BEFORE (bad - arbitrary sizes):
 * ```
 * <h1 style={{fontSize: '28px', fontWeight: 'bold'}}>Courses</h1>
 * <p style={{fontSize: '15px', color: '#666'}}>Manage your course catalog</p>
 * ```
 * 
 * AFTER (good - uses spec classes):
 * ```
 * <h1 className="text-2xl font-extrabold">Courses</h1>
 * <p className="text-sm text-muted-foreground">Manage your course catalog</p>
 * ```
 */

/**
 * ============================================================================
 * SECTION 2: COLOR TOKEN ENFORCEMENT
 * ============================================================================
 * 
 * All colors must use the semantic color tokens from tailwind.config.ts
 * Do NOT use arbitrary hex values or hardcoded colors.
 * 
 * SEMANTIC TOKENS:
 * - Primary actions:       bg-primary text-primary-foreground
 * - Secondary buttons:     bg-secondary text-secondary-foreground
 * - Text hierarchy:
 *   - Main text:          text-foreground
 *   - Secondary text:     text-muted-foreground
 *   - Links:              text-primary hover:underline
 * - Backgrounds:
 *   - Page background:     bg-background (light slate-50)
 *   - Card background:     bg-card (white)
 *   - Section background: bg-slate-50
 * - Status colors (semantic):
 *   - Success:            bg-emerald-50 text-emerald-700
 *   - Warning:            bg-amber-50 text-amber-700
 *   - Error:              bg-rose-50 text-rose-600
 *   - Info:               bg-violet-50 text-violet-700
 *   - Disabled:           bg-slate-100 text-slate-500
 * 
 * BEFORE (bad - hardcoded hex):
 * ```
 * <div style={{backgroundColor: '#4F46E5', color: '#FFFFFF'}}>
 *   Save
 * </div>
 * ```
 * 
 * AFTER (good - uses tokens):
 * ```
 * <div className="bg-primary text-primary-foreground">
 *   Save
 * </div>
 * ```
 */

/**
 * ============================================================================
 * SECTION 3: NAVIGATION WITH ROLE-BASED VISIBILITY
 * ============================================================================
 * 
 * Use TopNavbar component with role-based link filtering.
 * The navbar is sticky, dark (bg-slate-900), and supports horizontal scrolling on mobile.
 * 
 * PATTERN:
 * ```
 * import { TopNavbar, PageLayout } from '@/components/academy/navigation';
 * 
 * export function CourseCatalogPage() {
 *   const userRole = await getCurrentUserRole();
 *   
 *   const navLinks = [
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'Courses', href: '/courses' },
 *     { label: 'Students', href: '/students', roles: ['admin', 'registrar'] },
 *     { label: 'Settings', href: '/settings', roles: ['admin'] },
 *   ];
 *   
 *   return (
 *     <>
 *       <TopNavbar links={navLinks} userRole={userRole} />
 *       <PageLayout>
 *         {/* Page content here */}
 *       </PageLayout>
 *     </>
 *   );
 * }
 * ```
 * 
 * ROLE-BASED VISIBILITY RULES:
 * - If link has no `roles` array: visible to all
 * - If link has `roles` array: only visible to users in that role
 * - Common roles: student, faculty, registrar, admin, dean, admissions
 */

/**
 * ============================================================================
 * SECTION 4: PAGE TEMPLATES
 * ============================================================================
 * 
 * The spec defines 3 main page templates:
 * 
 * A. LIST PAGE (courses, students, programs)
 * ─────────────────────────────────────────
 * 
 * ```
 * import {
 *   ListPageTemplate,
 *   PageLayout,
 *   ContentContainer,
 *   Table, TableHead, TableBody, TableRow, TableCell,
 *   Card, CardEmptyState
 * } from '@/components/academy';
 * 
 * export default function CoursesListPage() {
 *   const courses = [...]; // fetch from DB
 *   
 *   return (
 *     <PageLayout>
 *       <ContentContainer width="wide">
 *         <ListPageTemplate
 *           title="Courses"
 *           subtitle="Manage your course catalog"
 *           action={{
 *             label: 'New Course',
 *             href: '/courses/new'
 *           }}
 *         >
 *           {courses.length > 0 ? (
 *             <Table>
 *               <TableHead>
 *                 <TableRow header>
 *                   <TableCell header>Course</TableCell>
 *                   <TableCell header>Code</TableCell>
 *                   <TableCell header>Credit</TableCell>
 *                   <TableCell header align="right">Actions</TableCell>
 *                 </TableRow>
 *               </TableHead>
 *               <TableBody>
 *                 {courses.map((course) => (
 *                   <TableRow key={course.id}>
 *                     <TableCell>
 *                       <p className="font-semibold">{course.name}</p>
 *                       <p className="text-xs text-muted-foreground mt-0.5">
 *                         {course.description}
 *                       </p>
 *                     </TableCell>
 *                     <TableCell>
 *                       <code className="text-xs font-mono text-muted-foreground">
 *                         {course.code}
 *                       </code>
 *                     </TableCell>
 *                     <TableCell>{course.credits}</TableCell>
 *                     <TableCell align="right">
 *                       <a href={`/courses/${course.id}`} className="text-sm font-semibold text-primary hover:underline">
 *                         Edit
 *                       </a>
 *                     </TableCell>
 *                   </TableRow>
 *                 ))}
 *               </TableBody>
 *             </Table>
 *           ) : (
 *             <CardEmptyState
 *               title="No courses yet"
 *               description="Create your first course to get started"
 *               action={{ label: 'New Course', href: '/courses/new' }}
 *             />
 *           )}
 *         </ListPageTemplate>
 *       </ContentContainer>
 *     </PageLayout>
 *   );
 * }
 * ```
 * 
 * 
 * B. FORM / DETAIL PAGE (edit course, student profile)
 * ────────────────────────────────────────────────────
 * 
 * ```
 * import {
 *   FormPageTemplate,
 *   PageLayout,
 *   ContentContainer,
 *   TextInput, TextArea, Select,
 *   FormField, FormActions,
 *   FormBanner
 * } from '@/components/academy';
 * 
 * export default function EditCoursePage({ params }: { params: { id: string } }) {
 *   const [error, setError] = useState<string | null>(null);
 *   const [isLoading, setIsLoading] = useState(false);
 *   const course = await getCourse(params.id);
 *   
 *   async function handleSave(formData: any) {
 *     try {
 *       setIsLoading(true);
 *       setError(null);
 *       await updateCourse(params.id, formData);
 *     } catch (err) {
 *       setError(err.message);
 *     } finally {
 *       setIsLoading(false);
 *     }
 *   }
 *   
 *   return (
 *     <PageLayout>
 *       <ContentContainer width="narrow">
 *         <FormPageTemplate
 *           breadcrumbs={[
 *             { label: 'Courses', href: '/courses' },
 *             { label: course.name }
 *           ]}
 *           title="Edit Course"
 *           description="Update course details, requirements, and settings"
 *         >
 *           {error && (
 *             <FormBanner type="error">
 *               {error}
 *             </FormBanner>
 *           )}
 *           
 *           <TextInput
 *             label="Course Name"
 *             required
 *             defaultValue={course.name}
 *             hint="e.g., Biblical Studies 101"
 *           />
 *           
 *           <TextInput
 *             label="Course Code"
 *             required
 *             defaultValue={course.code}
 *             hint="e.g., BIS101"
 *           />
 *           
 *           <TextArea
 *             label="Description"
 *             defaultValue={course.description}
 *             hint="Brief overview of the course content and goals"
 *           />
 *           
 *           <Select
 *             label="Department"
 *             required
 *             defaultValue={course.department_id}
 *             options={[
 *               { value: '', label: 'Select department...' },
 *               { value: 'theo', label: 'Theology' },
 *               { value: 'bible', label: 'Bible' }
 *             ]}
 *           />
 *           
 *           <FormActions
 *             submitLabel="Save Changes"
 *             isLoading={isLoading}
 *             onSubmit={handleSave}
 *           />
 *         </FormPageTemplate>
 *       </ContentContainer>
 *     </PageLayout>
 *   );
 * }
 * ```
 * 
 * 
 * C. DASHBOARD / ANALYTICS PAGE
 * ─────────────────────────────
 * 
 * ```
 * import {
 *   DashboardPageTemplate,
 *   SummaryCard,
 *   PageLayout,
 *   ContentContainer,
 *   Card, CardBody
 * } from '@/components/academy';
 * 
 * export default function DashboardPage() {
 *   const stats = await getInstitutionStats();
 *   
 *   return (
 *     <PageLayout>
 *       <ContentContainer width="full">
 *         <DashboardPageTemplate
 *           title="Academic Operations"
 *           subtitle="Institution overview and key metrics"
 *         >
 *           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
 *             <SummaryCard
 *               label="Active Students"
 *               value={stats.studentCount}
 *             />
 *             <SummaryCard
 *               label="Enrolled Courses"
 *               value={stats.courseCount}
 *             />
 *             <SummaryCard
 *               label="Faculty"
 *               value={stats.facultyCount}
 *             />
 *             <SummaryCard
 *               label="Avg GPA"
 *               value={stats.avgGpa.toFixed(2)}
 *             />
 *           </div>
 *           
 *           <div className="space-y-6">
 *             <Card>
 *               <CardBody>
 *                 <h2 className="text-lg font-bold mb-4">
 *                   Enrollment Trends
 *                 </h2>
 *                 {/* Chart goes here */}
 *               </CardBody>
 *             </Card>
 *           </div>
 *         </DashboardPageTemplate>
 *       </ContentContainer>
 *     </PageLayout>
 *   );
 * }
 * ```
 */

/**
 * ============================================================================
 * SECTION 5: RESPONSIVE BEHAVIOR
 * ============================================================================
 * 
 * The spec is desktop-first with mobile support via Tailwind breakpoints.
 * 
 * KEY BREAKPOINTS:
 * - sm: 640px  (tablets and small devices)
 * - md: 768px  (tablets)
 * - lg: 1024px (desktops)
 * 
 * MOBILE PATTERNS:
 * 
 * 1. HORIZONTAL SCROLLING NAVBAR ON MOBILE
 *    The navbar supports overflow-x-auto with no-scrollbar on mobile,
 *    allowing users to scroll through links horizontally.
 * 
 * 2. STACKED SUMMARY CARDS
 *    ```
 *    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 *      {/* 2 columns on mobile, 4 on desktop */}
 *    </div>
 *    ```
 * 
 * 3. MOBILE EDITOR WARNING
 *    Shows on mobile (sm:hidden) to warn users to use desktop for editing:
 *    ```
 *    <MobileEditorWarning />
 *    ```
 * 
 * 4. TABLE HORIZONTAL SCROLL
 *    Tables can be wrapped in overflow-x-auto on mobile:
 *    ```
 *    <div className="overflow-x-auto sm:overflow-visible">
 *      <Table>...</Table>
 *    </div>
 *    ```
 * 
 * ALWAYS TEST WITH:
 * - Mobile: 375px (iPhone SE)
 * - Tablet: 768px (iPad)
 * - Desktop: 1440px (standard)
 */

/**
 * ============================================================================
 * SECTION 6: ACCESSIBILITY
 * ============================================================================
 * 
 * The spec includes WCAG 2.1 AA accessibility features.
 * 
 * 1. SKIP NAVIGATION LINK
 *    SkipNavLink is automatically included in the page layout.
 *    Jump to #main-content using the skip link (visible on Tab).
 * 
 * 2. FOCUS RING
 *    All interactive elements have focus:outline-none focus:ring-2 focus:ring-ring
 *    This is automatically applied via globals.css focus-visible rules.
 * 
 * 3. SEMANTIC HTML
 *    Use proper heading hierarchy:
 *    - h1: Page title (only one per page)
 *    - h2: Section headings
 *    - h3: Subsection headings
 *    Do NOT use divs with text-3xl instead of h1.
 * 
 * 4. LABEL ASSOCIATIONS
 *    All form inputs must have associated labels:
 *    ```
 *    <label htmlFor="email" className="block text-sm font-semibold">
 *      Email Address
 *    </label>
 *    <input
 *      id="email"
 *      type="email"
 *      className="..."
 *    />
 *    ```
 * 
 * 5. ARIA LABELS
 *    Icon-only buttons must have aria-label:
 *    ```
 *    <button aria-label="Delete course" className="...">
 *      <TrashIcon />
 *    </button>
 *    ```
 * 
 * 6. COLOR NOT ALONE
 *    Don't rely on color alone to convey meaning:
 *    - Use icons + color for status badges
 *    - Add text labels in addition to colors
 *    - Use text patterns (e.g., "Draft" label) not just background color
 */

/**
 * ============================================================================
 * QUICK REFERENCE: COLOR PALETTE
 * ============================================================================
 * 
 * PRIMARY (Ministry Blue)
 *   hsl(220 65% 32%)  → bg-primary, text-primary-foreground
 * 
 * SEMANTIC (Status Colors)
 *   Emerald (Success):   hsl(var(--color-emerald))
 *   Amber (Warning):     hsl(var(--color-amber))
 *   Rose (Error):        hsl(var(--color-rose))
 *   Violet (Info/AI):    hsl(var(--color-violet))
 *   Slate (Disabled):    hsl(var(--color-slate))
 * 
 * NEUTRAL (Backgrounds & Text)
 *   Foreground:          hsl(220 20% 10%)     → text-foreground
 *   Background:          hsl(210 40% 98%)     → bg-background
 *   Card:                hsl(0 0% 100%)       → bg-card
 *   Muted-foreground:    hsl(220 10% 46%)     → text-muted-foreground
 *   Border:              hsl(220 13% 91%)     → border-border
 * 
 * NAVBAR
 *   Dark background:     bg-slate-900
 *   Border:              border-slate-800
 *   Text:                text-slate-400 hover:text-white
 * 
 * ALL COLORS ARE IN TAILWIND.CONFIG.TS
 * DO NOT ADD NEW COLORS TO YOUR CSS — USE EXISTING TOKENS
 */

/**
 * ============================================================================
 * EXAMPLE: CONVERTING AN EXISTING PAGE
 * ============================================================================
 * 
 * BEFORE (Old pattern without spec):
 * ```
 * export function StudentsPage() {
 *   return (
 *     <div style={{padding: '20px'}}>
 *       <h1 style={{fontSize: '32px', fontWeight: 'bold'}}>Students</h1>
 *       <button style={{backgroundColor: '#2F5BCE', color: 'white'}}>
 *         Add Student
 *       </button>
 *       <table style={{borderCollapse: 'collapse'}}>
 *         <tr>
 *           <th style={{textAlign: 'left', padding: '10px'}}>Name</th>
 *         </tr>
 *         {students.map(s => (
 *           <tr key={s.id}>
 *             <td>{s.name}</td>
 *           </tr>
 *         ))}
 *       </table>
 *     </div>
 *   );
 * }
 * ```
 * 
 * AFTER (With LMS UI Specification):
 * ```
 * import {
 *   PageLayout, ContentContainer,
 *   ListPageTemplate,
 *   Table, TableHead, TableBody, TableRow, TableCell,
 *   CardEmptyState
 * } from '@/components/academy';
 * 
 * export default function StudentsPage() {
 *   const students = [...];
 *   
 *   return (
 *     <PageLayout>
 *       <ContentContainer width="wide">
 *         <ListPageTemplate
 *           title="Students"
 *           subtitle="Manage student records and enrollment"
 *           action={{
 *             label: 'New Student',
 *             href: '/students/new'
 *           }}
 *         >
 *           {students.length > 0 ? (
 *             <Table>
 *               <TableHead>
 *                 <TableRow header>
 *                   <TableCell header>Name</TableCell>
 *                   <TableCell header>Status</TableCell>
 *                   <TableCell header align="right">Actions</TableCell>
 *                 </TableRow>
 *               </TableHead>
 *               <TableBody>
 *                 {students.map(s => (
 *                   <TableRow key={s.id}>
 *                     <TableCell>
 *                       <p className="font-semibold">{s.name}</p>
 *                     </TableCell>
 *                     <TableCell>
 *                       <StatusBadge status="active">
 *                         Active
 *                       </StatusBadge>
 *                     </TableCell>
 *                     <TableCell align="right">
 *                       <a href={`/students/${s.id}`} className="text-sm font-semibold text-primary hover:underline">
 *                         View
 *                       </a>
 *                     </TableCell>
 *                   </TableRow>
 *                 ))}
 *               </TableBody>
 *             </Table>
 *           ) : (
 *             <CardEmptyState
 *               title="No students yet"
 *               description="Add your first student to get started"
 *               action={{ label: 'New Student', href: '/students/new' }}
 *             />
 *           )}
 *         </ListPageTemplate>
 *       </ContentContainer>
 *     </PageLayout>
 *   );
 * }
 * ```
 * 
 * KEY IMPROVEMENTS:
 * ✓ Typography uses spec scale (text-2xl font-extrabold for title)
 * ✓ Colors use semantic tokens (text-primary, text-muted-foreground)
 * ✓ Layout uses page template system (ListPageTemplate)
 * ✓ Table is properly wrapped in Table component with semantic structure
 * ✓ Empty state uses CardEmptyState for consistency
 * ✓ Actions are properly styled using primary button color
 * ✓ All responsive behavior is handled by Tailwind classes
 */

export {};
