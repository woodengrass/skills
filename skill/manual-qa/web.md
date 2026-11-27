# Web

Use the browser through the Chrome DevTools MCP server (`chrome-devtools`)
when it is available. Its own `chrome-devtools` skill lists the current tool
names and parameters. If it is not available, use another browser tool the
harness gives you, or Playwright headed or headless with screenshots you
open yourself.

- Start the dev server in the background, remember its PID, and wait until a
  real page loads with real content, not only until the port opens.
- Open the page with `navigate_page`. Read the page structure with
  `take_snapshot` to find elements, then act with `click` and `fill`, the
  way a user would.
- After each step that matters, `take_screenshot` and look at the image. A
  snapshot shows structure and text; only a screenshot shows layout, colors
  and spacing.
- Try a phone width and a desktop width, and light and dark when the site
  supports both, with the server's emulation or page-size tools.
- Check `list_console_messages` and the failed network requests after each
  step.
- Check what the action stored, through the app's API or database, not only
  what the page shows.
- Stop the server by its PID when done.
