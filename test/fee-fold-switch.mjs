// 回归测试：「费用面板折叠」总开关（0.4.0）。
// 不启动 DSH：用最小 DOM 桩 + React 桩加载 client.js，验证开关的完整行为。
// 覆盖：
//   1) 默认开启，侧栏底行「费用面板 ▾」存在，body 不带隐藏类
//   2) 点底行按钮 → 收起，body 带隐藏类，按钮变「费用面板 ▸」
//   3) 设置页关掉开关 → 底行消失、body 隐藏类移除、下次启动也不再隐藏
//   4) 重新打开 → 底行恢复，并记住之前的收起状态
//   5) 只匹配 sidebar.footer.action 的直接子节点 .cm-footer-stack
//   6) dispose 移除监听与隐藏类，之后事件不会再把类加回来
// 运行：node test/fee-fold-switch.mjs

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const CODE = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')
const BODY_CLASS = 'dsh-sff-collapsed'
const FEE_FOLD_EVENT = 'dsh-sidebar-footer-fold:fee-fold-change'

let failures = 0
const results = []

function check(name, ok, detail) {
  results.push({ name, ok })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ─────────────────────────── 最小 DOM 桩 ───────────────────────────

class ClassList {
  constructor() {
    this.set = new Set()
  }
  add(...names) {
    for (const name of names) this.set.add(name)
  }
  remove(...names) {
    for (const name of names) this.set.delete(name)
  }
  contains(name) {
    return this.set.has(name)
  }
  toggle(name, force) {
    const next = force === undefined ? !this.set.has(name) : Boolean(force)
    if (next) this.set.add(name)
    else this.set.delete(name)
    return next
  }
}

function createHarness() {
  const selectors = []
  const listeners = new Map()
  const store = new Map()

  const state = { costStack: { className: 'cm-footer-stack' } }

  const document = {
    body: { classList: new ClassList() },
    head: { appendChild() {} },
    querySelector(selector) {
      selectors.push(selector)
      if (selector.includes('data-plugin-css')) return null
      if (selector === '[data-slot="sidebar.footer.action"] > .cm-footer-stack') return state.costStack
      return null
    },
    querySelectorAll() {
      return []
    },
    createElement() {
      return { dataset: {}, textContent: '', remove() {} }
    }
  }

  const window = {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, value) {
        store.set(key, String(value))
      }
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn)
    },
    dispatchEvent(event) {
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event)
      return true
    },
    requestAnimationFrame() {
      return 0
    },
    cancelAnimationFrame() {}
  }
  window.window = window

  class Event {
    constructor(type) {
      this.type = type
    }
  }

  class MutationObserver {
    observe() {}
    disconnect() {}
  }

  const context = vm.createContext({
    window,
    document,
    Event,
    MutationObserver,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    console,
    fetch: async () => ({ json: async () => ({}) })
  })
  window.__ModuleLoader__ = { load(definition) {
    context.__definition = definition
  } }

  vm.runInContext(CODE, context, { filename: 'client.js' })

  const definition = context.__definition
  const registrations = []
  const slots = {
    inject(name, callback) {
      callback()
    },
    register(registration, component) {
      registrations.push({ registration, component })
      return () => {}
    }
  }
  return { definition, registrations, slots, window, document, state, selectors }
}

// ─────────────────────────── React 桩 ───────────────────────────

function createReact() {
  let currentStore = []
  let currentIndex = 0
  let pendingEffects = []

  const setValue = (slot, next) => {
    slot.value = typeof next === 'function' ? next(slot.value) : next
  }

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity) }
    },
    useState(initial) {
      const index = currentIndex++
      if (!(index in currentStore)) {
        currentStore[index] = { value: typeof initial === 'function' ? initial() : initial }
      }
      const slot = currentStore[index]
      return [slot.value, (next) => setValue(slot, next)]
    },
    useEffect(effect, deps) {
      const index = currentIndex++
      const previous = currentStore[index]
      const changed =
        !previous ||
        !previous.deps ||
        !deps ||
        deps.length !== previous.deps.length ||
        deps.some((value, offset) => !Object.is(value, previous.deps[offset]))
      currentStore[index] = { deps }
      if (changed) pendingEffects.push(effect)
    },
    useCallback(fn) {
      return fn
    },
    useMemo(fn) {
      return fn()
    },
    useRef(initial) {
      const index = currentIndex++
      if (!(index in currentStore)) currentStore[index] = { value: { current: initial } }
      return currentStore[index].value
    },
    Fragment: 'Fragment'
  }

  function render(component, props) {
    if (!component.__hooks) component.__hooks = []
    currentStore = component.__hooks
    currentIndex = 0
    pendingEffects = []
    const node = component(props)
    for (const effect of pendingEffects) effect()
    return node
  }

  function reset(component) {
    component.__hooks = []
  }

  return { React, render, reset }
}

