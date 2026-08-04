/**
 * 版型量測片段——不是 node 腳本，是貼進瀏覽器 console 的東西。
 *
 * 用法：
 *   1. pnpm build && npx wrangler pages dev out --port 8788
 *   2. 瀏覽器開 http://localhost:8788 並登入
 *   3. 把整份檔案貼進 console，然後執行：
 *        await __audit(375, 812)      // 單一寬度
 *        await __audit(1440, 900)
 *
 * 為什麼用 iframe：iframe 自身的寬度就是 media query 的依據，所以一頁就能把
 * 14 條路由 × 多個寬度全部量完，不必逐頁重載、也不必動瀏覽器視窗。
 *
 * 已知限制：iframe 裡 env(safe-area-inset-bottom) 恆為 0、dvh 是靜態值，
 * 所以真機的瀏海與網址列收合行為量不到，那部分只能實機確認。
 */

window.__auditRoutes = [
  '/', '/practice', '/chapters', '/path', '/wrong-questions', '/vocab-review',
  '/stats', '/profile', '/practice/grammar', '/practice/vocab',
  '/practice/formulas', '/practice/reading', '/practice/mock',
  '/chapters/grammar/01_八大詞性與句型結構/01_名詞與代名詞',
]

function sel(e) {
  const raw = e.className
  const cls = String(raw && raw.baseVal !== undefined ? raw.baseVal : raw || '')
  return e.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 6).join('.') : '')
}

function probe(win, doc) {
  const de = doc.documentElement
  const vw = win.innerWidth

  // 真的伸出視窗右緣的元素。注意：放在 overflow-x:auto 容器裡的表格也會被抓到，
  // 那是可捲的、不是缺陷——判讀前要往上追祖先的 overflowX。
  const wide = []
  for (const e of doc.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect()
    if (r.width > 0 && r.right > vw + 1) wide.push(sel(e) + ' →' + Math.round(r.right))
    if (wide.length >= 10) break
  }

  // 觸控目標偏小。同樣要人工判讀：16×16 的 input 若包在 44×44 的 label 裡就是達標的。
  const small = new Set()
  for (const e of doc.querySelectorAll('a,button,[role="button"],input,select,textarea')) {
    const r = e.getBoundingClientRect()
    if (r.height === 0 || r.width === 0) continue
    if (r.height < 40 || r.width < 24) {
      const label = (e.getAttribute('aria-label') || e.textContent || e.tagName)
        .trim().replace(/\s+/g, ' ').slice(0, 16)
      small.add(label + ' ' + Math.round(r.width) + '×' + Math.round(r.height))
    }
    if (small.size >= 10) break
  }

  const main = doc.querySelector('main')
  const mainR = main ? main.getBoundingClientRect() : null
  const topNav = doc.querySelector('header[data-chrome="nav"]')
  const botNav = doc.querySelector('nav[data-chrome="nav"]')

  return {
    overflow: de.scrollWidth - de.clientWidth,
    mainW: mainR ? Math.round(mainR.width) : null,
    gutter: mainR ? Math.round(vw - mainR.width) : null,
    pageH: Math.round(de.scrollHeight),
    topNavH: topNav ? Math.round(topNav.getBoundingClientRect().height) : 0,
    botNavH: botNav ? Math.round(botNav.getBoundingClientRect().height) : 0,
    navHVar: getComputedStyle(de).getPropertyValue('--nav-h').trim(),
    wide,
    small: [...small],
  }
}

window.__audit = async function (width, height, routes) {
  routes = routes || window.__auditRoutes
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;'
  document.body.appendChild(host)
  const out = {}

  for (const route of routes) {
    const f = document.createElement('iframe')
    f.style.cssText = `width:${width}px;height:${height}px;border:0;`
    host.appendChild(f)
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout')), 15000)
        f.onload = () => { clearTimeout(t); res() }
        f.src = route
      })
      // 等 hydration：等到 main 有子節點，最多 1.5 秒
      const t0 = Date.now()
      while (Date.now() - t0 < 1500) {
        const m = f.contentDocument && f.contentDocument.querySelector('main')
        if (m && m.children.length > 0) break
        await new Promise((r) => setTimeout(r, 100))
      }
      await new Promise((r) => setTimeout(r, 350))
      out[route] = probe(f.contentWindow, f.contentDocument)
    } catch (e) {
      out[route] = { error: String((e && e.message) || e) }
    }
    f.remove()
  }
  host.remove()
  return out
}
