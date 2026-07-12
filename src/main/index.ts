const { app, BrowserWindow, ipcMain, shell, globalShortcut, screen } = require('electron')
import { join } from 'path'
import { stat } from 'fs/promises'   

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1200,
    minWidth: 1200,
    minHeight: 750,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    maximizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  // 默认不置顶，让用户能切换到其他软件
  // 需要置顶时可以按快捷键切换（下面注册了快捷键）
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 启动应用程序
function registerIpcHandlers() {
ipcMain.handle('launch-app', async (_event, appPath: string) => {
  try {
    await shell.openPath(appPath)
    // 启动应用后自动置顶主窗口，确保手势控制继续可用
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.focus()
    }
    return { success: true }
  } catch (error: any) {
    console.error('启动失败:', error)
    return { success: false, error: error?.message || String(error) }
  }
})

// 获取应用文件大小
ipcMain.handle('get-app-size', async (_event, appPath: string) => {
  try {
    // 获取 .app 包的大小
    const stats = await stat(appPath)
    if (stats.isDirectory()) {
      // 如果是目录（.app包），尝试获取其内容大小
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      try {
        // 使用 du 命令获取目录大小
        const { stdout } = await execAsync(`du -sk "${appPath}"`)
        const sizeInKB = parseInt(stdout.split('\t')[0])
        return { success: true, size: sizeInKB * 1024 } // 转换为字节
      } catch {
        // 如果 du 失败，返回基本信息大小
        return { success: true, size: stats.size }
      }
    }
    return { success: true, size: stats.size }
  } catch (error: any) {
    console.error('获取文件大小失败:', error)
    return { success: false, error: error?.message || String(error), size: 0 }
  }
})

// 获取运行中进程列表
ipcMain.handle('get-running-apps', async () => {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    exec('ps aux | grep -i ".app/Contents/MacOS" | grep -v grep', (error: any, stdout: string) => {
      if (error) {
        resolve([])
      } else {
        const processes = stdout.split('\n').filter(Boolean).map((line: string) => {
          const parts = line.trim().split(/\s+/)
          return parts[parts.length - 1] || ''
        })
        resolve(processes)
      }
    })
  })
})

// ===== 新增：系统级控制 =====
// 使用 Electron 的屏幕 API + shell 命令实现系统控制

// 移动系统鼠标（用 AppleScript 实现精确控制）
ipcMain.handle('mouse-move', async (_event, x: number, y: number) => {
  try {
    const { exec } = require('child_process')
    // 获取当前显示器尺寸，确保坐标在范围内
    const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) })
    return new Promise((resolve) => {
      // 用 cliclick 工具移动鼠标（需要安装），退回 AppleScript
      exec(`osascript -e 'tell application "System Events" to set position of the mouse to {${Math.round(x)}, ${Math.round(y)}}'`, (err: any) => {
        resolve({ success: !err, error: err?.message })
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

// 系统级点击（用 AppleScript + cliclick）
ipcMain.handle('mouse-click', async (_event, button: 'left' | 'right' = 'left', double: boolean = false) => {
  try {
    const { exec } = require('child_process')
    // 优先用 cliclick（Mac 上最好用的命令行鼠标工具）
    let cmd = 'cliclick c:.'  // 单击当前位置
    if (button === 'right') cmd = 'cliclick rc:.'
    if (double) cmd = 'cliclick dc:.'

    return new Promise((resolve) => {
      exec(cmd, (err: any) => {
        if (err) {
          // cliclick 没装，退回 AppleScript
          const script = button === 'right'
            ? 'tell application "System Events" to right click'
            : double
              ? 'tell application "System Events" to double click'
              : 'tell application "System Events" to click'
          exec(`osascript -e '${script}'`, (err2: any) => {
            resolve({ success: !err2, error: err2?.message })
          })
        } else {
          resolve({ success: true })
        }
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

// 鼠标按下
ipcMain.handle('mouse-down', async (_event, _button: 'left' | 'right' = 'left') => {
  try {
    const { exec } = require('child_process')
    return new Promise((resolve) => {
      exec('cliclick dd:.', (err: any) => {
        resolve({ success: !err, error: err?.message })
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

// 鼠标抬起
ipcMain.handle('mouse-up', async (_event, _button: 'left' | 'right' = 'left') => {
  try {
    const { exec } = require('child_process')
    return new Promise((resolve) => {
      exec('cliclick du:.', (err: any) => {
        resolve({ success: !err, error: err?.message })
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

// 滚轮
ipcMain.handle('mouse-scroll', async (_event, amount: number) => {
  try {
    const { exec } = require('child_process')
    // cliclick 的 scroll 命令：正值向下，负值向上
    const cmd = `cliclick "scroll:${Math.round(amount)}"`
    return new Promise((resolve) => {
      exec(cmd, (err: any) => {
        resolve({ success: !err, error: err?.message })
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

// 键盘快捷键（用于切窗口等）
ipcMain.handle('key-tap', async (_event, key: string, modifier: string | null) => {
  try {
    const { exec } = require('child_process')
    // 用 cliclick 的 key 命令
    // key 格式：cmd, alt, ctrl, shift + 字母
    let cmd = 'cliclick '
    if (modifier) {
      // Mac 修饰键映射
      const modMap: Record<string, string> = {
        'command': 'cmd',
        'cmd': 'cmd',
        'control': 'ctrl',
        'ctrl': 'ctrl',
        'option': 'alt',
        'alt': 'alt',
        'shift': 'shift'
      }
      const mod = modMap[modifier.toLowerCase()] || modifier.toLowerCase()
      cmd += `kp:${mod}+${key}`
    } else {
      cmd += `kp:${key}`
    }
    return new Promise((resolve) => {
      exec(cmd, (err: any) => {
        resolve({ success: !err, error: err?.message })
      })
    })
  } catch (e: any) {
    return { success: false, error: String(e) }
  }
})

}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  // 启动时最大化窗口，充分利用屏幕空间
  if (mainWindow) {
    mainWindow.maximize()
  }

  // Cmd+Shift+P 切换置顶
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow) {
      const isOnTop = mainWindow.isAlwaysOnTop()
      mainWindow.setAlwaysOnTop(!isOnTop, 'screen-saver')
      console.log(`[Window] 置顶: ${!isOnTop}`)
    }
  })

  // Cmd+Shift+H 隐藏/显示窗口
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
      }
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
