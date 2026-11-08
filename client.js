// dsh-sidebar-footer-fold — 浏览器客户端
// 功能 1：账号菜单（与「设置」同级）里的「收起 / 展开费用面板」——隐藏 dsh-cost-meter 的侧栏卡片。
// 功能 2：侧栏「更多」菜单里的「编辑侧栏…」——勾选显示/隐藏侧栏面板入口。
// 功能 3：设置页「归档会话清理」——列出归档会话，按需移入 Windows 回收站（只删除会话自身文件）。
// 本地状态保存在 localStorage；不读写 DSH 配置，不影响计费与费用查询。
window.__ModuleLoader__.load({
  id: 'dsh-sidebar-footer-fold',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-sidebar-footer-fold-styles'
    const BODY_CLASS = 'dsh-sff-collapsed'
    const PANEL_HIDDEN_CLASS = 'dsh-sff-panel-hidden'
    const STORAGE_KEY = 'dsh-sidebar-footer-fold:collapsed'
    const HIDDEN_KEY = 'dsh-sidebar-footer-fold:hidden-panels'
    const EXCLUDED_PANEL_ID = 'plugins'

    const CSS = `
      body.${BODY_CLASS} [data-slot="sidebar.footer.action"] > .cm-footer-stack { display: none !important; }

      .dsh-sff-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 18px;
        padding: 0 8px;
        box-sizing: border-box;
        width: 100%;
      }
      .dsh-sff-btn {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-label-tertiary, #8a8f99);
        font: inherit;
        font-size: 11px;
        line-height: 16px;
        padding: 1px 6px;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color .15s ease, color .15s ease;
      }
      .dsh-sff-btn:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .06));
        color: var(--dsw-alias-label-secondary, #5b6270);
      }
      .dsh-sff-btn:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary, #4f6ef7);
        outline-offset: 1px;
      }

      .${PANEL_HIDDEN_CLASS} { display: none !important; }

      .dsh-sff-menu-sep {
        height: 1px;
        margin: 4px 8px;
        background: var(--dsw-alias-border-l1, rgba(15, 23, 42, .08));
      }
      .dsh-sff-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 7px 10px;
        border: 0;
        border-radius: var(--dsw-radius-md, 8px);
        background: transparent;
        color: var(--dsw-alias-label-primary, #1f2328);
        font: inherit;
        font-size: 13px;
        line-height: 20px;
        text-align: left;
        cursor: pointer;
      }
      .dsh-sff-menu-item:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .06));
      }
      .dsh-sff-menu-item:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary, #4f6ef7);
        outline-offset: -2px;
      }
      .dsh-sff-menu-icon { flex: none; display: inline-flex; width: 16px; height: 16px; color: currentColor; opacity: .8; }

      .dsh-sff-dialog-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, .32);
      }
      .dsh-sff-dialog {
        width: min(420px, calc(100vw - 48px));
        max-height: min(72vh, 560px);
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 16px 18px 14px;
        border-radius: 12px;
        background: var(--dsw-alias-bg-layer-2, #ffffff);
        color: var(--dsw-alias-label-primary, #1f2328);
        box-shadow: 0 18px 48px rgba(15, 23, 42, .22);
        border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, .08));
      }
      .dsh-sff-dialog-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
      .dsh-sff-dialog-desc { margin: 4px 0 10px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-dialog-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 2px 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .dsh-sff-dialog-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 20px;
        cursor: pointer;
      }
      .dsh-sff-dialog-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .05)); }
      .dsh-sff-dialog-row input { margin: 0; accent-color: var(--dsw-alias-brand-primary, #4f6ef7); }
      .dsh-sff-dialog-foot {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 12px;
        margin-top: 8px;
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, .08));
      }
      .dsh-sff-dialog-btn {
        appearance: none;
        border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, .12));
        border-radius: 8px;
        padding: 5px 14px;
        font: inherit;
        font-size: 13px;
        line-height: 20px;
        background: transparent;
        color: var(--dsw-alias-label-primary, #1f2328);
        cursor: pointer;
      }
      .dsh-sff-dialog-btn.primary {
        border-color: transparent;
        background: var(--dsw-alias-brand-primary, #4f6ef7);
        color: #fff;
      }
      .dsh-sff-dialog-btn.danger {
        border-color: var(--dsw-alias-state-error-primary, #d64c4c);
        color: var(--dsw-alias-state-error-primary, #d64c4c);
      }
      .dsh-sff-dialog-btn:hover { filter: brightness(.97); }
      .dsh-sff-dialog-btn:disabled { opacity: .55; cursor: default; }

      .dsh-sff-archive { display: flex; flex-direction: column; gap: 12px; max-width: 780px; color: var(--dsw-alias-label-primary, #1f2328); }
      .dsh-sff-archive-heading { margin: 0; font-size: 18px; font-weight: 600; line-height: 26px; }
      .dsh-sff-archive-intro { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-note { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
      .dsh-sff-archive-total { margin-right: auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, .10));
        border-radius: 12px;
      }
      .dsh-sff-archive-group-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .dsh-sff-archive-group-title { flex: none; font-size: 14px; line-height: 22px; font-weight: 500; }
      .dsh-sff-archive-group-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-group-count { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, .08)); font-size: 13px; }
      .dsh-sff-archive-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsh-sff-archive-row-meta { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary, #8a8f99); font-variant-numeric: tabular-nums; }
      .dsh-sff-archive-empty { margin: 0; padding: 12px; border: 1px dashed var(--dsw-alias-border-l3, rgba(15, 23, 42, .16)); border-radius: 8px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-loading { margin: 0; font-size: 13px; color: var(--dsw-alias-label-tertiary, #8a8f99); }
      .dsh-sff-archive-error { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary, #d64c4c); }
      .dsh-sff-archive-notice { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-success-primary, #2f8f5b); }
      .dsh-sff-btn {
        appearance: none;
        border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, .14));
        border-radius: 8px;
        padding: 3px 10px;
        font: inherit;
        font-size: 12px;
        line-height: 18px;
        background: transparent;
        color: var(--dsw-alias-label-primary, #1f2328);
        cursor: pointer;
      }
      .dsh-sff-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .05)); }
      .dsh-sff-btn:disabled { opacity: .55; cursor: default; }
      .dsh-sff-btn.danger {
        border-color: var(--dsw-alias-state-error-primary, #d64c4c);
        color: var(--dsw-alias-state-error-primary, #d64c4c);
      }
    `

    function ensureStyles() {
      if (typeof document === 'undefined' || !document.head) return
      const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
      if (existing) {
        if (existing.textContent !== CSS) existing.textContent = CSS
        return
      }
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-sidebar-footer-fold'
      style.dataset.pluginCss = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    function formatBytes(bytes) {
      const value = Number(bytes)
      if (!Number.isFinite(value) || value <= 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = value
      let unit = 0
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024
        unit += 1
      }
      const digits = size >= 100 || unit === 0 ? 0 : size >= 10 ? 1 : 2
      return `${size.toFixed(digits)} ${units[unit]}`
    }

    function formatDate(iso) {
      if (!iso) return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    // ─────────────────────────── 费用面板折叠 ───────────────────────────

    function readCollapsed() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === '1'
      } catch {
        return false
      }
    }

    function writeCollapsed(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
      } catch {
        // 隐私模式等：忽略
      }
    }

    function applyCollapsed(value) {
      if (typeof document === 'undefined' || !document.body) return
      document.body.classList.toggle(BODY_CLASS, Boolean(value))
    }

    function findCostStack() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-slot="sidebar.footer.action"] .cm-footer-stack')
    }

    /** 0.1.2 风格的侧栏底行：费用面板 ▾ / ▸（收合状态本机记忆）。 */
    function ToggleRow(props) {
      const [collapsed, setCollapsed] = React.useState(readCollapsed)
      const [visible, setVisible] = React.useState(() => Boolean(findCostStack()))

      React.useEffect(() => {
        applyCollapsed(collapsed)
      }, [collapsed])

      React.useEffect(() => {
        let localObserver = null
        const check = () => setVisible(Boolean(findCostStack()))
        check()
        try {
          localObserver = new MutationObserver(check)
          localObserver.observe(document.body, { childList: true, subtree: true })
        } catch {
          localObserver = null
        }
        return () => {
          try {
            localObserver?.disconnect()
          } catch {
            // 忽略
          }
        }
      }, [])

      if (props && props.wide === false) return null
      if (!visible) return null

      const collapsedNow = Boolean(collapsed)
      const label = collapsedNow ? '费用面板 ▸' : '费用面板 ▾'
      const title = collapsedNow ? '展开左侧栏费用面板' : '收起左侧栏费用面板'
      return h(
        'div',
        { className: 'dsh-sff-row' },
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-sff-btn',
            title,
            'aria-label': title,
            'aria-pressed': String(collapsedNow),
            onClick: () => {
              const next = !collapsedNow
              setCollapsed(next)
              writeCollapsed(next)
              applyCollapsed(next)
            }
          },
          label
        )
      )
    }

    // ─────────────────────────── 编辑侧栏 ───────────────────────────

    let slotsRef = null
    let panelObserver = null
    let applyScheduled = 0
    let dialogElement = null
    const labelToId = new Map()

    function readHidden() {
      try {
        const raw = window.localStorage.getItem(HIDDEN_KEY)
        const value = raw ? JSON.parse(raw) : []
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
      } catch {
        return []
      }
    }

    function saveHidden(list) {
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(list))
      } catch {
        // 忽略
      }
    }

    function resolveLabel(label) {
      try {
        return typeof label === 'function' ? label() : label
      } catch {
        return undefined
      }
    }

    function rememberEntries(entries) {
      if (!Array.isArray(entries)) return
      for (const entry of entries) {
        if (!entry || typeof entry.id !== 'string') continue
        const label = resolveLabel(entry.label)
        if (typeof label === 'string' && label) labelToId.set(label, entry.id)
      }
    }

    function rememberSlotEntries() {
      if (!slotsRef || typeof slotsRef.entriesOfSlot !== 'function') return
      let entries = []
      try {
        entries = slotsRef.entriesOfSlot('sidebar.panellist') || []
      } catch {
        return
      }
      for (const entry of entries) {
        const options = entry && entry.options
        if (!options || typeof options.id !== 'string') continue
        const label = resolveLabel(options.label)
        if (typeof label === 'string' && label) labelToId.set(label, options.id)
      }
    }

    function collectPanelButtons() {
      if (typeof document === 'undefined') return []
      const result = []
      const all = document.querySelectorAll('button[class*="panelRow"]')
      for (const button of all) {
        if (button.hasAttribute('aria-haspopup')) continue
        if (!button.closest('nav')) continue
        result.push(button)
      }
      return result
    }

    function applyHiddenPanels() {
      if (typeof document === 'undefined') return
      rememberSlotEntries()
      if (labelToId.size === 0) return
      const hidden = readHidden()
      for (const button of collectPanelButtons()) {
        const label = button.getAttribute('aria-label') || ''
        const id = labelToId.get(label)
        if (id && hidden.includes(id)) button.classList.add(PANEL_HIDDEN_CLASS)
        else button.classList.remove(PANEL_HIDDEN_CLASS)
      }
    }

    function schedulePanelApply() {
      if (applyScheduled) return
      applyScheduled = window.requestAnimationFrame(() => {
        applyScheduled = 0
        try {
          applyHiddenPanels()
        } catch {
          // 忽略
        }
      })
    }

    function closePanelDialog() {
      if (!dialogElement) return
      try {
        dialogElement.remove()
      } catch {
        // 忽略
      }
      dialogElement = null
    }

    function openPanelDialog(entries) {
      if (typeof document === 'undefined' || !document.body) return
      rememberEntries(entries)
      closePanelDialog()
      const list = Array.isArray(entries)
        ? entries.filter((entry) => entry && typeof entry.id === 'string' && entry.id !== EXCLUDED_PANEL_ID)
        : []

      const overlay = document.createElement('div')
      overlay.className = 'dsh-sff-dialog-backdrop'
      const card = document.createElement('div')
      card.className = 'dsh-sff-dialog'
      card.setAttribute('role', 'dialog')
      card.setAttribute('aria-modal', 'true')
      card.setAttribute('aria-label', '编辑侧栏')

      const title = document.createElement('h2')
      title.className = 'dsh-sff-dialog-title'
      title.textContent = '编辑侧栏'
      const desc = document.createElement('p')
      desc.className = 'dsh-sff-dialog-desc'
      desc.textContent = '选择要在侧栏中显示的面板入口；取消勾选会从侧栏面板列表里隐藏，随时可以在这里恢复。'

      const listEl = document.createElement('div')
      listEl.className = 'dsh-sff-dialog-list'
      for (const entry of list) {
        const labelText = resolveLabel(entry.label) || entry.id
        const row = document.createElement('label')
        row.className = 'dsh-sff-dialog-row'
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = !readHidden().includes(entry.id)
        input.addEventListener('change', () => {
          const current = readHidden()
          let next
          if (input.checked) next = current.filter((item) => item !== entry.id)
          else next = current.includes(entry.id) ? current : current.concat(entry.id)
          saveHidden(next)
          applyHiddenPanels()
          schedulePanelApply()
        })
        const text = document.createElement('span')
        text.textContent = labelText
        row.append(input, text)
        listEl.appendChild(row)
      }
      if (list.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'dsh-sff-dialog-desc'
        empty.textContent = '当前没有可编辑的侧栏面板入口。'
        listEl.appendChild(empty)
      }

      const foot = document.createElement('div')
      foot.className = 'dsh-sff-dialog-foot'
      const done = document.createElement('button')
      done.type = 'button'
      done.className = 'dsh-sff-dialog-btn primary'
      done.textContent = '完成'
      done.addEventListener('click', () => {
        schedulePanelApply()
        closePanelDialog()
      })
      foot.appendChild(done)
      card.append(title, desc, listEl, foot)
      overlay.appendChild(card)

      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          closePanelDialog()
        }
      }, true)
      overlay.addEventListener('mousedown', (event) => {
        if (event.target === overlay) closePanelDialog()
      })
      dialogElement = overlay
      document.body.appendChild(overlay)
      try {
        done.focus({ preventScroll: true })
      } catch {
        // 忽略
      }
    }

    const ICON_EDIT = 'M13.5 3.5a1.7 1.7 0 0 1 2.4 2.4l-8.1 8.1-3.1.7.7-3.1 8.1-8.1z'

    function EditSidebarRow(props) {
      const entries = props && Array.isArray(props.entries) ? props.entries : []
      const onDismiss = props && props.onDismiss

      React.useEffect(() => {
        rememberEntries(entries)
        schedulePanelApply()
      }, [entries])

      return h(
        React.Fragment,
        null,
        h('div', { className: 'dsh-sff-menu-sep' }),
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            className: 'dsh-sff-menu-item',
            onClick: (event) => {
              event.preventDefault()
              event.stopPropagation()
              try {
                onDismiss?.()
              } catch {
                // 忽略
              }
              openPanelDialog(entries)
            }
          },
          h(
            'span',
            { className: 'dsh-sff-menu-icon', 'aria-hidden': 'true' },
            h(
              'svg',
              {
                width: 16,
                height: 16,
                viewBox: '0 0 20 20',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
              },
              h('path', { d: ICON_EDIT }),
              h('path', { d: 'M3.5 16.5h13' })
            )
          ),
          h('span', null, '编辑侧栏…')
        )
      )
    }

    // ─────────────────────── 设置页：归档会话清理 ───────────────────────

    function ArchivedSessionsSection() {
      const [state, setState] = React.useState({
        loading: true,
        error: null,
        notice: null,
        groups: [],
        count: 0,
        totalBytes: 0,
        busy: false,
        confirm: null
      })

      const patch = (next) => setState((prev) => ({ ...prev, ...next }))

      const refresh = React.useCallback(() => {
        patch({ loading: true, error: null })
        return fetch('/sidebar-footer-fold/api/archived/list', { cache: 'no-store' })
          .then((response) => response.json())
          .then((json) => {
            if (!json || json.ok === false) throw new Error((json && json.error) || '读取归档会话失败')
            setState((prev) => ({
              ...prev,
              loading: false,
              error: null,
              groups: Array.isArray(json.groups) ? json.groups : [],
              count: Number(json.count) || 0,
              totalBytes: Number(json.totalBytes) || 0
            }))
          })
          .catch((error) => patch({ loading: false, error: String(error?.message ?? error) }))
      }, [])

      React.useEffect(() => {
        refresh()
      }, [refresh])

      const requestDelete = (ids) => {
        if (!ids.length) return
        const bytes = state.groups
          .flatMap((group) => group.sessions)
          .filter((session) => ids.includes(session.id))
          .reduce((total, session) => total + (Number(session.bytes) || 0), 0)
        patch({
          confirm: {
            ids,
            title: '移入回收站',
            description: `将把 ${ids.length} 个归档会话（约 ${formatBytes(bytes)}）移入 Windows 回收站，可随时从回收站还原。只删除会话自身的文件，不影响其他会话和附件。`,
            confirmLabel: '移入回收站',
            busyLabel: '移动中…'
          }
        })
      }

      const closeConfirm = () => {
        if (state.busy) return
        patch({ confirm: null })
      }

      const commit = React.useCallback(() => {
        const confirm = state.confirm
        if (!confirm) return
        patch({ busy: true, error: null })
        return fetch('/sidebar-footer-fold/api/archived/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids: confirm.ids })
        })
          .then((response) => response.json())
          .then((json) => {
            if (!json || json.ok === false) throw new Error((json && json.error) || '移入回收站失败')
            const freed = Number(json.freedBytes) || 0
            const moved = Array.isArray(json.deleted) ? json.deleted.length : 0
            const warnings = Array.isArray(json.warnings) ? json.warnings : []
            setState((prev) => ({
              ...prev,
              busy: false,
              confirm: null,
              error: warnings.length ? `部分未完成：${warnings.slice(0, 3).join('；')}` : null,
              notice: `已移入回收站：${moved} 个会话，释放约 ${formatBytes(freed)}`
            }))
            return refresh()
          })
          .catch((error) => patch({ busy: false, confirm: null, error: String(error?.message ?? error) }))
      }, [state.confirm, refresh])

      const confirmDialog = state.confirm
        ? h(
            'div',
            {
              className: 'dsh-sff-dialog-backdrop',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) closeConfirm()
              }
            },
            h(
              'div',
              { className: 'dsh-sff-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': state.confirm.title },
              h('h2', { className: 'dsh-sff-dialog-title' }, state.confirm.title),
              h('p', { className: 'dsh-sff-dialog-desc' }, state.confirm.description),
              h(
                'div',
                { className: 'dsh-sff-dialog-foot' },
                h('button', { type: 'button', className: 'dsh-sff-dialog-btn', disabled: state.busy, onClick: closeConfirm }, '取消'),
                h('button', { type: 'button', className: 'dsh-sff-dialog-btn danger', disabled: state.busy, onClick: commit }, state.busy ? state.confirm.busyLabel : state.confirm.confirmLabel)
              )
            )
          )
        : null

      return h(
        'div',
        { className: 'dsh-sff-archive' },
        h('h2', { className: 'dsh-sff-archive-heading' }, '归档会话清理'),
        h('p', { className: 'dsh-sff-archive-intro' }, '只处理已归档的会话：把会话自身的文件移入 Windows 回收站以释放磁盘空间，可随时从回收站还原。'),
        h(
          'div',
          { className: 'dsh-sff-archive-toolbar' },
          h('span', { className: 'dsh-sff-archive-total' }, state.loading ? '读取中…' : `共 ${state.count} 个归档会话 · ${formatBytes(state.totalBytes)}`),
          h('button', { type: 'button', className: 'dsh-sff-btn', disabled: state.loading || state.busy, onClick: refresh }, '刷新'),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-sff-btn danger',
              disabled: state.loading || state.busy || state.count === 0,
              onClick: () => {
                const ids = state.groups.flatMap((group) => group.sessions.map((session) => session.id))
                requestDelete(ids)
              }
            },
            '全部移入回收站'
          )
        ),
        state.error ? h('p', { className: 'dsh-sff-archive-error', role: 'alert' }, state.error) : null,
        state.notice ? h('p', { className: 'dsh-sff-archive-notice', role: 'status' }, state.notice) : null,
        state.loading
          ? h('p', { className: 'dsh-sff-archive-loading' }, '加载归档会话…')
          : state.groups.length === 0
            ? h('p', { className: 'dsh-sff-archive-empty' }, '暂无归档会话。')
            : state.groups.map((group) =>
                h(
                  'div',
                  { className: 'dsh-sff-archive-group', key: group.workspaceId },
                  h(
                    'div',
                    { className: 'dsh-sff-archive-group-head' },
                    h('span', { className: 'dsh-sff-archive-group-title' }, group.title || '未分组'),
                    h('span', { className: 'dsh-sff-archive-group-path', title: group.path || '' }, group.path || ''),
                    h('span', { className: 'dsh-sff-archive-group-count' }, `${group.sessions.length} 个`)
                  ),
                  group.sessions.map((session) =>
                    h(
                      'div',
                      { className: 'dsh-sff-archive-row', key: session.id },
                      h('span', { className: 'dsh-sff-archive-row-title', title: session.title }, session.title),
                      h('span', { className: 'dsh-sff-archive-row-meta' }, `${formatBytes(session.bytes)} · ${formatDate(session.createdAt)}`),
                      h('button', { type: 'button', className: 'dsh-sff-btn danger', disabled: state.busy, onClick: () => requestDelete([session.id]) }, '移入回收站')
                    )
                  )
                )
              ),
        confirmDialog
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyles()
        applyCollapsed(readCollapsed())

        const slots =
          (ctx && typeof ctx.get === 'function' && ctx.get('slots')) ||
          (ctx && ctx.slots)
        if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
          try {
            ctx?.logger?.warn?.('[dsh-sidebar-footer-fold] slots 服务不可用，部分功能未挂载')
          } catch {
            // 忽略
          }
          return () => applyCollapsed(false)
        }
        slotsRef = slots

        const disposers = []
        disposers.push(
          slots.inject('sidebar.footer.action', () =>
            slots.register(
              {
                name: 'sidebar.footer.action',
                id: 'sidebar-footer-fold',
                order: 1,
                inject: () => ({})
              },
              ToggleRow
            )
          )
        )
        disposers.push(
          slots.inject('sidebar.panellist.actions', () =>
            slots.register(
              {
                name: 'sidebar.panellist.actions',
                id: 'sidebar-footer-fold-edit',
                order: 20
              },
              EditSidebarRow
            )
          )
        )
        disposers.push(
          slots.inject('settings.section', () =>
            slots.register(
              {
                name: 'settings.section',
                id: 'sidebar-footer-fold-archive',
                order: 17,
                label: () => '归档会话清理'
              },
              ArchivedSessionsSection
            )
          )
        )

        // 面板隐藏状态同步
        schedulePanelApply()
        try {
          panelObserver = new MutationObserver(schedulePanelApply)
          panelObserver.observe(document.body, { childList: true, subtree: true })
        } catch {
          panelObserver = null
        }

        let slotsChangedHandler = null
        try {
          if (typeof ctx.on === 'function') {
            slotsChangedHandler = () => {
              schedulePanelApply()
            }
            ctx.on('slots/changed', slotsChangedHandler)
          }
        } catch {
          slotsChangedHandler = null
        }

        return () => {
          for (const dispose of disposers) {
            try {
              dispose?.()
            } catch {
              // 忽略
            }
          }
          try {
            panelObserver?.disconnect()
          } catch {
            // 忽略
          }
          panelObserver = null
          if (applyScheduled) {
            try {
              window.cancelAnimationFrame(applyScheduled)
            } catch {
              // 忽略
            }
            applyScheduled = 0
          }
          try {
            if (slotsChangedHandler && typeof ctx.off === 'function') ctx.off('slots/changed', slotsChangedHandler)
          } catch {
            // 忽略
          }
          slotsRef = null
          labelToId.clear()
          closePanelDialog()
          for (const button of collectPanelButtons()) button.classList.remove(PANEL_HIDDEN_CLASS)
          applyCollapsed(false)
        }
      }
    }
  }
})
