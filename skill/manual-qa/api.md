# API and backend

- Start the service in the background, remember its PID, and wait until a
  real request (not only a health endpoint) succeeds, or until the log line
  that means it finished starting.
- Call it the way a client does:
  `curl -sS -w '\nstatus %{http_code}\n' -H 'Content-Type: application/json' -d '{...}' http://localhost:<port>/<path>`.
  Save request and response under `.agent/evidence/<task>/`.
- Read each response as the client's developer would: the right status code,
  the shape the client expects, and error bodies that say what was wrong
  without leaking internals (stack traces, SQL, secrets).
- Try what clients get wrong: a missing field, a wrong type, no or bad
  credentials, the same request twice.
- Check the stored result directly: query the database with its own CLI
  (`psql`, `sqlite3`, `mysql`, `redis-cli`) or read the files written.
- Check the service log for errors during the call.
- Use a local or test database, never a production one. If only a shared or
  production database is configured, stop and ask.
- Stop the service by its PID when done.
