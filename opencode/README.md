# OpenCode V2 設定

這個資料夾是我在 OpenCode V2 上用的角色、權限、外掛、腳本，以及 OpenCode 專用的全域規則 `AGENTS.md`。skills 直接用 repo 的 `skill/`。

`opencode/AGENTS.md` 是根目錄 `AGENTS.md` 的 OpenCode 版：ADR 由外掛自動放進指示，第二意見找 advisor subagent，另外多一條「同一個沒驗證的說法只算一個來源」。改根目錄那份時，記得看這份要不要跟著改。

## 安裝（Mac）

最簡單的方式是把根目錄 README 的安裝 prompt 貼給 coding agent，選「OpenCode V2 setup」。agent 會問你要裝什麼，把 repo clone 到暫存資料夾、執行 `install.sh`，裝完再刪掉。也可以自己執行：

```sh
git clone https://github.com/woodengrass/skills.git /tmp/skills && /tmp/skills/opencode/install.sh && rm -rf /tmp/skills
```

`install.sh` 依序完成以下步驟，已經做過的會跳過：
1. 檢查 git、node、bun 是否已安裝。
2. 沒有 OpenCode 就裝最新的 V2，已經有 V2 就不動版本；裝的是 V1 會停下來。沒有 Claude Code 就安裝。
3. 把 agents、roles、plugins、scripts、設定檔、`opencode/AGENTS.md` 和 `skill/` 逐檔複製到 `~/.config/opencode`。第一次安裝時，原本就有、內容不同的檔案移到 `~/.config/opencode.backup-<時間>/`。之後每次更新都會保留你在 `~/.config/opencode` 裡改過或新增的檔案：你沒改過的換成新版；只有你改過的保留；兩邊都改了、但改的地方不重疊就自動合併；改到同一處就保留你的版本，新版本放在備份資料夾的 `new/` 底下讓你自己比對。判斷依據是上次安裝的內容，存在 `~/.local/share/opencode-setup/base`。舊的 `opencode.json` 也移到備份（OpenCode 會把它和 `opencode.jsonc` 合併）。其他檔案（本機外掛、`service.json`）不會動到。
4. 把 `~/.local/bin` 加進 PATH。
5. 設定背景服務的環境變數。
6. 列出不屬於這套設定的外掛，標出 V1 這類 V2 不支援的，讓你決定要不要刪。
7. 跑外掛測試，並列出 MCP 狀態。

## 更新

在用複製方式安裝的電腦上執行：

```sh
curl -fsSL https://raw.githubusercontent.com/woodengrass/skills/main/opencode/update.sh | sh
```

它會比對這台的版本（記在 `~/.config/opencode/.setup-version`）和 GitHub 上 main 的最新 commit：一樣就直接結束；不一樣就 clone 到暫存資料夾、執行 `install.sh`、刪掉暫存資料夾，最後印出新舊版本和 GitHub 上的變更連結。加 `--force` 會在版本相同時也重裝一次。更新會重啟背景服務，正在跑的 session 會被打斷。

注意：這會直接裝上 main 當下的內容，推到 main 的東西下次更新就會到每台電腦。

在用來修改這套設定的電腦上，改用 `install.sh --link`：`~/.config/opencode` 會用 symlink 指向 clone，所以 clone 要留著；在 repo 裡改的內容立即生效，`git pull` 就是更新。

## 裡面有什麼

| 位置 | 內容 |
|---|---|
| `AGENTS.md` | OpenCode 用的全域規則 |
| `agents/` | 9 個角色的模型和權限（不設步數上限）：lead、quick、worker、worker-deep、reviewer、advisor、advisor-alt、explore、librarian |
| `roles/` | 各角色的說明。由 role-prompts 外掛插在 OpenCode 依模型家族準備的 base prompt 後面，所以 base prompt 會保留 |
| `opencode.jsonc` | 預設 agent、權限（遠端操作要確認；`.env`、`git reset --hard`、`git add -A` 會被拒絕；修改設定要確認）、MCP（chrome-devtools）、websearch、`/bro` 指令 |
| `plugins/role-prompts` | 把 `roles/` 的文字插進 system prompt |
| `plugins/adr-inject` | 讀或改檔案時，把 GOALS.md 和相關的 `*.adr.md` 放進指示。壓縮對話後仍會保留 |
| `plugins/comment-checker` | 寫入前擋下關掉或刪除測試的修改；雜訊註解照常寫入，並在結果附上請它移除的提醒 |
| `plugins/evidence-ledger` | worker 結束時，把它實際改了哪些檔案、跑了哪些指令交給 lead |
| `plugins/openai-context` | 用 ChatGPT 登入時，OpenCode 內建規則會把 GPT 的輸入上限壓到 272K 或 500K。這個外掛把每個 OpenAI 模型的上限改回 models.dev 目錄裡的值（目前約 1.05M），只會調高 |
| `plugins/check-loop` | agent 收尾時自動跑專案的 check，失敗就把輸出送回給 agent。只在有 `.opencode/check-loop.json` 的專案生效，見下方 |
| `plugins/language` | 在頂層 session 的每則使用者訊息後面加一句「用這個語言回覆使用者」，長 session 才不會飄回英文。subagent 不加，它們的報告是給 lead 看的。語言在 `plugins/language/language.json` 改，每次請求都會重讀，不用重啟；值留空就關掉 |
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
