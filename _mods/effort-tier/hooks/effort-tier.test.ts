import { test, expect } from 'claude-code/testing'

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

const written: string[] = []
const CFG_PATH_TAIL = '/.claude/effort-tier.rules.json'

// 底層代表引擎：turn.start 回 turnId、ui.status 吞掉、env.get 給假家目錄、
// fs.read 只在有給設定時回設定檔內容、fs.write 記下寫入路徑、turn.step 記下送出的 effort 並回空結果。
async function seen(
  $: any, on: any, text: string | string[], effort: Effort, opts: { agentId?: string; cfg?: object | string } = {},
) {
  let got: unknown = 'unset'
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('ui.status', () => ({ value: undefined }) as any)
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'USERPROFILE' ? 'D:\\Users\\Someone' : undefined }) as any)
  on('fs.read', (_$: any, e: any) => {
    const p = String(e.path).split(String.fromCharCode(92)).join('/')
    if (opts.cfg !== undefined && p.endsWith(CFG_PATH_TAIL)) {
      return { value: typeof opts.cfg === 'string' ? opts.cfg : JSON.stringify(opts.cfg) } as any
    }
    throw new Error('ENOENT')
  })
  on('fs.write', (_$: any, e: any) => {
    written.push(e.path)
    return { value: undefined } as any
  })
  on('turn.step', async function* (_$: any, e: any) {
    got = e.effort
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: null, usage: null }
  })
  const texts = Array.isArray(text) ? text : [text]
  for (const [i, tx] of texts.entries()) await $.turn.start({ text: tx, turnId: i === texts.length - 1 ? 't1' : `p${i}` })
  const stream = $.turn.step({
    turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort, messageCount: 1,
    ...(opts.agentId ? { agentId: opts.agentId } : {}),
  })
  for await (const _ of stream) { /* drain */ }
  return got
}

// ---- 預設規則（沒有設定檔）----
test('預設：人事決策類用語 medium 抬到 high', async ($, on) => {
  expect(await seen($, on, '要不要接這個職位', 'medium')).toBe('high')
})
test('預設：接班題 low 也抬到 high', async ($, on) => {
  expect(await seen($, on, '接班的順序我該怎麼排', 'low')).toBe('high')
})
test('預設：已是 xhigh 不降', async ($, on) => {
  expect(await seen($, on, '要不要接這個職位', 'xhigh')).toBe('xhigh')
})
test('預設：機械雜務 medium 降到 low', async ($, on) => {
  expect(await seen($, on, '更新 TASKS 並寫 CHANGELOG', 'medium')).toBe('low')
})
test('預設：使用者自己設 high 不降', async ($, on) => {
  expect(await seen($, on, '整理格式', 'high')).toBe('high')
})
test('預設：一般題不動', async ($, on) => {
  expect(await seen($, on, '幫我發想三個產品名稱', 'medium')).toBe('medium')
})
test('預設：沒設定人物時，人名加動機詞不算高判斷', async ($, on) => {
  expect(await seen($, on, '王經理為什麼突然改口，背後的用意是什麼', 'medium')).toBe('medium')
})
test('預設：組織決策題（決策問法＋組織對象＋拆合動作）抬到 high', async ($, on) => {
  expect(await seen($, on, '這兩個部門該不該合併成一個事業單位？', 'medium')).toBe('high')
})
test('預設：只有組織詞沒有決策問法不算', async ($, on) => {
  expect(await seen($, on, '幫我整理部門合併後的通訊錄格式', 'medium')).toBe('medium')
})
test('預設：組織對象與拆合動作相隔太遠不算', async ($, on) => {
  expect(await seen($, on, '要不要先問團隊成員的意見，下週會議再說，至於資料表要不要拆開', 'medium')).toBe('medium')
})
test('subagent 不動', async ($, on) => {
  expect(await seen($, on, '要不要接這個職位', 'medium', { agentId: 'agent-1' })).toBe('medium')
})
test('貼上內容裡的關鍵字不算', async ($, on) => {
  expect(await seen($, on, '這段要改嗎？ <pasted_content id="a"> 接班 離職 </pasted_content>', 'medium')).toBe('medium')
})

