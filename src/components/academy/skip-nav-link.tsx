/**
 * Skip Navigation Link following LMS UI spec section 9
 * 
 * A skip-nav link is rendered at the top of the layout, visible only on focus.
 * This allows keyboard users to skip directly to the main content.
 */
export function SkipNavLink() {
  return (
    <a
      href="#main-content"
      className="skip-nav"
    >
      Skip to main content
    </a>
  );
}