# 個人用 Skills

[English](./README.md)

這個倉庫收錄我自用的 coding agent 技能和工作指引。

- [`AGENTS.md`](./AGENTS.md)：工作指引，涵蓋工作範圍、驗證方式與決策紀錄。
- [`adr`](./skill/adr/SKILL.md)：用 `GOALS.md` 記錄專案目標，並在相關程式碼旁用 `*.adr.md` 記下長期決策。
- [`tests-that-catch-bugs`](./skill/tests-that-catch-bugs/SKILL.md)：撰寫和審查測試，確認受測行為出錯時，測試會失敗。
- [`mistakes-to-lint-rules`](./skill/mistakes-to-lint-rules/SKILL.md)：把反覆出現、可客觀判定的錯誤，轉成型別或 API 限制，或用 lint 規則攔下並提示改法。
- [`github-actions-ci`](./skill/github-actions-ci/SKILL.md)：設定或審查 GitHub Actions CI，讓每個 PR 跑完專案現有的檢查，並驗證各項檢查能攔下對應的錯誤。
- [`git`](./skill/git/SKILL.md)：分支、頻繁 commit、PR、CI 失敗、查歷史與安全還原，每個部分一個檔案。
- [`debugging`](./skill/debugging/SKILL.md)：觀察實際執行的程式找出 bug 原因，一次驗證一個假設，並留下假設紀錄。
- [`verify-app`](./skill/verify-app/SKILL.md)：啟動並操作真實的 app（web、CLI、API、iOS）證明改動有效，並維護一份使用者需求清單。
- [`opencode/`](./opencode/README.md)：選用。我在 OpenCode V2 上的設定（角色、權限、外掛），有自己的一份 `AGENTS.md`，skills 用上面這些；可以用下面的 prompt 安裝，或直接執行 `opencode/install.sh`。

部分指引要求 agent 用繁體中文書寫：兩份 `AGENTS.md` 裡給使用者的回覆，以及 `adr` skill 裡的決策紀錄。使用前請改成你自己的語言。

## 安裝

把下面的 prompt 貼給你正在使用的 coding agent：

```text
請讀取 https://raw.githubusercontent.com/woodengrass/skills/main/INSTALL.md 並依照指引幫我安裝。
```
