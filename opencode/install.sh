#!/bin/sh
# Installs this OpenCode setup on a Mac by copying it into ~/.config/opencode.
# Clone the repository anywhere, run opencode/install.sh, then the clone can be deleted. To update, run it
# again from a fresh clone.
# With --link it links ~/.config/opencode to the clone instead, so the clone must stay; use this on the
# computer where you edit the setup.
# Safe to run again: each step checks whether it is already done. Nothing is deleted; anything it replaces
# is moved to a timestamped backup folder.
set -eu

MODE=copy
case "${1:-}" in
  --link) MODE=link ;;
  "") ;;
  *) echo "用法：install.sh [--link]" >&2; exit 2 ;;
esac

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
TARGET="$HOME/.config/opencode"
BACKUP="$HOME/.config/opencode.backup-$(date +%Y%m%d%H%M%S)"
CLAUDE="$HOME/.local/bin/claude"

say() { printf '\n==> %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

[ -d "$REPO/skill" ] && [ -d "$REPO/opencode/agents" ] || { echo "找不到 $REPO/skill 或 $REPO/opencode，請從 repo 裡執行。" >&2; exit 1; }

say "檢查必要工具"
missing=""
for tool in git node npm npx; do have "$tool" || missing="$missing $tool"; done
BUN="$(command -v bun || true)"
if [ -z "$BUN" ] && [ -x "$HOME/.bun/bin/bun" ]; then BUN="$HOME/.bun/bin/bun"; fi
[ -n "$BUN" ] || missing="$missing bun"
if [ -n "$missing" ]; then
  echo "缺少：$missing" >&2
  echo "node / npm / npx：裝 Node.js LTS（例如 fnm 或 nodejs.org）" >&2
  echo "bun：curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

say "OpenCode V2"
current="$(opencode --version 2>/dev/null || true)"
major="$(printf '%s' "$current" | sed -n 's/^[^0-9]*\([0-9][0-9]*\).*/\1/p')"
if [ -z "$current" ]; then
  npm install -g --allow-scripts=@opencode/cli @opencode/cli
elif [ "${major:-0}" -ge 2 ]; then
  echo "已安裝：$current，不更動版本"
else
  echo "這台裝的是 OpenCode V1（$current）。這套設定只支援 V2，請先移除 V1 再執行。" >&2
  exit 1
fi

say "Claude Code（lead 透過它執行）"
if [ -x "$CLAUDE" ]; then
  echo "已安裝：$("$CLAUDE" --version 2>/dev/null || echo "$CLAUDE")"
else
  curl -fsSL https://claude.ai/install.sh | bash
fi

if [ "$MODE" = link ]; then say "連結 ~/.config/opencode 到這個 repo"; else say "複製設定到 ~/.config/opencode"; fi
mkdir -p "$TARGET/plugins"
# place <path inside ~/.config/opencode> <source inside the repo>
place() {
  dest="$TARGET/$1"
  src="$2"
  if [ "$MODE" = link ]; then
    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then echo "已連結：$1"; return; fi
  elif [ ! -L "$dest" ] && [ -e "$dest" ] && diff -rq "$src" "$dest" >/dev/null 2>&1; then
    echo "已是最新：$1"
    return
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    mkdir -p "$(dirname "$BACKUP/$1")"
    mv "$dest" "$BACKUP/$1"
    echo "原本的 $1 移到 $BACKUP/$1"
  fi
  if [ "$MODE" = link ]; then
    ln -s "$src" "$dest"
    echo "連結：$1 -> $src"
  else
    cp -R "$src" "$dest"
    echo "複製：$1"
  fi
}
for item in agents roles scripts opencode.jsonc tui.json; do place "$item" "$REPO/opencode/$item"; done
for dir in "$REPO"/opencode/plugins/*/; do
  name="$(basename "$dir")"
  place "plugins/$name" "$REPO/opencode/plugins/$name"
done
place skills "$REPO/skill"
place AGENTS.md "$REPO/opencode/AGENTS.md"
# OpenCode reads opencode.json as well as opencode.jsonc and merges them, so an old one would mix into this setup.
if [ -e "$TARGET/opencode.json" ] || [ -L "$TARGET/opencode.json" ]; then
  mkdir -p "$BACKUP"
  mv "$TARGET/opencode.json" "$BACKUP/opencode.json"
  echo "舊的 opencode.json 移到 $BACKUP/opencode.json（OpenCode 會把它和 opencode.jsonc 合併）"
fi

say "不屬於這套設定的外掛"
# Listed for the user to decide; nothing here is changed.
others=0
for path in "$TARGET"/plugins/*; do
  [ -e "$path" ] || continue
  name="$(basename "$path")"
  [ -d "$REPO/opencode/plugins/$name" ] && continue
  if grep -rqs --exclude-dir=node_modules '@opencode/plugin' "$path"; then kind="V2 外掛"
  elif grep -rqs --exclude-dir=node_modules '@opencode-ai/plugin' "$path"; then kind="V1 外掛，V2 不支援"
  else kind="看不出版本"; fi
  echo "plugins/$name：$kind"
  others=$((others + 1))
done
for old in "$BACKUP/opencode.json" "$TARGET/package.json"; do
  [ -f "$old" ] || continue
  listed="$(node -e '
    const text = require("fs").readFileSync(process.argv[1], "utf8");
    let config; try { config = JSON.parse(text); } catch { process.exit(0); }
    for (const key of ["plugin", "plugins"]) for (const item of [].concat(config[key] ?? [])) console.log(`${key}: ${typeof item === "string" ? item : JSON.stringify(item)}`);
    for (const dep of Object.keys(config.dependencies ?? {})) console.log(`dependency: ${dep}`);
  ' "$old")"
  [ -n "$listed" ] || continue
  echo "$old 裡列的："
  printf '%s\n' "$listed" | sed 's/^/  /'
  others=$((others + 1))
done
[ "$others" -gt 0 ] || echo "沒有"

say "PATH"
line='export PATH="$HOME/.local/bin:$PATH"'
if grep -qsF "$line" "$HOME/.zshrc"; then
  echo "~/.zshrc 已包含 ~/.local/bin"
else
  printf '\n%s\n' "$line" >> "$HOME/.zshrc"
  echo "已加到 ~/.zshrc（新開的終端機才會生效）"
fi

say "背景服務"
opencode service set env OPENCODE_CLAUDE_PATH "$CLAUDE"
opencode service restart >/dev/null 2>&1 || opencode service start >/dev/null 2>&1 || true
opencode service status || true

say "外掛自我檢查"
for dir in "$REPO"/opencode/plugins/*/ "$REPO/opencode/scripts/"; do
  name="${dir#"$REPO/opencode/"}"
  dir="$TARGET/$name"
  if (cd "$dir" && "$BUN" test >/dev/null 2>&1); then echo "通過：$name"; else echo "失敗：$name（在 $dir 執行 bun test 看細節）"; fi
done

say "MCP 狀態"
# The first query after a restart can come back empty while servers are still loading.
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  listing="$(cd "$HOME" && opencode mcp list 2>&1 || true)"
  case "$listing" in *"No MCP servers configured"*) sleep 3 ;; *) break ;; esac
done
echo "$listing"

say "還需要你手動做的事"
cat <<'EOF'
1. 登入 Claude Code：              ~/.local/bin/claude auth login
2. 登入 OpenAI（ChatGPT 訂閱）：     opencode auth login openai
3. 登入 OpenCode Go：               opencode auth login opencode-go
4. 只屬於這台電腦的 MCP（例如 Xcode、JetBrains），寫成 ~/.config/opencode/plugins/ 下的本機外掛，見 opencode/README.md。
5. 想讓某個專案在 agent 收尾時自動跑 check，見 opencode/README.md 的「check-loop」。
EOF