function walk(node, visit) {
  if (node == null) return
  if (typeof node !== 'object') {
    visit(node)
    return
  }
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function textOf(node) {
  const parts = []
  walk(node, (current) => {
    if (typeof current === 'string') parts.push(current)
  })
  return parts.join('')
}

function find(node, predicate) {
  let hit = null
  walk(node, (current) => {
    if (!hit && predicate(current)) hit = current
  })
  return hit
}

// ─────────────────────────── 测试流程 ───────────────────────────

const harness = createHarness()
const { definition, registrations, slots } = harness
const { React, render, reset } = createReact()
const module = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})

check('module injects slots', module.inject?.includes('slots'))

const ctx = {
  get(name) {
    return name === 'slots' ? slots : undefined
  },
  on() {},
  off() {},
  logger: { warn() {} }
}
const dispose = module.apply(ctx)

const toggleRegistration = registrations.find(
  (item) => item.registration.name === 'sidebar.footer.action'
)
const settingsRegistration = registrations.find(
  (item) => item.registration.id === 'sidebar-footer-fold-general'
)
check('footer row registered', Boolean(toggleRegistration))
check('sidebar settings section registered with switch', Boolean(settingsRegistration))
check(
  'settings section label is 侧栏增强',
  typeof settingsRegistration?.registration.label === 'function' &&
    settingsRegistration.registration.label() === '侧栏增强'
)

const ToggleRow = toggleRegistration.component
const SidebarSection = settingsRegistration.component

// 1) 默认开启
let row = render(ToggleRow, {})
let toggleButton = find(row, (node) => node.type === 'button')
check('default: row visible', Boolean(toggleButton), textOf(row))
check('default: label 费用面板 ▾', textOf(row).includes('费用面板 ▾'))
check('default: body not collapsed', !harness.document.body.classList.contains(BODY_CLASS))

let settings = render(SidebarSection, {})
let switchButton = find(
  settings,
  (node) => node.type === 'button' && node.props.role === 'switch'
)
check('default: switch on', switchButton?.props['aria-checked'] === 'true')
check('default: switch shows 已开启', textOf(settings).includes('已开启'))

// 2) 点底行 → 收起
toggleButton.props.onClick()
check('collapse: body class added', harness.document.body.classList.contains(BODY_CLASS))
check('collapse: state persisted', harness.window.localStorage.getItem('dsh-sidebar-footer-fold:collapsed') === '1')
row = render(ToggleRow, {})
check('collapse: label 费用面板 ▸', textOf(row).includes('费用面板 ▸'))
check('collapse: aria-pressed true', find(row, (node) => node.type === 'button')?.props['aria-pressed'] === 'true')

// 3) 设置页关闭开关
settings = render(SidebarSection, {})
switchButton = find(settings, (node) => node.type === 'button' && node.props.role === 'switch')
switchButton.props.onClick()
check('disable: preference saved', harness.window.localStorage.getItem('dsh-sidebar-footer-fold:fee-fold-enabled') === '0')
check('disable: body class removed', !harness.document.body.classList.contains(BODY_CLASS))
row = render(ToggleRow, {})
check('disable: footer row removed', row === null)
settings = render(SidebarSection, {})
check('disable: switch off', find(settings, (node) => node.type === 'button' && node.props.role === 'switch')?.props['aria-checked'] === 'false')
check('disable: switch shows 已关闭', textOf(settings).includes('已关闭'))

// 关闭状态下即使本地记住「已收起」，也不能隐藏卡片
harness.window.localStorage.setItem('dsh-sidebar-footer-fold:collapsed', '1')
render(ToggleRow, {})
check('disable: collapsed state ignored', !harness.document.body.classList.contains(BODY_CLASS))

// 4) 重新打开 → 恢复，并记住之前的收起状态
settings = render(SidebarSection, {})
find(settings, (node) => node.type === 'button' && node.props.role === 'switch').props.onClick()
check('re-enable: preference saved', harness.window.localStorage.getItem('dsh-sidebar-footer-fold:fee-fold-enabled') === '1')
check('re-enable: collapsed state restored', harness.document.body.classList.contains(BODY_CLASS))
row = render(ToggleRow, {})
check('re-enable: footer row visible again', Boolean(find(row, (node) => node.type === 'button')))
check('re-enable: label 费用面板 ▸', textOf(row).includes('费用面板 ▸'))

// 5) 只匹配插槽直接子节点
check(
  'selector requires direct child',
  harness.selectors.includes('[data-slot="sidebar.footer.action"] > .cm-footer-stack')
)

// 费用卡片不在时，底行也不显示
harness.state.costStack = null
reset(ToggleRow)
row = render(ToggleRow, {})
check('no cost stack: row hidden', row === null)

// 6) dispose 清理
harness.state.costStack = {}
dispose()
check('dispose: body class removed', !harness.document.body.classList.contains(BODY_CLASS))
harness.window.localStorage.setItem('dsh-sidebar-footer-fold:collapsed', '1')
harness.window.dispatchEvent({ type: FEE_FOLD_EVENT })
check('dispose: fee-fold event no longer applies class', !harness.document.body.classList.contains(BODY_CLASS))

const passed = results.filter((item) => item.ok).length
console.log(`\n${passed}/${results.length} checks passed`)
process.exit(failures === 0 ? 0 : 1)
