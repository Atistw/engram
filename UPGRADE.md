---
tags: [升級指南]
updated: 2026-10-22
version: v2.1.x→v2.2.0
status: active
---

> **一句話定位**：已在用舊版 Engram 的人，照這份指南升級，不用重新複製整個資料夾、不會丟掉你自己填的內容。

# 升級指南：v2.1.x → v2.2.0（2026-10-22）

小版號：新增幾個選用項目，修正 log 多一欄。知識庫結構、排程、其他閘門都沒改。

## v2.2.0 改了什麼

| 變更 | 為什麼 | 你要做什麼 |
|------|--------|-----------|
| 修正 log 加最後一欄「模型／檔位」；`CLAUDE.md`「被更正時」補一句：記犯錯當下的模型與檔位，不知道寫「檔位未知」 | 月審時才看得出同類錯誤是不是集中在某個模型或低檔位 | 在你的 `CLAUDE.md`「被更正時」那條末尾補同一句；當月修正 log 表頭加一欄（舊列留空即可） |
| 新增 `_hooks/correction_stamp.py`（選用） | 每輪提示當下的模型與檔位，讓上面那欄照抄 | 想用再裝，見 `_hooks/README.md` |
| 新增 `_mods/vault-guards`（選用） | 擋住 CHANGELOG／TASKS 被整檔覆寫（作者的庫同月發生兩次） | 想用再裝，見該資料夾 README；要建 `~/.claude/vault-guards.json` 列出知識庫資料夾名 |
| 新增 `_mods/todo-pane`（選用） | 在側邊窗格看 TASKS | 想用再裝 |
| `_mods/effort-tier` 0.3.0：新增「組織決策題」規則（決策問法＋組織對象＋拆合動作） | 部門拆合類問題原本不會被抬到 high | 已裝的人把新版 `hooks/register.tsx` 覆蓋過去，開新 session |
| 新增 `_skills/decision-matrix`、`_skills/framework-adoption-gate`（選用） | 加權評分挑選；導入外部框架前先審 | 想用再打包安裝 |
| `README.md`：拿掉「搭配 fable-harness」段落；「核心理念」第 5 點與常見問題的實測主張改成照實寫（樣本小；拆掉流程提醒後修正紀錄反而變多，也照實寫） | 作者自己的庫已拆掉那套常駐流程；原寫法說過頭 | 不用動 |
| 已知陷阱：刪兩條判例 | 判例來源不適合公開 | 你自己的判例照留 |

## 驗證

- 修正 log：在你的當月檔表頭看到「模型／檔位」欄。
- 有裝 mod 的：每個 mod 資料夾跑 `claude plugin test .`（要支援 mod 的版本），全過。
- `bash 10-操作手冊/vault-check.sh` 仍應全 PASS。

---

# 升級指南：v2.0.0 → v2.1.0（2026-10-20）

小版號：只**新增一個選用項目**，知識庫本身的結構、閘門、排程、skill 都沒改。不想用的話，這一版什麼都不用做。

## v2.1.0 改了什麼

| 變更 | 為什麼 |
|------|--------|
| 新增 `_mods/effort-tier/`（選用）：Claude Code mod，依提問類型自動調整思考檔位，只改 effort，不換模型、不連網；人名與詞用 `~/.claude/effort-tier.rules.json` 自己加 | `CLAUDE.md`「模型檔次（選用）」那條只靠模型記得提醒；這個 mod 在請求送出前直接處理 |
| `README.md`：新增 Step 6.7（選用）、資料夾結構補 `_mods/`、版本徽章 2.1.0 | 讓新使用者找得到 |

## 想用的話（約 10 分鐘）

1. 複製 `_mods/` 資料夾與更新後的 `README.md` 到你的知識庫。
2. 照 `_mods/effort-tier/README.md` 安裝：放到 `~/.claude/mods/effort-tier`、在 `~/.claude/settings.json` 設 `CLAUDE_CODE_PLUGIN_DIRS`、開新 session。
3. 前提：Claude Code 桌面版夠新、支援 mod；用其他模型或 Bedrock／Google Cloud 時改 effort 會讓快取重算，不要用。細節都在該 README。

