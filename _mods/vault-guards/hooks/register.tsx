import type { Register } from 'claude-code'

// vault-guards：知識庫的兩個機械護欄。
// 1. 寫回護欄：CHANGELOG／TASKS 不得被整檔覆寫成較少內容（作者的庫曾發生 CHANGELOG 被整檔覆寫、歷史只剩幾行）。
// 2. Windows UTF-8：Bash／PowerShell 執行 python 前補 PYTHONIOENCODING=utf-8（中文輸出被系統預設編碼截斷）。
// 兩者都只在高把握時動作；護欄自己出錯一律放行，不擋正常工作。
// 寫回護欄只管 ~/.claude/vault-guards.json 列出的知識庫資料夾；沒有設定檔就只做 UTF-8 那一項（見同資料夾 README.md）。

const nl = (s: string) => s.replace(/\r\n/g, '\n')
const slash = (p: string) => p.replace(/\\/g, '/')
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 以 shell 寫檔的常見形式：重導向（非 >>）、Set-Content、Out-File、open(..., 'w')、write_text
const SHELL_WRITE =
  /(?:[^>]|^)>\s*["']?[^\s"'|;&]*(?:CHANGELOG|TASKS)\.md|(?:Set-Content|Out-File)[^|;\n]*(?:CHANGELOG|TASKS)\.md|open\([^)]*(?:CHANGELOG|TASKS)\.md[^)]*['"]w|(?:CHANGELOG|TASKS)\.md['"]?\)?\.write_text/i

// python 必須在指令位置（開頭，或 ; & | ( 之後），避免 echo python 之類的字眼被誤改
const PYTHON = /(?:^|[;&|(])\s*(?:python3?|py)(?:\.exe)?(?=\s|$)/i
// 只有「已經在指派」才跳過；指令裡單純出現這個字（例如 os.environ.get('PYTHONIOENCODING')）不算
const HAS_ENCODING = /PYTHONIOENCODING\s*=|\$env:PYTHONIOENCODING\s*=/i

const WRITE_MSG = (name: string) =>
  `vault-guards：${name}.md 不能整檔覆寫成較少內容。請改用 Edit 在檔頭插入一行；整檔 Write 時必須保留原文全部內容。`

// 家目錄由環境變數取得（Windows: USERPROFILE，其他: HOME）。引擎規定 $ 只能傳給最上層函式。
async function homeDir($: any): Promise<string> {
  return slash(((await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || '') as string)
}

// 設定檔格式：{ "vaults": ["my-vault"] }，每項是知識庫資料夾名稱（路徑中的一段）。讀不到或格式錯誤就當沒設定。
let cached: { raw: string; dir: RegExp | null } = { raw: '\u0000', dir: null }
async function vaultDir($: any): Promise<RegExp | null> {
  let raw = ''
  try {
    const home = await homeDir($)
    if (home) raw = String(await $.fs.read(`${home}/.claude/vault-guards.json`))
  } catch {
    raw = ''
  }
  if (raw === cached.raw) return cached.dir
  let dir: RegExp | null = null
  try {
    const names = raw ? JSON.parse(raw)?.vaults : []
    const list = Array.isArray(names) ? names.filter((x: unknown): x is string => typeof x === 'string' && x.trim() !== '') : []
    if (list.length) dir = new RegExp(`(?:^|/)(?:${list.map(n => esc(slash(n.trim()))).join('|')})(?:/|$)`, 'i')
  } catch {
    dir = null
  }
  cached = { raw, dir }
  return dir
}

// 只在知識庫內動作：指令提到知識庫路徑，或 session 起始目錄在知識庫內。其他專案的 CHANGELOG.md 不管。
async function inVault($: any, command: string, dir: RegExp): Promise<boolean> {
  // 指令裡的路徑可能沒加引號、後面接空白，或是相對路徑開頭，所以把引號、空白、等號都當成路徑分隔再比
  if (dir.test(slash(command).replace(/["'\s=]/g, '/'))) return true
  try {
    return dir.test(slash(String(await $.session.cwd())))
  } catch {
    return false
  }
}

async function shellDenied($: any, command: string): Promise<boolean> {
  if (!SHELL_WRITE.test(command)) return false
  const dir = await vaultDir($)
  return dir !== null && (await inVault($, command, dir))
}

export const register: Register = on => {
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const m = /(?:^|\/)(CHANGELOG|TASKS)\.md$/i.exec(slash(e.file_path))
    if (!m) return next(e)
    const dir = await vaultDir($)
    if (dir === null || !dir.test(slash(e.file_path))) return next(e)
    let old: string
    try {
      old = nl((await $.fs.read(e.file_path)) as string)
    } catch {
      return next(e) // 檔案不存在或讀不到：當新檔放行
    }
    const body = nl(e.content)
    const name = m[1].toUpperCase()
    if (name === 'CHANGELOG' && !body.includes(old)) return { deny: WRITE_MSG('CHANGELOG') }
    if (name === 'TASKS' && body.length < old.length * 0.7) return { deny: WRITE_MSG('TASKS') }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (await shellDenied($, e.command))
      return { deny: 'vault-guards：不要用 shell 重導向或腳本整檔覆寫 CHANGELOG／TASKS。請用 Edit 在檔頭插入；要追加請用 >>。' }
    if (PYTHON.test(e.command) && !HAS_ENCODING.test(e.command))
      return next({ ...e, command: `export PYTHONIOENCODING=utf-8; ${e.command}` })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    if (await shellDenied($, e.command))
      return { deny: 'vault-guards：不要用重導向或 Set-Content 整檔覆寫 CHANGELOG／TASKS。請用 Edit 在檔頭插入；要追加請用 Add-Content。' }
    if (PYTHON.test(e.command) && !HAS_ENCODING.test(e.command))
      return next({ ...e, command: `$env:PYTHONIOENCODING='utf-8'; ${e.command}` })
    return next(e)
  }).catch(($, e, next) => next(e))
}
