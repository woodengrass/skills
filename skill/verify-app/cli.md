# CLI and TUI

## Commands that run and exit

- Build once, then run the real binary or entry point with the arguments a
  user would type.
- Capture stdout, stderr and the exit code:
  `./app args >.agent/evidence/<task>/out.txt 2>&1; echo "exit $?"`.
- Check files the command should have written or changed.
- Use a temporary directory for its data so runs do not touch the user's
  real files: `HOME`, config or data paths pointed at `mktemp -d` when the
  program allows it.

## Interactive programs

The shell cannot type into a program that waits for input, so run it in tmux:

```
tmux new-session -d -s verify -x 120 -y 40 './app'
tmux send-keys -t verify 'text to type' Enter
tmux capture-pane -t verify -p > .agent/evidence/<task>/screen-1.txt
tmux kill-session -t verify
```

- After each key sequence, poll `capture-pane` until the expected text
  appears, with a timeout, instead of sleeping a fixed time.
- Use a unique session name and kill only that session.
