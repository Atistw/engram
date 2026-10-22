import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Goal, Watch } from '../types'
import { forOthers, parse } from './parse'

// todo-pane：把知識庫 TASKS.md 的 🎯 我要做、👀 我在追、📅 近期日程顯示在側邊窗格。只讀不寫。
// TASKS.md 位置與你的名字可在 ~/.claude/todo-pane.json 設定（見同資料夾 README.md）；沒設定就讀 session 起始目錄的 TASKS.md。

const PANE = 'todo-pane'
const GOAL_CAP = 8
const STALE_DAYS = 21
const REFRESH_MS = 60_000

const snap = atom({ plugin: 'todo-pane', key: 'snapshot' } as const, {
  goals: [],
  events: [],
  watches: [],
  loadedAt: 0,
  error: '',
})

type Config = { tasks: string; selfName: string }
let config: Config = { tasks: '', selfName: '' }

// 家目錄由環境變數取得（Windows: USERPROFILE，其他: HOME）。引擎規定 $ 只能傳給最上層函式。
async function homeDir($: any): Promise<string> {
  return (((await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || '') as string).replace(/\\/g, '/')
}

// 設定檔格式：{ "tasks": "D:/my-vault/TASKS.md", "selfName": "王小明" }。讀不到或格式錯誤就用預設。
async function loadConfig($: any): Promise<Config> {
  try {
    const home = await homeDir($)
    const cfg = home ? JSON.parse(String(await $.fs.read(`${home}/.claude/todo-pane.json`))) : {}
    return {
      tasks: typeof cfg?.tasks === 'string' ? cfg.tasks : '',
      selfName: typeof cfg?.selfName === 'string' ? cfg.selfName : '',
    }
  } catch {
    return { tasks: '', selfName: '' }
  }
}

async function readTasks($: any): Promise<string> {
  const paths = [config.tasks, 'TASKS.md'].filter(p => p !== '')
  let last = ''
  for (const path of paths) {
    try {
      return String(await $.fs.read(path))
    } catch (err) {
      last = String(err)
    }
  }
  throw new Error(last || '讀不到 TASKS.md')
}

async function load($: any): Promise<void> {
  const now = await $.clock.now()
  config = await loadConfig($)
  try {
    const next = parse(await readTasks($), now)
    await update($, snap, () => next)
  } catch (err) {
    await update($, snap, prev => ({ ...prev, loadedAt: now, error: String(err).slice(0, 120) }))
  }
}

const two = (n: number) => String(n).padStart(2, '0')
const hhmm = (ms: number): string => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`
const md = (ms: number): string => `${new Date(ms).getMonth() + 1}/${new Date(ms).getDate()}`

const watchLine = (w: Watch): string => `• ${w.name}：${forOthers(w.full, config.selfName)}`
const watchesText = (ws: Watch[], at: number): string => [`【我在追的事】${md(at)}`, ...ws.map(watchLine)].join('\n')
const goalLine = (g: Goal): string => `${g.n}. ${g.title}${g.updated !== '' ? `（${g.updated}）` : ''}`
const goalsText = (gs: Goal[], at: number): string => [`【我要做的事】${md(at)}`, ...gs.map(goalLine)].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'todo', description: '打開待辦窗格（顯示 TASKS.md 的 🎯、👀 與近期日程）' })
    await load($)
    void $.ui.open({ id: PANE, title: '待辦' })
    $.clock.every(REFRESH_MS, () => load($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.text.trim() === '/todo') {
      await load($)
      await $.ui.open({ id: PANE, title: '待辦' })
      return { drop: '待辦窗格已打開' }
    }
    void load($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    await load($)
    return ran
  })

  on('command.run', { command: 'todo' }, async $ => {
    await load($)
    await $.ui.open({ id: PANE, title: '待辦' })
    return { text: '待辦窗格已打開。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, snap)
    const room = Math.max(4, (e.viewport?.rows ?? 30) - 8)
    const open = s.goals.filter(g => !g.isDone)
    const over = open.length > GOAL_CAP
    const copy = async (press: { surface?: any }, text: string, what: string) => {
      const r = await $.ui.copy({ text, surface: press.surface })
      $.ui.toast(r.isCopied ? `已複製：${what}` : `複製失敗：${r.reason}`)
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>
            🎯 我要做 {open.length}/{GOAL_CAP}
            {over ? '　超過上限' : ''}
            {'　'}
          </Text>
          <Button key="copy-goals" onPress={press => copy(press, goalsText(open, s.loadedAt), '我要做的事')}>
            複製全部
          </Button>
        </Box>
        {s.error !== '' && <Text bold>讀取失敗：{s.error}</Text>}
        {open.slice(0, room).map((g, i) => (
          <Box key={`g${i}`} flexDirection="column">
            {g.group !== '' && (i === 0 || open[i - 1].group !== g.group) && <Text bold>▍{g.group}</Text>}
            <Text wrap="truncate-end" dimColor={g.idleDays >= STALE_DAYS}>
              {g.n}. {g.isWarn ? '⚠️ ' : ''}
              {g.title}
              {g.deadline !== '' ? `　⏰${g.deadline}` : ''}
              {g.updated !== '' ? `　${g.updated}` : ''}
              {g.idleDays >= STALE_DAYS ? ` ⏳${g.idleDays}天` : ''}
              {g.tag !== '' ? `　〔${g.tag}〕` : ''}
            </Text>
          </Box>
        ))}
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>👀 我在追 {s.watches.length}{'　'}</Text>
            <Button key="copy-watches" onPress={press => copy(press, watchesText(s.watches, s.loadedAt), '我在追的事')}>
              複製全部
            </Button>
          </Box>
          {s.watches.slice(0, room).map((w, i) => (
            <Box key={`w${i}`}>
              <Button key={`cw${i}`} onPress={press => copy(press, watchLine(w), w.name)}>
                複製
              </Button>
              <Text wrap="truncate-end" dimColor={w.idleDays >= STALE_DAYS}>
                {' '}
                {w.isWarn ? '⚠️ ' : ''}
                {w.name}
                {w.updated !== '' ? ` ${w.updated}` : ''}
                {w.idleDays >= STALE_DAYS ? ` ⏳${w.idleDays}天` : ''}
                {w.text !== '' ? `　${w.text}` : ''}
              </Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>📅 近期日程</Text>
          {s.events.length === 0 && <Text dimColor>沒有未來的日期列</Text>}
          {s.events.map(ev => (
            <Text wrap="truncate-end">
              {ev.date}
              {ev.days === 0 ? '（今天）' : `（${ev.days}天後）`} {ev.text}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{s.loadedAt > 0 ? `更新 ${hhmm(s.loadedAt)}　` : ''}</Text>
          <Button onPress={() => void load($)}>重新整理</Button>
        </Box>
      </Box>
    )
  })
}
