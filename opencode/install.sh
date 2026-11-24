#!/bin/sh
# Installs this OpenCode setup on a Mac by linking ~/.config/opencode to this repository.
# Clone the repository anywhere (for example ~/code/skills) and run opencode/install.sh.
# Safe to run again: each step checks whether it is already done. Nothing is deleted; anything in the
# way is moved to a timestamped backup folder.
set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
TARGET="$HOME/.config/opencode"
BACKUP="$HOME/.config/opencode.backup-$(date +%Y%m%d%H%M%S)"
OPENCODE_VERSION="2.4.1"
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

say "OpenCode $OPENCODE_VERSION"
if [ "$(opencode --version 2>/dev/null || true)" = "opencode v$OPENCODE_VERSION" ]; then
  echo "已安裝"
else
  npm install -g --allow-scripts=@opencode/cli "@opencode/cli@$OPENCODE_VERSION"
fi

say "Claude Code（lead 透過它執行）"
if [ -x "$CLAUDE" ]; then
  echo "已安裝：$("$CLAUDE" --version 2>/dev/null || echo "$CLAUDE")"
else
  curl -fsSL https://claude.ai/install.sh | bash
fi

say "連結 ~/.config/opencode 到這個 repo"
mkdir -p "$TARGET/plugins"
# link <path inside ~/.config/opencode> <target inside the repo>
link() {
  dest="$TARGET/$1"
  src="$2"
  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    echo "已連結：$1"
    return
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    mkdir -p "$(dirname "$BACKUP/$1")"
    mv "$dest" "$BACKUP/$1"
    echo "原本的 $1 移到 $BACKUP/$1"
  fi
  ln -s "$src" "$dest"
  echo "連結：$1 -> $src"
}
for item in agents roles scripts opencode.jsonc tui.json; do link "$item" "$REPO/opencode/$item"; done
for dir in "$REPO"/opencode/plugins/*/; do
  name="$(basename "$dir")"
  link "plugins/$name" "$REPO/opencode/plugins/$name"
done
link skills "$REPO/skill"
link AGENTS.md "$REPO/opencode/AGENTS.md"

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
  name="${dir#"$REPO/"}"
  if (cd "$dir" && "$BUN" test >/dev/null 2>&1); then echo "通過：$name"; else echo "失敗：$name（在該目錄執行 bun test 看細節）"; fi
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
