# CLI and TUI

## Commands that run and exit

- Build once, then run the real binary or entry point with the arguments a
  user would type.
- Capture stdout, stderr and the exit code:
  `./app args >.agent/evidence/<task>/out.txt 2>&1; echo "exit $?"`, then
  read the output as a user would: is it clear what happened and what to do
  next?
- Try what users get wrong: a missing argument, a bad value, a file that
  does not exist. Each should give a message a user understands and a
  non-zero exit code.
- Check files the command should have written or changed.
- Use a temporary directory for its data so runs do not touch the user's
  real files: `HOME`, config or data paths pointed at `mktemp -d` when the
  program allows it.

## Interactive programs

The shell cannot type into a program that waits for input, so run it in tmux:

```
tmux new-session -d -s qa-<task> -x 120 -y 40 './app'
tmux send-keys -t qa-<task> 'text to type' Enter
tmux capture-pane -t qa-<task> -p -e > .agent/evidence/<task>/screen-1.txt
tmux kill-session -t qa-<task>
```

- After each key sequence, poll `capture-pane` until the expected text
  appears, with a timeout, instead of sleeping a fixed time. Then read the
  whole captured screen, not only the line you waited for.
- `-e` keeps colors as escape codes; check that highlights and error colors
  land where they should.
- Try a narrow and a wide terminal (`tmux resize-window -t qa-<task> -x 60
  -y 20`), and resize while the program runs.
- Use a unique session name and kill only that session.
