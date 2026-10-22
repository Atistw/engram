---
tags: [hook, 選用, Claude-Code, 修正log]
updated: 2026-10-22
status: active
related: ["[[CLAUDE]]", "[[10-操作手冊/修正log/_模板_修正log]]"]
---

# _hooks：Claude Code 的 hook 腳本（選用）

## correction_stamp.py：修正 log 的「模型／檔位」欄自動提示

> **一句話定位**：每次你送出提問時，在 AI 的上下文裡附一行「本輪模型／檔位」，讓 AI 被你更正、要記修正 log 時，最後一欄可以照抄，不用猜。

**為什麼要記這欄**：月審修正 log 時，可以看出同類錯誤是不是集中在某個模型或低檔位，用來決定哪類工作該換大模型或調高檔位。沒有這欄，只能靠印象。

**它怎麼取值**

| 欄位 | 來源 | 取不到時 |
|---|---|---|
| 模型 | 這個 session 對話紀錄裡，最近一則 AI 回覆標的模型名稱 | 寫「未知」 |
| 檔位 | `~/.claude/effort-tier-trace.mods.json`，這是 `_mods/effort-tier` 寫的追蹤檔；附上距今幾分鐘，讓你看得出新舊 | 寫「未知」 |

沒裝 effort-tier 時，檔位一律是「未知」，模型仍取得到。腳本只讀檔，不寫檔、不連網。

**安裝**

1. 把 `correction_stamp.py` 複製到 `~/.claude/hooks/`。
2. 在 `~/.claude/settings.json` 的 `hooks` 加入（已有 `UserPromptSubmit` 就加在同一個陣列裡）：

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         { "hooks": [ { "type": "command", "command": "python \"C:/Users/你的帳號/.claude/hooks/correction_stamp.py\"" } ] }
       ]
     }
   }
   ```

   macOS 與 Linux 把 `python` 換成 `python3`，路徑改成你的家目錄。
3. 開一個新 session。之後每輪 AI 會看到一行「🏷️ 修正log 末欄可抄：…」。

**驗證範圍**：作者 2026-10-22 把舊版裝進自己的環境，但舊版在 Windows 預設編碼下印 emoji 會當掉，裝上後一次都沒有成功跑過，直到驗收時才發現。這份已修正（腳本自己改用 UTF-8 輸出），只在 Windows 不設任何編碼環境變數的情況下手動執行過一次、正常結束；還沒有在真實 session 裡看過它的提示。macOS、Linux 沒有測過。
