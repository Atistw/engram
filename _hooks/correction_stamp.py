#!/usr/bin/env python3
"""UserPromptSubmit hook：每輪注入一行「本輪模型／檔位」，供寫修正log 末欄時直接抄，不用猜。

模型：從 transcript 最近一則 assistant 訊息的 model 欄位取。
檔位：~/.claude/effort-tier-trace.mods.json 最近一筆的 to；附事件時間，讓讀的人看得出新舊。
查不到就寫「未知」，不編。
"""
import json
import os
import sys
from datetime import datetime, timezone

TAIL_BYTES = 400_000


def last_model(path):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - TAIL_BYTES))
            raw = f.read().decode("utf-8", errors="ignore")
    except OSError:
        return ""
    model = ""
    for line in raw.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        m = (e.get("message") or {}).get("model")
        if e.get("type") == "assistant" and m:
            model = m
    return model


def effort():
    p = os.path.expanduser("~/.claude/effort-tier-trace.mods.json")
    try:
        with open(p, encoding="utf-8") as f:
            line = [l for l in f.read().splitlines() if l.strip()][-1]
        d = json.loads(line)
        at = datetime.fromisoformat(d["at"].replace("Z", "+00:00"))
        mins = int((datetime.now(timezone.utc) - at).total_seconds() // 60)
        return f"{d.get('to') or '未知'}（追蹤檔事件距今 {mins} 分鐘）"
    except Exception:
        return "未知"


def main():
    # Windows 預設主控台編碼（cp950、cp1252）印不出 emoji 與部分中文，hook 會當掉；一律改用 UTF-8 輸出
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    model = last_model(data.get("transcript_path", "")) or "未知（新 session 尚無 assistant 訊息）"
    print(f"🏷️ 修正log 末欄可抄：{model}／effort {effort()}。子代理犯錯記子代理的模型。")


if __name__ == "__main__":
    main()
