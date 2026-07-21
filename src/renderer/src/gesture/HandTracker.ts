import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { DebugLogger } from './DebugLogger'

// ===== 核心类型定义 =====

export type HandSide = 'Left' | 'Right'

export type Gesture =
  | 'unknown'
  | 'pinch'
  | 'fist'
  | 'point'
  | 'peace'
  | 'open_palm'
  | 'back_palm'
  | 'palm_down'
  | 'palm_up'

export type ComboGesture =
  | 'both_fist'
  | 'both_open_palm'
  | 'both_pinch'
  | 'both_peace'

export type PalmFacing =
  | 'toward_camera'
  | 'away_from_camera'
  | 'facing_left'
  | 'facing_right'
  | 'facing_down'
  | 'facing_up'
  | 'oblique'
  | 'unknown'

export interface LandmarkLike {
  x: number
  y: number
  z?: number
}

interface Vec3 {
  x: number
  y: number
  z: number
}

export interface HandTrackerOptions {
  mirrorPointerX?: boolean
  swapHandednessLabels?: boolean
}

export interface ResolvedHand {
  side: HandSide
  landmarks: LandmarkLike[]
  worldLandmarks: LandmarkLike[] | null
  handednessScore: number
  hasWorldLandmarks: boolean
}

export interface PointerUpdate {
  side: HandSide
  screenX: number
  screenY: number
  normalizedX: number
  normalizedY: number
  rawGesture: Gesture
  stableGesture: Gesture
  armed: boolean
  handednessScore: number
  timestamp: number
}

export interface HandData {
  side: HandSide
  landmarks: LandmarkLike[]
  worldLandmarks: LandmarkLike[] | null
  gesture: Gesture
  stableGesture: Gesture
  x: number
  y: number
  isPinching: boolean
  pinchRatio: number
  smoothX: number
  smoothY: number
  palmFacing: PalmFacing
  handednessScore: number
}

interface GestureMetrics {
  pinchRatio: number
  averageTipToWristRatio: number
  hasWorldGeometry: boolean
}

interface HandDebugData {
  rawGesture: Gesture
  stableGesture: Gesture
  handednessScore: number
  palmFacing: PalmFacing
  pinchRatio: number
  indexAngle: number
  middleAngle: number
  ringAngle: number
  pinkyAngle: number
}

export interface TrackerDebugData {
  left: HandDebugData | null
  right: HandDebugData | null
  combo: ComboGesture | null
  mode: 'none' | 'single' | 'dual'
  inferenceEmaMs: number
  inferenceMaxMs: number
}

// ===== 回调类型 =====

type GestureCallback = (gesture: Gesture, handX: number, handY: number) => void
type PointerCallback = (pointer: PointerUpdate) => void
type PointerLostCallback = (event: { side: HandSide | null; timestamp: number }) => void
type ClickCallback = () => void
type ComboCallback = (combo: ComboGesture) => void
type DualHandCallback = (
  left: HandData,
  right: HandData,
  meta: { consumedByCombo: boolean }
) => void
type RestCallback = (resting: boolean) => void
// 方案A：左手操作手势回调（双手分工法专用）
type LeftHandGestureCallback = (gesture: Gesture, stableGesture: Gesture) => void

// ===== 几何工具函数 =====

function dist3D(a: LandmarkLike, b: LandmarkLike): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function vsub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function vcross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

function getFingerAngle(lm: LandmarkLike[], a: number, b: number, c: number): number {
  const bax = lm[a].x - lm[b].x
  const bay = lm[a].y - lm[b].y
  const baz = (lm[a].z ?? 0) - (lm[b].z ?? 0)

  const bcx = lm[c].x - lm[b].x
  const bcy = lm[c].y - lm[b].y
  const bcz = (lm[c].z ?? 0) - (lm[b].z ?? 0)

  const baSq = bax * bax + bay * bay + baz * baz
  const bcSq = bcx * bcx + bcy * bcy + bcz * bcz

  if (baSq < 1e-12 || bcSq < 1e-12) {
    return 180
  }

  const cosine = Math.max(
    -1,
    Math.min(
      1,
      (bax * bcx + bay * bcy + baz * bcz) / Math.sqrt(baSq * bcSq)
    )
  )

  return Math.acos(cosine) * 180 / Math.PI
}

function getGestureMetrics(
  landmarks: LandmarkLike[],
  worldLandmarks: LandmarkLike[] | null
): GestureMetrics {
  const geometry = worldLandmarks?.length === 21 ? worldLandmarks : landmarks

  const palmScale = Math.max(dist3D(geometry[0], geometry[9]), 1e-6)

  const pinchRatio = dist3D(geometry[4], geometry[8]) / palmScale

  const averageTipToWristRatio =
    [8, 12, 16, 20].reduce((sum, index) => sum + dist3D(geometry[index], geometry[0]), 0) /
    (4 * palmScale)

  return {
    pinchRatio,
    averageTipToWristRatio,
    hasWorldGeometry: Boolean(worldLandmarks?.length === 21)
  }
}