## 驗證

照 `_mods/effort-tier/README.md` 的「驗證」節：打一句會命中的話，狀態列應出現 `effort medium → high`。知識庫本身的檢查不受影響，`bash 10-操作手冊/vault-check.sh` 仍應全 PASS。

---

# 升級指南：v1.1.0 → v2.0.0（2026-10-14）

若你從 v1.x 升級，**先照本節的步驟做完，再看上面 v2.1.0 的選用項目**。

大版號的原因：TASKS 結構、HOME 的「最近更新」、常駐指示層的位置都變了，排程 prompt 也跟著改。舊排程配新 TASKS 會找不到區塊，所以**第 3、5 步要一起做**。

## v2.0.0 改了什麼

| 變更 | 為什麼 |
|------|--------|
| 新增根目錄 `CLAUDE.md`：常駐閘門（出處分級、證據、人事阻尼、外送外部模型、大決策）＋日常規則（入庫、寫回、被更正時、不覆述） | 舊版把常駐指示寫在 README 的範本框裡，要你自己複製。現在直接給檔案，Claude Code 自動載入。「證據」閘門是新的：沒讀檔就下結論、只驗格式就說「已驗證」，是作者庫裡最常見的真實錯誤 |
| 新增 `10-操作手冊/`：`已知陷阱.md`、`修正log/`、`專名消歧登記表.md`（正本）、`vault-check.sh` | 每條閘門都要對應一個真實事故，改閘門前先讀；AI 被更正就記一列，月掃時同類 2 次以上才長新規則，不預先堆規則 |
| TASKS 改三桶：🎯 我要做（上限 8）／🗓 我要開的會／👀 我在追（一人一行），加「停讀邊界」，以下放 🟡 待確認、🤖 系統維護；刪「已完成」區 | 舊結構會越堆越長。作者的庫一度堆到 258 條未完成、150 多 KB，每個新對話都要吃進去。新規則：21 天沒更新移 🟡，🟡 兩週沒點名就結案，完成就刪並記 CHANGELOG |
| HOME 不再有「最近更新」；CHANGELOG 改成唯一變更軌跡，新條目直接插最上方 | 兩處記同一件事必飄移；HOME 只做導航 |
| `schema.md`：新增 status 三態判準（`draft` 是唯一勿用信號）、版本號小數點規則、原始逐字稿與修正 log 頁面型態 | 舊版 `active`／`draft` 判準模糊，持續在改的文件常被標成 draft，結果 AI 不敢採信 |
| `transcript-intake`：專名「語境讀得通不是正名依據」、多份逐字稿衝突不各自定案、與會者行為紀錄（不打分）、TASKS「先對帳再寫」、選用的盲點四視角、語氣三不、「庫裡沒有的組織事實停下來問」 | 都是作者庫裡實際出過的錯 |
| `vault-weekly-review`：TASKS 膨脹改看 🎯 是否超過 8、殭屍改 21 天、加跑 vault-check、寫回改 CHANGELOG | 對齊新 TASKS 結構 |
| 排程範本 v2：週五庫管家改搬 🟡／結案／跑 vault-check；月掃加修正 log 月審；全部改寫 CHANGELOG。cron 腳本 log 路徑修正（舊版誤寫成 `_starter-kit/_schedules/logs`） | 對齊新結構；修 bug |
| README：核心理念加兩條（閘門要少且從事故長出來、skill 只留一份正本）、Step 4 改指向 `CLAUDE.md` | — |

## 升級步驟（約 30 分鐘）

