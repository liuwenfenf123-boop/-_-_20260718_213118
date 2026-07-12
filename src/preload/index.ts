import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  launchApp: (appPath: string) => ipcRenderer.invoke('launch-app', appPath),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  getAppSize: (appPath: string) => ipcRenderer.invoke('get-app-size', appPath),

  // ===== 新增：系统控制 =====
  mouseMove: (x: number, y: number) => ipcRenderer.invoke('mouse-move', x, y),
  mouseClick: (button?: 'left' | 'right', double?: boolean) =>
    ipcRenderer.invoke('mouse-click', button, double),
  mouseDown: (button?: 'left' | 'right') => ipcRenderer.invoke('mouse-down', button),
  mouseUp: (button?: 'left' | 'right') => ipcRenderer.invoke('mouse-up', button),
  mouseScroll: (amount: number) => ipcRenderer.invoke('mouse-scroll', amount),
  keyTap: (key: string, modifier?: string | null) =>
    ipcRenderer.invoke('key-tap', key, modifier || null),
})
