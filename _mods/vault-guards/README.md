---
tags: [mod, 選用, Claude-Code, 寫回護欄]
updated: 2026-10-22
status: active
related: ["[[CLAUDE]]", "[[README]]"]
---

# vault-guards：擋住 CHANGELOG／TASKS 被整檔覆寫（選用）

> **一句話定位**：AI 寫回知識庫時，偶爾會用「整檔重寫」取代「在檔頭插一行」，結果歷史紀錄被洗掉。這個 mod 在工具執行前擋下這種寫法，另外幫 Windows 上的 python 指令補 UTF-8 編碼。

## 為什麼需要

作者的庫在同一個月裡發生兩次 CHANGELOG 被整檔覆寫，其中一次從幾百行剩下個位數行，是事後週回顧翻 git 紀錄才發現。之後改在寫檔前用程式擋，不只靠文字規則。

## 它做什麼，不做什麼

| 做 | 不做 |
|---|---|
| `Write` 寫知識庫內的 `CHANGELOG.md`：新內容沒有完整包含原檔 → 擋 | 不擋 `Edit`（Edit 只改指定段落，不會洗掉整檔） |
| `Write` 寫知識庫內的 `TASKS.md`：新內容比原檔少三成以上 → 擋 | 不擋小幅改寫、不擋新檔 |
| Bash／PowerShell 用重導向 `>`、`Set-Content`、`Out-File`、python `open(..., 'w')` 覆寫這兩個檔 → 擋 | 不擋追加（`>>`、`Add-Content`），不擋唯讀指令 |
| Bash／PowerShell 執行 python 前補 `PYTHONIOENCODING=utf-8` | 指令已經指定編碼就不動；`echo python` 這類字眼不算 |
| 只管你在設定檔列出的知識庫資料夾 | 其他專案的 CHANGELOG.md、TASKS.md 不管 |

護欄自己出錯（讀不到檔、設定檔壞掉）一律放行，不擋正常工作。

## 前提

Claude Code 要夠新、支援 mod。作者在桌面版 2.1.308 驗證；舊版終端機 `claude`（例如 2.1.214）不認得 mod 格式。

## 安裝

1. 把本資料夾（`_mods/vault-guards`，內有 `.claude-plugin/` 與 `hooks/`）複製到 `~/.claude/mods/vault-guards`。
2. 在 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS` 加入這個路徑。已經裝了其他 mod 就追加在後面，Windows 用 `;` 分隔，macOS 與 Linux 用 `:`：

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:/Users/你的帳號/.claude/mods/vault-guards"
     }
   }
   ```

3. 建立 `~/.claude/vault-guards.json`，列出知識庫資料夾名稱（路徑中的一段，要整段相符）：

   ```json
   { "vaults": ["my-vault"] }
   ```

   沒有這個檔，寫回護欄不動作，只做 python 編碼那一項。
4. **開一個新 session**（已開的 session 不會載入）。

## 怎麼判斷「在知識庫內」

- `Write`：檔案路徑裡有你列的資料夾名稱。
- Bash／PowerShell：指令裡寫的路徑有資料夾名稱，或 session 起始目錄在知識庫內（這時 `echo x > CHANGELOG.md` 這種相對路徑也會擋）。
- 資料夾名稱要整段相符：設 `my-vault` 時，`my-vault-old` 不算。

## 已知限制

- 這是字面規則比對。用別的寫法覆寫（例如其他語言的寫檔指令、先刪再建）擋不到。
- TASKS 的「少三成」是門檻，不是語意判斷：一次清掉大量已完成項目也會被擋，這時改用 Edit 分段刪。
- 驗證範圍：17 項 mod 測試（`claude plugin test`），包含沒有設定檔、設定檔壞掉、路徑沒加引號與相對路徑開頭的情況。測試涵蓋面有限：一位審視者對作者的私庫版做過突變測試（故意把程式改壞，看測試抓不抓得到），19 種改壞有 4 種測試仍全過；作者沒有獨立重跑，這個可設定的版本也沒重做。作者的庫用的是寫死路徑的版本，這個可設定的版本只跑過測試，**沒有在真實 session 實測過**。
