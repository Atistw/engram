---
tags: [mod, 選用, Claude-Code, 思考檔位]
updated: 2026-10-22
status: active
related: ["[[CLAUDE]]", "[[README]]"]
---

# effort-tier：依題目自動調整 Claude Code 的思考檔位（選用）

> **一句話定位**：在每個模型請求送出前，看你這一輪的提問屬於哪一類，**只調整 effort（思考檔位），不換模型、不連網**：需要深度判斷的抬到 `high`，純機械的雜務降到 `low`，其他不動。

它是 `CLAUDE.md`「模型檔次（選用）」那條的機械版：那條靠模型自己記得提醒，這個 mod 在請求送出前直接處理。兩者可以並用，也可以只用其一。

## 它做什麼，不做什麼

| 做 | 不做 |
|---|---|
| 提問命中「高判斷」規則，且目前 effort 是 `low` 或 `medium` → 改成 `high` | 不換模型 |
| 提問命中「機械雜務」規則，且目前 effort 是 `medium` → 改成 `low` | 不降你自己設定的 `high`、`xhigh`、`max`，也不動你設成 `low` 的 |
| 只改**主對話**的請求 | 不改 subagent 的 effort |
| 狀態列在有調整時顯示 `effort medium → high` | 沒調整就不顯示 |
| 在本機寫一個追蹤檔，記錄最後一步改了什麼 | 不記提問內容、不連網、不讀設定檔以外的檔案 |

## 判斷規則

只看**你這一輪提問的前 600 個字**。流程：

1. 這一輪是 subagent 回報或系統通知（不是你打的）→ 不調整。
2. 提問裡貼上的內容（`<pasted_content>` 之後）不算，避免長文裡的字眼誤觸發；系統自動加在提問前面的 `<system-reminder>` 區塊也不算，並且先拿掉再取前 600 字。
3. 本輪自己命中「高判斷」規則 → 抬到 `high`。任一成立即可：
   - **人事與決策類用語**單獨出現（預設內建，例如：接班、繼任、離職、資遣、升遷、考核面談、要不要接／留／走、婉拒、越級）；
   - **你指定的人名**與**動機類用語**同時出現（例如「王經理」加上「用意」「背後」「為什麼突然」）。人名清單預設是空的，要在設定檔填。
   - **組織決策題**：決策問法（要不要、該不該、拆不拆、如何整併…）、組織對象（部門、團隊、事業單位、編制…）、拆合動作（拆、合併、整併、重組、劃歸…）三者同時出現，且對象與動作相隔 12 字內。例如「這兩個部門該不該合併」。
4. 本輪沒有自己的主題，只是短句（40 字以內）或指回前文（「同問題再說明」「繼續」「剛剛那題」）→ 承接**前兩輪**的判斷。長的新主題不承接。
5. 以上都沒命中，但本輪命中「機械雜務」用語（預設：格式整理、改檔名、重新命名、更新 TASKS、寫 CHANGELOG、同步索引）→ 降到 `low`。
6. 都沒命中 → 不動。

這是**關鍵字規則，不是語意判斷**：沒有出現關鍵字的難題不會被抬高，出現關鍵字的簡單題可能被誤抬。

## 前提

- Claude Code 要夠新、支援 mod。作者在桌面版 2.1.299 驗證；舊版終端機 `claude`（例如 2.1.220）不認得 mod 格式。
- 改 effort 不重置快取，依官方 prompt caching 文件，僅限 Opus 5.5、Sonnet 5.5、Haiku 5.5、Fable 5.1，並用 API key 或 Claude 訂閱連線。**用其他模型，或走 Bedrock、Google Cloud、內部 gateway，改 effort 會讓整段上下文重算**，請不要用在那些環境。這點是依文件，沒有另外實測。

## 安裝

