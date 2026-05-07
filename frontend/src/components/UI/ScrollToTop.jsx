import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — restores the browser to the top of the viewport on every
 * pathname change.
 *
 * Without this, react-router preserves the previous page's scroll
 * position when you navigate (this is the default browser behaviour for
 * SPAs because the document never actually changes), which feels broken
 * to users — e.g. scrolling halfway down the planner results then
 * clicking a nav link drops them in the middle of the next page.
 *
 * We deliberately:
 *   - Use `useEffect` (not useLayoutEffect) so the new page is allowed
 *     to mount its own scrollable elements first, otherwise the scroll
 *     reset can fire before the layout is ready.
 *   - Only react to `pathname`, not `search` or `hash`, so query-string
 *     updates inside the same page (filters, tabs that use ?tab=...)
 *     don't yank the user back to the top.
 *   - Use `instant` not `smooth` because animating a scroll on every
 *     navigation makes the app feel laggy.
 *
 * Mounted once inside <Router> in App.jsx.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // `instant` is part of the spec but TS/older browsers don't ship
    // the type; the literal works in every browser we support.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
