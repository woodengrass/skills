# Web

Drive the browser with Playwright. Use the project's Playwright if it has
one; otherwise install it as a project dev dependency and report that.

- Start the dev server in the background, remember its PID, and wait until a
  request to a real page succeeds and the page shows real content, not only
  until the port opens.
- Write the drive script in `verify/`, for example `verify/login.spec.ts` or
  `verify/login.py`. Run headless.
- Wait for what the user waits for: an element, a URL, a response. Avoid
  fixed sleeps; `networkidle` is a last resort for pages that never settle
  otherwise.
- Find elements the way a user does: `getByRole`, `getByLabel`, `getByText`,
  or test ids the project already uses.
- Capture into `.agent/evidence/<task>/`: a screenshot after each step that
  matters, the browser console errors (`page.on('console')`), and failed
  network requests (`page.on('requestfailed')`).
- Check what the action stored, through the app's API or database, not only
  what the page shows.
- Stop the server by its PID when done.
