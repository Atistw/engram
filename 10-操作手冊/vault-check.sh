#!/usr/bin/env bash
# vault-check.sh — 保護內容完整性的 fail-loud 檢查。週五庫管家、週回顧跑。
# 只檢查「資料會不會被讀錯、讀漏」：核心檔在不在、出處欄填對沒、TASKS 停讀邊界、skill 部署版有沒有落後正本。
# 不檢查治理文件自己的格式（那種檢查會自我繁殖，維護成本高於價值）。
# 用法：bash 10-操作手冊/vault-check.sh   （cwd 任意，腳本自己找知識庫根目錄）
# 退出碼：有 FAIL → 1；全過 → 0。讀不到檔算 FAIL，不靜默放行。
# 需要 GNU awk（Windows Git Bash、Linux 內建；macOS 先 `brew install gawk`）。

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || { echo "FATAL: 進不了知識庫根目錄 $ROOT"; exit 1; }

AWK="$(command -v gawk || command -v awk)"
if ! "$AWK" 'BEGINFILE{} END{}' /dev/null >/dev/null 2>&1; then
  echo "FATAL: 需要 GNU awk（gawk）。macOS：brew install gawk"; exit 1
fi

fail=0
pass=0
echo "== vault-check @ $ROOT =="

report() {  # report "描述" "違規清單（空＝PASS）"
  if [ -z "$2" ]; then echo "  [PASS] $1"; pass=$((pass+1))
  else echo "  [FAIL] $1"; printf "%b\n" "$2"; fail=$((fail+1)); fi
}

# 1 核心檔存在
missing=""
for f in HOME.md TASKS.md CLAUDE.md schema.md DECISIONS.md CHANGELOG.md 99-memory/MEMORY.md 10-操作手冊/已知陷阱.md; do
  [ -f "$f" ] || missing="$missing\n    - $f"
done
report "核心檔存在" "$missing"

# 2-5 frontmatter 出處欄：一次 awk 掃全庫（逐檔多次 grep 在 Windows 上很慢）
# 規格見 schema.md「出處分級欄位」；為什麼要查見 已知陷阱 §1
scan=$(find . \( -name .git -o -name .obsidian -o -name _templates -o -name node_modules \) -prune -o -name '*.md' -print0 \
  | xargs -0 "$AWK" '
    BEGINFILE { ha=0; a=""; hl=0; l=""; hs=0; sp=0; sd=0 }  # 不用 FNR==1：0 byte 檔不會觸發，會沿用上一檔狀態
    sp { if ($0 ~ /^([[:space:]]+([a-zA-Z_]+:|-|\[\[)|-[[:space:]])/) hs=1; sp=0; sd=1 }  # source: 下一行是縮排子鍵或清單項（含零縮排的 "- "）
    /^author:/ && !ha { ha=1; a=$0; sub(/^author:[[:space:]]*/,"",a); gsub(/[[:space:]]+$/,"",a); gsub(/"/,"",a) }
    /^證據等級:/ && !hl { hl=1; l=$0; sub(/^證據等級:[[:space:]]*/,"",l); gsub(/"/,"",l) }
    /^source:/ && !sd { r=$0; sub(/^source:[[:space:]]*/,"",r); gsub(/[[:space:]"]/,"",r); if (r!="") { hs=1; sd=1 } else sp=1 }
    ENDFILE {
      f=FILENAME
      if (f ~ /^\.\/03-決策案例庫\/.+\.md$/ && f !~ /\/_MOC-[^\/]*$/ && !ha) print "NOAUTHOR\t" f
      if (ha && a=="") print "BADAUTHOR\t" f " (值：<空>)"
      if (ha && a ~ /\{\{/) print "BADAUTHOR\t" f " (模板佔位符沒換掉)"
      if (hl && l !~ /^(A|B|C|混合)/) print "BADLEVEL\t" f " (值：" l ")"
      if (hl && l ~ /^(B|C)/ && !hs) print "NOSOURCE\t" f
    }')
pick() { printf '%s\n' "$scan" | "$AWK" -F'\t' -v k="$1" '$1==k { printf "\\n    - %s", $2 }'; }
report "決策案例庫全含 author 欄" "$(pick NOAUTHOR)"
report "author 非空且不是模板佔位符" "$(pick BADAUTHOR)"
report "證據等級值域合規（A/B/C/混合）" "$(pick BADLEVEL)"
report "B/C 級都附 source 欄" "$(pick NOSOURCE)"

# 6 TASKS 停讀邊界標記（CLAUDE.md「啟動」靠它截斷載入）
# 比對註解標記本身（<!-- … 停讀邊界 …），不比對規則說明文字裡提到的「停讀邊界」
grep -qE '^<!--.*停讀邊界' TASKS.md 2>/dev/null && m="" || m="\n    - TASKS.md 找不到「<!-- … 停讀邊界 … -->」標記"
report "TASKS 含停讀邊界標記" "$m"

# 7 部署版 skill 不得落後 _skills/ 正本（正本改了、部署版沒重裝，新規則就沒生效）
# 只看 diff 的 '<' 行（正本有、部署版沒有）；部署版自己加的客製放行。
# 你的 agent 從別的位置載 skill，就把路徑加進下面的清單。
drift=""
for dir in ".claude/skills" ".agents/skills" "$HOME/.claude/skills"; do
  [ -d "$dir" ] || continue
  for d in "$dir"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d"); dep="$d/SKILL.md"; canon="_skills/$name/SKILL.md"
    [ -f "$dep" ] && [ -f "$canon" ] || continue
    behind=$(diff "$canon" "$dep" 2>/dev/null | grep -c '^<')
    [ "$behind" -gt 0 ] && drift="$drift\n    - $name @ $dir（落後或被改了 $behind 行）"
  done
done
report "部署版 skill 未落後 _skills/ 正本" "$drift"

echo
echo "== 結果：PASS=$pass FAIL=$fail =="
if [ "$fail" -gt 0 ]; then echo "== ⚠️ 有 FAIL，先修再收工 =="; exit 1; fi
echo "== ✅ 全過 =="
exit 0
