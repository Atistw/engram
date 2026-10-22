#!/bin/bash
# 排程一：週五庫管家 + 週報（每週五 16:00）（cron 版；prompt 與 _schedules/排程範本.md 相同，改一邊要同步改另一邊）
set -euo pipefail

VAULT_DIR="${VAULT_DIR:-/path/to/your-knowledge-base}"   # 改成你 cron 主機上的實際路徑
LOG_DIR="$VAULT_DIR/_schedules/logs"
mkdir -p "$LOG_DIR"

cd "$VAULT_DIR"

claude -p "你是知識庫的庫管家。工作目錄：$VAULT_DIR

先讀 CLAUDE.md、schema.md，再讀 TASKS.md 全文，然後執行兩段工作：

【第一段：庫衛生清理】
1. TASKS.md：
   - frontmatter updated 改為今天
   - 「📅 近期日程」：刪過期列；TASKS 或 DECISIONS 有新死線就補進來
   - 🎯／🗓／👀 裡 \`(更新 MM-DD)\` 超過 21 天的條目：原文搬到「🟡 待確認還活著」，尾端加〔移入 MM-DD〕
   - 🟡 裡移入超過 14 天、期間沒被點名要留的條目：刪除，CHANGELOG 記一行「結案（未點名）：…」
   - 還留著 [x] 的條目：刪掉並在 CHANGELOG 記一行完成
   - 👀 我在追：期限已到或本週到期的承諾加 ⚠️
   - 🎯 超過 8 條：不刪，列入回報
2. HOME.md：本週新增的檔案是否已入導覽，缺的補上
3. 99-memory/MEMORY.md：索引與實際檔案比對，缺漏補索引
4. 跑 bash 10-操作手冊/vault-check.sh，FAIL 項列入回報（只列不改）
5. 一致性掃描：發現 status 標記矛盾（舊版 active、新版 draft）只記錄不擅自改，列入回報

【第二段：週報草稿】
1. 讀 02-日常運作/raw/ 本週週記（YYYY-WXX_週記.md，ISO 週數）
2. 對照本週 CHANGELOG 的完成項與 DECISIONS.md 本週變動
3. 產出 02-日常運作/週報/YYYY-WXX_週報.md（參考既有週報格式；已存在則更新）

【完成後】
CHANGELOG.md 頂部補一行維護摘要（搬了幾條到 🟡、結案幾條、vault-check 結果）。
輸出回報：清了什麼、週報重點三行、需要我判斷的事項（若有）。回報「已清理」時寫出檢查了哪些區塊。

原則：機械性清理直接做；涉及判斷的只標記回報，不擅自改。"   --dangerously-skip-permissions   >> "$LOG_DIR/friday-lint_$(date +%F).log" 2>&1
