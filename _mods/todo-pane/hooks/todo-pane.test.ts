import { test, expect } from 'claude-code/testing'

import { forOthers, parse } from './parse'

const NOW = Date.UTC(2026, 9, 22, 12) // 10/22

const TASKS = [
  '## 📅 近期日程',
  '| 日期 | 事項 |',
  '|---|---|',
  '| 10/25 | 月會 |',
  '| 10/01 | 已過的會 |',
  '| MM/DD | （範例） |',
  '## 🎯 我要做',
  '1. [ ] **寫月報**〔對上〕(更新 10-20)——交給主管 → [[月報]]',
  '2. [x] **已完成的事** (更新 10-01)',
  '3. [ ] ⚠️ **很久沒動的事** (更新 09-01)',
  '### 🏠 私人（不計入上限）',
  '- [ ] 私人待辦 (更新 10-20)',
  '## 👀 我在追',
  '- **王小明**：①交報表〔10/30〕(更新 10-21) → [[會議記錄]]',
  '- **李小華**：②回覆合約 (更新 10-10)',
  '<!-- ═══════════ 停讀邊界 ═══════════',
  '## 🎯 我要做',
  '9. [ ] **停讀邊界以下不該被讀到** (更新 10-22)',
].join('\n')

test('🎯：只算編號項目，私人 `- [ ]` 不算；標題、標籤、更新日正確', () => {
  const s = parse(TASKS, NOW)
  expect(s.goals.map(g => g.n)).toEqual(['1', '2', '3'])
  expect(s.goals[0].title).toBe('寫月報')
  expect(s.goals[0].tag).toBe('對上')
  expect(s.goals[0].updated).toBe('10-20')
  expect(s.goals[0].idleDays).toBe(2)
  expect(s.goals[1].isDone).toBe(true)
  expect(s.goals[2].isWarn).toBe(true)
  expect(s.goals[2].idleDays).toBe(51)
})
test('停讀邊界以下不讀', () => {
  expect(parse(TASKS, NOW).goals.some(g => g.n === '9')).toBe(false)
})
test('👀：一人一行的寫法', () => {
  const w = parse(TASKS, NOW).watches
  expect(w.map(x => x.name)).toEqual(['王小明', '李小華'])
  expect(w[0].updated).toBe('10-21')
  expect(w[0].text).toBe('①交報表')
})
test('👀：一人一節的寫法（### 姓名 底下分專案與事項）', () => {
  const t = ['## 👀 我在追', '### 王小明', '- 專案甲 (更新 10-20)', '  - 交報表', '  - 回覆信件', '- → [[連結]]'].join('\n')
  const w = parse(t, NOW).watches
  expect(w.length).toBe(1)
  expect(w[0].name).toBe('王小明')
  expect(w[0].full).toBe('專案甲：交報表；回覆信件')
})
test('📅：只留今天以後的日期，範例列與過去的列略過', () => {
  const e = parse(TASKS, NOW).events
  expect(e.map(x => x.date)).toEqual(['10/25'])
  expect(e[0].days).toBe(3)
})
test('📅：本機時間清晨，今天的會仍算「今天」', () => {
  const early = new Date(2026, 9, 22, 1).getTime() // 本機時區 10/22 01:00
  const e = parse(['## 📅 近期日程', '| 10/22 | 今天的會 |', '| 10/23 | 明天的會 |'].join('\n'), early).events
  expect(e.map(x => x.days)).toEqual([0, 1])
})
test('複製給別人：拿掉自己的註記，把自己的名字換成「我」', () => {
  expect(forOthers('交報表（待確認）；王大同 下週追；待你回覆', '王大同')).toBe('交報表；我 下週追')
  expect(forOthers('交報表', '')).toBe('交報表')
})