function getPalmFacing(wlm: LandmarkLike[] | null, side: HandSide): PalmFacing {
  if (!wlm || wlm.length !== 21) {
    return 'unknown'
  }

  const v1 = vsub(wlm[5] as Vec3, wlm[0] as Vec3)
  const v2 = vsub(wlm[17] as Vec3, wlm[0] as Vec3)

  const normal = side === 'Right' ? vcross(v1, v2) : vcross(v2, v1)

  const magnitude = Math.hypot(normal.x, normal.y, normal.z)

  if (magnitude < 1e-7) {
    return 'unknown'
  }

  const x = normal.x / magnitude
  const y = normal.y / magnitude
  const z = normal.z / magnitude

  const absX = Math.abs(x)
  const absY = Math.abs(y)
  const absZ = Math.abs(z)
  const threshold = 0.72

  if (absZ >= absX && absZ >= absY && absZ >= threshold) {
    return z > 0 ? 'toward_camera' : 'away_from_camera'
  }

  if (absX >= absY && absX >= absZ && absX >= threshold) {
    return x > 0 ? 'facing_right' : 'facing_left'
  }

  if (absY >= absX && absY >= absZ && absY >= threshold) {
    return y > 0 ? 'facing_up' : 'facing_down'
  }

  return 'oblique'
}

// ===== 主类 =====

export class HandTracker {
  private video: HTMLVideoElement
  private readonly mirrorPointerX: boolean
  private readonly swapHandednessLabels: boolean

  private handLandmarker: HandLandmarker | null = null
  private isRunning = false
  private destroyed = false
  private animationFrameId = 0

  // 检测节流
  private lastVideoTime = -1

  // 性能统计
  private inferenceEmaMs = 0
  private inferenceMaxMs = 0

  // 指针追踪
  private smoothX = 0.5
  private smoothY = 0.5
  private readonly SMOOTH_FACTOR = 0.5

  private pointerWasTracked = false
  private pointerLostSince = 0
  private readonly POINTER_LOST_GRACE_MS = 150
  private wasResting = false

  // 手势缓冲（左右手完全独立，避免互相干扰）
  private leftGestureBuffer: Gesture[] = []
  private rightGestureBuffer: Gesture[] = []
  private readonly BUFFER_SIZE = 5          // 缓冲区长度
  private readonly VOTE_THRESHOLD = 3        // 5帧中至少3帧相同就确认，手势响应更跟手
  private readonly PINCH_RATIO_THRESHOLD = 0.5

  // 稳定手势状态
  private leftStableGesture: Gesture = 'unknown'
  private rightStableGesture: Gesture = 'unknown'
  private leftStableChangeTime: Record<Gesture, number> = { unknown: 0, pinch: 0, fist: 0, point: 0, peace: 0, open_palm: 0, back_palm: 0, palm_down: 0, palm_up: 0 }
  private rightStableChangeTime: Record<Gesture, number> = { unknown: 0, pinch: 0, fist: 0, point: 0, peace: 0, open_palm: 0, back_palm: 0, palm_down: 0, palm_up: 0 }

  // 点击防抖：手势必须持续一定时长才触发点击，并加冷却防止重复
  private leftClickArmedSince = 0            // 左手进入"点击手势"的时间戳（0 表示未进入）
  private rightClickArmedSince = 0            // 右手进入"点击手势"的时间戳
  private readonly CLICK_HOLD_MS = 40         // 持续 40ms 才算一次有效点击，让捏合选中更灵敏
  private readonly CLICK_COOLDOWN_MS = 200    // 两次点击之间至少间隔 200ms（原 400，加速连击）
  private lastClickFiredTime = 0

  // 双手状态
  private leftHandData: HandData | null = null
  private rightHandData: HandData | null = null

  // 缩放状态
  private previousLeftPinchDistance: number | null = null
  public dualPinchZoomDelta = 0

  // 组合手势
  private activeCombo: ComboGesture | null = null
  private lastComboTime = 0
  private readonly COMBO_COOLDOWN = 1200
  private readonly COMBO_WINDOW = 600       // 放宽组合手势时间窗口，更符合人的实际操作节奏

  // 调试数据
  public debugData: TrackerDebugData | null = null

  // 回调
  private gestureCallback: GestureCallback | null = null
  private pointerCallback: PointerCallback | null = null
  private pointerLostCallback: PointerLostCallback | null = null
  private clickCallback: ClickCallback | null = null
  private comboCallback: ComboCallback | null = null
  private dualHandCallback: DualHandCallback | null = null
  private restCallback: RestCallback | null = null
  // 方案A：左手操作手势回调（双手分工法专用）
  private leftHandGestureCallback: LeftHandGestureCallback | null = null
  // 方案A：上一次左手稳定手势（用于检测变化）
  private prevLeftStableGesture: Gesture = 'unknown'
  // 方案A：左手操作手势冷却（防止重复触发）
  private lastLeftGestureTime = 0
  private readonly LEFT_GESTURE_COOLDOWN_MS = 250  // 左手操作冷却，太长会让捏合像没反应

  // 旧版兼容
  private cursorCallback: ((screenX: number, screenY: number) => void) | null = null

