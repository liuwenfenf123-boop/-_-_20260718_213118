import * as THREE from 'three'
import gsap from 'gsap'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { ParticleSystem, ParticleShape, SHAPE_CATEGORIES, SHAPE_LABELS } from './ParticleSystem'
import { OrnamentSystem, CONSTELLATION_INFO, ConstellationType } from './OrnamentSystem'
import { HandTracker, PointerUpdate, HandData, ComboGesture } from '../gesture/HandTracker'
import { AudioManager } from './AudioManager'
import { appConfig } from '../config/appConfig'

// 扁平化所有形态
const ALL_SHAPES: ParticleShape[] = Object.values(SHAPE_CATEGORIES).flat()

const GESTURE_NAMES: Record<string, string> = {
  'fist': '握拳',
  'open_palm': '张开手掌',
  'peace': '比耶',
  'point': '食指',
  'pinch': '捏合'
}

class App {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private finalePass!: ShaderPass
  private particleSystem!: ParticleSystem
  private ornamentSystem!: OrnamentSystem
  private handTracker: HandTracker | null = null
  private audioManager!: AudioManager
  private starField!: THREE.Points
  private dustField!: THREE.Points
  private snowParticles!: THREE.Points
  private lightBeam!: THREE.Mesh
  private groundRing!: THREE.Mesh
  private auroraMesh!: THREE.Mesh
  private clock: THREE.Clock
  private gestureCooldown: Map<string, number> = new Map()
  private readonly COOLDOWN_MS = 1500

  // 鼠标交互
  private mouseNDC = new THREE.Vector2(0, 0)
  private raycaster = new THREE.Raycaster()
  private mouseActive = false
  private isRightDragging = false
  private isLeftDragging = false
  private cameraYaw = 0
  private cameraPitch = 0.3
  private cameraDistance = 8
  private readonly MIN_DIST = 4
  private readonly MAX_DIST = 50
  private readonly CAMERA_RADIUS = 8
  private keysDown: Set<string> = new Set()
  private lastClickTime = 0
  private cursorRing: HTMLElement | null = null
  private cursorDot: HTMLElement | null = null
  private cursorTrail: { x: number; y: number; life: number }[] = []
  private isDraggingConstellation = false
  private dragMouseDownPos = { x: 0, y: 0 }
  private dragMoved = false

  // ===== 锁定观察模式 =====
  // 选中星球/星座后，按 L 锁定，可以自由拖动视角观察，不会取消选中
  private lockViewMode = false
  // 点击选中后相机居中的目标位置（null 表示未选中）
  private clickedCenterTarget: THREE.Vector3 | null = null
  // 选中群组中每个星球相对于群组中心的位置（用于跟随相机移动）
  private clickedGroupRelativePositions: Map<number, THREE.Vector3> = new Map()
  // 点击选中前的相机状态（用于取消选中时恢复）
  private savedCameraYaw = 0
  private savedCameraPitch = 0.3
  private savedCameraDistance = 8
  // R 键控制相机围绕中心公转（不是星球自身光环旋转）
  private cameraAutoRotateEnabled = true

  // ===== 新增：手势光标状态 =====
  private handCursorActive = false
  private handCursorX = 0
  private handCursorY = 0
  private handLastClickTime = 0

  // ===== Dwell 选择状态 =====
  private dwellTarget: string | null = null
  private dwellStartTime = 0
  private readonly DWELL_MS = 650
  private dwellTriggered = false

  // 形态切换
  private currentShapeIndex = 0
  private currentCategoryIndex = 0
  private categoryNames: string[]
  private panelVisible = false
  private constellationPanelVisible = false
  private constellationTypes: ConstellationType[]

