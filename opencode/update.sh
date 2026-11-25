#!/bin/sh
# Updates a copied OpenCode setup to the latest commit on main:
#   curl -fsSL https://raw.githubusercontent.com/woodengrass/skills/main/opencode/update.sh | sh
# It clones the repository into a temporary folder, runs install.sh, and deletes the clone. Pass --force to
# reinstall even when this computer already has the latest commit.
set -eu

REPO_URL="${SKILLS_REPO_URL:-https://github.com/woodengrass/skills.git}"
VERSION_FILE="$HOME/.config/opencode/.setup-version"

FORCE=0
case "${1:-}" in
  --force) FORCE=1 ;;
  "") ;;
  *) echo "用法：update.sh [--force]" >&2; exit 2 ;;
esac

before="$(cat "$VERSION_FILE" 2>/dev/null || echo none)"
case "$before" in
  link\ *) echo "這台用 --link 連到 ${before#link }，更新請在那裡 git pull。"; exit 0 ;;
esac

latest="$(git ls-remote "$REPO_URL" refs/heads/main | cut -f1)"
[ -n "$latest" ] || { echo "讀不到 $REPO_URL 的 main。" >&2; exit 1; }
if [ "$before" = "$latest" ] && [ "$FORCE" = 0 ]; then
  echo "已是最新：$latest"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git clone -q --depth 1 "$REPO_URL" "$tmp/skills"
sh "$tmp/skills/opencode/install.sh"

after="$(cat "$VERSION_FILE" 2>/dev/null || echo unknown)"
printf '\n==> 更新完成：%s -> %s\n' "$before" "$after"
case "$before" in
  none | unknown) ;;
  *) [ "$before" = "$after" ] || echo "這次的變更：https://github.com/woodengrass/skills/compare/$before...$after" ;;
esac
