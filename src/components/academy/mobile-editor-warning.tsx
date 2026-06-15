/**
 * Mobile Warning for Editors following LMS UI spec section 10
 * 
 * A mobile warning is shown inside the editor:
 * <div class="sm:hidden bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
 *   For the best editing experience, use a desktop or tablet.
 * </div>
 */
export function MobileEditorWarning() {
  return (
    <div className="sm:hidden bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
      For the best editing experience, use a desktop or tablet.
    </div>
  );
}