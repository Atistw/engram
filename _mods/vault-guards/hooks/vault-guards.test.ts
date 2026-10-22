import { test, expect } from 'claude-code/testing'

const HOME = 'D:/Users/Someone'
const CFG = `${HOME}/.claude/vault-guards.json`
const CL = 'D:/x/my-vault/CHANGELOG.md'
const TK = String.raw`D:\x\my-vault\TASKS.md`
const OLD = '- 2026-10-20 B\n- 2026-10-19 A\n'
const CONF = JSON.stringify({ vaults: ['my-vault'] })

// 底層代表引擎：記下實際送到工具的輸入。引擎會把路徑正規化成反斜線，所以比對前一律轉成正斜線。
const slash = (p: string) => p.split(String.fromCharCode(92)).join('/')
let reads = 0
function bottom(on: any, existing: Record<string, string>, cfg: string | null = CONF) {
  const seen: any[] = []
  reads = 0
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'USERPROFILE' ? String.raw`D:\Users\Someone` : undefined }) as any)
  on('fs.read', (_$: any, e: any) => {
    const p = slash(e.path)
    if (p === CFG) {
      if (cfg === null) throw new Error('ENOENT')
      return { value: cfg }
    }
    reads++
    const v = existing[p]
    if (v === undefined) throw new Error('ENOENT')
    return { value: v }
  })
  on('tool.call', (_$: any, e: any) => {
    seen.push(e)
    return { result: {}, text: 'ok' } as any
  })
  return seen
}

