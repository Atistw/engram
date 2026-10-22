#!/bin/bash
# 排程三：月度 Wiki 體檢（每月 15 日 09:00）（cron 版；prompt 與 _schedules/排程範本.md 相同，改一邊要同步改另一邊）
set -euo pipefail

VAULT_DIR="${VAULT_DIR:-/path/to/your-knowledge-base}"   # 改成你 cron 主機上的實際路徑
LOG_DIR="$VAULT_DIR/_schedules/logs"
mkdir -p "$LOG_DIR"

cd "$VAULT_DIR"

claude -p "你是知識庫的體檢員。工作目錄：$VAULT_DIR

先讀 HOME.md 與 schema.md 確認庫結構，然後執行三項體檢（做法見 02-日常運作/wiki體檢_checklist.md）：

【一、壞連結偵測】
找出指向不存在檔案的 [[wikilink]]。用 grep 列出全庫的 wikilink 目標，逐一確認對應檔案是否存在，列出找不到的連結。

【二、老化 Draft 偵測】
找出 status: draft 且 updated 超過 4 週的頁面，列出檔名與最後更新日，供我判斷要繼續還是刪除。

【三、孤兒頁偵測】
找出沒有任何入站連結的 MD 檔案（排除 README/HOME/TASKS/DECISIONS/schema/CHANGELOG/CLAUDE 等系統檔），列出供我確認是否仍有用。

【完成後】
1. 把發現的問題開成 TASKS.md「🤖 系統維護」的待辦（各類型各開一條）
2. 更新 02-日常運作/wiki體檢_checklist.md 的「體檢紀錄」表
3. CHANGELOG.md 頂部補一行：「YYYY-MM-DD 月度 wiki 體檢，發現 N 項，已開 TASKS」

輸出回報：發現幾個壞連結、幾個老化草稿、幾個孤兒頁、已開幾條 TASKS。
原則：只回報與開 TASKS，不擅自刪除或改動任何內容。"   --dangerously-skip-permissions   >> "$LOG_DIR/monthly-wiki-checkup_$(date +%F).log" 2>&1
