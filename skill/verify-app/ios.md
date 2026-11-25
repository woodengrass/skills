# iOS and macOS apps

- Build for a simulator with the project's scheme:
  `xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=<device>' -derivedDataPath .agent/build build`.
- Boot a simulator if none is booted: `xcrun simctl boot '<device>'`.
  Install and launch:
  `xcrun simctl install booted <path to .app>` and
  `xcrun simctl launch booted <bundle id>`.
- Drive the UI with a UI test the project keeps (XCUITest), run one test at a
  time: `xcodebuild test -scheme <Scheme> -destination '...' -only-testing:<Target>/<Class>/<test>`.
  If there is none, add one in the project's UI test target for the behavior
  you changed.
- Capture: `xcrun simctl io booted screenshot .agent/evidence/<task>/<step>.png`,
  and the app's log with
  `xcrun simctl spawn booted log show --last 5m --predicate 'process == "<App>"'`.
- Open a deep link to reach a screen directly when the app supports it:
  `xcrun simctl openurl booted '<url>'`.
- For a macOS app, run the built app and use its UI test target the same way.
