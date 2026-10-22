---
tags: [系統設定, lint, 體檢, 日常運作]
updated: YYYY-MM-DD
version: v1
status: active
related: ["[[HOME]]", "[[schema]]"]
---

> **一句話定位**：知識庫健康檢查操作手冊——可重複執行的 lint 流程。建議每月或大規模調整後跑一次。

# Wiki 體檢 Checklist

**觸發時機**：每月第一個週一、執行目錄重組後、新重大文件入庫前。

---

## 一、壞連結偵測（Broken wikilinks）

```bash
# 在知識庫根目錄執行（把 /path/to 換成你的實際路徑）
cd /path/to/your-knowledge-base

# 找出所有 [[wikilink]] 目標，逐一確認檔案是否存在
grep -roh '\[\[[^]]*\]\]' --include="*.md" . \
  | sed 's/\[\[//g; s/\]\]//g' | sed 's/|.*//' \
  | sort -u > /tmp/wikilink_targets.txt

while IFS= read -r link; do
  file=$(echo "$link" | sed 's/#.*//')
  if ! find . -name "${file}.md" -o -name "${file}" 2>/dev/null | grep -q .; then
    echo "❌ 找不到: $link"
  fi
done < /tmp/wikilink_targets.txt
```

**快速版**（針對已知搬遷路徑）：

```bash
# 把 OLD_PATH 換成已知的舊路徑
grep -rn "OLD_PATH" --include="*.md" . | grep -v CHANGELOG
# 預期：無輸出
```

---

## 二、孤兒頁偵測（Orphan pages）

```bash
# 找沒有任何入站連結的 MD 檔案
find . -name "*.md" ! -name "_*" ! -name "README*" ! -name "HOME*" \
  ! -name "TASKS*" ! -name "DECISIONS*" ! -name "CHANGELOG*" \
  ! -name "schema*" \
  | sed 's|^\./||; s|\.md$||' > /tmp/all_pages.txt

grep -roh '\[\[[^]]*\]\]' --include="*.md" . \
  | sed 's/\[\[//g; s/\]\]//g; s/|.*//' \
  | sort -u > /tmp/linked_pages.txt

comm -23 <(sort /tmp/all_pages.txt) <(sort /tmp/linked_pages.txt)
```

---

## 三、老化 Draft 偵測（超過 4 週）

```bash
CUTOFF=$(date -d "4 weeks ago" +%Y-%m-%d 2>/dev/null || date -v-4w +%Y-%m-%d)

grep -rl "^status: draft" --include="*.md" . \
  | while read file; do
    updated=$(grep -m1 "^updated:" "$file" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
    if [[ -n "$updated" && "$updated" < "$CUTOFF" ]]; then
      echo "⚠️ 老化 draft: $file (updated: $updated)"
    fi
  done
```

---

## 四、人工比對項目

| 檢查項 | 常見矛盾點 |
|--------|-----------|
| 人物側寫（技能/職責） | 人物圖譜 vs 會議記錄描述不一致 |
| 專案狀態 | TASKS.md 待辦 vs DECISIONS.md 記載版本 |
| 命名規則 | 新建檔案是否符合 schema.md |

---

## 體檢紀錄

| 日期 | 執行者 | 發現問題數 | 已開 TASKS 項 |
|------|--------|-----------|--------------|
| — | — | — | — |

---

## 執行後動作

1. 把發現的問題開成 `TASKS.md` 待辦項
2. 更新本表「體檢紀錄」
3. `CHANGELOG.md` 頂部補一行
