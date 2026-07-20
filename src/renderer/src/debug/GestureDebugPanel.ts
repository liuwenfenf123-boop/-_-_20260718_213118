// ===== 手势调试面板 =====
// 按 ` 键切换显示/隐藏

export interface GestureDebugState {
  timestamp: number
  handCount: number
  mode: 'none' | 'single' | 'dual'
  leftHand: boolean
  leftRawGesture: string
  leftStableGesture: string
  leftPalmFacing: string
  leftPinchRatio: number
  rightHand: boolean
  rightRawGesture: string
  rightStableGesture: string
  rightPalmFacing: string
  rightPinchRatio: number
  comboGesture: string | null
  isArmed: boolean
  isSelected: boolean
  selectedName: string
  isLockView: boolean
  inferenceMs: number
}

interface LogEntry {
  time: string
  type: 'gesture' | 'action' | 'system'
  message: string
}

const GESTURE_NAMES_CN: Record<string, string> = {
  unknown: '未知',
  pinch: '捏合',
  fist: '握拳',
  point: '食指',
  peace: '比耶',
  open_palm: '张开手掌',
  back_palm: '手背',
  palm_down: '掌心向下',
  palm_up: '掌心向上',
  both_fist: '双拳',
  both_open_palm: '双张手',
  both_pinch: '双捏合',
  both_peace: '双比耶',
}

export class GestureDebugPanel {
  private panel: HTMLElement
  private logList: HTMLElement
  visible = false
  recording = true
  private logs: LogEntry[] = []
  private readonly MAX_LOGS = 500
  private state: GestureDebugState | null = null