test('CHANGELOG：保留原文並置頂新行 → 放行', async ($, on) => {
  const seen = bottom(on, { [CL]: OLD })
  const r: any = await $.tool.call({ tool: 'Write', file_path: CL, content: '- 2026-10-21 C\n' + OLD })
  expect(r.deny).toBeUndefined()
  expect(seen.length).toBe(1)
  expect(reads).toBe(1) // 護欄真的讀過原檔，不是因為讀不到才放行
})
test('CHANGELOG：整檔覆寫成較少內容 → 擋', async ($, on) => {
  const seen = bottom(on, { [CL]: OLD })
  const r: any = await $.tool.call({ tool: 'Write', file_path: CL, content: '- 2026-10-21 C\n' })
  expect(typeof r.deny).toBe('string')
  expect(seen.length).toBe(0)
})
test('CHANGELOG：CRLF 原檔、LF 新內容 → 仍放行', async ($, on) => {
  const seen = bottom(on, { [CL]: OLD.replace(/\n/g, '\r\n') })
  const r: any = await $.tool.call({ tool: 'Write', file_path: CL, content: '- C\n' + OLD })
  expect(r.deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('TASKS：縮水超過三成 → 擋；小幅修改 → 放行', async ($, on) => {
  const big = 'x'.repeat(1000)
  const seen = bottom(on, { [slash(TK)]: big })
  const bad: any = await $.tool.call({ tool: 'Write', file_path: TK, content: 'x'.repeat(500) })
  expect(typeof bad.deny).toBe('string')
  const ok: any = await $.tool.call({ tool: 'Write', file_path: TK, content: 'y'.repeat(980) })
  expect(ok.deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('新檔或知識庫外的檔：放行', async ($, on) => {
  const seen = bottom(on, {})
  const a: any = await $.tool.call({ tool: 'Write', file_path: CL, content: 'new' })
  const b: any = await $.tool.call({ tool: 'Write', file_path: 'D:/x/other/CHANGELOG.md', content: 'z' })
  expect(a.deny).toBeUndefined()
  expect(b.deny).toBeUndefined()
  expect(seen.length).toBe(2)
})
test('資料夾名稱要整段相符：my-vault-old 不算 my-vault', async ($, on) => {
  const seen = bottom(on, { 'D:/x/my-vault-old/CHANGELOG.md': OLD })
  const r: any = await $.tool.call({ tool: 'Write', file_path: 'D:/x/my-vault-old/CHANGELOG.md', content: 'z' })
  expect(r.deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('沒有設定檔：寫回護欄不動作', async ($, on) => {
  const seen = bottom(on, { [CL]: OLD }, null)
  const r: any = await $.tool.call({ tool: 'Write', file_path: CL, content: 'z' })
  expect(r.deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('設定檔格式錯誤：寫回護欄不動作、不當機', async ($, on) => {
  const seen = bottom(on, { [CL]: OLD }, '{not json')
  const r: any = await $.tool.call({ tool: 'Write', file_path: CL, content: 'z' })
  expect(r.deny).toBeUndefined()
  expect(seen.length).toBe(1)
})

const sh = async ($: any, cmd: string, tool: 'Bash' | 'PowerShell' = 'Bash') => $.tool.call({ tool, command: cmd })

test('Bash：重導向覆寫 CHANGELOG/TASKS → 擋；>> 與唯讀 → 放行', async ($, on) => {
  const seen = bottom(on, {})
  const V = 'D:/v/my-vault'
  expect(typeof ((await sh($, `echo hi > ${V}/CHANGELOG.md`)) as any).deny).toBe('string')
  expect(typeof ((await sh($, `cat x > "${V}/TASKS.md"`)) as any).deny).toBe('string')
  expect(typeof ((await sh($, `python -c "open('${V}/CHANGELOG.md','w').write('x')"`)) as any).deny).toBe('string')
  expect(((await sh($, `echo hi >> ${V}/CHANGELOG.md`)) as any).deny).toBeUndefined()
  expect(((await sh($, `cat ${V}/CHANGELOG.md | head -5`)) as any).deny).toBeUndefined()
  expect(((await sh($, `cat ${V}/CHANGELOG.md > /tmp/backup.md`)) as any).deny).toBeUndefined()
  expect(seen.length).toBe(3)
})
test('Bash：路徑沒加引號接空白、或相對路徑開頭，仍擋', async ($, on) => {
  const seen = bottom(on, {})
  expect(typeof ((await sh($, 'cd D:/v/my-vault && echo x > CHANGELOG.md')) as any).deny).toBe('string')
  expect(typeof ((await sh($, 'echo x > my-vault/CHANGELOG.md')) as any).deny).toBe('string')
  expect(((await sh($, 'cd D:/v/my-vault-old && echo x > CHANGELOG.md')) as any).deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('Bash：知識庫外的 CHANGELOG／TASKS 不管', async ($, on) => {
  const seen = bottom(on, {}) // 測試預設 cwd 是 mod 資料夾，不在知識庫
  const rel = ['echo hi', '>', 'CHANGELOG.md'].join(' ')
  expect(((await sh($, rel)) as any).deny).toBeUndefined()
  expect(((await sh($, 'echo hi > /d/otherproj/TASKS.md')) as any).deny).toBeUndefined()
  expect(seen.length).toBe(2)
})
test('Bash：session 起始目錄在知識庫時，相對路徑也擋；>> 仍放行', async ($, on) => {
  const seen = bottom(on, {})
  on('session.cwd', () => ({ value: 'D:/OneDrive/x/my-vault' }) as any)
  const rel = ['echo hi', '>', 'CHANGELOG.md'].join(' ')
  expect(typeof ((await sh($, rel)) as any).deny).toBe('string')
  expect(((await sh($, 'echo hi >> CHANGELOG.md')) as any).deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('Bash：沒有設定檔時，重導向不擋', async ($, on) => {
  const seen = bottom(on, {}, null)
  expect(((await sh($, 'echo hi > D:/v/my-vault/CHANGELOG.md')) as any).deny).toBeUndefined()
  expect(seen.length).toBe(1)
})
test('Bash：python 補 UTF-8；已有或非 python 不動', async ($, on) => {
  const seen = bottom(on, {})
  await sh($, 'python script.py')
  await sh($, 'cd /d && python3 -c "print(1)"')
  await sh($, 'PYTHONIOENCODING=utf-8 python a.py')
  await sh($, 'echo python is nice')
  await sh($, 'ls -la')
  expect(seen[0].command).toBe('export PYTHONIOENCODING=utf-8; python script.py')
  expect(seen[1].command).toBe('export PYTHONIOENCODING=utf-8; cd /d && python3 -c "print(1)"')
  expect(seen[2].command).toBe('PYTHONIOENCODING=utf-8 python a.py')
  expect(seen[3].command).toBe('echo python is nice')
  expect(seen[4].command).toBe('ls -la')
})
test('Bash：沒有設定檔時，python 仍補 UTF-8', async ($, on) => {
  const seen = bottom(on, {}, null)
  await sh($, 'python a.py')
  expect(seen[0].command).toBe('export PYTHONIOENCODING=utf-8; python a.py')
})
test('Bash：指令只是提到 PYTHONIOENCODING（沒有在指派）仍要補；已在指派才不動', async ($, on) => {
  const seen = bottom(on, {})
  const probe = `python -c "import os;print(os.environ.get('PYTHONIOENCODING'))"`
  await sh($, probe)
  await sh($, `export PYTHONIOENCODING=utf-8; ${probe}`)
  await sh($, 'echo PYTHONIOENCODING is a name')
  expect(seen[0].command).toBe(`export PYTHONIOENCODING=utf-8; ${probe}`)
  expect(seen[1].command).toBe(`export PYTHONIOENCODING=utf-8; ${probe}`)
  expect(seen[2].command).toBe('echo PYTHONIOENCODING is a name')
})
test('PowerShell：python 補 UTF-8；覆寫 TASKS 被擋', async ($, on) => {
  const seen = bottom(on, {})
  await sh($, 'python a.py', 'PowerShell')
  expect(seen[0].command).toBe("$env:PYTHONIOENCODING='utf-8'; python a.py")
  expect(typeof ((await sh($, String.raw`Set-Content -Path D:\v\my-vault\TASKS.md -Value x`, 'PowerShell')) as any).deny).toBe('string')
})