1. 把本資料夾（`_mods/effort-tier`，內有 `.claude-plugin/` 與 `hooks/`）複製到 `~/.claude/mods/effort-tier`。
2. 在 `~/.claude/settings.json` 加入，已有 `env` 就合併進去：

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:/Users/你的帳號/.claude/mods/effort-tier"
     }
   }
   ```

   已經有其他路徑時追加在後面，Windows 用 `;` 分隔，macOS 與 Linux 用 `:`。
3. **開一個新 session**（已開的 session 不會載入）。

只想先試一個 session：用 `claude --plugin-dir <資料夾路徑>` 啟動。

## 設定你自己的詞（選用，不必改程式）

建立 `~/.claude/effort-tier.rules.json`，每輪提問時讀取，改完不用重開 session：

```json
{
  "person": ["王經理", "李總"],
  "motive": ["打什麼算盤"],
  "diag": ["資遣評估"],
  "mech": ["轉檔"],
  "mechEnabled": true
}
```

| 欄位 | 作用 |
|---|---|
| `person` | 要追蹤的人名。只有「人名加動機類用語」同時出現才抬到 high；不填就沒有這條規則 |
| `motive` | 追加的動機類用語（加在預設之後） |
| `diag` | 追加的人事與決策類用語，單獨命中就抬到 high |
| `mech` | 追加的機械雜務用語，命中就降到 low |
| `mechEnabled` | 設成 `false` 完全關掉降檔，只保留升檔 |

詞一律寫**純文字**，不必寫正規表示式。檔案不存在、格式錯誤、欄位型別不對，都會退回預設規則，不會讓 Claude Code 當機。

**兩個建議**：

- 先拿你自己一週的真實提問回放，看會命中哪些，再決定要不要加詞。詞加多了，誤判也會增加。
- 降檔（`mech`）比升檔風險高：機械雜務也可能需要思考。不確定就把 `mechEnabled` 設成 `false`。

## 驗證

1. 新 session 打一句會命中的話，例如「要不要接這個職位」。狀態列應出現 `effort-tier effort medium → high`。
2. 看追蹤檔 `~/.claude/effort-tier-trace.mods.json`，應有 `"tier":"high","from":"medium","to":"high"`。
3. 再打一句與規則無關的短句，追蹤檔應變成 `"tier":null`，`from` 與 `to` 相同。

注意：狀態列與追蹤檔證明的是「**送出的請求被改成 high**」。API 端是否因此想得更久，沒有量測。

mod 自身的檢查（需要有支援 mod 的 `claude` 執行檔）：

```bash
claude plugin validate ~/.claude/mods/effort-tier
claude plugin test     ~/.claude/mods/effort-tier
```

## 停用與解除

- 暫停：把 `env.CLAUDE_CODE_PLUGIN_DIRS` 裡這個路徑拿掉，開新 session。
- 解除：同上，再刪除 `~/.claude/mods/effort-tier`，可一併刪 `~/.claude/effort-tier-trace.mods.json` 與 `~/.claude/effort-tier.rules.json`。

## 隱私與安全

- 不連網，不呼叫模型。
- 讀的檔案只有 `~/.claude/effort-tier.rules.json`；寫的檔案只有 `~/.claude/effort-tier-trace.mods.json`（時間、回合 id、改前改後的 effort，**不含提問內容**，每一步覆寫一次）。
- 規則只在記憶體中比對你提問的前 600 字，不留存。

## 已知限制

- 關鍵字規則有漏判與誤判。作者自己的使用中就出現過口語詞沒收錄而漏判，補詞後才命中。
- 只內建中文關鍵字。要用在英文或程式工作，請用設定檔加詞。
- 「承接前兩輪」靠字數與用語判斷，遇到很短但換了主題的句子，可能被誤承接。
- 作者的測試以單一使用者、少量 session 為主，不代表長期穩定。
- 調高 effort 會多用 token，調低可能降低品質。實際省多少、貴多少，沒有量測。
- 驗證範圍：29 項 mod 測試（2026-10-22 新增組織決策題 3 項），加上 2026-10-20 一次真實 session 的 8 輪實測（設定檔的人名、追加詞、預設詞、對照組，以及設定檔改壞後退回預設）；組織決策題沒有在真實 session 實測過。只驗到「送出的請求被改成什麼」，單一 session、單次執行；任何設定檔讀取失敗都退回預設規則。

## 疑難排解

| 現象 | 檢查 |
|---|---|
| 狀態列完全沒出現 | 是否開了新 session；`CLAUDE_CODE_PLUGIN_DIRS` 路徑是否正確；版本是否支援 mod |
| 命中卻沒調整 | 目前 effort 是否本來就是 `high` 以上，或你手動設成 `low`（規則不覆蓋） |
| 該調沒調 | 關鍵字是否在提問前 600 字內，是否放在貼上內容裡；人名規則是否已在設定檔填 `person` |
| `plugin validate` 失敗 | 用的是否為較舊的 `claude`；改用桌面版內建的執行檔 |
| 追蹤檔沒產生 | 該 session 沒載入 mod；或家目錄環境變數（Windows 的 `USERPROFILE`、其他系統的 `HOME`）未設 |
