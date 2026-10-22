import type { Goal, Snapshot, Upcoming, Watch } from '../types'

// 解析 TASKS.md 的三個區塊：🎯 我要做（編號項目）、👀 我在追、📅 近期日程（表格）。
// 純函式，不碰引擎，方便測試。

const DAY_MS = 86_400_000

export const clean = (s: string): string =>
  s
    .replace(/\*\*/g, '')
    .replace(/\[\[([^\]|]*\/)?([^\]|]*)(\|[^\]]*)?\]\]/g, '$2')
    .replace(/`/g, '')
    .trim()

// 日期一律用本機時區的午夜計算，避免清晨時段「今天」被算成昨天
const dayStart = (ms: number): number => {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// 只有月日的日期：取離今天最近的那一年
const dateOf = (now: number, month: number, day: number): number => {
  const year = new Date(now).getFullYear()
  let at = new Date(year, month - 1, day).getTime()
  if (at - now > 200 * DAY_MS) at = new Date(year - 1, month - 1, day).getTime()
  if (now - at > 200 * DAY_MS) at = new Date(year + 1, month - 1, day).getTime()
  return at
}

const daysBetween = (from: number, to: number): number => Math.round((to - from) / DAY_MS)

const idleOf = (now: number, month: string, day: string): number =>
  daysBetween(dateOf(now, Number(month), Number(day)), dayStart(now))

const UPDATED = /\(更新\s*(\d{1,2})-(\d{1,2})/

type Raw = { who: string; nested: boolean; body: string }

// 👀 支援兩種寫法：
// A. 一人一行：`- **姓名**：答應交的事 (更新 MM-DD)`
// B. 一人一節：`### 姓名` 底下，頂層 `- ` 是專案、縮排 `  - ` 是事項（`→` 開頭的連結行略過）
const buildWatches = (raws: Raw[], now: number): Watch[] => {
  const order: string[] = []
  const byWho = new Map<string, Raw[]>()
  for (const r of raws) {
    if (!byWho.has(r.who)) {
      byWho.set(r.who, [])
      order.push(r.who)
    }
    byWho.get(r.who)!.push(r)
  }

  return order.map(who => {
    const rs = byWho.get(who)!
    const blocks: { head: string; items: string[] }[] = []
    let idle = -1
    let updated = ''
    let warn = who.includes('⚠️')
    for (const r of rs) {
      const dm = UPDATED.exec(r.body)
      if (dm) {
        const d = idleOf(now, dm[1], dm[2])
        if (idle < 0 || d < idle) {
          idle = d
          updated = `${dm[1]}-${dm[2]}`
        }
      }
      if (r.body.trim().startsWith('→')) continue
      const text = clean(
        r.body
          .split(' → ')[0]
          .replace(/〔[^〕]*〕/g, '')
          .replace(/\(更新[^)]*\)/g, '')
          .replace(/^[\s：:—-]+/, ''),
      )
      if (!r.nested) {
        if (r.body.slice(0, 40).includes('⚠️')) warn = true
        blocks.push({ head: text.replace('⚠️', '').replace(/[：:\s]+$/, ''), items: [] })
      } else if (blocks.length > 0 && text !== '') {
        blocks[blocks.length - 1].items.push(text)
      }
    }
    const full = blocks
      .map(b => (b.items.length > 0 ? `${b.head}：${b.items.join('；')}` : b.head))
      .join('；')

    return {
      name: clean(who.replace(/^###\s*/, '').replace(/⚠️/g, '').split(/[（(]/)[0]).slice(0, 20),
      isWarn: warn,
      text: full.slice(0, 60),
      full: full.slice(0, 1200),
      updated,
      idleDays: idle,
    }
  })
}

export const parse = (text: string, now: number): Snapshot => {
  const goals: Goal[] = []
  const events: Upcoming[] = []
  const raws: Raw[] = []
  let section = ''
  let sub = ''
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('<!--') && line.includes('停讀邊界')) break
    if (line.startsWith('## ')) {
      section = line
      sub = ''
      continue
    }
    if (line.startsWith('### ')) {
      sub = line
      continue
    }
    if (section.includes('我要做')) {
      // 只算編號項目；`- [ ]` 的私人待辦不計
      const m = /^(\d+)\.\s*\[( |x|X|-)\]\s*(.*)$/.exec(line)
      if (!m) continue
      const rest = m[3]
      const bold = /\*\*([^*]+)\*\*/.exec(rest)
      const dm = UPDATED.exec(rest)
      const tags = [...rest.matchAll(/`\[([^\]]+)\]`/g)].map(t => t[1])
      const tagInBracket = /〔([^〕]{1,12})〕/.exec(rest)
      const dl = /期限：([^｜]+)/.exec(rest)
      goals.push({
        n: m[1],
        group: clean(sub.replace(/^###\s*/, '')),
        title: clean(bold ? bold[1] : rest).replace('⚠️', '').trim().slice(0, 60),
        isWarn: rest.slice(0, 40).includes('⚠️'),
        isDone: m[2].toLowerCase() === 'x',
        tag: tags.length > 0 ? tags.join('・') : tagInBracket ? tagInBracket[1] : '',
        deadline: dl ? clean(dl[1].split(/[（；]/)[0]).slice(0, 16) : '',
        updated: dm ? `${dm[1]}-${dm[2]}` : '',
        idleDays: dm ? idleOf(now, dm[1], dm[2]) : -1,
      })
    } else if (section.includes('我在追') && /^\s*- /.test(line)) {
      const body = line.replace(/^\s*- /, '')
      const nested = /^\s/.test(line)
      if (sub !== '') {
        raws.push({ who: sub, nested, body })
      } else if (!nested) {
        const one = /^\*\*([^*]+)\*\*[：:]\s*(.*)$/.exec(body)
        if (one) raws.push({ who: one[1], nested: false, body: one[2] })
      }
    } else if (section.includes('近期日程') && line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim())
      const dm = /^(\d{1,2})\/(\d{1,2})/.exec(cells[1] ?? '')
      if (!dm) continue
      const at = dateOf(now, Number(dm[1]), Number(dm[2]))
      const days = Math.round((at - dayStart(now)) / DAY_MS)
      if (days < 0) continue
      events.push({ date: cells[1].slice(0, 12), days, text: clean((cells[2] ?? '').split('〔')[0]).slice(0, 70) })
    }
  }
  events.sort((a, b) => a.days - b.days)

  return { goals, events: events.slice(0, 6), watches: buildWatches(raws, now), loadedAt: now, error: '' }
}

// 複製給別人看的版本：拿掉寫給自己的註記（待確認、待核…），把自己的名字換成「我」
const NOTE_PAREN = /待核|待確認|待你|不推定|未指定|已過|未見回報/
const NOTE_CLAUSE = /請你|待你|待核|再確認 owner|不推定/
export const forOthers = (raw: string, selfName: string): string => {
  const noParen = raw.replace(/[（(][^（）()]*[）)]/g, m => (NOTE_PAREN.test(m) ? '' : m))
  const parts = noParen.split(/([；。，])/)
  let out = ''
  for (let i = 0; i < parts.length; i += 2) {
    if (NOTE_CLAUSE.test(parts[i])) continue
    out += parts[i] + (parts[i + 1] ?? '')
  }
  out = out.replace(/[；。，\s]+$/, '').trim()
  if (selfName.trim() !== '') out = out.split(selfName.trim()).join('我')
  return out
}