// ---- 承接前文 ----
const HIGH_Q = '要不要接這個職位'
test('長的新主題不承接前一題', async ($, on) => {
  expect(await seen($, on, [HIGH_Q, '關於這個專案，請你幫我整理出可以加快日常工作的方案，並依照各方案所需的成本、預期的效益與導入的難易度排序，列出前五名與你的理由'], 'medium')).toBe('medium')
})
test('短的指回句承接前一題', async ($, on) => {
  expect(await seen($, on, [HIGH_Q, '同問題再說明'], 'medium')).toBe('high')
})
test('subagent 回報那輪不調整', async ($, on) => {
  expect(await seen($, on, [HIGH_Q, 'Another Claude session sent a message: <agent-message from="x"> 接班 </agent-message>'], 'medium')).toBe('medium')
})

// ---- 設定檔 ----
test('設定檔：指定人物後，人名加動機詞抬到 high', async ($, on) => {
  expect(await seen($, on, '王經理為什麼突然改口，背後的用意是什麼', 'medium', { cfg: { person: ['王經理'] } })).toBe('high')
})
test('設定檔：只有人名沒有動機詞不算', async ($, on) => {
  expect(await seen($, on, '王經理的月報格式幫我看一下', 'medium', { cfg: { person: ['王經理'] } })).toBe('medium')
})
test('設定檔：追加 diag 詞', async ($, on) => {
  expect(await seen($, on, '這個資遣評估怎麼做', 'medium', { cfg: { diag: ['資遣評估'] } })).toBe('high')
})
test('設定檔：追加 mech 詞', async ($, on) => {
  expect(await seen($, on, '幫我轉檔成 PDF', 'medium', { cfg: { mech: ['轉檔'] } })).toBe('low')
})
test('設定檔：mechEnabled=false 關掉降檔', async ($, on) => {
  expect(await seen($, on, '更新 TASKS 並寫 CHANGELOG', 'medium', { cfg: { mechEnabled: false } })).toBe('medium')
})
test('設定檔：詞裡的正規表示式符號被跳脫（點只比對點本身）', async ($, on) => {
  expect(await seen($, on, '一般的 a.b 問題', 'medium', { cfg: { diag: ['a.b'] } })).toBe('high')
})
test('設定檔：跳脫後不會把 . 當萬用字元', async ($, on) => {
  expect(await seen($, on, '一般的 axb 問題', 'medium', { cfg: { diag: ['a.b'] } })).toBe('medium')
})
test('設定檔：格式錯誤的 JSON 退回預設', async ($, on) => {
  expect(await seen($, on, '要不要接這個職位', 'medium', { cfg: '{壞掉的 json' })).toBe('high')
})
test('設定檔：內容是陣列而不是物件，退回預設', async ($, on) => {
  expect(await seen($, on, '更新 TASKS', 'medium', { cfg: '[1,2,3]' })).toBe('low')
})
test('設定檔：欄位型別怪異時忽略該欄位，不當機', async ($, on) => {
  expect(await seen($, on, '要不要接這個職位', 'medium', { cfg: { person: [1, null, {}], diag: 'not-array' } })).toBe('high')
})

// ---- 前面帶系統提醒區塊 ----
const NL = String.fromCharCode(10)
const REMINDER = '<system-reminder>' + NL + '系統提醒的內容。'.repeat(80) + NL + '</system-reminder>' + NL
test('提問前面帶很長的系統提醒區塊，關鍵字仍要命中', async ($, on) => {
  expect(REMINDER.length).toBeGreaterThan(600)
  expect(await seen($, on, REMINDER + '王經理為什麼突然改口，背後的用意是什麼', 'medium', { cfg: { person: ['王經理'] } })).toBe('high')
})
test('系統提醒區塊裡出現的關鍵字不算提問', async ($, on) => {
  const r = '<system-reminder>' + NL + '接班 離職 資遣 要不要接' + NL + '</system-reminder>' + NL
  expect(await seen($, on, r + '幫我發想三個產品名稱', 'medium')).toBe('medium')
})
test('提醒區塊後面跟著短的指回句，仍承接前一題', async ($, on) => {
  expect(await seen($, on, [HIGH_Q, REMINDER + '同問題再說明'], 'medium')).toBe('high')
})

// ---- 追蹤檔 ----
test('追蹤檔路徑由環境變數的家目錄組成', async ($, on) => {
  written.length = 0
  await seen($, on, '更新 TASKS 並寫 CHANGELOG', 'medium')
  expect(written.length).toBe(1)
  // 引擎會把路徑正規化成系統格式，所以比對前統一成正斜線
  expect(written[0].split(String.fromCharCode(92)).join('/')).toBe('D:/Users/Someone/.claude/effort-tier-trace.mods.json')
})
