export interface AppEntry {
  name: string
  path: string
  gesture: string    // peace | fist | open_palm（pinch 已改为光标点击，不再绑软件）
  color: string      // hex color - 图标颜色
  auraColor: string  // hex color - 光圈颜色（必须与图标颜色不同）
  icon?: string
  fileSize?: number  // 文件大小（字节），用于调整星球大小
}

export const appConfig = {
  particleTheme: 'christmas_tree',

  apps: [
    // ===== 握拳 = 控制/开发/工具类 =====
    {
      name: '代码编辑器',
      path: '/Applications/Visual Studio Code.app',
      gesture: 'fist',
      color: '#007acc',
      auraColor: '#ff9ecd'  // 粉红光圈，与蓝色图标不同
    },
    {
      name: '终端',
      path: '/System/Applications/Utilities/Terminal.app',
      gesture: 'fist',
      color: '#00ff88',
      auraColor: '#ff6b9d'  // 玫红光，与绿色图标不同
    },
    {
      name: 'Cursor',
      path: '/Applications/Cursor.app',
      gesture: 'fist',
      color: '#33aaff',
      auraColor: '#ffb347'  // 橙色光圈，与蓝色图标不同
    },
    {
      name: 'Docker',
      path: '/Applications/Docker.app',
      gesture: 'fist',
      color: '#2496ed',
      auraColor: '#ff7f50'  // 珊瑚色光圈，与蓝色图标不同
    },
    {
      name: '活动监视器',
      path: '/System/Applications/Utilities/Activity Monitor.app',
      gesture: 'fist',
      color: '#ff6b6b',
      auraColor: '#40e0d0'  // 青绿色光圈，与红色图标不同
    },
    {
      name: '截图',
      path: '/System/Applications/Utilities/Screenshot.app',
      gesture: 'fist',
      color: '#ff9500',
      auraColor: '#da70d6'  // 兰花紫光，与橙色图标不同
    },
    {
      name: '系统信息',
      path: '/System/Applications/Utilities/System Information.app',
      gesture: 'fist',
      color: '#8e8e93',
      auraColor: '#ffd700'  // 金色光圈，与灰色图标不同
    },
    {
      name: '字体册',
      path: '/System/Applications/Font Book.app',
      gesture: 'fist',
      color: '#ff4444',
      auraColor: '#00ced1'  // 深青色光圈，与红色图标不同
    },
    {
      name: '时间机器',
      path: '/System/Applications/Time Machine.app',
      gesture: 'fist',
      color: '#2ecc71',
      auraColor: '#ff69b4'  // 热粉光圈，与绿色图标不同
    },
    {
      name: '磁盘工具',
      path: '/System/Applications/Utilities/Disk Utility.app',
      gesture: 'fist',
      color: '#e74c3c',
      auraColor: '#00fa9a'  // 春绿色光圈，与红色图标不同
    },
    {
      name: '控制台',
      path: '/System/Applications/Utilities/Console.app',
      gesture: 'fist',
      color: '#95a5a6',
      auraColor: '#ff1493'  // 深粉光圈，与灰色图标不同
    },
    {
      name: '脚本编辑器',
      path: '/System/Applications/Utilities/Script Editor.app',
      gesture: 'fist',
      color: '#3498db',
      auraColor: '#ff6347'  // 番茄色光圈，与蓝色图标不同
    },

    // ===== 张手 = 打开/浏览/通讯类 =====
    {
      name: '谷歌浏览器',
      path: '/Applications/Google Chrome.app',
      gesture: 'open_palm',
      color: '#ffcc00',
      auraColor: '#4169e1'  // 皇家蓝光圈，与黄色图标不同
    },
    {
      name: '访达',
      path: '/System/Library/CoreServices/Finder.app',
      gesture: 'open_palm',
      color: '#4488ff',
      auraColor: '#ff8c00'  // 深橙光圈，与蓝色图标不同
    },
    {
      name: 'Safari浏览器',
      path: '/Applications/Safari.app',
      gesture: 'open_palm',
      color: '#0071e3',
      auraColor: '#ff4500'  // 橙红光，与蓝色图标不同
    },
    {
      name: '照片',
      path: '/System/Applications/Photos.app',
      gesture: 'open_palm',
      color: '#ff9500',
      auraColor: '#9932cc'  // 深兰花紫，与橙色图标不同
    },
    {
      name: '微信',
      path: '/Applications/WeChat.app',
      gesture: 'open_palm',
      color: '#07c160',
      auraColor: '#ff1493'  // 深粉光圈，与绿色图标不同
    },
    {
      name: '邮件',
      path: '/System/Applications/Mail.app',
      gesture: 'open_palm',
      color: '#3498db',
      auraColor: '#ff6347'  // 番茄色光圈，与蓝色图标不同
    },
    {
      name: '信息',
      path: '/System/Applications/Messages.app',
      gesture: 'open_palm',
      color: '#4cd964',
      auraColor: '#ff1493'  // 深粉光圈，与绿色图标不同
    },
    {
      name: '地图',
      path: '/System/Applications/Maps.app',
      gesture: 'open_palm',
      color: '#5856d6',
      auraColor: '#ffd700'  // 金色光圈，与紫色图标不同
    },
    {
      name: '天气',
      path: '/System/Applications/Weather.app',
      gesture: 'open_palm',
      color: '#5ac8fa',
      auraColor: '#ff6347'  // 番茄色光圈，与天蓝色图标不同
    },
    {
      name: '预览',
      path: '/System/Applications/Preview.app',
      gesture: 'open_palm',
      color: '#ff6b35',
      auraColor: '#4169e1'  // 皇家蓝光圈，与橙色图标不同
    },
    {
      name: 'WPS灵犀',
      path: '/Applications/WPS 灵犀.app',
      gesture: 'open_palm',
      color: '#d32f2f',
      auraColor: '#00ced1'  // 深青色光圈，与红色图标不同
    },
    {
      name: '通讯录',
      path: '/System/Applications/Contacts.app',
      gesture: 'open_palm',
      color: '#a855f7',
      auraColor: '#ffd700'  // 金色光圈，与紫色图标不同
    },

    // ===== 比耶 = 娱乐/效率/创作类 =====
    {
      name: 'Spotify',
      path: '/Applications/Spotify.app',
      gesture: 'peace',
      color: '#1db954',
      auraColor: '#ff1493'  // 深粉光圈，与绿色图标不同
    },
    {
      name: '音乐',
      path: '/System/Applications/Music.app',
      gesture: 'peace',
      color: '#fc3c44',
      auraColor: '#00ced1'  // 深青色光圈，与红色图标不同
    },
    {
      name: 'Slack',
      path: '/Applications/Slack.app',
      gesture: 'peace',
      color: '#4a154b',
      auraColor: '#ffd700'  // 金色光圈，与深紫图标不同
    },
    {
      name: '备忘录',
      path: '/System/Applications/Notes.app',
      gesture: 'peace',
      color: '#ffd43b',
      auraColor: '#4169e1'  // 皇家蓝光圈，与黄色图标不同
    },
    {
      name: '日历',
      path: '/System/Applications/Calendar.app',
      gesture: 'peace',
      color: '#ff3b30',
      auraColor: '#00fa9a'  // 春绿色光圈，与红色图标不同
    },
    {
      name: '系统设置',
      path: '/System/Applications/System Settings.app',
      gesture: 'peace',
      color: '#8e8e93',
      auraColor: '#ff6347'  // 番茄色光圈，与灰色图标不同
    },
    {
      name: 'Obsidian',
      path: '/Applications/Obsidian.app',
      gesture: 'peace',
      color: '#7c3aed',
      auraColor: '#ffd700'  // 金色光圈，与紫色图标不同
    },
    {
      name: '抖音',
      path: '/Applications/抖音.app',
      gesture: 'peace',
      color: '#ff0050',
      auraColor: '#00ced1'  // 深青色光圈，与玫红图标不同
    },
    {
      name: '计算器',
      path: '/System/Applications/Calculator.app',
      gesture: 'peace',
      color: '#ff9500',
      auraColor: '#9932cc'  // 深兰花紫，与橙色图标不同
    },
    {
      name: 'QuickTime',
      path: '/System/Applications/QuickTime Player.app',
      gesture: 'peace',
      color: '#34c759',
      auraColor: '#ff1493'  // 深粉光圈，与绿色图标不同
    },
    {
      name: '提醒事项',
      path: '/System/Applications/Reminders.app',
      gesture: 'peace',
      color: '#ff453a',
      auraColor: '#00fa9a'  // 春绿色光圈，与红色图标不同
    },
    {
      name: '播客',
      path: '/System/Applications/Podcasts.app',
      gesture: 'peace',
      color: '#9b59b6',
      auraColor: '#ffd700'  // 金色光圈，与紫色图标不同
    },
  ]
}
