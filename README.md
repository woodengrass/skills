# OpenCode 個人指引與技能

這個倉庫用來維護我自用的 OpenCode 全域指引與技能。

- [`AGENTS.md`](./AGENTS.md)：全域指引，涵蓋工作範圍、驗證方式與決策紀錄。
- [`skill/adr/SKILL.md`](./skill/adr/SKILL.md)：`adr` 技能，用 `GOALS.md` 記錄專案目標，並在相關程式碼旁用 `*.adr.md` 記下長期決策。

## 安裝

從倉庫根目錄執行。若已有全域 `AGENTS.md`，請先合併要保留的內容；直接複製會覆蓋原檔。

```bash
mkdir -p ~/.config/opencode ~/.agents/skills
cp AGENTS.md ~/.config/opencode/AGENTS.md
cp -r skill/adr ~/.agents/skills/
```

重新啟動 OpenCode 後生效。
