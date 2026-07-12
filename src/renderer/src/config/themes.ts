// ==================== 视觉主题系统 ====================

export type ThemeId = 'deep_space' | 'cyberpunk' | 'minimal_white' | 'sunset' | 'ink' | 'retro80s'

export interface ThemeConfig {
  id: ThemeId
  name: string
  label: string         // UI 显示名
  hotkey: string        // 快捷键

  // 场景
  background: number       // 背景色 (hex)
  fogColor: number         // 雾色
  fogDensity: number       // 雾密度
  exposure: number         // 色调映射曝光

  // 后处理
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  aberration: number       // 色差强度
  grain: number            // 颗粒强度
  vignette: number         // 暗角强度
  gamma: number            // 伽马校正

  // 灯光
  ambientColor: number
  ambientIntensity: number
  pointLightColor: number
  pointLightIntensity: number

  // 氛围元素颜色
  starColor: { r: number; g: number; b: number }  // 星空颜色范围基准
  dustColor: { r: number; g: number; b: number }  // 尘埃颜色基准
  snowColor: number       // 雪花/飘浮粒子颜色
  snowOpacity: number
  beamColorA: [number, number, number]  // 光柱渐变起点
  beamColorB: [number, number, number]  // 光柱渐变终点
  groundRingColor: number
  auroraColorA: [number, number, number]  // 极光颜色 A
  auroraColorB: [number, number, number]  // 极光颜色 B

  // 氛围元素开关
  showStars: boolean
  showDust: boolean
  showSnow: boolean
  showBeam: boolean
  showGroundRing: boolean
  showAurora: boolean

  // UI 主色
  uiAccent: string
}