  constructor() {
    this.clock = new THREE.Clock()
    this.categoryNames = Object.keys(SHAPE_CATEGORIES)
    this.constellationTypes = Object.keys(CONSTELLATION_INFO) as ConstellationType[]

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000511)
    this.scene.fog = new THREE.FogExp2(0x000511, 0.00003)

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
    this.camera.position.set(0, 1.5, this.CAMERA_RADIUS)
    this.camera.lookAt(0, 0.5, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.85
    document.body.appendChild(this.renderer.domElement)

    const renderPass = new RenderPass(this.scene, this.camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45, 0.8, 0.25    // strength↓柔和, radius↑扩散, threshold↑只让亮部参与
    )
    // 色差 + 颗粒 + 暗角 自定义后处理
    const finaleShader = {
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uTime: { value: 0 },
        uAberration: { value: 0.0012 },   // 色差减弱
        uGrain: { value: 0.02 },           // 颗粒减弱
        uVignette: { value: 0.55 }         // 暗角减弱
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uAberration;
        uniform float uGrain;
        uniform float uVignette;
        varying vec2 vUv;

        float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
          vec2 uv = vUv;
          vec2 d = uv - 0.5;
          float r2 = dot(d, d);

          // 径向色差：边缘偏移 RGB 通道
          float aberration = uAberration * (1.0 + r2 * 4.0);
          vec2 dir = normalize(d + 0.0001);
          float r = texture2D(tDiffuse, uv - dir * aberration).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv + dir * aberration).b;
          vec3 col = vec3(r, g, b);

          // 暗角
          float vig = smoothstep(0.95, 0.25, r2 * uVignette);
          col *= mix(0.55, 1.0, vig);

          // 颗粒噪点（仅边缘微弱）
          float grain = rand(uv * 1000.0 + uTime) * 2.0 - 1.0;
          col += grain * uGrain * r2;

          // 柔和伽马：微降对比度，让画面温润
          col = pow(col, vec3(0.97));

          gl_FragColor = vec4(col, 1.0);
        }
      `
    }
    const finalePass = new ShaderPass(finaleShader)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(bloomPass)
    this.composer.addPass(finalePass)
    this.finalePass = finalePass

    this.scene.add(new THREE.AmbientLight(0x112244, 1.5))
    const pointLight = new THREE.PointLight(0xffaa44, 30, 60)
    pointLight.position.set(0, 3, 5)
    this.scene.add(pointLight)

    this.createStarField()
    this.createSnowParticles()
    this.createLightBeam()
    this.createGroundRing()
    this.createAurora()

    this.audioManager = new AudioManager()

    this.particleSystem = new ParticleSystem(this.scene, this.audioManager)
    this.particleSystem.generate(10000, 'christmas_tree')

    this.ornamentSystem = new OrnamentSystem(this.scene, this.audioManager)

    window.addEventListener('particle-burst', ((e: CustomEvent) => {
      this.particleSystem.burstAt(e.detail.x, e.detail.y, e.detail.z, 300)
    }) as EventListener)

    try {
      this.handTracker = new HandTracker(
        document.getElementById('video') as HTMLVideoElement
      )
      this.handTracker.onGesture((gesture, handX, handY) => {
        this.handleGesture(gesture, handX, handY)
      })

      // ===== 手势光标控制（重构后使用 onPointerUpdate）=====
      this.handTracker.onPointerUpdate((pointer: PointerUpdate) => {
        console.log('[PointerUpdate]', pointer.screenX, pointer.screenY, pointer.stableGesture)
        this.handCursorActive = true
        this.handCursorX = pointer.screenX
        this.handCursorY = pointer.screenY

        // 更新光标位置
        if (this.cursorRing) {
          this.cursorRing.style.left = pointer.screenX + 'px'
          this.cursorRing.style.top = pointer.screenY + 'px'
          this.cursorRing.style.opacity = '1'
        }
        if (this.cursorDot) {
          this.cursorDot.style.left = pointer.screenX + 'px'
          this.cursorDot.style.top = pointer.screenY + 'px'
          this.cursorDot.style.opacity = '1'
        }

        // 更新 NDC 坐标
        this.mouseNDC.x = pointer.normalizedX * 2 - 1
        this.mouseNDC.y = -(pointer.normalizedY * 2 - 1)
        this.mouseActive = true

        // 光标拖尾
        this.cursorTrail.push({ x: pointer.screenX, y: pointer.screenY, life: 1 })
        if (this.cursorTrail.length > 18) this.cursorTrail.shift()
      })

      // ===== 手势丢失处理 =====
      this.handTracker.onPointerLost(() => {
        this.handCursorActive = false
        if (this.cursorRing) this.cursorRing.style.opacity = '0'
        if (this.cursorDot) this.cursorDot.style.opacity = '0'
      })

      // 拇指捏合 / peace 保持静止 → 选中星球（不直接打开）
      this.handTracker.onClick(() => {
        this.handleHandSelect()
      })

      // ===== 新增：手势事件 → 控制星球 =====
      this.handTracker.onGesture((gesture, _handX, _handY) => {
        this.handleGestureForOrb(gesture)
      })

      // ===== 休息模式 =====
      this.handTracker.onRest((resting) => {
        const statusEl = document.getElementById('status')
        if (resting) {
          if (this.cursorRing) this.cursorRing.style.opacity = '0.3'
          if (this.cursorDot) this.cursorDot.style.opacity = '0.3'
          if (statusEl) {
            statusEl.textContent = '💤 休息模式 — 举手唤醒'
            statusEl.style.color = 'rgba(255,255,255,0.3)'
          }
        } else {
          if (this.cursorRing) this.cursorRing.style.opacity = '1'
          if (this.cursorDot) this.cursorDot.style.opacity = '1'
          if (statusEl) {
            statusEl.textContent = '👋 检测到手势'
            statusEl.style.color = '#66ffcc'
          }
        }
      })

      // ===== 新增：窗口管理（握拳左/右/下划）=====
      // 简化版：通过握拳触发，用 W/S 键切窗口，这里先不实现动态方向检测
      // 留给后续阶段
    } catch (_) {
      console.log('Camera not available, using mouse controls')
    }

    this.setupMouseControls()
    this.setupKeyboardControls()
    this.buildShapePanel()
    this.buildConstellationPanel()

    window.addEventListener('resize', () => this.onResize())

    // 隐藏 loading
    const loadingEl = document.getElementById('loading')
    if (loadingEl) loadingEl.style.opacity = '0'
    setTimeout(() => { if (loadingEl) loadingEl.style.display = 'none' }, 500)

    this.animate()
  }

  // ========== 形态选择面板 ==========

  private buildShapePanel() {
    const panel = document.getElementById('shape-panel')
    if (!panel) return

    let html = ''
    for (const [category, shapes] of Object.entries(SHAPE_CATEGORIES)) {
      html += `<div class="shape-category" data-cat="${category}">`
      html += `<div class="category-title">${category}</div>`
      html += `<div class="category-shapes">`
      for (const shape of shapes) {
        html += `<div class="shape-btn" data-shape="${shape}">${SHAPE_LABELS[shape]}</div>`
      }
      html += `</div></div>`
    }
    panel.innerHTML = html

    // 点击事件
    panel.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const shape = (btn as HTMLElement).dataset.shape as ParticleShape
        if (shape) {
          this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
          // 同步更新分类索引，避免状态栏显示错误的分类名
          const catIdx = this.categoryNames.findIndex(catName => {
            const shapes = SHAPE_CATEGORIES[catName]
            return shapes && shapes.indexOf(shape) >= 0
          })
          if (catIdx >= 0) this.currentCategoryIndex = catIdx
          this.switchShape(shape)
          this.updatePanelHighlight()
        }
      })
    })
  }

  private updatePanelHighlight() {
    const panel = document.getElementById('shape-panel')
    if (!panel) return
    const currentShape = ALL_SHAPES[this.currentShapeIndex]
    panel.querySelectorAll('.shape-btn').forEach(btn => {
      const el = btn as HTMLElement
      if (el.dataset.shape === currentShape) {
        el.classList.add('active')
      } else {
        el.classList.remove('active')
      }
    })
  }

  private togglePanel() {
    this.panelVisible = !this.panelVisible
    const panel = document.getElementById('shape-panel')
    if (panel) {
      panel.style.opacity = this.panelVisible ? '1' : '0'
      panel.style.pointerEvents = this.panelVisible ? 'auto' : 'none'
    }
  }

  // ========== 星座选择面板 ==========

  private buildConstellationPanel() {
    const panel = document.getElementById('constellation-panel')
    if (!panel) return

    const hexToRgb = (hex: number) => {
      const r = (hex >> 16) & 0xff
      const g = (hex >> 8) & 0xff
      const b = hex & 0xff
      return `rgb(${r},${g},${b})`
    }

    let html = '<div class="constellation-title">星座选择</div>'
    html += '<div class="constellation-list">'
    for (const type of this.constellationTypes) {
      const info = CONSTELLATION_INFO[type]
      const colorCss = hexToRgb(info.color)
      html += `<div class="constellation-btn" data-constellation="${type}">`
      html += `<div class="constellation-dot" style="background:${colorCss};box-shadow:0 0 6px ${colorCss}"></div>`
      html += `<span>${info.name}</span>`
      html += `<span class="constellation-count">${info.starCount}星</span>`
      html += `</div>`
    }
    html += '</div>'
    panel.innerHTML = html

    panel.querySelectorAll('.constellation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.constellation as ConstellationType
        if (type) {
          this.ornamentSystem.setConstellation(type)
          this.updateConstellationHighlight()
          const statusEl = document.getElementById('status')
          if (statusEl) {
            statusEl.textContent = `星座: ${CONSTELLATION_INFO[type].name}`
            statusEl.style.color = '#88ccff'
          }
        }
      })
    })
  }

  private updateConstellationHighlight() {
    const panel = document.getElementById('constellation-panel')
    if (!panel) return
    const current = this.ornamentSystem.getCurrentConstellation()
    panel.querySelectorAll('.constellation-btn').forEach(btn => {
      const el = btn as HTMLElement
      if (el.dataset.constellation === current) {
        el.classList.add('active')
      } else {
        el.classList.remove('active')
      }
    })
  }

  private toggleConstellationPanel() {
    this.constellationPanelVisible = !this.constellationPanelVisible
    const panel = document.getElementById('constellation-panel')
    if (panel) {
      panel.style.opacity = this.constellationPanelVisible ? '1' : '0'
      panel.style.pointerEvents = this.constellationPanelVisible ? 'auto' : 'none'
    }
  }

  // ========== 场景效果 ==========

  private createStarField() {
    const starCount = 3500
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 35 + Math.random() * 60
      positions[i3] = Math.sin(phi) * Math.cos(theta) * r
      positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r
      positions[i3 + 2] = Math.cos(phi) * r
      colors[i3] = 0.6 + Math.random() * 0.4
      colors[i3 + 1] = 0.6 + Math.random() * 0.4
      colors[i3 + 2] = 0.7 + Math.random() * 0.3
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.08, vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.9
    })
    this.starField = new THREE.Points(geo, mat)
    this.scene.add(this.starField)

    // 远景尘埃：弥散在场景外的微小漂浮粒子，增强空间纵深感
    const dustCount = 2500
    const dustGeo = new THREE.BufferGeometry()
    const dustPos = new Float32Array(dustCount * 3)
    const dustColor = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      const i3 = i * 3
      // 球壳分布，半径 30~80，远离主体
      const r = 30 + Math.random() * 50
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      dustPos[i3]     = r * Math.sin(phi) * Math.cos(theta)
      dustPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6  // 压扁
      dustPos[i3 + 2] = r * Math.cos(phi)
      // 冷色调，淡淡的青蓝
      const tint = 0.4 + Math.random() * 0.4
      dustColor[i3]     = tint * 0.5
      dustColor[i3 + 1] = tint * 0.8
      dustColor[i3 + 2] = tint
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColor, 3))
    const dustMat = new THREE.PointsMaterial({
      size: 0.1, vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.5
    })
    this.dustField = new THREE.Points(dustGeo, dustMat)
    this.scene.add(this.dustField)
  }

  private createSnowParticles() {
    const count = 1500
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 50
      positions[i3 + 1] = Math.random() * 35 - 5
      positions[i3 + 2] = (Math.random() - 0.5) * 50
      velocities[i3] = (Math.random() - 0.5) * 0.01
      velocities[i3 + 1] = -(0.005 + Math.random() * 0.015)
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.01
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.03, color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.4
    })
    this.snowParticles = new THREE.Points(geo, mat)
    this.scene.add(this.snowParticles)
  }

  private createLightBeam() {
    const geo = new THREE.CylinderGeometry(0.02, 0.6, 4, 32, 1, true)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    })
    this.lightBeam = new THREE.Mesh(geo, mat)
    this.lightBeam.position.set(0, 3.5, 0)
    this.scene.add(this.lightBeam)
  }

  private createGroundRing() {
    const geo = new THREE.RingGeometry(2.0, 2.8, 64)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2244aa, transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    })
    this.groundRing = new THREE.Mesh(geo, mat)
    this.groundRing.rotation.x = -Math.PI / 2
    this.groundRing.position.y = -2.8
    this.scene.add(this.groundRing)
  }

  private createAurora() {
    const geo = new THREE.PlaneGeometry(80, 10, 100, 12)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 0.3 + uTime * 0.5) * 0.5;
          pos.z += cos(pos.x * 0.2 + uTime * 0.3) * 0.3;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float wave = sin(vUv.x * 6.0 + uTime) * 0.5 + 0.5;
          vec3 color = mix(vec3(0.1, 0.4, 0.8), vec3(0.2, 0.8, 0.4), wave);
          float alpha = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y) * 0.06;
          alpha *= sin(vUv.x * 3.0 + uTime * 0.2) * 0.5 + 0.5;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    })
    this.auroraMesh = new THREE.Mesh(geo, mat)
    this.auroraMesh.position.set(0, 25, -45)
    this.auroraMesh.rotation.x = Math.PI * 0.1
    this.scene.add(this.auroraMesh)
  }

  // ========== 鼠标控制 ==========

  private setupMouseControls() {
    const statusEl = document.getElementById('status')!
    const $hints = document.getElementById('gesture-hints')
    this.cursorRing = document.getElementById('cursor-ring')
    this.cursorDot = document.getElementById('cursor-dot')

    window.addEventListener('mousemove', (e) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
      this.mouseActive = true

      // 光标跟随
      if (this.cursorRing) {
        this.cursorRing.style.left = e.clientX + 'px'
        this.cursorRing.style.top = e.clientY + 'px'
      }
      if (this.cursorDot) {
        this.cursorDot.style.left = e.clientX + 'px'
        this.cursorDot.style.top = e.clientY + 'px'
      }

      // 拖尾点记录
      this.cursorTrail.push({ x: e.clientX, y: e.clientY, life: 1 })
      if (this.cursorTrail.length > 18) this.cursorTrail.shift()

      if (this.isRightDragging) {
        this.cameraYaw -= e.movementX * 0.005
        this.cameraPitch += e.movementY * 0.005
        // 完全 360°，不限制 pitch
        if (this.cameraPitch > Math.PI) this.cameraPitch -= Math.PI * 2
        if (this.cameraPitch < -Math.PI) this.cameraPitch += Math.PI * 2
      }

      // 左键拖动旋转视角（非星座拖动时）
      if (this.isLeftDragging && !this.isDraggingConstellation) {
        this.cameraYaw -= e.movementX * 0.005
        this.cameraPitch += e.movementY * 0.005
        if (this.cameraPitch > Math.PI) this.cameraPitch -= Math.PI * 2
        if (this.cameraPitch < -Math.PI) this.cameraPitch += Math.PI * 2
      }

      // 星座拖动
      if (this.isDraggingConstellation) {
        const dx = e.clientX - this.dragMouseDownPos.x
        const dy = e.clientY - this.dragMouseDownPos.y
        // 用户大幅垂直拖动 → 视角翻转意图，从星座拖动切换到视角旋转
        if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          this.ornamentSystem.endDrag()
          this.isDraggingConstellation = false
          this.isLeftDragging = true
          // 不再走星座拖动分支，下一帧会走 isLeftDragging 分支更新相机
        } else {
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            this.dragMoved = true
          }
          if (this.dragMoved) {
            this.raycaster.setFromCamera(this.mouseNDC, this.camera)
            this.ornamentSystem.updateDrag(this.raycaster)
          }
        }
      }
    })

    window.addEventListener('mouseleave', () => {
      this.mouseActive = false
      if (this.cursorRing) this.cursorRing.style.opacity = '0'
      if (this.cursorDot) this.cursorDot.style.opacity = '0'
    })
    window.addEventListener('mouseenter', () => {
      if (this.cursorRing) this.cursorRing.style.opacity = '1'
      if (this.cursorDot) this.cursorDot.style.opacity = '1'
    })

    window.addEventListener('click', (e) => {
      if (e.button !== 0) return
      // 忽略面板内的点击
      if ((e.target as HTMLElement).closest('#shape-panel')) return
      // 忽略星座面板内的点击
      if ((e.target as HTMLElement).closest('#constellation-panel')) return
      // 拖动后的 mouseup 不应触发 click
      if (this.dragMoved) {
        this.dragMoved = false
        return
      }

      const now = performance.now()
      if (now - this.lastClickTime < 300) return
      this.lastClickTime = now

      this.raycaster.setFromCamera(this.mouseNDC, this.camera)
      // 锁定观察模式下：左键点击星球不取消选中，只允许视角拖动
      if (this.lockViewMode) {
        // 锁定模式下：点击不做选中/取消操作，只让 mousedown/mouseup 处理视角旋转
        return
      }
      // 点击星球：选中/取消选中
      // 先保存旧选中群组（用于切换时恢复）
      const oldGroup = this.ornamentSystem.getLastClickedGroup()
      const selected = this.ornamentSystem.clickSelectByRay(this.raycaster)
      if (selected) {
        // 恢复旧选中群组的缩放（切换星球时）
        if (oldGroup.length > 0) {
          for (const o of oldGroup) {
            gsap.to(o.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' })
            o.positionAnimating = false
          }
        }
        // 新选中：保存当前相机状态
        this.savedCameraYaw = this.cameraYaw
        this.savedCameraPitch = this.cameraPitch
        this.savedCameraDistance = this.cameraDistance
        // 保存选中群组中每个星球相对于群组中心的位置（用于跟随相机移动）
        const group = this.ornamentSystem.getClickedGroupOrnaments()
        const groupCenter = this.ornamentSystem.getClickedGroupCenter()!
        this.clickedGroupRelativePositions.clear()
        // 星座模式：调整星球间距到合适比例（90%），不太近也不太远
        const spacingScale = group.length > 1 ? 0.9 : 1.0
        group.forEach((o, idx) => {
          const relativePos = o.mesh.position.clone().sub(groupCenter).multiplyScalar(spacingScale)
          this.clickedGroupRelativePositions.set(idx, relativePos)
          o.positionAnimating = true
          // 只放大星球，位置由 animate 中每帧更新（跟随相机移动）
          gsap.to(o.mesh.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.35, ease: 'back.out(1.5)' })
        })
        // 光标消失：选中后光标固定在星球上
        if (this.cursorRing) this.cursorRing.style.opacity = '0'
        if (this.cursorDot) this.cursorDot.style.opacity = '0'
        const clickedOrnament = this.ornamentSystem.getClickedOrnament()
        const groupName = clickedOrnament?.app.name || '星球'
        if (group.length > 1) {
          // 星座模式
          const statusEl2 = document.getElementById('status')
          if (statusEl2) {
            statusEl2.textContent = `已选中星座（${group.length}个星球）— 再次点击取消`
            statusEl2.style.color = '#00ff88'
          }
        } else {
          const statusEl2 = document.getElementById('status')
          if (statusEl2) {
            statusEl2.textContent = `已选中: ${groupName} — 再次点击取消`
            statusEl2.style.color = '#00ff88'
          }
        }
        this.audioManager.playGestureConfirm('click')
        // 设置初始居中目标（animate 会每帧更新）
        this.clickedCenterTarget = groupCenter.clone()
      } else {
        // 取消选中或未命中
        if (this.clickedCenterTarget) {
          // 退出锁定观察模式
          this.lockViewMode = false
          // 之前有选中，现在是取消：恢复群组位置和缩放
          const group = this.ornamentSystem.getLastClickedGroup()
          for (const o of group) {
            if (this.ornamentSystem.isRingMode()) {
              // 环模式：立即重置缩放（不动画），防止放大状态与环上其他星球穿透
              o.mesh.scale.set(1, 1, 1)
              o.positionAnimating = false
            } else {
              // 非环模式：恢复到原始位置
              gsap.to(o.mesh.position, { x: o.basePosition.x, y: o.basePosition.y, z: o.basePosition.z, duration: 0.4, ease: 'power2.out' })
              gsap.to(o.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' })
              o.positionAnimating = false
            }
          }
          this.ornamentSystem.clearLastClickedGroup()
          this.ornamentSystem.clearClickSelection()
          this.clickedCenterTarget = null
          this.clickedGroupRelativePositions.clear()
          // 恢复光标显示
          if (this.cursorRing) this.cursorRing.style.opacity = '1'
          if (this.cursorDot) this.cursorDot.style.opacity = '1'
          const statusEl2 = document.getElementById('status')
          if (statusEl2) {
            statusEl2.textContent = '已取消选中'
            statusEl2.style.color = 'rgba(255,255,255,0.6)'
          }
        } else {
          // 没有命中星球 → 在空白处点击触发粒子爆发
          const cameraDir = new THREE.Vector3()
          this.camera.getWorldDirection(cameraDir)
          const plane = new THREE.Plane()
          plane.setFromNormalAndCoplanarPoint(cameraDir.clone().negate(), new THREE.Vector3(0, 0.5, 0))
          const target = new THREE.Vector3()
          if (this.raycaster.ray.intersectPlane(plane, target)) {
            this.particleSystem.burstAt(target.x, target.y, target.z, 200)
            this.audioManager.playBurst()
          }
        }
      }
      // 光标 burst 反馈
      if (this.cursorRing) {
        this.cursorRing.classList.add('burst')
        window.setTimeout(() => this.cursorRing?.classList.remove('burst'), 400)
      }
    })

    // 悬停在饰品上时光标放大
    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.isRightDragging = true
      if (e.button === 0) {
        this.cursorRing?.classList.add('active')
        // 锁定观察模式下：直接走视角旋转，不启动星座拖动
        if (this.lockViewMode) {
          this.isLeftDragging = true
          return
        }
        // 尝试启动星座拖动
        this.raycaster.setFromCamera(this.mouseNDC, this.camera)
        if (this.ornamentSystem.startDrag(this.raycaster)) {
          this.isDraggingConstellation = true
          this.dragMouseDownPos = { x: e.clientX, y: e.clientY }
          this.dragMoved = false
        } else {
          // 没命中星球 → 左键旋转视角
          this.isLeftDragging = true
        }
      }
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.isRightDragging = false
      if (e.button === 0) {
        this.cursorRing?.classList.remove('active')
        if (this.isDraggingConstellation) {
          this.ornamentSystem.endDrag()
          this.isDraggingConstellation = false
        }
        this.isLeftDragging = false
      }
    })

    window.addEventListener('contextmenu', (e) => e.preventDefault())

    window.addEventListener('wheel', (e) => {
      e.preventDefault()
      // 围绕中心点缩放
      this.cameraDistance *= (1 + e.deltaY * 0.001)
      this.cameraDistance = Math.max(this.MIN_DIST, Math.min(this.MAX_DIST, this.cameraDistance))
    }, { passive: false })

    if (statusEl) {
      statusEl.textContent = '比耶: 移动光标/停留0.5秒选中 | 张手: 启动应用 | 握拳: 取消选中 | Tab: 面板'
      statusEl.style.color = 'rgba(255,255,255,0.6)'
    }
    if ($hints) {
      $hints.innerHTML = `
        <div class="hint-item"><div class="hint-dot" style="background:#ffcc00"></div><span>Peace 移动/选中</span></div>
        <div class="hint-item"><div class="hint-dot" style="background:#cc66ff"></div><span>Palm 启动</span></div>
        <div class="hint-item"><div class="hint-dot" style="background:#ff6666"></div><span>Fist 取消</span></div>
        <div class="hint-item"><div class="hint-dot" style="background:#88ccff"></div><span>Tab 面板</span></div>
      `
    }
  }

  private setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      // 忽略面板输入
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      this.keysDown.add(e.key.toLowerCase())

      const gestureMap: Record<string, string> = {
        '1': 'pinch', '2': 'peace', '3': 'fist', '4': 'open_palm', '5': 'point',
      }
      if (gestureMap[e.key]) {
        this.handleGesture(gestureMap[e.key], 0.5, 0.5)
      }

      if (e.key === ' ') {
        e.preventDefault()
        const avgMix = this.particleSystem.getMixAverage()
        if (avgMix > 0.5) {
          this.particleSystem.morphToHeap(2.5)
        } else {
          this.particleSystem.morphToTarget(2.5)
        }
      }

      // Q/E: 在当前分类内切换形态
      if (e.key === 'q' || e.key === 'Q') {
        const currentCat = this.categoryNames[this.currentCategoryIndex]
        const catShapes = SHAPE_CATEGORIES[currentCat]
        const idxInCat = catShapes.indexOf(ALL_SHAPES[this.currentShapeIndex])
        const newIdx = (idxInCat - 1 + catShapes.length) % catShapes.length
        const shape = catShapes[newIdx]
        this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
        this.switchShape(shape)
        this.updatePanelHighlight()
      }
      if (e.key === 'e' || e.key === 'E') {
        const currentCat = this.categoryNames[this.currentCategoryIndex]
        const catShapes = SHAPE_CATEGORIES[currentCat]
        const idxInCat = catShapes.indexOf(ALL_SHAPES[this.currentShapeIndex])
        const newIdx = (idxInCat + 1) % catShapes.length
        const shape = catShapes[newIdx]
        this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
        this.switchShape(shape)
        this.updatePanelHighlight()
      }

      // W/S: 切换分类
      if (e.key === 'w' || e.key === 'W') {
        this.currentCategoryIndex = (this.currentCategoryIndex - 1 + this.categoryNames.length) % this.categoryNames.length
        const catShapes = SHAPE_CATEGORIES[this.categoryNames[this.currentCategoryIndex]]
        const shape = catShapes[0]
        this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
        this.switchShape(shape)
        this.updatePanelHighlight()
      }
      if (e.key === 's' || e.key === 'S') {
        this.currentCategoryIndex = (this.currentCategoryIndex + 1) % this.categoryNames.length
        const catShapes = SHAPE_CATEGORIES[this.categoryNames[this.currentCategoryIndex]]
        const shape = catShapes[0]
        this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
        this.switchShape(shape)
        this.updatePanelHighlight()
      }

      // Tab: 切换形态面板
      if (e.key === 'Tab') {
        e.preventDefault()
        this.togglePanel()
      }

      // C: 切换星座面板
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        this.toggleConstellationPanel()
      }

      // V: 切换星座连线显示
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        const visible = this.ornamentSystem.toggleConstellationLines()
        const statusEl = document.getElementById('status')
        if (statusEl) {
          statusEl.textContent = `星座连线: ${visible ? '显示' : '隐藏'}`
          statusEl.style.color = '#88ccff'
        }
      }

      // N: 切换显示/隐藏所有星球的应用名称
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        const mode = this.ornamentSystem.cycleLabelDisplayMode()
        const statusEl = document.getElementById('status')
        if (statusEl) {
          statusEl.textContent = `应用名称：${mode}`
          statusEl.style.color = mode === '隐藏' ? '#ff8866' : '#88ff88'
        }
      }

      // L: 锁定/解锁观察模式（选中星球后按 L，可以自由拖动视角观察，不会取消选中）
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        if (this.clickedCenterTarget) {
          // 有选中状态下才能切换锁定
          this.lockViewMode = !this.lockViewMode
          const statusEl = document.getElementById('status')
          if (statusEl) {
            statusEl.textContent = this.lockViewMode ? '🔒 锁定观察模式 — 自由拖动视角，再次按 L 或 ESC 退出' : '🔓 已解锁观察模式'
            statusEl.style.color = this.lockViewMode ? '#ffaa00' : '#88ff88'
          }
        } else {
          const statusEl = document.getElementById('status')
          if (statusEl) {
            statusEl.textContent = '请先选中星球/星座再按 L 锁定'
            statusEl.style.color = '#ff8866'
          }
        }
      }

      // ESC: 退出锁定观察模式（不取消选中）
      if (e.key === 'Escape') {
        if (this.lockViewMode) {
          this.lockViewMode = false
          const statusEl = document.getElementById('status')
          if (statusEl) {
            statusEl.textContent = '🔓 已退出锁定观察模式'
            statusEl.style.color = '#88ff88'
          }
        }
      }

      // R: 切换相机围绕中心的公转（不是星球自身光环旋转）
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        this.cameraAutoRotateEnabled = !this.cameraAutoRotateEnabled
        const statusEl = document.getElementById('status')
        if (statusEl) {
          statusEl.textContent = this.cameraAutoRotateEnabled ? '相机公转：开启' : '相机公转：已停止'
          statusEl.style.color = this.cameraAutoRotateEnabled ? '#88ff88' : '#ff8866'
        }
      }

      // T: 启动自动测试模式（循环播放所有形态）
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        this.startAutoTest()
      }

      // 数字键 6-0 快速跳转到分类
      const catNum = parseInt(e.key)
      if (catNum >= 6 && catNum <= 9) {
        const catIdx = catNum - 6
        if (catIdx < this.categoryNames.length) {
          this.currentCategoryIndex = catIdx
          const catShapes = SHAPE_CATEGORIES[this.categoryNames[catIdx]]
          const shape = catShapes[0]
          this.currentShapeIndex = ALL_SHAPES.indexOf(shape)
          this.switchShape(shape)
          this.updatePanelHighlight()
        }
      }
    })

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key.toLowerCase())
    })
  }

  // ========== 自动测试模式 ==========

  private autoTestTimeout: number | null = null
  private autoTestIndex = 0
  private autoTestRunning = false

  private startAutoTest() {
    // 防止重复启动：如果已在运行，先停止再重启
    if (this.autoTestTimeout !== null) {
      clearTimeout(this.autoTestTimeout)
      this.autoTestTimeout = null
    }

    this.autoTestRunning = true
    this.autoTestIndex = 0

    const statusEl = document.getElementById('status')
    if (statusEl) {
      statusEl.textContent = '自动测试: 开始...'
      statusEl.style.color = '#ffcc00'
    }

    // 短暂延迟后开始第一步
    this.autoTestTimeout = window.setTimeout(() => this.runAutoTestStep(), 600)
  }

  private runAutoTestStep() {
    if (!this.autoTestRunning) return
    const statusEl = document.getElementById('status')

    // 完成检查
    if (this.autoTestIndex >= ALL_SHAPES.length) {
      this.autoTestRunning = false
      this.autoTestTimeout = null
      if (statusEl) {
        statusEl.textContent = '自动测试: 完成！'
        statusEl.style.color = '#00ff88'
      }
      return
    }

    const shape = ALL_SHAPES[this.autoTestIndex]
    this.currentShapeIndex = this.autoTestIndex

    // 更新分类索引
    for (let i = 0; i < this.categoryNames.length; i++) {
      const catShapes = SHAPE_CATEGORIES[this.categoryNames[i]]
      if (catShapes.includes(shape)) {
        this.currentCategoryIndex = i
        break
      }
    }

    this.switchShape(shape)
    this.updatePanelHighlight()

    if (statusEl) {
      statusEl.textContent = `自动测试 [${this.autoTestIndex + 1}/${ALL_SHAPES.length}]: ${SHAPE_LABELS[shape]}`
      statusEl.style.color = '#ffcc00'
    }

    this.autoTestIndex++
    // 每 3 秒切换一个形态（链式 setTimeout，避免堆积）
    this.autoTestTimeout = window.setTimeout(() => this.runAutoTestStep(), 3000)
  }

  private stopAutoTest() {
    this.autoTestRunning = false
    if (this.autoTestTimeout !== null) {
      clearTimeout(this.autoTestTimeout)
      this.autoTestTimeout = null
    }
  }

  private switchShape(shape: ParticleShape) {
    this.particleSystem.morphToShape(shape)
    this.audioManager.playMorphStart()

    const cat = this.categoryNames[this.currentCategoryIndex]
    const statusEl = document.getElementById('status')
    if (statusEl) {
      statusEl.textContent = `${cat} / ${SHAPE_LABELS[shape]}`
      statusEl.style.color = '#66ffcc'
    }

    // 形态指示器：分类标签 + 名称 + 进度条
    const indicator = document.getElementById('shape-indicator')
    if (indicator) {
      indicator.innerHTML = `<span class="shape-cat">${cat}</span>${SHAPE_LABELS[shape]}`
    }
    const progressEl = document.getElementById('shape-progress')
    if (progressEl) {
      const progress = ((this.currentShapeIndex + 1) / ALL_SHAPES.length) * 100
      progressEl.style.setProperty('--progress', `${progress}%`)
    }
  }

  // ========== 手势处理（键盘 1-5 触发，兼容旧逻辑）==========

  private handleGesture(gesture: string, handX: number, handY: number) {
    // 现在手势不再直接启动软件，而是通过 handleGestureForOrb 处理
    // 这个方法保留给键盘 1-5 触发用
    this.handleGestureForOrb(gesture)
  }

  // ========== 鼠标到世界坐标 ==========

  private getMouseWorldOnPlane(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouseNDC, this.camera)
    const cameraDir = new THREE.Vector3()
    this.camera.getWorldDirection(cameraDir)
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(cameraDir.clone().negate(), new THREE.Vector3(0, 0.5, 0))
    const target = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, target)
  }

  // ===== 新增：手势选中星球 =====
  // 捏合 → 选中最近的星球（不需要精确对准）
  private handleHandSelect() {
    const now = performance.now()
    if (now - this.handLastClickTime < 300) return
    this.handLastClickTime = now

    // 光标反馈
    if (this.cursorRing) {
      this.cursorRing.classList.add('burst')
      window.setTimeout(() => this.cursorRing?.classList.remove('burst'), 400)
    }

    // 方法1：射线检测
    this.raycaster.setFromCamera(this.mouseNDC, this.camera)
    const hit = this.ornamentSystem.raycast(this.raycaster)

    const statusEl = document.getElementById('status')
    console.log('[选中调试] raycast 结果:', hit, 'mouseNDC:', this.mouseNDC.x.toFixed(2), this.mouseNDC.y.toFixed(2))

    if (hit) {
      // 射线命中 → 选中
      this.ornamentSystem.selectByName(hit)
      this.audioManager.playHover()
      if (statusEl) {
        statusEl.textContent = `已选中: ${hit} — 张手启动`
        statusEl.style.color = '#66ffcc'
      }
    } else {
      // 射线没命中 → 找最近的星球（距离判断）
      const worldPos = this.getMouseWorldOnPlane()
      if (worldPos) {
        const nearest = this.ornamentSystem.findNearestOrnament(worldPos, 6.0) // 6.0 范围内（更宽松）
        if (nearest) {
          this.ornamentSystem.selectOrnament(nearest)
          this.audioManager.playHover()
          if (statusEl) {
            statusEl.textContent = `已选中: ${nearest.app.name} — 张手启动`
            statusEl.style.color = '#66ffcc'
          }
          console.log('[选中调试] 通过距离选中:', nearest.app.name)
          return
        }
      }

      // 真的没有星球 → 如果有选中的，取消；没有就炸粒子
      const selected = this.ornamentSystem.getSelectedOrnament()
      if (selected) {
        this.ornamentSystem.deselectAll()
        if (statusEl) {
          statusEl.textContent = '已取消选中'
          statusEl.style.color = 'rgba(255,255,255,0.5)'
        }
      } else {
        if (worldPos) {
          this.particleSystem.burstAt(worldPos.x, worldPos.y, worldPos.z, 200)
        }
      }
    }
  }

  // ===== 手势控制星球 =====
  // 张开手掌 → 打开选中的应用
  // 握拳 → 取消选中；如果没有选中，则把主窗口带回前台（解决打开应用后失控的问题）
  private handleGestureForOrb(gesture: string) {
    const now = performance.now()
    const lastTime = this.gestureCooldown.get(gesture) || 0
    if (now - lastTime < this.COOLDOWN_MS) return

    const selected = this.ornamentSystem.getSelectedOrnament()
    const statusEl = document.getElementById('status')

    if (gesture === 'open_palm') {
      // 张开手掌 → 打开选中的应用
      if (selected) {
        this.gestureCooldown.set(gesture, now)
        this.ornamentSystem.activateByAppName(selected.app.name)
        this.ornamentSystem.deselectOrnament(selected)
        if (statusEl) {
          statusEl.textContent = `🚀 启动: ${selected.app.name}`
          statusEl.style.color = '#00ff88'
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '请先 peace 手势选中一个星球'
          statusEl.style.color = 'rgba(255,255,255,0.4)'
        }
      }
    } else if (gesture === 'fist') {
      // 握拳 → 取消选中（包括鼠标点击选中和手势选中），或把主窗口带回前台
      const clicked = this.ornamentSystem.getClickedOrnament()
      if (selected || clicked) {
        this.gestureCooldown.set(gesture, now)
        if (selected) this.ornamentSystem.deselectAll()
        if (clicked) {
          // 恢复群组位置和缩放
          const group = this.ornamentSystem.getLastClickedGroup()
          for (const o of group) {
            if (this.ornamentSystem.isRingMode()) {
              // 环模式：立即重置缩放（不动画），防止放大状态与环上其他星球穿透
              o.mesh.scale.set(1, 1, 1)
              o.positionAnimating = false
            } else {
              // 非环模式：恢复到原始位置
              gsap.to(o.mesh.position, { x: o.basePosition.x, y: o.basePosition.y, z: o.basePosition.z, duration: 0.4, ease: 'power2.out' })
              gsap.to(o.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' })
              o.positionAnimating = false
            }
          }
          this.ornamentSystem.clearLastClickedGroup()
          this.ornamentSystem.clearClickSelection()
          this.clickedCenterTarget = null
          // 恢复光标显示
          if (this.cursorRing) this.cursorRing.style.opacity = '1'
          if (this.cursorDot) this.cursorDot.style.opacity = '1'
        }
        if (statusEl) {
          statusEl.textContent = '已取消选中'
          statusEl.style.color = 'rgba(255,255,255,0.5)'
        }
      } else if (window.electronAPI) {
        // 没有选中时，尝试把主窗口带回前台继续控制
        this.gestureCooldown.set(gesture, now)
        window.electronAPI.keyTap('tab', 'command').then(() => {
          if (statusEl) {
            statusEl.textContent = '已切换回手势控制'
            statusEl.style.color = '#88ccff'
          }
        })
      }
    }
  }

  // ========== 动画循环 ==========

  private animate() {
    requestAnimationFrame(() => this.animate())

    const dt = Math.min(this.clock.getDelta(), 0.1)
    const time = this.clock.elapsedTime

    // 相机：完全 360° 围绕中心点旋转 + 滚轮缩放（四元数方案，无奇异点）
    const hasClickedSelection = this.clickedCenterTarget !== null
    // R 键控制相机围绕中心的公转
    // 选中状态下相机继续公转，选中星座跟随相机移动保持在屏幕正中间
    if (!this.isRightDragging && !this.isLeftDragging && this.cameraAutoRotateEnabled) {
      this.cameraYaw += dt * 0.12  // 自动公转
    }
    // 用四元数组合 yaw 和 pitch，避免球面坐标的极点奇异性
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw)
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraPitch)
    const qTotal = qYaw.multiply(qPitch)
    // 相机初始位置（朝 -Z 看），经过旋转后得到实际位置
    const offset = new THREE.Vector3(0, 0, this.cameraDistance).applyQuaternion(qTotal)
    this.camera.position.copy(offset).add(new THREE.Vector3(0, 0.5, 0))
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(qTotal)
    this.camera.up.copy(up)

    // 选中状态下：每帧把选中群组移到相机正前方，让用户可以任意角度观察
    if (hasClickedSelection && this.clickedCenterTarget) {
      // 计算相机正前方的目标位置（根据当前缩放距离，保持合适比例）
      const cameraDir = new THREE.Vector3()
      this.camera.getWorldDirection(cameraDir)
      const viewDistance = this.cameraDistance * 0.45  // 跟随缩放比例，不远不近
      const targetPos = this.camera.position.clone().add(cameraDir.multiplyScalar(viewDistance))
      // 更新每个选中星球的位置（保持相对位置）
      const group = this.ornamentSystem.getClickedGroupOrnaments()
      group.forEach((o, idx) => {
        const relativePos = this.clickedGroupRelativePositions.get(idx)
        if (relativePos) {
          const newPos = targetPos.clone().add(relativePos)
          o.mesh.position.copy(newPos)
        }
      })
      // 相机看向选中群组中心
      this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z)
    } else {
      this.camera.lookAt(0, 0.5, 0)
    }

    // 鼠标交互
    if (this.mouseActive) {
      // 始终更新 hover 检测（即使射线与粒子平面不相交，也要清除过期的 hover 状态）
      this.raycaster.setFromCamera(this.mouseNDC, this.camera)
      this.ornamentSystem.checkHoverRay(this.raycaster)
      const worldPos = this.getMouseWorldOnPlane()
      if (worldPos) {
        this.particleSystem.updateHandPosition(worldPos.x, worldPos.y)
      }
    }

    // 星空旋转
    this.starField.rotation.y += dt * 0.02
    this.starField.rotation.x += dt * 0.005

    // 远景尘埃缓慢漂移
    if (this.dustField) {
      this.dustField.rotation.y += dt * 0.01
      this.dustField.rotation.x += dt * 0.003
    }

    // 雪花飘落
    this.updateSnow(dt)

    // 光柱呼吸
    ;(this.lightBeam.material as THREE.MeshBasicMaterial).opacity = 0.06 + Math.sin(time * 2) * 0.03
    this.lightBeam.rotation.y += dt * 0.5

    // 地面光环脉冲
    ;(this.groundRing.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(time * 1.5) * 0.04
    this.groundRing.rotation.z += dt * 0.1

    // 极光
    ;(this.auroraMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time

    // 主系统
    this.particleSystem.update(dt, time)
    this.ornamentSystem.update(dt, time)

    // 后处理时间更新
    if (this.finalePass) {
      this.finalePass.uniforms.uTime.value = time
    }

    // 鼠标拖尾衰减
    for (let i = this.cursorTrail.length - 1; i >= 0; i--) {
      this.cursorTrail[i].life -= dt * 3
      if (this.cursorTrail[i].life <= 0) this.cursorTrail.splice(i, 1)
    }

    this.composer.render()
  }

  private updateSnow(dt: number) {
    const positions = this.snowParticles.geometry.attributes.position.array as Float32Array
    const velocities = this.snowParticles.geometry.attributes.velocity.array as Float32Array

    for (let i = 0; i < positions.length / 3; i++) {
      const i3 = i * 3
      positions[i3] += velocities[i3] + Math.sin(positions[i3 + 1] * 2) * 0.002
      positions[i3 + 1] += velocities[i3 + 1]
      positions[i3 + 2] += velocities[i3 + 2]

      if (positions[i3 + 1] < -4) {
        positions[i3] = (Math.random() - 0.5) * 20
        positions[i3 + 1] = 12 + Math.random() * 3
        positions[i3 + 2] = (Math.random() - 0.5) * 20
      }
    }
    this.snowParticles.geometry.attributes.position.needsUpdate = true
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.composer.setSize(window.innerWidth, window.innerHeight)
  }
}

;(window as any).__app = new App()
