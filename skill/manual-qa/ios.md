# iOS and macOS apps

- Build for a simulator with the project's scheme:
  `xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=<device>' -derivedDataPath .agent/build build`.
- Boot a simulator if none is booted: `xcrun simctl boot '<device>'`.
  Install and launch:
  `xcrun simctl install booted <path to .app>` and
  `xcrun simctl launch booted <bundle id>`.
- Use the app with the harness's simulator tool when it has one (tap, swipe,
  type, screenshot), and look at each screenshot. Without one, open a deep
  link to reach a screen when the app supports it
  (`xcrun simctl openurl booted '<url>'`) and capture with
  `xcrun simctl io booted screenshot .agent/evidence/<task>/<step>.png`.
- Try light and dark (`xcrun simctl ui booted appearance dark`), a large
  text size (`xcrun simctl ui booted content_size extra-extra-large`), and a
  small and a large device when the layout depends on size.
- Read the app's log with
  `xcrun simctl spawn booted log show --last 5m --predicate 'process == "<App>"'`.
- For a macOS app, run the built app and use it with the harness's screen
  tool the same way.
- UI tests (XCUITest) are automated tests; write them under
  `tests-that-catch-bugs`, not as part of QA.
