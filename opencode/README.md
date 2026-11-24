# OpenCode V2 設定

這個資料夾是我在 OpenCode V2 上用的角色、權限、外掛、腳本，以及 OpenCode 專用的全域規則 `AGENTS.md`。skills 直接用 repo 的 `skill/`。

`opencode/AGENTS.md` 是根目錄 `AGENTS.md` 的 OpenCode 版：ADR 由外掛自動放進指示，第二意見找 advisor subagent，另外多一條「同一個沒驗證的說法只算一個來源」。改根目錄那份時，記得看這份要不要跟著改。

## 安裝（Mac）

```sh
git clone https://github.com/woodengrass/skills.git ~/code/skills
~/code/skills/opencode/install.sh
```

`install.sh` 依序完成以下步驟，已經做過的會跳過：
1. 檢查 git、node、bun 是否已安裝。
2. 安裝 OpenCode 2.4.1 和 Claude Code。
3. 把 `~/.config/opencode` 裡的項目用 symlink 指向這個 repo，包括 `opencode/AGENTS.md` 和 `skill/`。原本就在的檔案會移到 `~/.config/opencode.backup-<時間>/`，不會刪除。
4. 把 `~/.local/bin` 加進 PATH。
5. 設定背景服務的環境變數。
6. 跑外掛測試，並列出 MCP 狀態。

之後要更新，只要在 repo 裡 `git pull`，所有連結自動指到新內容。

## 裡面有什麼

| 位置 | 內容 |
|---|---|
| `AGENTS.md` | OpenCode 用的全域規則 |
| `agents/` | 7 個角色的模型、步數上限、權限：lead、worker、worker-deep、advisor、advisor-alt、explore、librarian |
| `roles/` | 各角色的說明。由 role-prompts 外掛插在 OpenCode 依模型家族準備的 base prompt 後面，所以 base prompt 會保留 |
| `opencode.jsonc` | 預設 agent、權限（遠端操作要確認；`.env`、`git reset --hard`、`git add -A` 會被拒絕；修改設定要確認）、MCP（chrome-devtools）、websearch |
| `plugins/role-prompts` | 把 `roles/` 的文字插進 system prompt |
| `plugins/adr-inject` | 讀或改檔案時，把 GOALS.md 和相關的 `*.adr.md` 放進指示。壓縮對話後仍會保留 |
| `plugins/comment-checker` | 寫入前擋下兩類修改：雜訊註解，以及關掉或刪除測試 |
| `plugins/evidence-ledger` | worker 結束時，把它實際改了哪些檔案、跑了哪些指令交給 lead |
| `plugins/check-loop` | agent 收尾時自動跑專案的 check，失敗就把輸出送回給 agent。只在有 `.opencode/check-loop.json` 的專案生效，見下方 |
| `scripts/usage-report.ts` | 用量報告：`bun ~/.config/opencode/scripts/usage-report.ts --days 14` |

只在各台電腦上、不進 repo 的檔案（都在 `~/.config/opencode/`）：
- `service.json`：背景服務的密碼和環境變數，每台電腦各自產生。
- 只屬於某台電腦的 MCP（JetBrains、Xcode、supabase）：寫成 `~/.config/opencode/plugins/` 下的本機外掛，例如 `local-mcp.ts`，用 `ctx.mcp.transform` 加入。

## check-loop（在專案裡啟用）

在專案根目錄建立 `.opencode/check-loop.json`：

```json
{ "command": "npm test" }
```

選用的欄位：
- `maxFailures`：預設 3，連續失敗這麼多次就要 agent 停下回報。
- `timeoutMs`：預設 600000。

外掛會從 session 所在目錄往上找這個檔案，一路找到 repo 根目錄；找不到就不跑。每次使用都會重新讀檔，所以改完立即生效。agent 要修改 `.opencode/` 底下的檔案時，需要你同意。

## 測試

每個外掛目錄都可以執行 `bun test`。
