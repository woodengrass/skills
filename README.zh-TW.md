# 個人用 Skills

[English](./README.md)

這個倉庫收錄我自用的 coding agent 技能和工作指引。

- [`AGENTS.md`](./AGENTS.md)：工作指引，涵蓋工作範圍、驗證方式與決策紀錄。
- [`adr`](./skill/adr/SKILL.md)：用 `GOALS.md` 記錄專案目標，並在相關程式碼旁用 `*.adr.md` 記下長期決策。
- [`tests-that-catch-bugs`](./skill/tests-that-catch-bugs/SKILL.md)：撰寫和審查測試，確認受測行為出錯時，測試會失敗。
- [`mistakes-to-lint-rules`](./skill/mistakes-to-lint-rules/SKILL.md)：把反覆出現、可客觀判定的錯誤，轉成型別或 API 限制，或用 lint 規則攔下並提示改法。
- [`github-actions-ci`](./skill/github-actions-ci/SKILL.md)：設定或審查 GitHub Actions CI，讓每個 PR 跑完專案現有的檢查，並驗證各項檢查能攔下對應的錯誤。

## 安裝

把下面的 prompt 貼給你正在使用的 coding agent：

```text
請讀取 https://raw.githubusercontent.com/woodengrass/skills/main/INSTALL.md 並依照指引幫我安裝。
```