  constructor() {
    const panelEl = document.getElementById('gesture-debug-panel')
    if (!panelEl) {
      console.error('[GestureDebugPanel] ❌ 找不到 #gesture-debug-panel 元素！')
      // 创建一个空的占位，防止后续代码崩溃
      this.panel = document.createElement('div')
      this.logList = document.createElement('div')
      return
    }
    this.panel = panelEl
    const logListEl = this.panel.querySelector('.debug-log-list')
    if (!logListEl) {
      console.error('[GestureDebugPanel] ❌ 找不到 .debug-log-list 元素！')
      this.logList = document.createElement('div')
      return
    }
    this.logList = logListEl as HTMLElement
    this.setupKeyboard()
    this.setupButtons()
    console.log('[GestureDebugPanel] ✅ 调试面板初始化成功')
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // 支持 ` 键（Backquote）和 ~ 键（同一个物理键）
      if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
        e.preventDefault()
        this.toggle()
      }
    })
  }

  private setupButtons(): void {
    const btnRecord = document.getElementById('dbg-btn-record')
    const btnClear = document.getElementById('dbg-btn-clear')
    const btnExport = document.getElementById('dbg-btn-export')
    if (btnRecord) btnRecord.addEventListener('click', () => this.toggleRecording())
    if (btnClear) btnClear.addEventListener('click', () => this.clearLogs())
    if (btnExport) btnExport.addEventListener('click', () => this.exportLogs())
    if (!btnRecord || !btnClear || !btnExport) {
      console.warn('[GestureDebugPanel] ⚠️ 部分按钮未找到:', { btnRecord: !!btnRecord, btnClear: !!btnClear, btnExport: !!btnExport })
    }
  }

  toggle(): void {
    this.visible = !this.visible
    this.panel.classList.toggle('visible', this.visible)
    this.addLog('system', this.visible ? '面板打开' : '面板关闭')
  }

  private toggleRecording(): void {
    this.recording = !this.recording
    const btn = document.getElementById('dbg-btn-record')!
    const indicator = document.getElementById('dbg-recording')!
    if (this.recording) {
      btn.textContent = '⏸ 停止记录'
      indicator.textContent = '● 记录中'
      indicator.classList.remove('paused')
      this.addLog('system', '开始记录')
    } else {
      btn.textContent = '▶ 开始记录'
      indicator.textContent = '○ 已暂停'
      indicator.classList.add('paused')
      this.addLog('system', '停止记录')
    }
  }

  private clearLogs(): void {
    this.logs = []
    this.logList.innerHTML = ''
    this.updateLogCount()
    this.addLog('system', '日志已清除')
  }

  private exportLogs(): void {
    const text = this.logs.map(l => `[${l.time}] [${l.type}] ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    const filename = `gesture-debug-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.log`
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    this.addLog('system', `日志已导出: ${filename}`)
  }

  updateState(state: GestureDebugState): void {
    this.state = state

    const modeText = state.mode === 'dual' ? '👐 双手' : state.mode === 'single' ? '👆 单手' : '🈳 无'
    this.setText('dbg-mode', modeText)

    if (state.leftHand) {
      this.setText('dbg-left', GESTURE_NAMES_CN[state.leftStableGesture] || state.leftStableGesture)
      this.setText('dbg-left-raw', GESTURE_NAMES_CN[state.leftRawGesture] || state.leftRawGesture)
      this.setText('dbg-left-stable', GESTURE_NAMES_CN[state.leftStableGesture] || state.leftStableGesture)
      this.setText('dbg-left-facing', state.leftPalmFacing)
      this.setText('dbg-left-pinch', state.leftPinchRatio.toFixed(3))
    } else {
      this.setText('dbg-left', '——')
      this.setText('dbg-left-raw', '——')
      this.setText('dbg-left-stable', '——')
      this.setText('dbg-left-facing', '——')
      this.setText('dbg-left-pinch', '——')
    }

    if (state.rightHand) {
      this.setText('dbg-right', GESTURE_NAMES_CN[state.rightStableGesture] || state.rightStableGesture)
      this.setText('dbg-right-raw', GESTURE_NAMES_CN[state.rightRawGesture] || state.rightRawGesture)
      this.setText('dbg-right-stable', GESTURE_NAMES_CN[state.rightStableGesture] || state.rightStableGesture)
      this.setText('dbg-right-facing', state.rightPalmFacing)
      this.setText('dbg-right-pinch', state.rightPinchRatio.toFixed(3))
    } else {
      this.setText('dbg-right', '——')
      this.setText('dbg-right-raw', '——')
      this.setText('dbg-right-stable', '——')
      this.setText('dbg-right-facing', '——')
      this.setText('dbg-right-pinch', '——')
    }

    this.setText('dbg-combo', state.comboGesture ? (GESTURE_NAMES_CN[state.comboGesture] || state.comboGesture) : '——')
    this.setText('dbg-armed', state.isArmed ? '✅ 激活' : '⚠️ 冻结')
    this.setText('dbg-selected', state.isSelected ? '✅ ' + state.selectedName : '——')
    this.setText('dbg-lock', state.isLockView ? '🔒 锁定' : '——')
    this.setText('dbg-inference', state.inferenceMs.toFixed(1) + 'ms')
  }

  addLog(type: 'gesture' | 'action' | 'system', message: string): void {
    if (!this.recording && type !== 'system') return

    const now = new Date()
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    const entry: LogEntry = { time, type, message }
    this.logs.push(entry)

    while (this.logs.length > this.MAX_LOGS) {
      this.logs.shift()
    }

    this.renderLogEntry(entry)
    this.updateLogCount()
  }

  private renderLogEntry(entry: LogEntry): void {
    const div = document.createElement('div')
    div.className = `debug-log-entry debug-log-${entry.type}`
    div.innerHTML = `<span class="log-time">${entry.time}</span> <span class="log-msg">${entry.message}</span>`
    this.logList.appendChild(div)

    while (this.logList.children.length > 200) {
      this.logList.removeChild(this.logList.firstChild!)
    }

    this.logList.scrollTop = this.logList.scrollHeight
  }

  private updateLogCount(): void {
    const el = document.getElementById('dbg-log-count')
    if (el) el.textContent = this.logs.length + '条'
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }
}