1. **常駐指示層**：把新版 `CLAUDE.md` 複製到你的知識庫根目錄，照檔頭註解改。你原本貼在 Cowork 偏好設定／`CLAUDE.md`／`AGENTS.md` 的舊版規則（【讀回紀律】【放大器紀律】等）已收進新檔，**用新檔整份取代舊規則，不要兩份並存**。你自己加過的規則，搬進新檔「日常規則」段。
2. **操作手冊**：複製整個 `10-操作手冊/` 資料夾。若你已經在 `_skills/transcript-intake/references/專名消歧登記表.md` 累積了易混組，把內容搬進 `10-操作手冊/專名消歧登記表.md`（正本），`references/` 那份換成新版快照說明。
3. **TASKS 搬家**：先把舊 TASKS.md 另存為 `02-日常運作/TASKS封存/YYYY-MM-DD_TASKS重整.md`，再換成新版 TASKS.md。然後對你的 agent 說：
   > 「照新版 TASKS 三桶規則，把封存檔裡還沒完成的條目分流：我自己要做的進 🎯（最多 8 條）、要開會收斂的進 🗓、等別人交的進 👀 一人一行，其餘全部進 🟡 待確認。每條補 `(更新 MM-DD)`。原文不要刪，最後回報每一桶幾條、總數有沒有對上。」
   對帳：封存檔未完成條數 ＝ 新 TASKS 各桶條數加總（合併成一行的要列出來）。
4. **HOME／CHANGELOG**：把 HOME 的「最近更新」區塊整段搬到 CHANGELOG 最上方，然後刪掉 HOME 那段。換上新版 CHANGELOG 的定位說明（只增不刪、新條目插最上方）。
5. **排程**：刪掉舊的週五庫管家、月初決策掃描、月度體檢排程，照新版 `_schedules/排程範本.md` 重建；用 cron 的換新版 `.sh`。
6. **schema 與 skill**：換上新版 `schema.md`（若你自己加過頁面型態，把那幾列搬回去）；換新版 `_skills/transcript-intake/SKILL.md`、`_skills/vault-weekly-review/SKILL.md`，重新打包安裝。
7. `.gitignore` 補一行 `_schedules/logs/`。

## 驗證（升級完成後跑一次）

在你的知識庫根目錄執行：

```bash
bash 10-操作手冊/vault-check.sh
```

7 項全 PASS、退出碼 0 才算升級完成。常見 FAIL：
- 「TASKS 含停讀邊界標記」→ 第 3 步 TASKS 沒換成新版
- 「決策案例庫全含 author 欄」→ 舊案例沒有 `author` 欄，補上（本人寫的填本人，AI 起草的填模型名）
- 「部署版 skill 未落後正本」→ 第 6 步改了 `_skills/` 但沒重新安裝

另外確認舊結構已清乾淨（三條都應該沒有輸出）：

```bash
grep -n "最近更新" HOME.md
grep -n "近期已完成" TASKS.md
grep -rn "HOME.md 最近更新" _schedules/
```

---

# 升級指南：v1.0.0 → v1.1.0（2026-07-24，歷史）

## v1.1.0 改了什麼

| 變更 | 為什麼 |
|------|--------|
| `_skills/transcript-intake/SKILL.md` 步驟0.5：人名消歧 → 專名消歧 | 涵蓋範圍擴大到客戶名、產品名——這兩類沒有名冊擋，寫錯字會安靜污染整條產品線的檢索與後續寫回，比人名誤植更難察覺 |
| 新增「完成準則」：每個待查實體都要結案，無漏 | 原本沒有收斂條件，容易漏查一半就當作跑完了 |
| 新增 `_skills/transcript-intake/references/專名消歧登記表.md` | 具體易混組會隨時間累積，不該塞進 SKILL.md 主幹——主幹只放規則，登記表放案例（v2.0.0 起正本改放 `10-操作手冊/`） |
| `README.md`：砍雙語，`README.zh-TW.md` 併入唯一 `README.md` | 資料夾名/schema/skill 檔全中文，維護英文版是個進去就破功的門面承諾 |

升級 v1.1.0 的人直接照上面 v2.0.0 的步驟做即可，v1.1.0 的內容已包含在內。
