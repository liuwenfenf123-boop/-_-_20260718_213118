export {}

declare global {
  interface Window {
    electronAPI: {
      launchApp: (appPath: string) => Promise<{ success: boolean; error?: string }>
      getRunningApps: () => Promise<string[]>

      // 系统控制
      mouseMove: (x: number, y: number) => Promise<{ success: boolean }>
      mouseClick: (button?: 'left' | 'right', double?: boolean) => Promise<{ success: boolean }>
      mouseDown: (button?: 'left' | 'right') => Promise<{ success: boolean }>
      mouseUp: (button?: 'left' | 'right') => Promise<{ success: boolean }>
      mouseScroll: (amount: number) => Promise<{ success: boolean }>
      keyTap: (key: string, modifier?: string | null) => Promise<{ success: boolean }>
    }
  }
}