export const THEMES: ThemeConfig[] = [
  // 1. 深空 — 当前默认风格
  {
    id: 'deep_space',
    name: 'Deep Space',
    label: '深空',
    hotkey: '5',
    background: 0x000511,
    fogColor: 0x000511,
    fogDensity: 0.00008,
    exposure: 0.85,
    bloomStrength: 0.45,
    bloomRadius: 0.8,
    bloomThreshold: 0.25,
    aberration: 0.0012,
    grain: 0.02,
    vignette: 0.55,
    gamma: 0.97,
    ambientColor: 0x112244,
    ambientIntensity: 1.5,
    pointLightColor: 0xffaa44,
    pointLightIntensity: 30,
    starColor: { r: 0.7, g: 0.7, b: 0.85 },
    dustColor: { r: 0.25, g: 0.4, b: 0.5 },
    snowColor: 0xffffff,
    snowOpacity: 0.4,
    beamColorA: [1.0, 0.85, 0.5],
    beamColorB: [1.0, 0.95, 0.75],
    groundRingColor: 0x2244aa,
    auroraColorA: [0.1, 0.4, 0.8],
    auroraColorB: [0.2, 0.8, 0.4],
    showStars: true,
    showDust: true,
    showSnow: true,
    showBeam: true,
    showGroundRing: true,
    showAurora: true,
    uiAccent: '#66ffcc'
  },

  // 2. 赛博朋克 — 霓虹紫粉 + 强烈色差
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    label: '赛博朋克',
    hotkey: '6',
    background: 0x0a0015,
    fogColor: 0x1a0028,
    fogDensity: 0.00012,
    exposure: 0.95,
    bloomStrength: 0.85,
    bloomRadius: 1.0,
    bloomThreshold: 0.2,
    aberration: 0.004,
    grain: 0.05,
    vignette: 0.7,
    gamma: 0.95,
    ambientColor: 0x2a0040,
    ambientIntensity: 1.2,
    pointLightColor: 0x00ffff,
    pointLightIntensity: 40,
    starColor: { r: 0.9, g: 0.3, b: 0.9 },
    dustColor: { r: 0.6, g: 0.2, b: 0.5 },
    snowColor: 0xff44ff,
    snowOpacity: 0.3,
    beamColorA: [1.0, 0.2, 0.8],
    beamColorB: [0.2, 0.9, 1.0],
    groundRingColor: 0xff00aa,
    auroraColorA: [0.8, 0.0, 0.6],
    auroraColorB: [0.0, 0.8, 1.0],
    showStars: true,
    showDust: true,
    showSnow: true,
    showBeam: true,
    showGroundRing: true,
    showAurora: true,
    uiAccent: '#ff44ff'
  },

  // 3. 极简白 — 干净明亮
  {
    id: 'minimal_white',
    name: 'Minimal White',
    label: '极简白',
    hotkey: '7',
    background: 0xf5f5f7,
    fogColor: 0xf5f5f7,
    fogDensity: 0.00003,
    exposure: 1.15,
    bloomStrength: 0.15,
    bloomRadius: 0.4,
    bloomThreshold: 0.6,
    aberration: 0.0,
    grain: 0.0,
    vignette: 0.2,
    gamma: 1.0,
    ambientColor: 0xffffff,
    ambientIntensity: 2.0,
    pointLightColor: 0xffffff,
    pointLightIntensity: 15,
    starColor: { r: 0.8, g: 0.8, b: 0.85 },
    dustColor: { r: 0.7, g: 0.7, b: 0.75 },
    snowColor: 0xaaaacc,
    snowOpacity: 0.15,
    beamColorA: [0.9, 0.9, 1.0],
    beamColorB: [1.0, 1.0, 1.0],
    groundRingColor: 0x99aabb,
    auroraColorA: [0.7, 0.8, 0.9],
    auroraColorB: [0.8, 0.9, 0.95],
    showStars: false,
    showDust: false,
    showSnow: false,
    showBeam: false,
    showGroundRing: true,
    showAurora: false,
    uiAccent: '#4488ff'
  },

  // 4. 日落暖调 — 暖橙金
  {
    id: 'sunset',
    name: 'Sunset',
    label: '日落暖调',
    hotkey: '8',
    background: 0x1a0a05,
    fogColor: 0x2a1208,
    fogDensity: 0.0001,
    exposure: 0.9,
    bloomStrength: 0.6,
    bloomRadius: 0.9,
    bloomThreshold: 0.22,
    aberration: 0.001,
    grain: 0.03,
    vignette: 0.5,
    gamma: 0.98,
    ambientColor: 0x3a1a08,
    ambientIntensity: 1.3,
    pointLightColor: 0xff8800,
    pointLightIntensity: 35,
    starColor: { r: 0.9, g: 0.7, b: 0.5 },
    dustColor: { r: 0.5, g: 0.3, b: 0.15 },
    snowColor: 0xffaa66,
    snowOpacity: 0.25,
    beamColorA: [1.0, 0.6, 0.2],
    beamColorB: [1.0, 0.85, 0.5],
    groundRingColor: 0xcc6600,
    auroraColorA: [0.9, 0.4, 0.1],
    auroraColorB: [0.8, 0.2, 0.3],
    showStars: true,
    showDust: true,
    showSnow: true,
    showBeam: true,
    showGroundRing: true,
    showAurora: true,
    uiAccent: '#ff9944'
  },

  // 5. 水墨 — 黑白宣纸
  {
    id: 'ink',
    name: 'Ink Wash',
    label: '水墨',
    hotkey: '9',
    background: 0xf8f6f0,
    fogColor: 0xf8f6f0,
    fogDensity: 0.00004,
    exposure: 1.05,
    bloomStrength: 0.1,
    bloomRadius: 0.3,
    bloomThreshold: 0.5,
    aberration: 0.0,
    grain: 0.01,
    vignette: 0.3,
    gamma: 1.0,
    ambientColor: 0xddd8cc,
    ambientIntensity: 1.8,
    pointLightColor: 0xeeeeee,
    pointLightIntensity: 10,
    starColor: { r: 0.5, g: 0.48, b: 0.45 },
    dustColor: { r: 0.4, g: 0.38, b: 0.35 },
    snowColor: 0x666666,
    snowOpacity: 0.2,
    beamColorA: [0.3, 0.28, 0.25],
    beamColorB: [0.6, 0.58, 0.55],
    groundRingColor: 0x555555,
    auroraColorA: [0.3, 0.28, 0.25],
    auroraColorB: [0.5, 0.48, 0.45],
    showStars: false,
    showDust: true,
    showSnow: true,
    showBeam: false,
    showGroundRing: true,
    showAurora: false,
    uiAccent: '#333333'
  },

  // 6. 复古80s — 紫粉霓虹 + 透视网格
  {
    id: 'retro80s',
    name: 'Retro 80s',
    label: '复古80s',
    hotkey: '0',
    background: 0x1a0033,
    fogColor: 0x2a0050,
    fogDensity: 0.0001,
    exposure: 0.92,
    bloomStrength: 0.75,
    bloomRadius: 1.1,
    bloomThreshold: 0.2,
    aberration: 0.003,
    grain: 0.04,
    vignette: 0.65,
    gamma: 0.96,
    ambientColor: 0x330044,
    ambientIntensity: 1.4,
    pointLightColor: 0x00ddff,
    pointLightIntensity: 38,
    starColor: { r: 0.8, g: 0.4, b: 1.0 },
    dustColor: { r: 0.5, g: 0.3, b: 0.7 },
    snowColor: 0xff66cc,
    snowOpacity: 0.3,
    beamColorA: [1.0, 0.3, 0.9],
    beamColorB: [0.3, 0.7, 1.0],
    groundRingColor: 0xff00ff,
    auroraColorA: [0.6, 0.0, 0.8],
    auroraColorB: [0.0, 0.6, 1.0],
    showStars: true,
    showDust: true,
    showSnow: true,
    showBeam: true,
    showGroundRing: true,
    showAurora: true,
    uiAccent: '#ff66cc'
  },
]

export function getThemeById(id: ThemeId): ThemeConfig {
  return THEMES.find(t => t.id === id) || THEMES[0]
}
