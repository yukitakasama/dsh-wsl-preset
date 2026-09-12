#!/usr/bin/env node
/**
 * dsh-wsl-preset 本地安装脚本
 *
 * 用法：克隆仓库后直接运行，无需 npm 发布：
 *
 *   git clone https://github.com/yukitakasama/dsh-wsl-preset.git
 *   cd dsh-wsl-preset
 *   node install.mjs
 *
 * 功能：
 *   1. 将预设文件复制到 ~/.dsh/.agent-presets/wsl/
 *   2. 将插件行注入到 DSH profile 的 cordis.patch.yml（如尚未添加）
 *   3. 将插件包复制到 profile 的 node_modules/（如尚未安装）
 *
 * 选项：
 *   --force      强制覆盖已存在的预设文件
 *   --home DIR   指定 DSH Home 目录（默认 ~/.dsh）
 *   --dir DIR    --home 的别名（注意：与 `dsh plugin --dir` 语义不同，
 *                那个是 pnpm 的工作目录，这里是 DSH Home）
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── 参数解析 ──
const args = process.argv.slice(2)
const force = args.includes('--force')
const flagIdx = Math.max(args.indexOf('--home'), args.indexOf('--dir'))
const dshHome = flagIdx !== -1 && args[flagIdx + 1] ? args[flagIdx + 1] : join(homedir(), '.dsh')

// ── 路径常量 ──
const PRESET_ID = 'wsl'
const PRESET_FILES = ['agent.cordis.yml', 'wsl-executor.mjs', 'preset.yml']
const PRESET_SRC = join(__dirname, 'agent-presets', PRESET_ID)
const PRESET_DST = join(dshHome, '.agent-presets', PRESET_ID)
const PLUGIN_NAME = '@yukitakasama/dsh-wsl-preset'
const INSERT_ID = 'dsh-wsl-preset'

/** 查找 DSH web profile 目录 */
function findWebProfile() {
  const profilesDir = join(dshHome, 'profiles', 'web')
  if (existsSync(profilesDir)) return profilesDir
  // 回退：尝试所有 profile
  const base = join(dshHome, 'profiles')
  if (!existsSync(base)) return null
  const entries = Array.from(new import('node:fs').readdirSync(base))
  for (const e of entries) {
    if (existsSync(join(base, e, 'cordis.patch.yml'))) return join(base, e)
  }
  return null
}

/** 字节比较两个文件 */
function filesEqual(a, b) {
  try { return readFileSync(a).equals(readFileSync(b)) } catch { return false }
}

// ── Step 1: 安装预设文件 ──
console.log(`\n📦 安装预设文件 -> ${PRESET_DST}`)
mkdirSync(PRESET_DST, { recursive: true })
let presetInstalled = PRESET_FILES.every(f => existsSync(join(PRESET_DST, f)))

if (presetInstalled && !force) {
  const outOfDate = PRESET_FILES.some(f => !filesEqual(join(PRESET_SRC, f), join(PRESET_DST, f)))
  if (outOfDate) {
    console.log('   ⚠️  本地文件有更新，覆盖安装中...')
    for (const f of PRESET_FILES) cpSync(join(PRESET_SRC, f), join(PRESET_DST, f), { force: true })
  } else {
    console.log('   ✅ 预设已存在且版本一致，跳过（使用 --force 覆盖）')
  }
} else {
  if (!force) console.log('   📥 首次安装...')
  for (const f of PRESET_FILES) cpSync(join(PRESET_SRC, f), join(PRESET_DST, f), { force: true })
  console.log('   ✅ 预设文件安装完成')
}

// ── Step 2: 注入 profile cordis.patch.yml ──
const profileDir = findWebProfile()
if (!profileDir) {
  console.log('\n⚠️  未找到 DSH web profile，跳过自动注入。')
  console.log('   请手动将以下内容添加到你的 cordis.patch.yml：')
  console.log(`
- insert:
    - id: ${INSERT_ID}
      name: '${PLUGIN_NAME}'
`)
  process.exit(0)
}

const patchFile = join(profileDir, 'cordis.patch.yml')
const patchContent = existsSync(patchFile) ? readFileSync(patchFile, 'utf-8') : ''

console.log(`\n📝 检查 profile: ${patchFile}`)

if (patchContent.includes(INSERT_ID)) {
  console.log('   ✅ cordis.patch.yml 已包含 wsl-preset 插入行，跳过')
} else {
  const inject = `\n- insert:\n    - id: ${INSERT_ID}\n      name: '${PLUGIN_NAME}'\n`
  if (existsSync(patchFile)) {
    appendFileSync(patchFile, inject, 'utf-8')
  } else {
    writeFileSync(patchFile, inject, 'utf-8')
  }
  console.log('   ✅ 已注入 wsl-preset 插入行')
}

// ── Step 3: 安装插件包到 node_modules ──
const pluginDst = join(profileDir, 'node_modules', PLUGIN_NAME.replace('/', '/'))
const pkgJson = join(__dirname, 'package.json')

if (!existsSync(pkgJson)) {
  console.log('\n⚠️  未找到 package.json，跳过 node_modules 安装')
} else {
  console.log(`\n📁 安装插件包 -> ${pluginDst}`)
  mkdirSync(pluginDst, { recursive: true })

  // 复制关键文件
  const filesToCopy = ['package.json', 'lib', 'cordis.patch.yml', 'README.md', 'LICENSE', 'agent-presets']
  for (const f of filesToCopy) {
    const src = join(__dirname, f)
    const dst = join(pluginDst, f)
    if (!existsSync(src)) continue
    cpSync(src, dst, { recursive: true, force: true })
  }
  console.log('   ✅ 插件包安装完成')
}

// ── 完成 ──
console.log(`
🎉 安装完成！重启 DSH 即可生效。

   使用方式：
   1. 重启 DSH web 服务
   2. 新建会话时选择「WSL 模式」
   3. 将沙箱切换到「完全访问」以使用 WSL bash
`)
