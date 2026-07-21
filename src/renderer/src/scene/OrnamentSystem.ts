import * as THREE from 'three'
import gsap from 'gsap'
import { appConfig, AppEntry } from '../config/appConfig'
import { AudioManager } from './AudioManager'
import { ParticleShape } from './ParticleSystem'

interface Ornament {
  mesh: THREE.Group
  bubbleMesh: THREE.Mesh
  iconSprite: THREE.Sprite
  ringMesh: THREE.Mesh
  outerRing: THREE.Mesh
  darkMask: THREE.Mesh        // 暗角遮罩：饰品背后的深色圆盘，让饰品从粒子中凸显
  whiteRing: THREE.Mesh       // 白色描边环：增强饰品的视觉边界
  glowSprite: THREE.Sprite    // 柔和外光晕
  labelSprite: THREE.Sprite   // 应用名称标签
  trailPoints: THREE.Points   // 粒子尾迹
  trailPositions: Float32Array // 尾迹位置数据
  trailIndex: number           // 尾迹写入位置（循环缓冲）
  ringSpeed: number            // 内环旋转速度（独立）
  outerRingSpeed: number       // 外环旋转速度（独立）
  whiteRingSpeed: number       // 白色描边环旋转速度（独立）
  ringAxis: THREE.Vector3      // 内环旋转轴（独立）
  outerRingAxis: THREE.Vector3 // 外环旋转轴（独立）
  whiteRingAxis: THREE.Vector3 // 白色描边环旋转轴（独立）
  app: AppEntry
  basePosition: THREE.Vector3
  hovered: boolean
  hoverProgress: number
  originalColor: THREE.Color
  cooldownUntil: number
  selected: boolean
  selectedProgress: number
  positionAnimating: boolean  // 防止 update() 覆盖 gsap 的 position 动画
}

const GESTURE_NAMES: Record<string, string> = {
  'fist': '握拳',
  'open_palm': '张开手掌',
  'peace': '比耶',
  'point': '食指',
  'pinch': '捏合'
}

const APP_ICONS: Record<string, string> = {
  '代码编辑器': 'VS',
  '终端': '⟩_',
  '谷歌浏览器': '🌐',
  '访达': '📁',
  'Safari浏览器': '🧭',
  '照片': '🖼',
  'Spotify': '♫',
  '音乐': '♪',
  'Slack': '💬',
  '备忘录': '📝',
  '日历': '📅',
  '系统设置': '⚙',
  '微信': '💬',
  'QQ': '🐧',
  '邮件': '✉',
  '地图': '🗺',
  '计算器': '🔢',
  '商店': '🛒',
  '视频': '▶',
  '浏览器': '🌐',
  '词典': '📖',
  '翻译': '🌍',
  '天气': '⛅',
  '时钟': '🕐',
  '提示': '💡',
}

// 星座类型
export type ConstellationType = 
  | 'realistic'  // 真实星空 - 多个星座同时存在
  | 'bigDipper'  // 北斗七星
  | 'leo'        // 狮子座
  | 'andromeda'  // 仙女座
  | 'orion'      // 猎户座
  | 'scorpius'   // 天蝎座
  | 'cassiopeia' // 仙后座
  | 'cygnus'     // 天鹅座
  | 'ursaMinor'  // 小熊座
  | 'gemini'     // 双子座
  | 'taurus'     // 金牛座
  | 'auriga'     // 御夫座
  | 'singleRing' // 单个环 - 所有星球排成一个环
  | 'doubleRing' // 双环交叉 - 两组星球形成60度夹角

// 星座信息
export const CONSTELLATION_INFO: Record<ConstellationType, { name: string; color: number; starCount: number }> = {
  realistic: { name: '真实星空', color: 0x88ccff, starCount: 36 },
  bigDipper: { name: '北斗七星', color: 0xffd700, starCount: 7 },
  leo: { name: '狮子座', color: 0xff8800, starCount: 7 },
  andromeda: { name: '仙女座', color: 0xaa66ff, starCount: 7 },
  orion: { name: '猎户座', color: 0x00ffff, starCount: 7 },
  scorpius: { name: '天蝎座', color: 0xff4444, starCount: 8 },
  cassiopeia: { name: '仙后座', color: 0xff66aa, starCount: 5 },
  cygnus: { name: '天鹅座', color: 0x66aaff, starCount: 6 },
  ursaMinor: { name: '小熊座', color: 0x66ffaa, starCount: 7 },
  gemini: { name: '双子座', color: 0xffaa66, starCount: 8 },
  taurus: { name: '金牛座', color: 0xffcc66, starCount: 7 },
  auriga: { name: '御夫座', color: 0x66ffcc, starCount: 6 },
  singleRing: { name: '单环旋转', color: 0xff66ff, starCount: 36 },
  doubleRing: { name: '双环交叉', color: 0x66ffff, starCount: 36 }
}

export class OrnamentSystem {
  private scene: THREE.Scene
  private audio: AudioManager
  private ornaments: Ornament[] = []
  private selectedOrnament: Ornament | null = null
  private time = 0
  // 预建的射线碰撞球（避免每次 raycast 都 new 几何体导致内存泄漏）
  private raycastSpheres: THREE.Mesh[] = []
  private raycastGeometry: THREE.SphereGeometry
  private raycastMaterial: THREE.MeshBasicMaterial
  // 星座连线
  private constellationLines: THREE.LineSegments | null = null
  private currentShape: ParticleShape = 'galaxy'
  private currentConstellation: ConstellationType = 'realistic'
  // 拖动功能 - 拖动整个星座
  private draggedConstellationIndices: number[] = []
  private dragPlane: THREE.Plane = new THREE.Plane()
  private dragStartPositions: Map<number, THREE.Vector3> = new Map()
  private isDragging = false
  private dragStartPoint: THREE.Vector3 = new THREE.Vector3()  // 拖动起始点（用于计算偏移）
  private dragCurrentPoint: THREE.Vector3 = new THREE.Vector3() // 当前拖动点
  // 星座分组定义
  private readonly CONSTELLATION_GROUPS = [
    { name: 'bigDipper', indices: [0, 1, 2, 3, 4, 5, 6] },      // 北斗七星
    { name: 'leo', indices: [7, 8, 9, 10, 11, 12, 13] },         // 狮子座
    { name: 'andromeda', indices: [14, 15, 16, 17, 18, 19, 20] }, // 仙女座
    { name: 'orion', indices: [21, 22, 23, 24, 25, 26, 27] },     // 猎户座
    { name: 'scorpius', indices: [28, 29, 30, 31, 32, 33, 34, 35] } // 天蝎座
  ]
  // 标签显示模式：'hidden' = 隐藏, 'hover' = 悬停显示, 'always' = 一直显示
  private labelDisplayMode: 'hidden' | 'hover' | 'always' = 'hover'
  // 星座连线显示状态
  private constellationLinesVisible = true
  // 鼠标点击选中的星球（与 hover 不同：点击后会"锁定"，即使光标移开仍然保持选中）
  private clickedOrnament: Ornament | null = null
  // 环模式旋转角度
  private ringRotationAngle = 0

  constructor(scene: THREE.Scene, audio: AudioManager) {
    this.scene = scene
    this.audio = audio
    this.raycastGeometry = new THREE.SphereGeometry(0.8, 16, 16)
    this.raycastMaterial = new THREE.MeshBasicMaterial({ visible: false })
    this.createOrnaments()
    this.createRaycastSpheres()
    // 在所有模式下都显示星座连线（如果星球数量足够）
    if (this.ornaments.length >= 36) {
      this.createConstellationLines()
    }
  }

  private createRaycastSpheres() {
    for (let i = 0; i < this.ornaments.length; i++) {
      const sphere = new THREE.Mesh(this.raycastGeometry, this.raycastMaterial)
      sphere.userData = { appName: this.ornaments[i].app.name, ornamentIndex: i }
      this.raycastSpheres.push(sphere)
      this.scene.add(sphere)
    }
  }

  private createIconTexture(appName: string, color: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!

    const r = 24
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(128 - r, 0)
    ctx.quadraticCurveTo(128, 0, 128, r)
    ctx.lineTo(128, 128 - r)
    ctx.quadraticCurveTo(128, 128, 128 - r, 128)
    ctx.lineTo(r, 128)
    ctx.quadraticCurveTo(0, 128, 0, 128 - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 128, 128)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, this.darkenColor(color, 0.35))
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(128 - r, 0)
    ctx.quadraticCurveTo(128, 0, 128, r)
    ctx.lineTo(128, 56)
    ctx.lineTo(0, 56)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()
    const highlight = ctx.createLinearGradient(0, 0, 0, 56)
    highlight.addColorStop(0, 'rgba(255,255,255,0.35)')
    highlight.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = highlight
    ctx.fill()