  constructor(video: HTMLVideoElement, options: HandTrackerOptions = {}) {
    this.video = video
    this.mirrorPointerX = options.mirrorPointerX ?? true
    this.swapHandednessLabels = options.swapHandednessLabels ?? false
    void this.init()
  }

  // ===== 初始化 =====

  private async init(): Promise<void> {
    if (this.destroyed) return

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )

      this.handLandmarker = await this.createHandLandmarker(vision)

      if (this.destroyed) {
        this.handLandmarker?.close()
        return
      }

      await this.startCamera()

      if (this.destroyed) return

      this.isRunning = true
      this.detectLoop()

      const loading = document.getElementById('loading')
      if (loading) loading.textContent = '手势识别就绪'
    } catch (error) {
      console.error('HandTracker init error:', error)
      const loading = document.getElementById('loading')
      if (loading) {
        loading.textContent = '摄像头错误 — 请检查权限'
        loading.style.color = '#ff4444'
      }
    }
  }

  private async createHandLandmarker(vision: any): Promise<HandLandmarker> {
    const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    const common = { runningMode: 'VIDEO' as const, numHands: 2 }

    try {
      return await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        ...common
      })
    } catch (error) {
      console.warn('[HandTracker] GPU 初始化失败，回退 CPU', error)
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        ...common
      })
    }
  }

  private async startCamera(): Promise<void> {
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
    tempStream.getTracks().forEach(t => t.stop())

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    const iriunDevice = videoDevices.find(d =>
      d.label.toLowerCase().includes('iriun') ||
      d.label.toLowerCase().includes('webcam') ||
      d.label.toLowerCase().includes('cam')
    )

    let stream: MediaStream
    if (iriunDevice) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: iriunDevice.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
      })
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
    }

    this.video.srcObject = stream
    await this.video.play()
    this.video.classList.add('active')
  }

  // ===== 回调注册 =====

  onGesture(callback: GestureCallback): void { this.gestureCallback = callback }
  onPointerUpdate(callback: PointerCallback): void {
    console.log('[HandTracker] onPointerUpdate registered')
    this.pointerCallback = callback
  }
  onPointerLost(callback: PointerLostCallback): void { this.pointerLostCallback = callback }
  onClick(callback: ClickCallback): void { this.clickCallback = callback }
  onComboGesture(callback: ComboCallback): void { this.comboCallback = callback }
  onDualHandInput(callback: DualHandCallback): void { this.dualHandCallback = callback }
  onRest(callback: RestCallback): void { this.restCallback = callback }

  // 方案A：注册左手操作手势回调（双手分工法专用）
  // 右手负责指向（光标移动），左手负责操作（选中/取消/启动）
  onLeftHandGesture(callback: LeftHandGestureCallback): void { this.leftHandGestureCallback = callback }

  // 旧版兼容
  onCursorMove(callback: (screenX: number, screenY: number) => void): void { this.cursorCallback = callback }

  // ===== 检测循环 =====

  private detectLoop = (): void => {
    if (!this.isRunning || this.destroyed) return

    this.animationFrameId = requestAnimationFrame(this.detectLoop)

    if (!this.handLandmarker) return
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
    if (this.video.currentTime === this.lastVideoTime) return

    this.lastVideoTime = this.video.currentTime
    const timestamp = performance.now()

    try {
      const startedAt = performance.now()
      const results = this.handLandmarker.detectForVideo(this.video, timestamp)
      const elapsed = performance.now() - startedAt

      this.inferenceEmaMs += (elapsed - this.inferenceEmaMs) * 0.1
      this.inferenceMaxMs = Math.max(this.inferenceMaxMs, elapsed)

      this.consumeResults(results, timestamp)
    } catch (error) {
      console.warn('[HandTracker] detect error:', error)
    }
  }

  // ===== 结果消费 =====

  private consumeResults(results: any, timestamp: number): void {
    if (!results?.landmarks?.length) {
      DebugLogger.logPerFrame('HandTracker', '🈳 没有检测到手')
      this.handleNoPointer(timestamp)
      this.debugData = {
        left: null,
        right: null,
        combo: null,
        mode: 'none',
        inferenceEmaMs: this.inferenceEmaMs,
        inferenceMaxMs: this.inferenceMaxMs
      }
      return
    }

    DebugLogger.logPerFrame('HandTracker', `检测到 ${results.landmarks.length} 只手`)

    const hands = this.resolveHands(results)

    if (hands.length >= 2) {
      const left = hands.find(h => h.side === 'Left')
      const right = hands.find(h => h.side === 'Right')

      if (left && right) {
        DebugLogger.logPerFrame('HandTracker', '👐 双手模式')
        this.processDualHands(left, right, timestamp)
      } else if (hands[0]) {
        DebugLogger.logPerFrame('HandTracker', `👆 单手模式: ${hands[0].side}`)
        this.processSingleHand(hands[0], timestamp)
      }
    } else if (hands[0]) {
      DebugLogger.logPerFrame('HandTracker', `👆 单手模式: ${hands[0].side}`)
      this.processSingleHand(hands[0], timestamp)
    }
  }

  // ===== 左右手解析 =====

  private resolveHands(results: any): ResolvedHand[] {
    const { landmarks, worldLandmarks, handedness } = results
    const hands: ResolvedHand[] = []

    for (let i = 0; i < landmarks.length; i++) {
      const handInfo = handedness?.[i]?.[0]
      let rawSide: HandSide = handInfo?.categoryName as HandSide
      let score = handInfo?.score ?? 0

      if (!rawSide || score < 0.65) {
        // 回退到位置推断
        // 注意：镜像模式下（mirrorPointerX = true），画面左右翻转
        // 用户右手在画面左侧（镜像后看起来在右侧）
        // MediaPipe 的 landmarks.x 是原始坐标（非镜像）
        // 所以 x > 0.5 表示在画面右侧（原始）= 用户的左手（镜像后）
        // 但这里我们用镜像后的逻辑：x < 0.5 是用户的右手
        rawSide = landmarks[i][0].x < 0.5 ? 'Right' : 'Left'
        score = 0.5
      }

      // 根据配置决定是否交换标签
      // swapHandednessLabels: true → 修正 MediaPipe 的左右手标签
      // （MediaPipe 返回的 Left/Right 是镜像视角的，和用户实际左右手相反）
      const side: HandSide = this.swapHandednessLabels
        ? (rawSide === 'Left' ? 'Right' : 'Left')
        : rawSide

      // 调试日志：查看 MediaPipe 原始返回和最终结果
      DebugLogger.logPerFrame('HandTracker:左右手', `手${i}: MediaPipe原始=${rawSide} 置信度=${score.toFixed(2)} 手腕X=${landmarks[i][0].x.toFixed(2)} swap=${this.swapHandednessLabels} → 最终=${side}`)

      // 最终结果已在上面一行输出

      hands.push({
        side,
        landmarks: landmarks[i],
        worldLandmarks: worldLandmarks?.[i] ?? null,
        handednessScore: score,
        hasWorldLandmarks: Boolean(worldLandmarks?.[i]?.length === 21)
      })
    }

    // 处理两只手被解析为同一侧的情况：按手腕位置稳定分配，避免置信度抖动导致左右手来回交换。
    if (hands.length === 2 && hands[0].side === hands[1].side) {
      const firstX = hands[0].landmarks[0]?.x ?? 0.5
      const secondX = hands[1].landmarks[0]?.x ?? 0.5
      const leftIndex = firstX <= secondX ? 0 : 1
      const rightIndex = leftIndex === 0 ? 1 : 0

      if (this.swapHandednessLabels) {
        hands[leftIndex].side = 'Left'
        hands[rightIndex].side = 'Right'
      } else {
        hands[leftIndex].side = 'Right'
        hands[rightIndex].side = 'Left'
      }
    }

    return hands
  }

  // ===== 手势分类 =====

  private classifyGesture(
    landmarks: LandmarkLike[],
    worldLandmarks: LandmarkLike[] | null,
    palmFacing: PalmFacing
  ): Gesture {
    const geometry = worldLandmarks?.length === 21 ? worldLandmarks : landmarks

    const indexAngle = getFingerAngle(geometry, 5, 6, 8)
    const middleAngle = getFingerAngle(geometry, 9, 10, 12)
    const ringAngle = getFingerAngle(geometry, 13, 14, 16)
    const pinkyAngle = getFingerAngle(geometry, 17, 18, 20)

    // 方案A：放宽手指伸直阈值
    // 原阈值 145-150 太严格，自然张开手掌时小指/无名指很难达到
    // 修复：降低到 130 度（更符合自然手势）
    const indexExtended = indexAngle > 130
    const middleExtended = middleAngle > 130
    const ringExtended = ringAngle > 130
    const pinkyExtended = pinkyAngle > 130

    const metrics = getGestureMetrics(landmarks, worldLandmarks)

    const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length

    // 捏合优先级最高：拇指和食指贴近时，其他手指张开也算捏合。
    if (metrics.pinchRatio < this.PINCH_RATIO_THRESHOLD) {
      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → pinch`)
      return 'pinch'
    }

    // 3 根以上手指伸直算 open_palm。
    if (extendedCount >= 3) {
      // 方案A：双手分工法 - 五指张开统一识别为 open_palm
      // 不再根据 palmFacing 拆分成 back_palm/palm_down/palm_up
      // 因为右手张开手掌就是"指向"手势，朝向不影响功能
      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → open_palm`)
      return 'open_palm'
    }

    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && metrics.averageTipToWristRatio < 1.05) {
      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → fist`)
      return 'fist'
    }

    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → point`)
      return 'point'
    }

    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → peace`)
      return 'peace'
    }

      DebugLogger.logPerFrame('HandTracker:手势分类', `手指角度: 食指=${indexAngle.toFixed(1)} 中指=${middleAngle.toFixed(1)} 无名指=${ringAngle.toFixed(1)} 小指=${pinkyAngle.toFixed(1)} 伸直数=${extendedCount} 捏合比=${metrics.pinchRatio.toFixed(2)} → unknown`)
    return 'unknown'
  }

  // ===== 单手处理 =====

  private processSingleHand(hand: ResolvedHand, timestamp: number): void {
    const palmFacing = getPalmFacing(hand.worldLandmarks, hand.side)
    const gesture = this.classifyGesture(hand.landmarks, hand.worldLandmarks, palmFacing)

    // 记录变化前的稳定手势（用于点击检测）
    const prevStable = hand.side === 'Left' ? this.leftStableGesture : this.rightStableGesture

    const stableGesture = this.updateStableGesture(hand.side, gesture, timestamp)

    // 单手模式也坚持双手分工：右手才是光标，左手只做操作。
    if (hand.side === 'Right') {
      this.updatePointer(hand, gesture, stableGesture, timestamp)
    }

    DebugLogger.gestureStateChange('HandTracker:单手', `手=${hand.side} 原始手势=${gesture} 稳定手势=${stableGesture}`)

    // ===== 点击检测：pinch/peace 必须持续 CLICK_HOLD_MS 才触发，并加冷却防重复 =====
    // 解决问题：手势短暂闪烁时被误判为点击
    // 方案A：单手模式下，只有左手才能触发点击选中，右手只负责移动光标
    if (hand.side === 'Left') {
      const isClickGesture = stableGesture === 'pinch' || stableGesture === 'peace'
      const wasClickGesture = prevStable === 'pinch' || prevStable === 'peace'
      if (isClickGesture) {
        // 刚进入点击手势 → 记录开始时间
        if (!wasClickGesture) {
          this.leftClickArmedSince = timestamp
        } else {
          // 持续够久 + 冷却已过 → 触发点击
          if (this.leftClickArmedSince > 0 && timestamp - this.leftClickArmedSince >= this.CLICK_HOLD_MS) {
            if (timestamp - this.lastClickFiredTime >= this.CLICK_COOLDOWN_MS) {
              this.lastClickFiredTime = timestamp
              // 重置 armedSince，防止持续按住时重复触发
              this.leftClickArmedSince = 0
              this.clickCallback?.()
                DebugLogger.important('HandTracker:点击', `手=${hand.side} 稳定手势=${stableGesture} 持续${timestamp - this.leftClickArmedSince}ms → 触发点击`)
            }
          }
        }
      } else {
        // 离开点击手势 → 清零
        this.leftClickArmedSince = 0
      }
    } else {
      DebugLogger.logPerFrame('HandTracker:单手', `右手在单手模式，不触发点击（仅左手可操作）`)
    }

    // ===== 休息模式回调：手回来时通知非休息 =====
    if (this.wasResting) {
      this.wasResting = false
    DebugLogger.event('HandTracker:休息', '手回来了，退出休息模式')
      this.restCallback?.(false)
    }

    // 手势回调（方案A：单手模式下仅左手触发，右手不触发操作）
    if (this.gestureCallback && stableGesture !== 'unknown' && hand.side === 'Left') {
      this.gestureCallback(stableGesture, hand.landmarks[0].x, hand.landmarks[0].y)
    }

    // 更新调试数据
    const metrics = getGestureMetrics(hand.landmarks, hand.worldLandmarks)
    this.debugData = {
      left: hand.side === 'Left' ? {
        rawGesture: gesture,
        stableGesture,
        handednessScore: hand.handednessScore,
        palmFacing,
        pinchRatio: metrics.pinchRatio,
        indexAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 5, 6, 8),
        middleAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 9, 10, 12),
        ringAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 13, 14, 16),
        pinkyAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 17, 18, 20)
      } : null,
      right: hand.side === 'Right' ? {
        rawGesture: gesture,
        stableGesture,
        handednessScore: hand.handednessScore,
        palmFacing,
        pinchRatio: metrics.pinchRatio,
        indexAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 5, 6, 8),
        middleAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 9, 10, 12),
        ringAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 13, 14, 16),
        pinkyAngle: getFingerAngle(hand.worldLandmarks ?? hand.landmarks, 17, 18, 20)
      } : null,
      combo: null,
      mode: 'single' as const,
      inferenceEmaMs: this.inferenceEmaMs,
      inferenceMaxMs: this.inferenceMaxMs
    }
  }

  // ===== 双手处理 =====

  private processDualHands(left: ResolvedHand, right: ResolvedHand, timestamp: number): void {
    const leftPalmFacing = getPalmFacing(left.worldLandmarks, 'Left')
    const rightPalmFacing = getPalmFacing(right.worldLandmarks, 'Right')

    const leftGesture = this.classifyGesture(left.landmarks, left.worldLandmarks, leftPalmFacing)
    const rightGesture = this.classifyGesture(right.landmarks, right.worldLandmarks, rightPalmFacing)

    // 记录变化前的右手稳定手势（用于点击检测）
    const prevRightStable = this.rightStableGesture

    const leftStable = this.updateStableGesture('Left', leftGesture, timestamp)
    const rightStable = this.updateStableGesture('Right', rightGesture, timestamp)

    DebugLogger.gestureStateChange('HandTracker:双手', `左手: ${leftGesture}→${leftStable} | 右手: ${rightGesture}→${rightStable}`)

    // ===== 关键日志：左手捏合链路追踪 =====
    if (leftGesture === 'pinch' || leftStable === 'pinch' || this.prevLeftStableGesture === 'pinch') {
      DebugLogger.important('HandTracker:左手捏合追踪', `原始=${leftGesture} 稳定=${leftStable} 上次稳定=${this.prevLeftStableGesture} 冷却剩余=${Math.max(0, this.LEFT_GESTURE_COOLDOWN_MS - (timestamp - this.lastLeftGestureTime))}ms`)
    }

    // 方案A：右手只负责"指向"（更新光标位置）
    this.updatePointer(right, rightGesture, rightStable, timestamp)

    // 手势缩放关闭：握拳/松拳过程容易被短暂识别成捏合，导致相机突然冲进星球中心。
    this.dualPinchZoomDelta = 0
    this.previousLeftPinchDistance = null

    // 组合手势检测
    const combo = this.detectComboGesture(leftStable, rightStable, timestamp)

    if (combo) {
      this.comboCallback?.(combo)
    }

    // 方案A：双手分工法 - 右手不再触发 clickCallback
    // 左手负责操作手势：pinch → 选中, fist → 取消, open_palm → 启动
    // 通过 leftHandGestureCallback 通知 App.ts
    const leftOperationChanged = leftStable !== this.prevLeftStableGesture
    const leftPinchHeld = leftStable === 'pinch'
    if (!combo && leftStable !== 'unknown' && (leftOperationChanged || leftPinchHeld)) {
      // 左手稳定手势变化 + 冷却检查
      if (timestamp - this.lastLeftGestureTime >= this.LEFT_GESTURE_COOLDOWN_MS) {
        // 只在左手做出明确操作手势时触发
        if (leftStable === 'pinch' || leftStable === 'fist' || leftStable === 'open_palm') {
          DebugLogger.important('HandTracker:左手操作触发', `手势=${leftStable} 通过冷却，调用 leftHandGestureCallback`)
          this.lastLeftGestureTime = timestamp
          this.leftHandGestureCallback?.(leftGesture, leftStable)
        } else {
          DebugLogger.logPerFrame('HandTracker:左手操作', `手势=${leftStable} 不是操作手势（pinch/fist/open_palm），跳过`)
        }
      } else {
        DebugLogger.logPerFrame('HandTracker:左手操作', `手势=${leftStable} 变化了但冷却中（剩余${this.LEFT_GESTURE_COOLDOWN_MS - (timestamp - this.lastLeftGestureTime)}ms），跳过`)
      }
    } else if (leftStable === this.prevLeftStableGesture && leftStable !== 'unknown') {
      DebugLogger.logPerFrame('HandTracker:左手操作', `手势=${leftStable} 未变化，不触发`)
    }
    this.prevLeftStableGesture = leftStable

    // ===== 休息模式回调：双手可见说明非休息 =====
    if (this.wasResting) {
      this.wasResting = false
    DebugLogger.event('HandTracker:休息', '手回来了，退出休息模式')
      this.restCallback?.(false)
    }

    // 双手模式下右手只负责指向，操作只能走 leftHandGestureCallback 或 comboCallback。

    // 构建 HandData
    const leftMetrics = getGestureMetrics(left.landmarks, left.worldLandmarks)
    const rightMetrics = getGestureMetrics(right.landmarks, right.worldLandmarks)

    this.leftHandData = {
      side: 'Left',
      landmarks: left.landmarks,
      worldLandmarks: left.worldLandmarks,
      gesture: leftGesture,
      stableGesture: leftStable,
      x: left.landmarks[0].x,
      y: left.landmarks[0].y,
      isPinching: leftMetrics.pinchRatio < this.PINCH_RATIO_THRESHOLD,
      pinchRatio: leftMetrics.pinchRatio,
      smoothX: this.leftHandData?.smoothX ?? 0.5,
      smoothY: this.leftHandData?.smoothY ?? 0.5,
      palmFacing: leftPalmFacing,
      handednessScore: left.handednessScore
    }

    this.rightHandData = {
      side: 'Right',
      landmarks: right.landmarks,
      worldLandmarks: right.worldLandmarks,
      gesture: rightGesture,
      stableGesture: rightStable,
      x: right.landmarks[0].x,
      y: right.landmarks[0].y,
      isPinching: rightMetrics.pinchRatio < this.PINCH_RATIO_THRESHOLD,
      pinchRatio: rightMetrics.pinchRatio,
      smoothX: this.smoothX,
      smoothY: this.smoothY,
      palmFacing: rightPalmFacing,
      handednessScore: right.handednessScore
    }

    // 双手回调
    this.dualHandCallback?.(this.leftHandData, this.rightHandData, { consumedByCombo: Boolean(combo) })

    // 更新调试数据
    this.debugData = {
      left: {
        rawGesture: leftGesture,
        stableGesture: leftStable,
        handednessScore: left.handednessScore,
        palmFacing: leftPalmFacing,
        pinchRatio: leftMetrics.pinchRatio,
        indexAngle: getFingerAngle(left.worldLandmarks ?? left.landmarks, 5, 6, 8),
        middleAngle: getFingerAngle(left.worldLandmarks ?? left.landmarks, 9, 10, 12),
        ringAngle: getFingerAngle(left.worldLandmarks ?? left.landmarks, 13, 14, 16),
        pinkyAngle: getFingerAngle(left.worldLandmarks ?? left.landmarks, 17, 18, 20)
      },
      right: {
        rawGesture: rightGesture,
        stableGesture: rightStable,
        handednessScore: right.handednessScore,
        palmFacing: rightPalmFacing,
        pinchRatio: rightMetrics.pinchRatio,
        indexAngle: getFingerAngle(right.worldLandmarks ?? right.landmarks, 5, 6, 8),
        middleAngle: getFingerAngle(right.worldLandmarks ?? right.landmarks, 9, 10, 12),
        ringAngle: getFingerAngle(right.worldLandmarks ?? right.landmarks, 13, 14, 16),
        pinkyAngle: getFingerAngle(right.worldLandmarks ?? right.landmarks, 17, 18, 20)
      },
      combo,
      mode: 'dual' as const,
      inferenceEmaMs: this.inferenceEmaMs,
      inferenceMaxMs: this.inferenceMaxMs
    }
  }

  // ===== 稳定手势更新 =====

  private updateStableGesture(side: HandSide, gesture: Gesture, timestamp: number): Gesture {
    // 左右手使用各自独立的缓冲区
    const buffer = side === 'Left' ? this.leftGestureBuffer : this.rightGestureBuffer
    const currentStable = side === 'Left' ? this.leftStableGesture : this.rightStableGesture

    // 推入最新一帧的手势
    buffer.push(gesture)
    if (buffer.length > this.BUFFER_SIZE) buffer.shift()

    // 投票统计：找出缓冲区中出现次数最多的手势
    const counts = new Map<Gesture, number>()
    for (const g of buffer) {
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    // 修复：不再默认用最新帧，而是真正找票数最多的手势
    let bestGesture: Gesture = 'unknown'
    let bestCount = 0
    for (const [g, c] of counts) {
      if (c > bestCount) {
        bestCount = c
        bestGesture = g
      }
    }

    // 只有票数达到阈值（5帧中4帧一致）才更新稳定手势
    // 这样可以有效过滤 MediaPipe 的瞬时误判（手势闪烁）
    if (bestCount >= this.VOTE_THRESHOLD && bestGesture !== currentStable) {
      if (side === 'Left') {
        this.leftStableGesture = bestGesture
        this.leftStableChangeTime[bestGesture] = timestamp
      } else {
        this.rightStableGesture = bestGesture
        this.rightStableChangeTime[bestGesture] = timestamp
      }
    }

    return side === 'Left' ? this.leftStableGesture : this.rightStableGesture
  }

  // ===== 指针更新 =====

  private updatePointer(hand: ResolvedHand, rawGesture: Gesture, stableGesture: Gesture, timestamp: number): void {
    // ===== 方案三：多关键点融合法 =====
    // 方案A：双手分工法 - 右手用 open_palm 作为"指向"手势
    //   open_palm → 掌心定位（光标跟着右手掌心移动）
    //   point/peace → 也作为指向手势（兼容单手模式，用指尖定位）
    //   其他手势 → 光标冻结在原地
    // 配合手势冻结：非 armed 状态不更新 smoothX/smoothY，光标停在原地

    const indexTip = hand.landmarks[8]    // 食指指尖
    const middleTip = hand.landmarks[12]  // 中指指尖
    const palmCenter = hand.landmarks[9]  // 掌心中心（中指根部）

    // 方案A：右手只保留张开手掌作为指向手势
    // 去掉 point/peace，避免右手食指/比耶干扰左手捏合选中
    const armed = stableGesture === 'open_palm'

    // 根据手势状态选择目标定位点
    let targetX: number
    let targetY: number
    if (stableGesture === 'open_palm') {
      // 方案A：右手张开手掌 → 用掌心定位（最稳定，适合双手分工法）
      targetX = this.mirrorPointerX ? 1 - palmCenter.x : palmCenter.x
      targetY = palmCenter.y
    } else if (stableGesture === 'point') {
      // 食指手势：用食指指尖（最精确）
      targetX = this.mirrorPointerX ? 1 - indexTip.x : indexTip.x
      targetY = indexTip.y
    } else if (stableGesture === 'peace') {
      // 比耶手势：用食指和中指的中点（两指尖中间，稳定且符合直觉）
      const midX = (indexTip.x + middleTip.x) / 2
      const midY = (indexTip.y + middleTip.y) / 2
      targetX = this.mirrorPointerX ? 1 - midX : midX
      targetY = midY
    } else {
      // 其他手势（捏合/握拳等）：用掌心位置（不受手指弯曲影响，最稳定）
      // 即使手势切换引起手指位置变化，掌心几乎不动，避免光标跳变
      targetX = this.mirrorPointerX ? 1 - palmCenter.x : palmCenter.x
      targetY = palmCenter.y
    }

    // ===== 手势冻结法 =====
    // 只在 armed 状态时更新光标位置
    // 非 armed 状态（捏合/握拳/张手）：光标停在原地不动，不会误触发 hover
    if (armed) {
      this.smoothX += (targetX - this.smoothX) * this.SMOOTH_FACTOR
      this.smoothY += (targetY - this.smoothY) * this.SMOOTH_FACTOR
    }

    const normalizedX = Math.max(0, Math.min(1, this.smoothX))
    const normalizedY = Math.max(0, Math.min(1, this.smoothY))

    this.pointerWasTracked = true
    this.pointerLostSince = 0

    const update: PointerUpdate = {
      side: hand.side,
      screenX: normalizedX * window.innerWidth,
      screenY: normalizedY * window.innerHeight,
      normalizedX,
      normalizedY,
      rawGesture,
      stableGesture,
      armed,
      handednessScore: hand.handednessScore,
      timestamp
    }

    // ===== 关键日志：右手光标更新追踪 =====
    if (hand.side === 'Right') {
      DebugLogger.logPerFrame('HandTracker:右手光标', `手势=${stableGesture} armed=${armed ? '是' : '否'} 掌心=(${palmCenter.x.toFixed(2)},${palmCenter.y.toFixed(2)}) smooth=(${this.smoothX.toFixed(2)},${this.smoothY.toFixed(2)}) NDC=(${normalizedX.toFixed(2)},${normalizedY.toFixed(2)})`)
    }

    this.pointerCallback?.(update)

    // 旧版兼容
    this.cursorCallback?.(update.screenX, update.screenY)
  }

  // ===== 指针丢失处理 =====

  private handleNoPointer(timestamp: number): void {
    if (!this.pointerWasTracked) return

    if (this.pointerLostSince === 0) {
      this.pointerLostSince = timestamp
      return
    }

    if (timestamp - this.pointerLostSince < this.POINTER_LOST_GRACE_MS) {
      return
    }

    this.pointerWasTracked = false
    this.pointerLostSince = 0

    this.pointerLostCallback?.({ side: null, timestamp })
    DebugLogger.event('HandTracker:丢失', '手势丢失，进入休息模式')

    // ===== 休息模式回调：手消失时通知休息 =====
    if (!this.wasResting) {
      this.wasResting = true
      this.restCallback?.(true)
    }

    // 重置状态
    this.leftStableGesture = 'unknown'
    this.rightStableGesture = 'unknown'
    this.leftGestureBuffer = []
    this.rightGestureBuffer = []
    this.leftClickArmedSince = 0
    this.rightClickArmedSince = 0
    this.previousLeftPinchDistance = null
    this.dualPinchZoomDelta = 0
  }

  // ===== 缩放更新 =====

  private updatePinchZoom(hand: ResolvedHand, stableGesture: Gesture): void {
    if (stableGesture !== 'pinch' || !hand.worldLandmarks) {
      this.previousLeftPinchDistance = null
      this.dualPinchZoomDelta = 0
      return
    }

    const currentDistance = dist3D(hand.worldLandmarks[4], hand.worldLandmarks[8])

    if (this.previousLeftPinchDistance !== null) {
      this.dualPinchZoomDelta = Math.log(
        Math.max(currentDistance, 1e-4) / Math.max(this.previousLeftPinchDistance, 1e-4)
      )
    } else {
      this.dualPinchZoomDelta = 0
    }

    this.previousLeftPinchDistance = currentDistance
  }

  // ===== 组合手势检测 =====

  private detectComboGesture(leftStable: Gesture, rightStable: Gesture, timestamp: number): ComboGesture | null {
    // 已触发的组合必须先释放
    if (this.activeCombo) {
      const requiredGesture = this.comboToGesture(this.activeCombo)
      if (leftStable !== requiredGesture || rightStable !== requiredGesture) {
        this.activeCombo = null
      } else {
        return null
      }
    }

    if (timestamp - this.lastComboTime < this.COMBO_COOLDOWN) {
      return null
    }

    if (leftStable === 'unknown' || rightStable === 'unknown' || leftStable !== rightStable) {
      return null
    }

    const leftTime = this.leftStableChangeTime[leftStable] ?? -Infinity
    const rightTime = this.rightStableChangeTime[rightStable] ?? -Infinity

    if (Math.abs(leftTime - rightTime) > this.COMBO_WINDOW) {
      return null
    }

    const comboMap: Partial<Record<Gesture, ComboGesture>> = {
      fist: 'both_fist',
      open_palm: 'both_open_palm',
      pinch: 'both_pinch',
      peace: 'both_peace'
    }

    const combo = comboMap[leftStable]
    if (!combo) return null

    this.activeCombo = combo
    this.lastComboTime = timestamp

    return combo
  }

  private comboToGesture(combo: ComboGesture): Gesture {
    const map: Record<ComboGesture, Gesture> = {
      both_fist: 'fist',
      both_open_palm: 'open_palm',
      both_pinch: 'pinch',
      both_peace: 'peace'
    }
    return map[combo]
  }

  // ===== 资源释放 =====

  destroy(): void {
    this.destroyed = true
    this.isRunning = false

    cancelAnimationFrame(this.animationFrameId)

    const stream = this.video.srcObject
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }

    this.video.pause()
    this.video.srcObject = null

    this.handLandmarker?.close()
    this.handLandmarker = null

    this.gestureCallback = null
    this.pointerCallback = null
    this.pointerLostCallback = null
    this.clickCallback = null
    this.comboCallback = null
    this.dualHandCallback = null
    this.restCallback = null
    this.cursorCallback = null
  }
}
