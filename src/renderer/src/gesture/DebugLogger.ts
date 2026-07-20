// ===== 全局调试日志系统 =====
// 所有日志输出到浏览器控制台（DevTools Console）
// 日志格式：[时间戳] [模块] 消息

const DEBUG_ENABLED = true
let frameCount = 0
let lastLogTime = 0
let prevStateKey = ''

export const DebugLogger = {
  // 每200ms输出一次（避免刷屏），用于光标位置等高频信息
  logPerFrame(module: string, msg: string, data?: any) {
    if (!DEBUG_ENABLED) return
    const now = performance.now()
    if (now - lastLogTime > 200) {
      frameCount++
      lastLogTime = now
      const time = new Date().toISOString().slice(11, 23)
      if (data !== undefined) {
        console.log(`[${time}] [${module}] ${msg}`, data)
      } else {
        console.log(`[${time}] [${module}] ${msg}`)
      }
    }
  },

  // 重要事件立即输出 — 手势识别结果、选中/取消等
  important(module: string, msg: string, data?: any) {
    if (!DEBUG_ENABLED) return
    const time = new Date().toISOString().slice(11, 23)
    if (data !== undefined) {
      console.log(`🔴 [${time}] [${module}] ${msg}`, data)
    } else {
      console.log(`🔴 [${time}] [${module}] ${msg}`)
    }
  },

  // 普通事件 — 手势变化、状态切换等
  event(module: string, msg: string, data?: any) {
    if (!DEBUG_ENABLED) return
    const time = new Date().toISOString().slice(11, 23)
    if (data !== undefined) {
      console.log(`🟢 [${time}] [${module}] ${msg}`, data)
    } else {
      console.log(`🟢 [${time}] [${module}] ${msg}`)
    }
  },

  // 手势状态变化（只在状态改变时输出，避免重复）
  gestureStateChange(module: string, msg: string, data?: any) {
    if (!DEBUG_ENABLED) return
    const key = msg + JSON.stringify(data || '')
    if (key === prevStateKey) return
    prevStateKey = key
    const time = new Date().toISOString().slice(11, 23)
    if (data !== undefined) {
      console.log(`🟡 [${time}] [${module}] ${msg}`, data)
    } else {
      console.log(`🟡 [${time}] [${module}] ${msg}`)
    }
  }
}
