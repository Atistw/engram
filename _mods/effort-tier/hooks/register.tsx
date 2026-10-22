import type { Register } from 'claude-code'

// effort-tier：依提問類型自動調整主對話的思考檔位（effort）。
// 只改主迴圈、只改 effort、不換模型、不連網、不記提問內容。
// 規則為關鍵字比對，可用 ~/.claude/effort-tier.rules.json 追加詞，不必改這支程式（見同資料夾 README.md）。

const HEAD = 600 // 只看提問的前幾個字
const LOOKBACK = 3 // 本輪加前兩輪
const POINTER_MAX = 40 // 短於這個字數的提問視為「可能在指回前文」

// 動機類用語。要與「指定人物」同時出現才算高判斷。
const MOTIVE =
  /動機|意圖|用意|目的|為何|盤算|布局|站位|背後|心態|真正(?:想|要|在意)|在意什麼|為什麼(?:會|要|這樣|突然)|想要什麼|怎麼看|怎麼解讀|什麼意思|立場|算計|試探|規避|認知有誤/
// 人事與決策類用語。單獨命中即算高判斷。
const DIAG =
  /接班|繼任|人事診斷|人事衝突|多方衝突|升遷|離職|資遣|考核面談|績效面談|要不要(?:接|留|走|離開)|婉拒|接受(?:這個)?(?:職|任命|交辦)|越級|跳級/
// 純機械雜務。只在本輪開頭命中才降檔。
const MECH = /格式整理|整理格式|改檔名|重新命名|更新\s?TASKS|寫\s?CHANGELOG|同步(?:索引|連結)/

// 非人類輸入：subagent 回報、系統通知不算使用者訊息
const NOISE = /Another Claude session sent a message|<agent-message|SYSTEM NOTIFICATION|<task-notification/
// 指回前文的用語：本輪沒有自己的主題時，才承接前兩輪
const POINTER = /同(?:一)?(?:題|問題)|再(?:跑|說|問|來)(?:一)?(?:次|遍)?|剛(?:剛|才)|上面|那題|這題|繼續|所以呢|然後呢/

type Tier = 'high' | 'low' | null
type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type Rules = { person: RegExp | null; motive: RegExp; diag: RegExp; mech: RegExp | null }

const DEFAULT_RULES: Rules = { person: null, motive: MOTIVE, diag: DIAG, mech: MECH }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const words = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])
const union = (base: RegExp, extra: string[]) =>
  extra.length ? new RegExp(`${base.source}|${extra.map(esc).join('|')}`) : base

// 設定檔格式：{ "person": [...], "motive": [...], "diag": [...], "mech": [...], "mechEnabled": true }
// person 是要追蹤的人名；motive／diag／mech 是追加在預設之後的詞（純文字，不用寫正規表示式）。
function buildRules(cfg: any): Rules {
  const person = words(cfg?.person)
  return {
    person: person.length ? new RegExp(person.map(esc).join('|')) : null,
    motive: union(MOTIVE, words(cfg?.motive)),
    diag: union(DIAG, words(cfg?.diag)),
    mech: cfg?.mechEnabled === false ? null : union(MECH, words(cfg?.mech)),
  }
}

// 系統自動加在提問前面的 <system-reminder> 區塊不算提問內容（例如 session 之間傳訊時會帶一大段），
// 先拿掉再取前 600 字，否則關鍵字會被擠到 600 字之外而漏判。
const stripReminders = (t: string) => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
const head = (t: string) => stripReminders(t).split('<pasted_content', 1)[0].trim().slice(0, HEAD)

const isHigh = (t: string, r: Rules) => {
  const h = head(t)
  return (r.person !== null && r.person.test(h) && r.motive.test(h)) || r.diag.test(h)
}
const isPointer = (t: string) => {
  const h = head(t).trim()
  return h.length <= POINTER_MAX || POINTER.test(h)
}

// texts：舊到新，最後一則是本輪。本輪自己命中才算；本輪是短句或指回前文時，才承接前兩輪。
function classify(texts: string[], r: Rules): Tier {
  const all = texts.map(stripReminders)
  const last = all[all.length - 1]
  if (last === undefined || NOISE.test(last.slice(0, 200))) return null
  const clean = all.filter(t => !NOISE.test(t.slice(0, 200)))
  if (isHigh(last, r)) return 'high'
  if (isPointer(last) && clean.slice(-LOOKBACK, -1).some(t => isHigh(t, r))) return 'high'
  return r.mech !== null && r.mech.test(head(last)) ? 'low' : null
}

// 只動預設檔位：high 只把 low/medium 抬到 high；low 只把 medium 降到 low。
// 使用者自己設的 high 以上或 low 不動；數值型 effort 不動。
function pick(tier: Tier, effort: Level | number | undefined): Level | undefined {
  if (tier === null || effort === undefined || typeof effort === 'number') return undefined
  if (tier === 'high' && (effort === 'low' || effort === 'medium')) return 'high'
  if (tier === 'low' && effort === 'medium') return 'low'
  return undefined
}

// 家目錄由環境變數取得（Windows: USERPROFILE，其他: HOME）。引擎規定 $ 只能傳給最上層函式。
async function homeDir($: any): Promise<string> {
  return (((await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || '') as string).replace(/\\/g, '/')
}

let cached: { raw: string; rules: Rules } = { raw: '\u0000', rules: DEFAULT_RULES }

// 每輪讀一次設定檔；內容沒變就沿用編譯好的規則。讀不到或格式錯誤一律用預設規則。
async function loadRules($: any): Promise<Rules> {
  let raw = ''
  try {
    const home = await homeDir($)
    if (home) raw = String(await $.fs.read(`${home}/.claude/effort-tier.rules.json`))
  } catch {
    raw = ''
  }
  if (raw === cached.raw) return cached.rules
  let rules = DEFAULT_RULES
  try {
    if (raw) rules = buildRules(JSON.parse(raw))
  } catch {
    rules = DEFAULT_RULES
  }
  cached = { raw, rules }
  return rules
}

export const register: Register = on => {
  const recent: string[] = []
  let current: { turnId: string; tier: Tier } = { turnId: '', tier: null }

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && e.text !== '') {
      recent.push(e.text)
      if (recent.length > LOOKBACK + 1) recent.shift()
      current = { turnId: e.turnId, tier: classify(recent, await loadRules($)) }
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const want =
      e.agentId === undefined && e.turnId === current.turnId ? pick(current.tier, e.effort) : undefined
    $.ui.status(want ? `effort ${e.effort} → ${want}` : undefined)
    // 追蹤檔：每步覆寫一次，供驗證「實際把 effort 改成什麼」；不記提問內容；寫失敗不影響主流程
    try {
      const home = await homeDir($)
      if (!home) throw new Error('no home')
      await $.fs.write(
        `${home}/.claude/effort-tier-trace.mods.json`,
        JSON.stringify({ at: new Date().toISOString(), turnId: e.turnId, index: e.index, agentId: e.agentId ?? null, tier: current.tier, from: e.effort ?? null, to: want ?? e.effort ?? null }),
      )
    } catch {}
    return yield* next(want ? { ...e, effort: want } : e)
  })
}