    const icon = APP_ICONS[appName] || appName.charAt(0)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (icon.length <= 2 && /[\u{1F000}-\u{1FFFF}]/u.test(icon)) {
      ctx.font = '68px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.fillText(icon, 64, 66)
    } else {
      ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2
      ctx.fillText(icon, 64, 66)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  private darkenColor(hex: string, amount: number): string {
    const c = new THREE.Color(hex)
    c.multiplyScalar(1 - amount)
    return '#' + c.getHexString()
  }

  // 创建径向渐变光晕纹理
  private createGlowTexture(color: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const c = new THREE.Color(color)
    const r = Math.floor(c.r * 255)
    const g = Math.floor(c.g * 255)
    const b = Math.floor(c.b * 255)

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0,   `rgba(${r},${g},${b},1.0)`)
    gradient.addColorStop(0.2, `rgba(${r},${g},${b},0.6)`)
    gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.2)`)
    gradient.addColorStop(1,   `rgba(${r},${g},${b},0.0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  // 创建应用名称标签纹理
  private createLabelTexture(appName: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    
    // 清除画布
    ctx.clearRect(0, 0, 256, 64)
    
    // 绘制文字
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // 添加文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 1
    
    ctx.fillText(appName, 128, 32)
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  // 创建星球着色器材质 - 基于用户提供的精美星球效果
  private createPlanetMaterial(iconColor: string, auraColor: THREE.Color): THREE.ShaderMaterial {
    const baseColor = new THREE.Color(iconColor)

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: baseColor },
        uAuraColor: { value: auraColor },
        uLightDir: { value: new THREE.Vector3(0.6, 0.7, 0.9).normalize() },
        uHoverGlow: { value: 0 }  // hover 时的发光强度（0=不发光，1=满发光）
      },
      vertexShader: `
        varying vec3 vNrm;
        varying vec3 vWorldPos;
        varying vec2 vTexCoord;
        varying vec3 vViewDir;
        
        void main() {
          vTexCoord = uv;
          vNrm = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - vWorldPos);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        precision highp float;
        
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uAuraColor;
        uniform vec3 uLightDir;
        uniform float uHoverGlow;
        
        varying vec3 vNrm;
        varying vec3 vWorldPos;
        varying vec2 vTexCoord;
        varying vec3 vViewDir;
        
        // 噪声函数
        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p *= 2.1;
            a *= 0.5;
          }
          return v;
        }
        
        void main() {
          vec2 uv = vTexCoord;
          float lat = uv.y;
          float lng = uv.x;
          
          // 动态云层
          float n1 = fbm(vec2(lng * 4.0 + uTime * 0.02, lat * 8.0));
          float n2 = fbm(vec2(lng * 6.0 - uTime * 0.015, lat * 12.0 + 5.0));
          float turbulence = fbm(vec2(lng * 3.0 + n1, lat * 10.0 + n2)) * 0.5 + 0.5;
          
          // 基础颜色 - 使用应用的颜色
          vec3 col = uBaseColor;
          
          // 添加云层纹理
          col = mix(col, col * 1.3, n1 * 0.4);
          col = mix(col, col * 0.8, n2 * 0.3);
          
          // 极地效果
          if (lat < 0.15 || lat > 0.85) {
            float polarPhase = lat < 0.15 ? lat / 0.15 : (1.0 - lat) / 0.15;
            col = mix(col, uAuraColor, (1.0 - polarPhase) * 0.5);
          }
          
          // 光照
          vec3 N = normalize(vNrm);
          vec3 L = normalize(uLightDir);
          vec3 V = normalize(vViewDir);
          vec3 H = normalize(L + V);
          
          float NdotL = max(dot(N, L), 0.0);
          float halfLambert = NdotL * 0.3 + 0.7;
          
          float NdotH = max(dot(N, H), 0.0);
          float specular = pow(NdotH, 32.0) * 0.3;
          
          col = col * halfLambert + vec3(1.0) * specular;
          
          // 菲涅尔边缘发光
          float NdotV = max(dot(N, V), 0.0);
          float fresnel = pow(1.0 - NdotV, 3.0);
          col += uAuraColor * fresnel * 0.8;
          
          // 粒子点效果
          vec3 wp = vWorldPos;
          float pointSize = 0.05;
          vec3 cellId = floor(wp / pointSize);
          float cellRand = hash21(cellId.xy + cellId.z * 17.3);
          vec3 cellCenter = (cellId + cellRand) * pointSize;
          float distToDot = length(wp - cellCenter);
          float dotRadius = pointSize * (0.35 + cellRand * 0.1);
          float dotCore = 1.0 - smoothstep(0.0, dotRadius, distToDot);
          float dotGlow = exp(-distToDot * distToDot / (dotRadius * dotRadius * 0.25));
          
          vec3 dotColor = col * (0.9 + cellRand * 0.1);
          col = mix(col * 0.15, dotColor, dotCore + dotGlow * 0.3);

          // hover 时的整体发光（淡淡一闪一闪）
          col += uAuraColor * uHoverGlow * 0.6;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false
    })
  }

  private createOrnaments() {
    // 12 个饰品位置：3 层深度（前/中/后），让饰品嵌入粒子云不同深度形成立体组合
    // 后层 z≈-1.2：嵌入粒子云深处（暗角遮罩压暗周围粒子让饰品凸显）
    // 中层 z≈ 0.4：粒子云中部
    // 前层 z≈ 1.8：靠近相机，浮在粒子前
    const positions = [
      // 后层（粒子云深处）
      new THREE.Vector3(-1.8,  0.9, -1.2),
      new THREE.Vector3( 0.5,  1.2, -1.0),
      new THREE.Vector3( 1.7, -0.4, -1.3),
      new THREE.Vector3(-0.6, -1.0, -1.1),
      // 中层（粒子云中部）
      new THREE.Vector3( 1.9,  0.8,  0.4),
      new THREE.Vector3(-1.9, -0.3,  0.5),
      new THREE.Vector3(-0.4,  0.4,  0.3),
      new THREE.Vector3( 0.8, -1.3,  0.4),
      // 前层（靠近相机）
      new THREE.Vector3(-1.5,  1.5,  1.7),
      new THREE.Vector3( 1.5,  1.4,  1.8),
      new THREE.Vector3(-0.7, -1.6,  1.8),
      new THREE.Vector3( 0.6, -0.2,  2.0)
    ]

    // 第一步：计算所有星球的大小（按软件大小显著差异比例调整）
    // 大软件（如 Chrome/Docker）→ 大星球；小软件（如 截图/字体册）→ 小星球
    const planetSizes: number[] = []
    appConfig.apps.forEach((app) => {
      const baseSize = 0.22
      // 缺失 fileSize 时按应用类型给默认估算（字节）
      let fileSize = app.fileSize || 0
      if (!fileSize) {
        const name = app.name
        // 大型软件（IDE/浏览器/容器）
        if (/代码编辑器|Cursor|Chrome|Docker|Safari浏览器|照片|WPS/.test(name)) fileSize = 800 * 1024 * 1024
        // 中型软件（音乐/聊天/邮件/地图/天气）
        else if (/Spotify|音乐|邮件|地图|天气|预览|通讯录|信息/.test(name)) fileSize = 200 * 1024 * 1024
        // 小型工具
        else fileSize = 30 * 1024 * 1024
      }
      // 1MB ~ 1GB 范围
      const minSize = 1024 * 1024
      const maxSize = 1024 * 1024 * 1024
      const clampedSize = Math.max(minSize, Math.min(maxSize, fileSize))
      const logRatio = (Math.log(clampedSize) - Math.log(minSize)) / (Math.log(maxSize) - Math.log(minSize))
      // 差异比例加强：0.5x ~ 2.6x（最大是最小的 5.2 倍，明显可见）
      const sizeScale = 0.5 + logRatio * 2.1
      planetSizes.push(baseSize * sizeScale)
    })

    // 第二步：使用力导向算法调整位置，确保星球不重叠
    // 最外环半径约为 planetSize * 2.8，需要保持至少 0.3 的间隙
    const adjustedPositions = this.adjustPositionsForSpacing(positions, planetSizes, 0.5)  // 形态模式间距适中

    appConfig.apps.forEach((app, index) => {
      const pos = adjustedPositions[index % adjustedPositions.length].clone()
      const color = new THREE.Color(app.color)
      const planetSize = planetSizes[index]

      const group = new THREE.Group()
      group.position.copy(pos)
      group.userData = { appIndex: index, appName: app.name }

      // 光球和光环使用每个应用独特的auraColor，与图标颜色不同
      const auraColor = new THREE.Color(app.auraColor || '#cce5ff')  // 使用配置的光圈颜色
      const auraEmissive = auraColor.clone().multiplyScalar(0.8)  // 发光颜色略深
      
      // 气泡主体 - 使用新的星球着色器效果
      const bubbleGeo = new THREE.SphereGeometry(planetSize, 64, 64)
      const bubbleMat = this.createPlanetMaterial(app.color, auraColor)
      const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat)
      bubbleMesh.renderOrder = 0
      group.add(bubbleMesh)

      // 图标 - 放大1.8倍更清晰，保持原图标颜色
      const iconTexture = this.createIconTexture(app.name, app.color)
      const iconMat = new THREE.SpriteMaterial({
        map: iconTexture,
        transparent: true,
        opacity: 1.0,  // 完全不透明更清晰
        depthWrite: false
      })
      const iconSprite = new THREE.Sprite(iconMat)
      iconSprite.scale.set(planetSize * 1.8, planetSize * 1.8, 1)  // 图标放大1.8倍
      iconSprite.renderOrder = 10
      group.add(iconSprite)

      // 内环 - 加强亮度，使用淡蓝色（与图标颜色不同）
      const ringGeo = new THREE.TorusGeometry(planetSize * 1.14, planetSize * 0.09, 16, 64)
      const ringMat = new THREE.MeshStandardMaterial({
        color: auraColor,  // 浅淡的淡蓝色
        roughness: 0.15,
        metalness: 0.9,
        emissive: auraEmissive,  // 发光颜色
        emissiveIntensity: 0.8,  // 增加内环亮度
        transparent: true,
        opacity: 0.6
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      group.add(ringMesh)

      // 外环 - 减弱亮度，使用淡蓝色（与图标颜色不同）
      const outerRingGeo = new THREE.TorusGeometry(planetSize * 1.86, planetSize * 0.064, 16, 100)
      const outerRingMat = new THREE.MeshStandardMaterial({
        color: auraColor,  // 浅淡的淡蓝色
        roughness: 0.05,
        metalness: 1.0,
        emissive: auraEmissive,  // 淡蓝色发光
        emissiveIntensity: 0.12,  // 减弱发光
        transparent: true,
        opacity: 0.12
      })
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat)
      outerRing.rotation.x = Math.PI * 0.4
      group.add(outerRing)

      // 白色描边环 - 微弱显示
      const whiteRingGeo = new THREE.RingGeometry(planetSize * 1.93, planetSize * 2.07, 64)
      const whiteRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,  // 降低不透明度
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const whiteRing = new THREE.Mesh(whiteRingGeo, whiteRingMat)
      whiteRing.position.z = 0.02
      group.add(whiteRing)

      // 暗角遮罩 - 微弱显示
      const darkMaskGeo = new THREE.CircleGeometry(planetSize * 2.68, 64)
      const darkMaskMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.2,  // 降低不透明度
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const darkMask = new THREE.Mesh(darkMaskGeo, darkMaskMat)
      darkMask.position.z = -0.1
      group.add(darkMask)

      // 柔和外光晕 - 极弱发光
      const glowTexture = this.createGlowTexture(app.color)
      const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const glowSprite = new THREE.Sprite(glowMat)
      glowSprite.scale.set(1.5, 1.5, 1)
      glowSprite.position.z = -0.2
      glowSprite.renderOrder = -1
      group.add(glowSprite)

      // 应用名称标签 - 悬停时显示
      const labelTexture = this.createLabelTexture(app.name)
      const labelMat = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0,  // 默认隐藏
        depthWrite: false
      })
      const labelSprite = new THREE.Sprite(labelMat)
      labelSprite.scale.set(planetSize * 3, planetSize * 0.75, 1)
      labelSprite.position.y = -planetSize * 2.5  // 放在星球下方
      labelSprite.renderOrder = 20
      group.add(labelSprite)

      // 粒子尾迹：禁用，避免在空白处产生杂乱的虚线
      const trailPositions = new Float32Array(0)
      const trailAlphas = new Float32Array(0)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      trailGeo.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlphas, 1))
      const trailMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xffffff) },
          uPixelRatio: { value: 1 }
        },
        vertexShader: `void main() { gl_Position = vec4(0.0); gl_PointSize = 0.0; }`,
        fragmentShader: `void main() { discard; }`,
        transparent: true
      })
      const trailPoints = new THREE.Points(trailGeo, trailMat)
      trailPoints.frustumCulled = false
      this.scene.add(trailPoints)

      // 独立旋转参数：每个星球都不一样（三个环完全独立，不规则旋转）
      const ringSpeed = (Math.random() * 1.5 + 0.2) * (Math.random() < 0.5 ? 1 : -1)
      const outerRingSpeed = (Math.random() * 2.0 + 0.1) * (Math.random() < 0.5 ? 1 : -1)
      const whiteRingSpeed = (Math.random() * 1.8 + 0.05) * (Math.random() < 0.5 ? 1 : -1)
      const ringAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()
      const outerRingAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()
      const whiteRingAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()

      this.scene.add(group)

      this.ornaments.push({
        mesh: group,
        bubbleMesh,
        iconSprite,
        ringMesh,
        outerRing,
        darkMask,
        whiteRing,
        glowSprite,
        labelSprite,
        trailPoints,
        trailPositions,
        trailIndex: 0,
        ringSpeed,
        outerRingSpeed,
        whiteRingSpeed,
        ringAxis,
        outerRingAxis,
        whiteRingAxis,
        app,
        basePosition: pos.clone(),
        hovered: false,
        hoverProgress: 0,
        originalColor: color.clone(),
        cooldownUntil: 0,
        selected: false,
        selectedProgress: 0,
        positionAnimating: false
      })
    })
  }

  // 使用力导向算法调整位置，确保星球最外环不碰在一起
  // minGap: 最外环之间的最小间隙
  private adjustPositionsForSpacing(
    positions: THREE.Vector3[],
    planetSizes: number[],
    minGap: number = 0.3
  ): THREE.Vector3[] {
    const adjustedPositions = positions.map(p => p.clone())
    const n = Math.min(adjustedPositions.length, planetSizes.length)
    const maxIterations = 50
    const repulsionStrength = 0.05

    for (let iter = 0; iter < maxIterations; iter++) {
      let moved = false

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const pos1 = adjustedPositions[i]
          const pos2 = adjustedPositions[j]
          const size1 = planetSizes[i]
          const size2 = planetSizes[j]

          // 计算最外环半径（约为星球大小的 2.8 倍）
          const outerRing1 = size1 * 2.8
          const outerRing2 = size2 * 2.8

          // 计算当前距离
          const diff = new THREE.Vector3().subVectors(pos2, pos1)
          const dist = diff.length()

          // 所需最小距离 = 两个最外环半径 + 最小间隙
          const requiredDist = outerRing1 + outerRing2 + minGap

          if (dist < requiredDist && dist > 0.001) {
            // 需要推开
            const overlap = requiredDist - dist
            const pushVector = diff.normalize().multiplyScalar(overlap * repulsionStrength)

            // 大星球移动少一点，小星球移动多一点
            const totalSize = size1 + size2
            const ratio1 = size2 / totalSize // 小星球移动更多
            const ratio2 = size1 / totalSize

            adjustedPositions[i].sub(pushVector.clone().multiplyScalar(ratio1))
            adjustedPositions[j].add(pushVector.clone().multiplyScalar(ratio2))
            moved = true
          }
        }
      }

      if (!moved) break // 没有移动了，提前结束
    }

    return adjustedPositions
  }

  // 根据粒子形态生成 36 个饰品位置（360度球面分布，支持星座图案）
  // spherical: 球面分布（斐波那契球）- 360度全方位
  // constellation: 星座模式（北斗七星、狮子座、仙女座等）
  // flat:      扁平盘面（旋臂分布，配合星系/云海）
  // conical:   锥形（上窄下宽，配合树/火焰/龙卷风）
  // cylindrical: 圆柱面（等高度环绕，配合立方体/DNA/瀑布）
  private getOrnamentPositionsForShape(shape: ParticleShape): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const N = 36
    const scale = 2.5 // 半径放大，扩大星际空间

    // 形态 → 布局类型映射
    const layoutMap: Record<string, 'spherical' | 'constellation' | 'flat' | 'conical' | 'cylindrical'> = {
      // 球面类 - 360度全方位分布
      'sphere': 'spherical', 'energy_orb': 'spherical', 'blackhole': 'spherical',
      'wormhole': 'spherical', 'star5': 'spherical', 'infinity': 'spherical',
      'heart': 'spherical', 'pyramid': 'spherical', 'kaleidoscope': 'spherical', 'firework': 'spherical',
      // 星座类 - 可识别星座图案
      'galaxy': 'constellation', 'spiral_galaxy': 'constellation',
      // 盘面类
      'cloud': 'flat', 'wave': 'flat', 'mountain': 'flat', 'vortex': 'flat', 
      'fish_school': 'flat', 'flower': 'flat',
      // 锥形类
      'christmas_tree': 'conical', 'flame': 'conical', 'tornado': 'conical',
      'jellyfish': 'conical', 'cherry_blossom': 'conical', 'lightning': 'conical',
      // 圆柱类
      'cube': 'cylindrical', 'dna': 'cylindrical', 'matrix_rain': 'cylindrical',
      'waterfall': 'cylindrical', 'butterfly': 'cylindrical', 'torus': 'cylindrical'
    }
    const layout = layoutMap[shape] || 'spherical'

    switch (layout) {
      case 'constellation': {
        // 星座模式：36个星球组成可识别的星座图案
        // 北斗七星 (0-6) + 狮子座 (7-13) + 仙女座 (14-20) + 猎户座 (21-27) + 天蝎座 (28-35)
        const r = 3.8 * scale
        
        // 北斗七星 - 勺子形状
        const bigDipper = [
          { x: -2.5, y: 1.2, z: 0.8 },  // 天枢
          { x: -1.8, y: 1.0, z: 0.9 },  // 天璇
          { x: -1.1, y: 0.8, z: 1.0 },  // 天玑
          { x: -0.4, y: 0.6, z: 1.1 },  // 天权
          { x: 0.2, y: 1.2, z: 0.9 },   // 玉衡
          { x: 0.8, y: 1.8, z: 0.7 },   // 开阳
          { x: 1.3, y: 2.3, z: 0.5 },   // 摇光
        ]
        for (let i = 0; i < 7; i++) {
          positions.push(new THREE.Vector3(
            bigDipper[i].x * scale,
            bigDipper[i].y * scale,
            bigDipper[i].z * scale + 1.5
          ))
        }
        
        // 狮子座 - 镰刀形状
        const leo = [
          { x: 2.0, y: -0.5, z: 1.5, r: 1.0 },   // 轩辕十四 (心脏)
          { x: 1.5, y: 0.2, z: 1.3, r: 0.8 },    // 轩辕十三
          { x: 1.0, y: 0.8, z: 1.1, r: 0.8 },    // 轩辕十二
          { x: 0.5, y: 1.2, z: 0.9, r: 0.8 },    // 轩辕十一
          { x: 0.0, y: 1.4, z: 0.7, r: 0.8 },    // 轩辕十
          { x: 2.8, y: -0.2, z: 1.2, r: 0.7 },   // 五帝座一
          { x: 2.5, y: -1.0, z: 1.4, r: 0.7 },   // 太微右垣
        ]
        for (let i = 0; i < 7; i++) {
          positions.push(new THREE.Vector3(
            leo[i].x * scale,
            leo[i].y * scale,
            leo[i].z * scale + 1.0
          ))
        }
        
        // 仙女座 - V形 + 链条
        const andromeda = [
          { x: -3.0, y: -1.5, z: 0.5 },   // 壁宿二
          { x: -2.2, y: -1.8, z: 0.7 },   // 奎宿九
          { x: -1.4, y: -1.6, z: 0.9 },   // 天大将军一
          { x: -0.8, y: -1.2, z: 1.1 },   // 天大将军二
          { x: -0.3, y: -0.8, z: 1.3 },   // 天大将军三
          { x: 0.2, y: -0.4, z: 1.5 },    // 天大将军四
          { x: 0.7, y: 0.0, z: 1.7 },     // 天大将军五
        ]
        for (let i = 0; i < 7; i++) {
          positions.push(new THREE.Vector3(
            andromeda[i].x * scale,
            andromeda[i].y * scale,
            andromeda[i].z * scale + 0.5
          ))
        }
        
        // 猎户座 - 沙漏形状
        const orion = [
          { x: 0.5, y: 2.5, z: 0.3 },     // 参宿四 (左上肩)
          { x: 2.0, y: 2.3, z: 0.2 },     // 参宿五 (右上肩)
          { x: 1.0, y: 1.8, z: 0.5 },     // 参宿六 (腰带左)
          { x: 1.3, y: 1.6, z: 0.6 },     // 参宿七 (腰带中)
          { x: 1.6, y: 1.4, z: 0.7 },     // 参宿八 (腰带右)
          { x: 0.8, y: 0.8, z: 1.0 },     // 参宿九 (左膝)
          { x: 2.2, y: 0.6, z: 1.1 },     // 参宿一 (右膝)
        ]
        for (let i = 0; i < 7; i++) {
          positions.push(new THREE.Vector3(
            orion[i].x * scale,
            orion[i].y * scale,
            orion[i].z * scale + 0.3
          ))
        }
        
        // 天蝎座 - 弧形尾巴
        const scorpius = [
          { x: -2.8, y: 2.0, z: -0.5 },   // 心宿二 (心脏)
          { x: -2.2, y: 1.5, z: -0.3 },   // 房宿四
          { x: -1.6, y: 1.0, z: -0.1 },   // 房宿三
          { x: -1.0, y: 0.5, z: 0.1 },    // 房宿二
          { x: -0.5, y: 0.0, z: 0.3 },    // 房宿一
          { x: -0.8, y: -0.8, z: 0.5 },   // 尾宿八
          { x: -1.5, y: -1.5, z: 0.7 },   // 尾宿五
          { x: -2.2, y: -2.2, z: 0.9 },   // 尾宿三
        ]
        for (let i = 0; i < 8 && positions.length < N; i++) {
          positions.push(new THREE.Vector3(
            scorpius[i].x * scale,
            scorpius[i].y * scale,
            scorpius[i].z * scale + 0.8
          ))
        }
        
        // 填充剩余位置（如果星座不够36个）
        while (positions.length < N) {
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          const radius = r * (0.8 + Math.random() * 0.4)
          positions.push(new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * radius,
            Math.sin(phi) * Math.sin(theta) * radius,
            Math.cos(phi) * radius * 0.5 + 0.5
          ))
        }
        break
      }
      case 'flat': {
        // 艺术星系：多条旋臂 + 中心亮星
        const arms = shape === 'spiral_galaxy' ? 6 : 5
        const centerCount = 3
        
        // 中心区域
        for (let i = 0; i < centerCount; i++) {
          const angle = (i / centerCount) * Math.PI * 2
          const r = 0.4 * scale
          positions.push(new THREE.Vector3(
            Math.cos(angle) * r,
            (Math.random() - 0.5) * 0.2,
            Math.sin(angle) * r * 0.7 + 0.5
          ))
        }
        
        // 旋臂上的饰品
        for (let i = centerCount; i < N; i++) {
          const armIdx = (i - centerCount) % arms
          const armPos = Math.floor((i - centerCount) / arms)
          const radius = (0.8 + armPos * 0.6) * scale
          const angle = (armIdx / arms) * Math.PI * 2 + radius * 0.7
          positions.push(new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle * 2) * 0.1 * scale,
            Math.sin(angle) * radius * 0.7 + 0.3
          ))
        }
        break
      }
      case 'conical': {
        // 艺术树形：动态金字塔分层
        const layers: { y: number; count: number; radius: number }[] = []
        let remaining = N
        const maxLayers = Math.ceil(Math.sqrt(N * 2))
        for (let l = 0; l < maxLayers && remaining > 0; l++) {
          const t = l / Math.max(maxLayers - 1, 1)
          const y = (2.5 - t * 4.5) * scale
          let count = Math.min(l + 1, remaining)
          if (l === maxLayers - 1) count = remaining
          const radius = (0.2 + t * 2.5) * scale
          layers.push({ y, count, radius })
          remaining -= count
        }
        let idx = 0
        for (const layer of layers) {
          for (let j = 0; j < layer.count && idx < N; j++) {
            const angle = (j / layer.count) * Math.PI * 2 + layer.y * 0.3
            positions.push(new THREE.Vector3(
              Math.cos(angle) * layer.radius,
              layer.y,
              Math.sin(angle) * layer.radius * 0.6 + 0.5
            ))
            idx++
          }
        }
        break
      }
      case 'cylindrical': {
        // 多螺旋：偶数/奇数交错螺旋
        for (let i = 0; i < N; i++) {
          const t = N > 1 ? i / (N - 1) : 0
          const y = (2.2 - t * 4.4) * scale
          const angle = t * Math.PI * 6 + (i % 3) * (Math.PI * 2 / 3)
          const radius = 2.0 * scale
          positions.push(new THREE.Vector3(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius * 0.7 + 0.5
          ))
        }
        break
      }
      case 'spherical':
      default: {
        // 360度全方位球面分布 - 斐波那契球算法
        // 真正的全球面均匀分布，从北极到南极全覆盖
        const r = 3.8 * scale
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        
        for (let i = 0; i < N; i++) {
          const t = (i + 0.5) / N  // +0.5 偏移避免极点聚集
          const y = 1 - t * 2      // y: +1（北极）→ -1（南极）
          const r2d = Math.sqrt(Math.max(0, 1 - y * y))  // 该纬度的圆半径
          const theta = goldenAngle * i
          
          positions.push(new THREE.Vector3(
            Math.cos(theta) * r2d * r,
            y * r,
            Math.sin(theta) * r2d * r * 0.8 + 0.5  // z 偏移让整体在视野中
          ))
        }
        break
      }
    }
    return positions
  }

  // 根据星座类型生成星球位置
  private getConstellationPositions(type: ConstellationType): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const N = 36
    const scale = 2.5
    const r = 3.8 * scale

    // 星座定义
    const constellations: Record<ConstellationType, { stars: { x: number; y: number; z: number }[]; color: number }> = {
      realistic: {
        // 真实星空 - 36个星球分成多个星座，像真实天文星空一样分布
        // 星座之间距离更近，星座内部星球间距适当像真实星空
        stars: (() => {
          const allStars: { x: number; y: number; z: number }[] = []
          const scale = 2.5
          // 更小的半径，让星座间距离更近
          const r = 2.8 * scale
          
          // 定义5个星座，共36颗星
          // 星座内部星球间距适当，像真实天文星空（0.8-1.2）
          const constellationPatterns = [
            // 北斗七星 - 勺子形状 (7颗) - 星球间距约 0.9-1.2
            {
              name: 'bigDipper',
              stars: [
                { x: -1.1, y: 0.5, z: 0 }, { x: -0.65, y: 0.38, z: 0.1 }, { x: -0.2, y: 0.28, z: 0.2 },
                { x: 0.3, y: 0.18, z: 0.3 }, { x: 0.65, y: 0.55, z: 0.2 }, { x: 1.05, y: 0.95, z: 0.1 }, { x: 1.45, y: 1.35, z: 0 }
              ]
            },
            // 狮子座 - 镰刀+三角形 (7颗) - 星球间距约 0.8-1.1
            {
              name: 'leo',
              stars: [
                { x: 1.0, y: 0, z: 0.5 }, { x: 0.6, y: 0.35, z: 0.4 }, { x: 0.2, y: 0.65, z: 0.3 },
                { x: -0.2, y: 0.75, z: 0.2 }, { x: -0.5, y: 0.6, z: 0.3 }, { x: 1.4, y: 0.1, z: 0.4 }, { x: 1.2, y: -0.5, z: 0.5 }
              ]
            },
            // 仙女座 - V形+链条 (7颗) - 星球间距约 0.8-1.0
            {
              name: 'andromeda',
              stars: [
                { x: -1.3, y: -0.6, z: 0.2 }, { x: -0.85, y: -0.85, z: 0.3 }, { x: -0.3, y: -0.7, z: 0.4 },
                { x: 0.1, y: -0.4, z: 0.5 }, { x: 0.4, y: -0.1, z: 0.6 }, { x: 0.7, y: 0.2, z: 0.7 }, { x: 1.0, y: 0.5, z: 0.8 }
              ]
            },
            // 猎户座 - 沙漏形状 (7颗) - 星球间距约 0.8-1.1
            {
              name: 'orion',
              stars: [
                { x: 0, y: 1.3, z: 0 }, { x: 1.0, y: 1.2, z: -0.1 }, { x: 0.3, y: 0.9, z: 0.2 },
                { x: 0.6, y: 0.8, z: 0.3 }, { x: 0.9, y: 0.6, z: 0.4 }, { x: 0.2, y: 0.2, z: 0.6 }, { x: 1.1, y: 0.1, z: 0.7 }
              ]
            },
            // 天蝎座 - 弯曲尾巴 (8颗) - 星球间距约 0.7-1.0
            {
              name: 'scorpius',
              stars: [
                { x: -1.3, y: -1.0, z: 0.3 }, { x: -0.9, y: -1.2, z: 0.4 }, { x: -0.5, y: -1.3, z: 0.5 },
                { x: -0.1, y: -1.2, z: 0.6 }, { x: 0.2, y: -1.0, z: 0.7 }, { x: 0.5, y: -0.7, z: 0.8 },
                { x: 0.8, y: -0.3, z: 0.9 }, { x: 1.1, y: 0.1, z: 1.0 }
              ]
            }
          ]
          
          // 使用斐波那契球算法分布5个星座中心点
          const goldenAngle = Math.PI * (3 - Math.sqrt(5))
          const centers: { x: number; y: number; z: number }[] = []
          
          for (let i = 0; i < 5; i++) {
            const t = (i + 0.5) / 5
            const y = 1 - t * 2  // y: +1 → -1
            const r2d = Math.sqrt(Math.max(0, 1 - y * y))
            const theta = goldenAngle * i
            
            centers.push({
              x: Math.cos(theta) * r2d * r,
              y: y * r * 0.8,  // 适中的Y轴范围
              z: Math.sin(theta) * r2d * r * 0.8
            })
          }
          
          // 将每个星座放置到对应的中心点位置
          for (let i = 0; i < 5 && allStars.length < 36; i++) {
            const center = centers[i]
            const pattern = constellationPatterns[i]
            
            for (const star of pattern.stars) {
              if (allStars.length >= 36) break
              allStars.push({
                x: center.x + star.x,
                y: center.y + star.y,
                z: center.z + star.z
              })
            }
          }
          
          return allStars
        })(),
        color: 0x88ccff
      },
      bigDipper: {
        // 北斗七星 - 勺子形状（居中放大）
        stars: [
          { x: -2.0, y: 0.8, z: 0.5 }, { x: -1.2, y: 0.6, z: 0.6 }, { x: -0.5, y: 0.4, z: 0.7 },
          { x: 0.2, y: 0.2, z: 0.8 }, { x: 0.8, y: 0.8, z: 0.6 }, { x: 1.4, y: 1.4, z: 0.4 }, { x: 1.9, y: 1.9, z: 0.2 }
        ],
        color: 0xffd700
      },
      leo: {
        // 狮子座 - 镰刀 + 三角形
        stars: [
          { x: 1.5, y: 0.0, z: 0.8 }, { x: 1.0, y: 0.6, z: 0.7 }, { x: 0.4, y: 1.0, z: 0.6 },
          { x: -0.2, y: 1.2, z: 0.5 }, { x: -0.6, y: 1.0, z: 0.6 }, { x: 2.2, y: 0.2, z: 0.7 }, { x: 1.8, y: -0.6, z: 0.9 }
        ],
        color: 0xff8800
      },
      andromeda: {
        // 仙女座 - V形 + 链条
        stars: [
          { x: -2.0, y: -1.0, z: 0.4 }, { x: -1.3, y: -1.3, z: 0.5 }, { x: -0.7, y: -1.1, z: 0.6 },
          { x: -0.2, y: -0.7, z: 0.7 }, { x: 0.2, y: -0.3, z: 0.8 }, { x: 0.6, y: 0.1, z: 0.9 }, { x: 1.0, y: 0.5, z: 1.0 }
        ],
        color: 0xaa66ff
      },
      orion: {
        // 猎户座 - 沙漏形状
        stars: [
          { x: 0.0, y: 2.0, z: 0.2 }, { x: 1.5, y: 1.8, z: 0.1 }, { x: 0.5, y: 1.3, z: 0.4 },
          { x: 0.8, y: 1.1, z: 0.5 }, { x: 1.1, y: 0.9, z: 0.6 }, { x: 0.3, y: 0.3, z: 0.8 }, { x: 1.7, y: 0.1, z: 0.9 }
        ],
        color: 0x00ffff
      },
      scorpius: {
        // 天蝎座 - 弯曲的尾巴
        stars: [
          { x: -2.0, y: -1.5, z: 0.5 }, { x: -1.4, y: -1.8, z: 0.6 }, { x: -0.9, y: -2.0, z: 0.7 },
          { x: -0.4, y: -1.8, z: 0.8 }, { x: 0.1, y: -1.5, z: 0.9 }, { x: 0.5, y: -1.0, z: 1.0 },
          { x: 0.9, y: -0.5, z: 1.1 }, { x: 1.3, y: 0.0, z: 1.2 }
        ],
        color: 0xff4444
      },
      cassiopeia: {
        // 仙后座 - W形状
        stars: [
          { x: -1.5, y: 0.5, z: 0.6 }, { x: -0.8, y: -0.2, z: 0.7 }, { x: 0.0, y: 0.3, z: 0.8 },
          { x: 0.8, y: -0.3, z: 0.9 }, { x: 1.5, y: 0.4, z: 1.0 }
        ],
        color: 0xff66aa
      },
      cygnus: {
        // 天鹅座 - 十字形
        stars: [
          { x: 0.0, y: 1.8, z: 0.3 }, { x: 0.0, y: 0.9, z: 0.6 }, { x: 0.0, y: 0.0, z: 0.9 },
          { x: -1.0, y: 0.0, z: 0.8 }, { x: 1.0, y: 0.0, z: 1.0 }, { x: 0.0, y: -0.9, z: 1.2 }
        ],
        color: 0x66aaff
      },
      ursaMinor: {
        // 小熊座 - 小勺子（包含北极星）
        stars: [
          { x: 0.0, y: 2.0, z: 0.2 }, { x: 0.5, y: 1.6, z: 0.3 }, { x: 0.9, y: 1.2, z: 0.4 },
          { x: 0.7, y: 0.7, z: 0.5 }, { x: 0.2, y: 0.4, z: 0.6 }, { x: -0.3, y: 0.5, z: 0.7 }, { x: -0.6, y: 0.8, z: 0.8 }
        ],
        color: 0x66ffaa
      },
      gemini: {
        // 双子座 - 两个并排的人形
        stars: [
          { x: -1.2, y: 1.5, z: 0.4 }, { x: -0.8, y: 1.0, z: 0.5 }, { x: -1.0, y: 0.5, z: 0.6 },
          { x: -0.6, y: 0.0, z: 0.7 }, { x: 0.6, y: 1.5, z: 0.5 }, { x: 1.0, y: 1.0, z: 0.6 },
          { x: 0.8, y: 0.5, z: 0.7 }, { x: 1.2, y: 0.0, z: 0.8 }
        ],
        color: 0xffaa66
      },
      taurus: {
        // 金牛座 - V形头部 + 身体
        stars: [
          { x: -1.0, y: 0.8, z: 0.5 }, { x: -0.3, y: 0.5, z: 0.6 }, { x: 0.4, y: 0.8, z: 0.7 },
          { x: 0.0, y: 0.0, z: 0.8 }, { x: 0.5, y: -0.5, z: 0.9 }, { x: 1.0, y: -0.8, z: 1.0 }, { x: 1.5, y: -0.6, z: 1.1 }
        ],
        color: 0xffcc66
      },
      auriga: {
        // 御夫座 - 五边形 + 手臂
        stars: [
          { x: -0.5, y: 1.2, z: 0.5 }, { x: 0.5, y: 1.3, z: 0.6 }, { x: 0.8, y: 0.5, z: 0.7 },
          { x: 0.0, y: 0.0, z: 0.8 }, { x: -0.8, y: 0.4, z: 0.7 }, { x: -1.3, y: 0.8, z: 0.6 }
        ],
        color: 0x66ffcc
      },
      singleRing: {
        // 单环旋转 - 所有星球排成一个环（baseRadius=3.5 让 36 星间距更大，不粘合）
        stars: (() => {
          const ringStars: { x: number; y: number; z: number }[] = []
          const baseRadius = 3.5
          for (let i = 0; i < 36; i++) {
            const angle = (i / 36) * Math.PI * 2
            ringStars.push({
              x: Math.cos(angle) * baseRadius,
              y: 0,
              z: Math.sin(angle) * baseRadius
            })
          }
          return ringStars
        })(),
        color: 0xff66ff
      },
      doubleRing: {
        // 双环交叉 - 两组星球形成60度夹角（baseRadius=2.8 让 18 星间距更大，不粘合）
        stars: (() => {
          const ringStars: { x: number; y: number; z: number }[] = []
          const baseRadius = 2.8
          // 第一个环（XY平面）
          for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2
            ringStars.push({
              x: Math.cos(angle) * baseRadius,
              y: Math.sin(angle) * baseRadius,
              z: 0
            })
          }
          // 第二个环（与第一个环成60度夹角）
          const tiltAngle = Math.PI / 3 // 60度
          for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2
            const x = Math.cos(angle) * baseRadius
            const y = Math.sin(angle) * baseRadius
            // 绕X轴旋转60度
            const rotatedY = y * Math.cos(tiltAngle)
            const rotatedZ = y * Math.sin(tiltAngle)
            ringStars.push({ x, y: rotatedY, z: rotatedZ })
          }
          return ringStars
        })(),
        color: 0x66ffff
      }
    }

    const constellation = constellations[type]
    const starCount = constellation.stars.length

    // 先放置星座主星（放大1.8倍让星座更开阔）
    for (let i = 0; i < starCount && i < N; i++) {
      const star = constellation.stars[i]
      positions.push(new THREE.Vector3(
        star.x * scale * 1.8,
        star.y * scale * 1.8,
        star.z * scale * 1.8 + 0.5
      ))
    }

    // 填充剩余位置（随机分布，远离主星座区域）
    while (positions.length < N) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = r * (1.1 + Math.random() * 0.4)
      positions.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.cos(phi) * radius * 0.5 + 0.5
      ))
    }

    return positions
  }

  // 切换粒子形态时调用：饰品平滑过渡到新形态对应的位置
  morphToShape(shape: ParticleShape) {
    this.currentShape = shape
    let newPositions = this.getOrnamentPositionsForShape(shape)
    
    // 应用力导向算法确保星球不重叠
    const planetSizes = this.ornaments.map(o => {
      // 从 bubbleMesh 的 geometry 获取星球大小
      const bubble = o.bubbleMesh
      if (bubble && bubble.geometry) {
        // SphereGeometry 的 radius 参数
        return (bubble.geometry as THREE.SphereGeometry).parameters.radius
      }
      return 0.28 // 默认大小
    })
    newPositions = this.adjustPositionsForSpacing(newPositions, planetSizes, 0.5)  // 形态切换间距适中

    for (let i = 0; i < this.ornaments.length && i < newPositions.length; i++) {
      const ornament = this.ornaments[i]
      const newPos = newPositions[i]
      ornament.basePosition.copy(newPos)
      ornament.positionAnimating = true
      gsap.to(ornament.mesh.position, {
        x: newPos.x, y: newPos.y, z: newPos.z,
        duration: 1.8,
        ease: 'power3.inOut',
        onComplete: () => { ornament.positionAnimating = false }
      })
    }
    // 创建或移除星座连线
    this.createConstellationLines()
  }

  // 切换星座布局
  setConstellation(type: ConstellationType) {
    this.currentConstellation = type
    // 重新生成位置
    let newPositions = this.getConstellationPositions(type)
    
    // 应用力导向算法确保星球不重叠
    const planetSizes = this.ornaments.map(o => {
      const bubble = o.bubbleMesh
      if (bubble && bubble.geometry) {
        return (bubble.geometry as THREE.SphereGeometry).parameters.radius
      }
      return 0.28
    })
    newPositions = this.adjustPositionsForSpacing(newPositions, planetSizes, 0.6)  // 星座模式间距更大

  for (let i = 0; i < this.ornaments.length && i < newPositions.length; i++) {
    const ornament = this.ornaments[i]
    const newPos = newPositions[i]
    ornament.basePosition.copy(newPos)
    ornament.positionAnimating = true
    gsap.to(ornament.mesh.position, {
      x: newPos.x, y: newPos.y, z: newPos.z,
      duration: 1.5,
        ease: 'power3.inOut',
        onComplete: () => { ornament.positionAnimating = false }
      })
    }
    // 重新创建连线
    this.createConstellationLines()
  }

  // 获取当前星座类型
  getCurrentConstellation(): ConstellationType {
    return this.currentConstellation
  }

  checkHover(worldX: number, worldY: number) {
    const threshold = 0.7
    for (const ornament of this.ornaments) {
      const dx = worldX - ornament.basePosition.x
      const dy = worldY - ornament.basePosition.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const wasHovered = ornament.hovered
      ornament.hovered = dist < threshold
      if (ornament.hovered && !wasHovered) this.onHoverStart(ornament)
      else if (!ornament.hovered && wasHovered) this.onHoverEnd(ornament)
    }
  }

  checkHoverRay(raycaster: THREE.Raycaster) {
    // 用预建的精确碰撞球做射线检测，避免 Sprite/Points 子对象造成的误命中
    for (let i = 0; i < this.raycastSpheres.length; i++) {
      this.raycastSpheres[i].position.copy(this.ornaments[i].mesh.position)
    }
    const intersects = raycaster.intersectObjects(this.raycastSpheres, false)
    let hitOrnament: Ornament | null = null
    if (intersects.length > 0) {
      const hitObj = intersects[0].object
      hitOrnament = this.ornaments.find(o =>
        o.mesh === hitObj || o.bubbleMesh === hitObj || o.iconSprite === hitObj ||
        o.ringMesh === hitObj || o.outerRing === hitObj ||
        o.mesh.children.includes(hitObj)
      ) || null
      // 通过碰撞球的 userData 找回对应的 ornament
      const idx = hitObj.userData.ornamentIndex
      if (idx !== undefined && this.ornaments[idx]) {
        hitOrnament = this.ornaments[idx]
      }
    }
    for (const ornament of this.ornaments) {
      const wasHovered = ornament.hovered
      ornament.hovered = ornament === hitOrnament
      if (ornament.hovered && !wasHovered) this.onHoverStart(ornament)
      else if (!ornament.hovered && wasHovered) this.onHoverEnd(ornament)
    }
  }

  raycast(raycaster: THREE.Raycaster): string | null {
    // 复用预建的碰撞球，只更新位置
    for (let i = 0; i < this.raycastSpheres.length; i++) {
      this.raycastSpheres[i].position.copy(this.ornaments[i].mesh.position)
    }
    const intersects = raycaster.intersectObjects(this.raycastSpheres, false)
    if (intersects.length > 0) return intersects[0].object.userData.appName
    return null
  }

  private onHoverStart(ornament: Ornament) {
    if (ornament.selected) return
    this.selectedOrnament = ornament
    this.audio.playHover()

    gsap.to(ornament.mesh.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.3, ease: 'back.out(1.5)' })

    // 对于 ShaderMaterial，我们不改变 opacity，而是改变缩放
    // 已经在上面处理了 mesh.scale

    gsap.to(ornament.iconSprite.scale, { x: 0.26, y: 0.26, z: 1, duration: 0.3 })

    // 白色描边环放大 + 暗角遮罩加深，让饰品更突出
    gsap.to(ornament.whiteRing.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.3, ease: 'back.out(2)' })
    gsap.to(ornament.whiteRing.material, { opacity: 1.0, duration: 0.3 })
    gsap.to(ornament.darkMask.material, { opacity: 0.72, duration: 0.3 })
    gsap.to(ornament.iconSprite.material, { opacity: 1.0, duration: 0.3 })

// 显示应用名称标签（仅在非 always 模式下需要手动控制）
if (this.labelDisplayMode !== 'always') {
gsap.to(ornament.labelSprite.material, { opacity: 1, duration: 0.3 })
}

    const statusEl = document.getElementById('status')
    if (statusEl) {
      statusEl.textContent = `悬停: ${ornament.app.name} — 捏合/比耶选中`
      statusEl.style.color = ornament.app.color
    }

    const label = document.getElementById('ornament-label')
    if (label) {
      label.querySelector('.app-name')!.textContent = ornament.app.name
      label.querySelector('.app-gesture span')!.textContent = '捏合/比耶选中'
      label.classList.add('visible')
    }
  }

  private onHoverEnd(ornament: Ornament) {
    if (this.selectedOrnament === ornament) this.selectedOrnament = null
    if (ornament.selected) return

    gsap.to(ornament.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' })

    // 对于 ShaderMaterial，我们不改变 opacity

    gsap.to(ornament.iconSprite.scale, { x: 0.22, y: 0.22, z: 1, duration: 0.3 })
    gsap.to(ornament.iconSprite.material, { opacity: 0.95, duration: 0.3 })

    gsap.to(ornament.whiteRing.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' })
    gsap.to(ornament.whiteRing.material, { opacity: 0.9, duration: 0.3 })
    gsap.to(ornament.darkMask.material, { opacity: 0.55, duration: 0.3 })

// 隐藏应用名称标签（仅在 always 模式下保持显示）
if (this.labelDisplayMode !== 'always') {
gsap.to(ornament.labelSprite.material, { opacity: 0, duration: 0.3 })
}

    const label = document.getElementById('ornament-label')
    if (label) label.classList.remove('visible')
  }

  selectByName(name: string) {
    const ornament = this.ornaments.find(o => o.app.name === name)
    if (ornament) this.selectOrnament(ornament)
  }

  selectOrnament(ornament: Ornament) {
    for (const o of this.ornaments) {
      if (o !== ornament && o.selected) this.deselectOrnament(o)
    }
    if (ornament.selected) return

    ornament.selected = true
    this.audio.playHover()

    gsap.killTweensOf(ornament.mesh.position)
    ornament.positionAnimating = false
    gsap.to(ornament.mesh.scale, { x: 1.9, y: 1.9, z: 1.9, duration: 0.4, ease: 'back.out(2)' })

    const bubbleMat = ornament.bubbleMesh.material as THREE.MeshPhysicalMaterial
    gsap.to(bubbleMat, { opacity: 0, emissiveIntensity: 0, duration: 0.8, ease: 'power2.out' })

    gsap.to(ornament.iconSprite.scale, { x: 0.60, y: 0.60, z: 1, duration: 0.6, ease: 'back.out(1.5)', delay: 0.3 })
    gsap.to(ornament.iconSprite.material, { opacity: 1.0, duration: 0.6, delay: 0.3 })

    const ringMat = ornament.ringMesh.material as THREE.MeshStandardMaterial
    gsap.to(ringMat, { emissiveIntensity: 1.4, opacity: 0.85, duration: 0.3 })
    gsap.to(ornament.outerRing.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.4, ease: 'power2.out' })

    const statusEl = document.getElementById('status')
    if (statusEl) {
      statusEl.textContent = `已选中: ${ornament.app.name} — 张开手掌启动 / 握拳取消`
      statusEl.style.color = ornament.app.color
    }

    const label = document.getElementById('ornament-label')
    if (label) {
      label.querySelector('.app-name')!.textContent = ornament.app.name
      label.querySelector('.app-gesture span')!.textContent = '张手启动'
      label.classList.add('visible')
    }
  }

  deselectOrnament(ornament: Ornament) {
    if (!ornament.selected) return
    ornament.selected = false
    // 标记正在进行位置动画，update() 期间不能覆盖 position.y
    ornament.positionAnimating = true

    gsap.to(ornament.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' })
    gsap.to(ornament.mesh.position, {
      x: ornament.basePosition.x,
      y: ornament.basePosition.y,
      z: ornament.basePosition.z,
      duration: 0.6,
      ease: 'power3.inOut',
      onComplete: () => { ornament.positionAnimating = false }
    })

    const bubbleMat = ornament.bubbleMesh.material as THREE.MeshPhysicalMaterial
    gsap.to(bubbleMat, { opacity: 0.32, emissiveIntensity: 0.5, duration: 0.6, ease: 'power2.inOut' })

    gsap.to(ornament.iconSprite.scale, { x: 0.22, y: 0.22, z: 1, duration: 0.4, ease: 'power2.in' })
    gsap.to(ornament.iconSprite.material, { opacity: 0.95, duration: 0.4 })

    const ringMat = ornament.ringMesh.material as THREE.MeshStandardMaterial
    gsap.to(ringMat, { emissiveIntensity: 0.5, opacity: 0.55, duration: 0.3 })
    gsap.to(ornament.outerRing.scale, { x: 1, y: 1, z: 1, duration: 0.3 })

    const label = document.getElementById('ornament-label')
    if (label) label.classList.remove('visible')
  }

  deselectAll() {
    for (const o of this.ornaments) {
      if (o.selected) this.deselectOrnament(o)
    }
  }

  getSelectedOrnament(): Ornament | null {
    return this.ornaments.find(o => o.selected) || null
  }

  getHoveredOrnament(): Ornament | null {
    return this.ornaments.find(o => o.hovered) || null
  }

  // ===== 鼠标点击选中相关 =====
  private lastClickedGroup: Ornament[] = []  // 缓存上次选中的群组（取消时仍可访问）

  // 点击星球进行选中（与 hover 不同：会锁定，光标移开仍保持选中）
  // 返回 true 表示新选中，false 表示取消选中（再次点击同一个星球）
  clickSelectByRay(raycaster: THREE.Raycaster): boolean {
    // 复用预建的碰撞球做射线检测
    for (let i = 0; i < this.raycastSpheres.length; i++) {
      this.raycastSpheres[i].position.copy(this.ornaments[i].mesh.position)
    }
    const intersects = raycaster.intersectObjects(this.raycastSpheres, false)
    if (intersects.length === 0) {
      // 没有命中任何星球
      return false
    }
    const idx = intersects[0].object.userData.ornamentIndex
    if (idx === undefined || !this.ornaments[idx]) return false
    const ornament = this.ornaments[idx]

    // 如果已经选中了同一个星球，则取消选中
    if (this.clickedOrnament === ornament) {
      this.clearClickSelection()
      return false
    }
    // 取消之前的选中
    if (this.clickedOrnament) {
      this.clearClickSelection()
    }
    this.clickedOrnament = ornament
    // 缓存当前选中的群组
    this.lastClickedGroup = this.getClickedGroupOrnaments()
    return true
  }

  // 取消点击选中（不清空 lastClickedGroup，便于 App 恢复位置）
  clearClickSelection() {
    this.clickedOrnament = null
  }

  // 获取上次选中的群组（取消选中后仍可访问，用于恢复位置）
  getLastClickedGroup(): Ornament[] {
    return this.lastClickedGroup
  }

  // 清空群组缓存（完全重置）
  clearLastClickedGroup() {
    this.lastClickedGroup = []
  }

  // 是否处于环模式（单环或双环）
  isRingMode(): boolean {
    return this.currentConstellation === 'singleRing' || this.currentConstellation === 'doubleRing'
  }

  // 获取当前点击选中的星球
  getClickedOrnament(): Ornament | null {
    return this.clickedOrnament
  }

  // 获取点击选中星球所属群组的所有 ornament（星座模式返回整组，非星座模式返回单个）
  getClickedGroupOrnaments(): Ornament[] {
    if (!this.clickedOrnament) return []
    const clickedIdx = this.ornaments.indexOf(this.clickedOrnament)
    if (clickedIdx < 0) return []
    // 检查星座分组
    for (const group of this.CONSTELLATION_GROUPS) {
      if (group.indices.includes(clickedIdx)) {
        return group.indices.map(i => this.ornaments[i])
      }
    }
    return [this.clickedOrnament]
  }

  // 获取点击选中群组的中心位置（用于相机居中）
  getClickedGroupCenter(): THREE.Vector3 | null {
    const group = this.getClickedGroupOrnaments()
    if (group.length === 0) return null
    const center = new THREE.Vector3()
    for (const o of group) {
      center.add(o.mesh.position)
    }
    center.divideScalar(group.length)
    return center
  }

  findNearestOrnament(worldPos: THREE.Vector3, maxDistance: number): Ornament | null {
    let nearest: Ornament | null = null
    let minDist = maxDistance
    for (const ornament of this.ornaments) {
      const dx = worldPos.x - ornament.basePosition.x
      const dy = worldPos.y - ornament.basePosition.y
      const dz = worldPos.z - ornament.basePosition.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist < minDist) { minDist = dist; nearest = ornament }
    }
    return nearest
  }

  activateByAppName(name: string) {
    const ornament = this.ornaments.find(o => o.app.name === name)
    if (ornament) this.activateOrnament(ornament)
  }

  activateSelected() {
    const selected = this.getSelectedOrnament()
    if (selected) this.activateOrnament(selected)
  }

  private activateOrnament(ornament: Ornament) {
    const now = performance.now()
    if (now < ornament.cooldownUntil) return
    ornament.cooldownUntil = now + 2000

    const app = ornament.app

    // 对于 ShaderMaterial，我们不使用 emissiveIntensity 动画
    // 而是使用缩放动画来产生脉冲效果
    gsap.to(ornament.bubbleMesh.scale, {
      x: 1.3, y: 1.3, z: 1.3, duration: 0.12, yoyo: true, repeat: 1,
      onComplete: () => gsap.to(ornament.bubbleMesh.scale, { x: 1, y: 1, z: 1, duration: 0.6 })
    })

    const ringMat = ornament.ringMesh.material as THREE.MeshStandardMaterial
    gsap.to(ringMat, {
      emissiveIntensity: 4.0, duration: 0.12, yoyo: true, repeat: 1,
      onComplete: () => gsap.to(ringMat, { emissiveIntensity: 0.5, duration: 0.6 })
    })

    gsap.to(ornament.mesh.rotation, { y: ornament.mesh.rotation.y + Math.PI * 4, duration: 0.5, ease: 'power2.out' })

    gsap.to(ornament.outerRing.scale, { x: 2.0, y: 2.0, z: 2.0, duration: 0.3, yoyo: true, repeat: 1, onComplete: () => gsap.to(ornament.outerRing.scale, { x: 1, y: 1, z: 1, duration: 0.5 }) })

    this.audio.playLaunchSuccess()

    if (window.electronAPI) {
      window.electronAPI.launchApp(app.path).then((result: { success: boolean }) => {
        const statusEl = document.getElementById('status')
        if (statusEl) {
          statusEl.textContent = result.success ? `已启动: ${app.name}` : `启动失败: ${app.name}`
          statusEl.style.color = result.success ? '#00ff88' : '#ff4444'
        }
      })
    }

    window.dispatchEvent(new CustomEvent('particle-burst', {
      detail: { x: ornament.basePosition.x, y: ornament.basePosition.y, z: ornament.basePosition.z }
    }))

    console.log(`[Ornament] Launching: ${app.name} (${app.path})`)
  }

  update(_dt: number, time: number) {
    this.time = time

    // 环模式旋转更新
    if (this.currentConstellation === 'singleRing' || this.currentConstellation === 'doubleRing') {
      this.ringRotationAngle += _dt * 0.08 // 旋转速度（缓慢）
      if (this.ringRotationAngle > Math.PI * 2) {
        this.ringRotationAngle -= Math.PI * 2
      }
      
      // 更新星球位置（与 getConstellationPositions 中的缩放保持一致：scale * 1.8 = 2.5 * 1.8 = 4.5）
      // 单环 baseRadius=3.5，双环 baseRadius=2.8，确保星球间距合适不粘合
      const baseRadius = this.currentConstellation === 'singleRing' ? 3.5 : 2.8
      const ringRadius = baseRadius * 2.5 * 1.8 // 与 constellation positions 的缩放一致
      const tiltAngle = Math.PI / 3 // 60度
      const clickedIndices = this.getClickedGroupIndices()
      
      for (let i = 0; i < this.ornaments.length; i++) {
        const ornament = this.ornaments[i]
        const isClicked = clickedIndices.has(i)
        
        // 被选中的星球不旋转
        if (isClicked) continue
        
        if (this.currentConstellation === 'singleRing') {
          // 单环旋转
          const angle = (i / 36) * Math.PI * 2 + this.ringRotationAngle
          ornament.mesh.position.x = Math.cos(angle) * ringRadius
          ornament.mesh.position.y = 0
          ornament.mesh.position.z = Math.sin(angle) * ringRadius + 0.5
        } else if (this.currentConstellation === 'doubleRing') {
          // 双环交叉旋转
          const ringIndex = i < 18 ? 0 : 1
          const indexInRing = i % 18
          const baseAngle = (indexInRing / 18) * Math.PI * 2 + this.ringRotationAngle
          
          const x = Math.cos(baseAngle) * ringRadius
          const y = Math.sin(baseAngle) * ringRadius
          
          if (ringIndex === 0) {
            // 第一个环（XY平面）
            ornament.mesh.position.x = x
            ornament.mesh.position.y = y
            ornament.mesh.position.z = 0 + 0.5
          } else {
            // 第二个环（绕X轴旋转60度）
            const rotatedY = y * Math.cos(tiltAngle)
            const rotatedZ = y * Math.sin(tiltAngle)
            ornament.mesh.position.x = x
            ornament.mesh.position.y = rotatedY
            ornament.mesh.position.z = rotatedZ + 0.5
          }
        }
      }
    }

    // 更新星座连线位置
    this.updateConstellationLines()

    // 更新射线检测球位置
    for (let i = 0; i < this.ornaments.length; i++) {
      this.raycastSpheres[i].position.copy(this.ornaments[i].mesh.position)
    }

    // 计算被点击选中的星球集合（在星座模式下，整个星座都被选中）
    const clickedGroupIndices = this.getClickedGroupIndices()

    for (const ornament of this.ornaments) {
      // 更新星球着色器的时间 uniform
      const bubbleMat = ornament.bubbleMesh.material as THREE.ShaderMaterial
      if (bubbleMat.uniforms && bubbleMat.uniforms.uTime) {
        bubbleMat.uniforms.uTime.value = time
      }

      const isClicked = clickedGroupIndices.has(this.ornaments.indexOf(ornament))
      const isHovered = ornament.hovered

      // ===== 被点击选中的星球：停止所有运动 + 包裹/闪烁 =====
      if (isClicked) {
        const target = 1
        ornament.hoverProgress += (target - ornament.hoverProgress) * 0.12

        const planetRadius = (ornament.bubbleMesh.geometry as THREE.SphereGeometry).parameters.radius
        // 白色描边环放大到完全包裹星球
        const wrapScale = (planetRadius * 2.5) / (planetRadius * 1.93)
        const pulse = 1.0 + Math.sin(time * 4) * 0.06
        ornament.whiteRing.scale.setScalar(wrapScale * pulse)
        ornament.outerRing.scale.setScalar(wrapScale * 0.95)
        // 光晕大幅放大并淡淡闪烁
        const glowPulse = 2.8 + Math.sin(time * 3) * 0.3
        ornament.glowSprite.scale.set(glowPulse, glowPulse, 1)
        const glowMat = ornament.glowSprite.material as THREE.SpriteMaterial
        glowMat.opacity = 0.25 + Math.sin(time * 3) * 0.1
        // 星球本体淡淡一闪一闪
        if (bubbleMat.uniforms && bubbleMat.uniforms.uHoverGlow) {
          bubbleMat.uniforms.uHoverGlow.value = 0.6 + Math.sin(time * 2.5) * 0.35
        }
        // 不执行任何旋转/位移代码 → 选中星球完全静止
        continue
      }

      // ===== 以下：未被点击选中的星球（包括 hover 的）继续正常旋转 =====
      const speedMul = ornament.selected ? 3.0 : (isHovered ? 2.0 : 1.0)
      ornament.ringMesh.rotateOnAxis(ornament.ringAxis, ornament.ringSpeed * 0.016 * speedMul)
      ornament.outerRing.rotateOnAxis(ornament.outerRingAxis, ornament.outerRingSpeed * 0.016 * speedMul)
      ornament.whiteRing.rotateOnAxis(ornament.whiteRingAxis, ornament.whiteRingSpeed * 0.016 * speedMul)

      if (ornament.selected) {
        // 选中状态额外旋转（保持视觉冲击）
        // 清除 hover 发光
        if (bubbleMat.uniforms && bubbleMat.uniforms.uHoverGlow) {
          bubbleMat.uniforms.uHoverGlow.value = 0
        }
      } else if (!isHovered) {
        // 普通星球：正常呼吸位移 + 呼吸脉冲（环模式下跳过呼吸位移，由环旋转代码控制位置）
        if (!ornament.positionAnimating && !this.isRingMode()) {
          const breathe = Math.sin(time * 1.5 + ornament.basePosition.x * 2) * 0.04
          ornament.mesh.position.y = ornament.basePosition.y + breathe
        }
        const pulse = 1.0 + Math.sin(time * 2 + ornament.basePosition.x * 3) * 0.06
        ornament.whiteRing.scale.setScalar(pulse)
        ornament.whiteRing.rotation.y += _dt * 0.6 * speedMul
        const glowPulse = 1.0 + Math.sin(time * 1.2 + ornament.basePosition.z * 4) * 0.1
        ornament.glowSprite.scale.set(1.8 * glowPulse, 1.8 * glowPulse, 1)
        // 清除 hover 发光
        if (bubbleMat.uniforms && bubbleMat.uniforms.uHoverGlow) {
          bubbleMat.uniforms.uHoverGlow.value = 0
        }
      } else {
        // hover 的星球：继续旋转 + 显示包裹/闪烁视觉反馈
        const planetRadius = (ornament.bubbleMesh.geometry as THREE.SphereGeometry).parameters.radius
        const wrapScale = (planetRadius * 2.5) / (planetRadius * 1.93)
        const pulse = 1.0 + Math.sin(time * 4) * 0.06
        ornament.whiteRing.scale.setScalar(wrapScale * pulse)
        ornament.whiteRing.rotation.y += _dt * 1.5
        const glowPulse = 2.8 + Math.sin(time * 3) * 0.3
        ornament.glowSprite.scale.set(glowPulse, glowPulse, 1)
        const glowMat = ornament.glowSprite.material as THREE.SpriteMaterial
        glowMat.opacity = 0.25 + Math.sin(time * 3) * 0.1
        if (bubbleMat.uniforms && bubbleMat.uniforms.uHoverGlow) {
          bubbleMat.uniforms.uHoverGlow.value = 0.6 + Math.sin(time * 2.5) * 0.35
        }
      }

      // 粒子尾迹
      this.updateTrail(ornament)

      const target = isHovered ? 1 : 0
      ornament.hoverProgress += (target - ornament.hoverProgress) * 0.12
    }
  }

  // 获取被点击选中星球所属群组的所有索引
  // - 星座模式（realistic 或其他星座）：返回整个星座的所有星球索引
  // - 非星座模式：只返回被点击的单个星球索引
  private getClickedGroupIndices(): Set<number> {
    if (!this.clickedOrnament) return new Set()
    const clickedIdx = this.ornaments.indexOf(this.clickedOrnament)
    if (clickedIdx < 0) return new Set()

    // 检查是否在星座模式（非 'realistic' 视为星座模式，或者所有星球都属于某个星座）
    // 根据需求："在星座模式下，连成星座就是几个球都是一个整体"
    // 简化：只要该星球属于 CONSTELLATION_GROUPS 中某个组，就返回整个组
    for (const group of this.CONSTELLATION_GROUPS) {
      if (group.indices.includes(clickedIdx)) {
        return new Set(group.indices)
      }
    }
    // 非星座模式或该星球不属于任何星座：只返回单个
    return new Set([clickedIdx])
  }

  // 更新粒子尾迹：每帧把当前位置写入循环缓冲，所有粒子 alpha 随时间衰减
  private updateTrail(ornament: Ornament) {
    const pos = ornament.mesh.position
    const trailCount = 30
    const positions = ornament.trailPositions
    const geo = ornament.trailPoints.geometry as THREE.BufferGeometry
    const alphaAttr = geo.getAttribute('aAlpha') as THREE.BufferAttribute

    // 写入当前位置
    const idx = ornament.trailIndex
    positions[idx * 3]     = pos.x
    positions[idx * 3 + 1] = pos.y
    positions[idx * 3 + 2] = pos.z
    ornament.trailIndex = (idx + 1) % trailCount

    // 更新位置属性
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true

    // 所有粒子 alpha 衰减（越旧的越淡）
    for (let i = 0; i < trailCount; i++) {
      const age = (ornament.trailIndex - i + trailCount) % trailCount  // 0=最新, 越大越旧
      const a = Math.max(0, 1 - age / trailCount)
      alphaAttr.array[i] = a * (ornament.selected ? 0.8 : 0.4)
    }
    alphaAttr.needsUpdate = true
  }

  // 创建星座连线 - 在星座模式时显示星座之间的连线
  private createConstellationLines() {
    // 移除旧连线
    if (this.constellationLines) {
      this.scene.remove(this.constellationLines)
      this.constellationLines.geometry.dispose()
      ;(this.constellationLines.material as THREE.Material).dispose()
      this.constellationLines = null
    }

    // 只在有足够星球时创建连线
    if (this.ornaments.length < 36) return

    // 根据当前星座类型获取连线数据
    const constellationData = this.getConstellationLineData()

    const positions: number[] = []
    const colors: number[] = []

    for (const constellation of constellationData) {
      const color = new THREE.Color(constellation.color)
      for (const [i, j] of constellation.connections) {
        if (i < this.ornaments.length && j < this.ornaments.length) {
          const pos1 = this.ornaments[i].mesh.position
          const pos2 = this.ornaments[j].mesh.position
          positions.push(pos1.x, pos1.y, pos1.z)
          positions.push(pos2.x, pos2.y, pos2.z)
          colors.push(color.r, color.g, color.b)
          colors.push(color.r, color.g, color.b)
        }
      }
    }

    if (positions.length === 0) return

    // 创建虚线效果：使用点划线，间隔较大（不频繁）
    const dashSize = 0.15  // 线段长度
    const gapSize = 0.35   // 间隔长度
    const dashedPositions: number[] = []
    const dashedColors: number[] = []
    
    for (let i = 0; i < positions.length; i += 6) {
      const x1 = positions[i], y1 = positions[i + 1], z1 = positions[i + 2]
      const x2 = positions[i + 3], y2 = positions[i + 4], z2 = positions[i + 5]
      const r = colors[i], g = colors[i + 1], b = colors[i + 2]
      
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const segments = Math.floor(dist / (dashSize + gapSize))
      
      for (let j = 0; j < segments; j++) {
        const t1 = j * (dashSize + gapSize) / dist
        const t2 = Math.min((j * (dashSize + gapSize) + dashSize) / dist, 1)
        
        dashedPositions.push(
          x1 + dx * t1, y1 + dy * t1, z1 + dz * t1,
          x1 + dx * t2, y1 + dy * t2, z1 + dz * t2
        )
        dashedColors.push(r, g, b, r, g, b)
      }
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(dashedPositions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(dashedColors, 3))

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      linewidth: 3
    })

    this.constellationLines = new THREE.LineSegments(geometry, material)
    this.scene.add(this.constellationLines)
  }

  // 获取当前星座类型的连线数据
  private getConstellationLineData(): { connections: number[][]; color: number; name: string }[] {
    const lineData: Record<ConstellationType, { connections: number[][]; color: number; name: string }[]> = {
      realistic: [
        // 真实星空模式：6个星座分布在球面上
        // 北斗七星 (0-6) - 金色
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], color: 0xffd700, name: '北斗七星' },
        // 狮子座 (7-13) - 橙色
        { connections: [[7, 8], [8, 9], [9, 10], [10, 11], [11, 7], [7, 12], [12, 13]], color: 0xff8800, name: '狮子座' },
        // 仙女座 (14-20) - 紫色
        { connections: [[14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 20]], color: 0xaa66ff, name: '仙女座' },
        // 猎户座 (21-27) - 青色 (7颗星)
        { connections: [[21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27]], color: 0x00ffff, name: '猎户座' },
        // 天蝎座 (28-35) - 红色 (8颗星)
        { connections: [[28, 29], [29, 30], [30, 31], [31, 32], [32, 33], [33, 34], [34, 35]], color: 0xff4444, name: '天蝎座' },
        // 仙后座 (36-40) - 粉色 (5颗星，但只有0-35，所以不显示)
      ],
      bigDipper: [
        // 北斗七星 - 勺子形状
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], color: 0xffd700, name: '北斗七星' }
      ],
      leo: [
        // 狮子座 - 镰刀 + 三角形
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [5, 6]], color: 0xff8800, name: '狮子座' }
      ],
      andromeda: [
        // 仙女座 - V形 + 链条
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], color: 0xaa66ff, name: '仙女座' }
      ],
      orion: [
        // 猎户座 - 沙漏形状
        { connections: [[0, 2], [2, 4], [1, 3], [3, 5], [2, 3]], color: 0x00ffff, name: '猎户座' }
      ],
      scorpius: [
        // 天蝎座 - 弯曲的尾巴
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]], color: 0xff4444, name: '天蝎座' }
      ],
      cassiopeia: [
        // 仙后座 - W形状
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4]], color: 0xff66aa, name: '仙后座' }
      ],
      cygnus: [
        // 天鹅座 - 十字形
        { connections: [[0, 1], [1, 2], [2, 5], [2, 3], [2, 4]], color: 0x66aaff, name: '天鹅座' }
      ],
      ursaMinor: [
        // 小熊座 - 小勺子
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], color: 0x66ffaa, name: '小熊座' }
      ],
      gemini: [
        // 双子座 - 两个并排的人形
        { connections: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4]], color: 0xffaa66, name: '双子座' }
      ],
      taurus: [
        // 金牛座 - V形头部 + 身体
        { connections: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6]], color: 0xffcc66, name: '金牛座' }
      ],
      auriga: [
        // 御夫座 - 五边形 + 手臂
        { connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5]], color: 0x66ffcc, name: '御夫座' }
      ],
      singleRing: [
        // 单环旋转 - 36个星球连成环
        { connections: Array.from({ length: 36 }, (_, i) => [i, (i + 1) % 36]), color: 0xff66ff, name: '单环' }
      ],
      doubleRing: [
        // 双环交叉 - 两个环各自连成环
        { connections: Array.from({ length: 18 }, (_, i) => [i, (i + 1) % 18]), color: 0xff66ff, name: '环1' },
        { connections: Array.from({ length: 18 }, (_, i) => [18 + i, 18 + ((i + 1) % 18)]), color: 0x66ffff, name: '环2' }
      ]
    }

    return lineData[this.currentConstellation] || lineData.realistic
  }

  // 更新星座连线位置 - 重新创建虚线段
  private updateConstellationLines() {
    if (!this.constellationLines) return

    // 保存当前的visible状态
    const wasVisible = this.constellationLines.visible

    // 移除旧连线并重新创建（因为虚线段需要重新计算）
    this.scene.remove(this.constellationLines)
    this.constellationLines.geometry.dispose()
    ;(this.constellationLines.material as THREE.Material).dispose()
    this.constellationLines = null
    
    // 重新创建连线
    this.createConstellationLines()
    
    // 恢复visible状态
    if (this.constellationLines) {
      (this.constellationLines as THREE.LineSegments).visible = wasVisible && this.constellationLinesVisible
    }
  }

  // 开始拖动星座 - 点击任意星球会拖动整个星座
  public startDrag(raycaster: THREE.Raycaster): boolean {
    const intersects = raycaster.intersectObjects(this.raycastSpheres, false)
    if (intersects.length > 0) {
      const index = intersects[0].object.userData.ornamentIndex
      
      // 找到该星球所属的星座
      for (const group of this.CONSTELLATION_GROUPS) {
        if (group.indices.includes(index)) {
          this.draggedConstellationIndices = [...group.indices]
          break
        }
      }
      
      // 如果没有找到星座（可能是多余的星球），只拖动单个
      if (this.draggedConstellationIndices.length === 0) {
        this.draggedConstellationIndices = [index]
      }
      
      this.isDragging = true
      
      // 创建拖动平面（垂直于相机方向的平面，通过被点击的星球）
      this.dragPlane.setFromNormalAndCoplanarPoint(
        raycaster.ray.direction.clone().normalize(),
        this.ornaments[index].mesh.position
      )
      
      // 记录拖动起始点
      raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint)
      this.dragCurrentPoint.copy(this.dragStartPoint)
      
      // 记录所有要拖动的星球的起始位置
      this.dragStartPositions.clear()
      for (const idx of this.draggedConstellationIndices) {
        this.dragStartPositions.set(idx, this.ornaments[idx].mesh.position.clone())
      }
      
      return true
    }
    return false
  }

  // 更新拖动位置 - 移动整个星座
  public updateDrag(raycaster: THREE.Raycaster): void {
    if (!this.isDragging || this.draggedConstellationIndices.length === 0) return
    
    const intersectPoint = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
      // 计算偏移量
      const offset = new THREE.Vector3().subVectors(intersectPoint, this.dragStartPoint)
      
      // 移动星座中的所有星球
      for (const idx of this.draggedConstellationIndices) {
        const startPos = this.dragStartPositions.get(idx)
        if (startPos) {
          const newPos = startPos.clone().add(offset)
          this.ornaments[idx].mesh.position.copy(newPos)
          this.ornaments[idx].basePosition.copy(newPos)
        }
      }
      
      // 更新星座连线
      this.updateConstellationLines()
    }
  }

  // 结束拖动
  public endDrag(): void {
    this.isDragging = false
    this.draggedConstellationIndices = []
    this.dragStartPositions.clear()
  }

  // 获取是否正在拖动
  public getIsDragging(): boolean {
    return this.isDragging
  }

  // 切换标签显示模式
  public cycleLabelDisplayMode(): string {
    const modes: ('hidden' | 'hover' | 'always')[] = ['hover', 'always', 'hidden']
    const currentIndex = modes.indexOf(this.labelDisplayMode)
    this.labelDisplayMode = modes[(currentIndex + 1) % modes.length]
    
    // 更新所有标签的显示状态
    this.updateAllLabels()
    
    const modeNames = {
      'hidden': '隐藏',
      'hover': '悬停显示',
      'always': '一直显示'
    }
    return modeNames[this.labelDisplayMode]
  }

  // 获取当前标签显示模式
  public getLabelDisplayMode(): string {
    const modeNames = {
      'hidden': '隐藏',
      'hover': '悬停显示',
      'always': '一直显示'
    }
    return modeNames[this.labelDisplayMode]
  }

  // 更新所有标签的显示状态
  private updateAllLabels() {
    for (const ornament of this.ornaments) {
      const targetOpacity = this.labelDisplayMode === 'always' ? 1 : 
                           (this.labelDisplayMode === 'hidden' ? 0 : 
                            (ornament.hovered ? 1 : 0))
      
      gsap.to(ornament.labelSprite.material, {
        opacity: targetOpacity,
        duration: 0.3
      })
    }
  }

  // 切换星座连线显示
  public toggleConstellationLines(): boolean {
    this.constellationLinesVisible = !this.constellationLinesVisible
    
    console.log('[OrnamentSystem] 切换星座连线显示:', this.constellationLinesVisible, 'constellationLines:', this.constellationLines)
    
    if (this.constellationLines) {
      this.constellationLines.visible = this.constellationLinesVisible
      console.log('[OrnamentSystem] 设置 visible:', this.constellationLinesVisible)
    } else {
      console.log('[OrnamentSystem] constellationLines 为空，重新创建')
      if (this.ornaments.length >= 36) {
        this.createConstellationLines()
        if (this.constellationLines) {
          (this.constellationLines as THREE.LineSegments).visible = this.constellationLinesVisible
        }
      }
    }
    
    return this.constellationLinesVisible
  }

  // 获取星座连线显示状态
  public getConstellationLinesVisible(): boolean {
    return this.constellationLinesVisible
  }
}
