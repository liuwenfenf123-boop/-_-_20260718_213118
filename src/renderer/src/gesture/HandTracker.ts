import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

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

  // 手势缓冲
  private gestureBuffer: Gesture[] = []
  private readonly BUFFER_SIZE = 3
  private readonly CONFIDENCE_THRESHOLD = 0.5

  // 稳定手势状态
  private leftStableGesture: Gesture = 'unknown'
  private rightStableGesture: Gesture = 'unknown'
  private leftStableChangeTime: Record<Gesture, number> = { unknown: 0, pinch: 0, fist: 0, point: 0, peace: 0, open_palm: 0, back_palm: 0, palm_down: 0, palm_up: 0 }
  private rightStableChangeTime: Record<Gesture, number> = { unknown: 0, pinch: 0, fist: 0, point: 0, peace: 0, open_palm: 0, back_palm: 0, palm_down: 0, palm_up: 0 }

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
  private readonly COMBO_WINDOW = 400

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

  // 旧版兼容
  private cursorCallback: ((screenX: number, screenY: number) => void) | null = null

  constructor(video: HTMLVideoElement, options: HandTrackerOptions = {}) {
    console.log('[HandTracker] constructor called')
    this.video = video
    this.mirrorPointerX = options.mirrorPointerX ?? true
    this.swapHandednessLabels = options.swapHandednessLabels ?? false
    void this.init()
  }

  // ===== 初始化 =====

  private async init(): Promise<void> {
    console.log('[HandTracker] init started')
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
      this.handleNoPointer(timestamp)
      this.debugData = {
        left: null,
        right: null,
        combo: null,
        inferenceEmaMs: this.inferenceEmaMs,
        inferenceMaxMs: this.inferenceMaxMs
      }
      return
    }

    const hands = this.resolveHands(results)

    if (hands.length >= 2) {
      const left = hands.find(h => h.side === 'Left')
      const right = hands.find(h => h.side === 'Right')

      if (left && right) {
        this.processDualHands(left, right, timestamp)
      } else if (hands[0]) {
        this.processSingleHand(hands[0], timestamp)
      }
    } else if (hands[0]) {
      this.processSingleHand(hands[0], timestamp)
    }
  }

  // ===== 左右手解析 =====

  private resolveHands(results: any): ResolvedHand[] {
    const { landmarks, worldLandmarks, handednesses } = results
    const hands: ResolvedHand[] = []

    for (let i = 0; i < landmarks.length; i++) {
      const handedness = handednesses?.[i]?.[0]
      let rawSide: HandSide = handedness?.categoryName as HandSide
      let score = handedness?.score ?? 0

      if (!rawSide || score < 0.65) {
        // 回退到位置推断
        rawSide = landmarks[i][0].x < 0.5 ? 'Left' : 'Right'
        score = 0.5
      }

      // 根据配置决定是否交换标签
      const side: HandSide = this.swapHandednessLabels
        ? (rawSide === 'Left' ? 'Right' : 'Left')
        : rawSide

      hands.push({
        side,
        landmarks: landmarks[i],
        worldLandmarks: worldLandmarks?.[i] ?? null,
        handednessScore: score,
        hasWorldLandmarks: Boolean(worldLandmarks?.[i]?.length === 21)
      })
    }

    // 处理两只手被解析为同一侧的情况
    if (hands.length === 2 && hands[0].side === hands[1].side) {
      // 保留置信度高的，另一手翻转
      if (hands[0].handednessScore >= hands[1].handednessScore) {
        hands[1].side = hands[1].side === 'Left' ? 'Right' : 'Left'
      } else {
        hands[0].side = hands[0].side === 'Left' ? 'Right' : 'Left'
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

    const indexExtended = indexAngle > 150
    const middleExtended = middleAngle > 145
    const ringExtended = ringAngle > 145
    const pinkyExtended = pinkyAngle > 145

    const metrics = getGestureMetrics(landmarks, worldLandmarks)

    if (metrics.pinchRatio < 0.34 && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'pinch'
    }

    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && metrics.averageTipToWristRatio < 1.05) {
      return 'fist'
    }

    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'point'
    }

    if (indexAngle > 150 && middleAngle > 145 && ringAngle < 150 && pinkyAngle < 150) {
      return 'peace'
    }

    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
      if (palmFacing === 'away_from_camera') return 'back_palm'
      if (palmFacing === 'facing_down') return 'palm_down'
      if (palmFacing === 'facing_up') return 'palm_up'
      return 'open_palm'
    }

    return 'unknown'
  }

  // ===== 单手处理 =====

  private processSingleHand(hand: ResolvedHand, timestamp: number): void {
    const palmFacing = getPalmFacing(hand.worldLandmarks, hand.side)
    const gesture = this.classifyGesture(hand.landmarks, hand.worldLandmarks, palmFacing)

    const stableGesture = this.updateStableGesture(hand.side, gesture, timestamp)

    this.updatePointer(hand, gesture, stableGesture, timestamp)

    // 旧版兼容回调
    if (this.gestureCallback && stableGesture !== 'unknown') {
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

    const leftStable = this.updateStableGesture('Left', leftGesture, timestamp)
    const rightStable = this.updateStableGesture('Right', rightGesture, timestamp)

    // 只更新右手指针
    this.updatePointer(right, rightGesture, rightStable, timestamp)

    // 处理缩放
    this.updatePinchZoom(left, leftStable)

    // 组合手势检测
    const combo = this.detectComboGesture(leftStable, rightStable, timestamp)

    if (combo) {
      this.comboCallback?.(combo)
    }

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
      isPinching: leftMetrics.pinchRatio < 0.34,
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
      isPinching: rightMetrics.pinchRatio < 0.34,
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
      inferenceEmaMs: this.inferenceEmaMs,
      inferenceMaxMs: this.inferenceMaxMs
    }
  }

  // ===== 稳定手势更新 =====

  private updateStableGesture(side: HandSide, gesture: Gesture, timestamp: number): Gesture {
    const buffer = side === 'Left' ? this.gestureBuffer : this.gestureBuffer
    const currentStable = side === 'Left' ? this.leftStableGesture : this.rightStableGesture
    const changeTimeMap = side === 'Left' ? this.leftStableChangeTime : this.rightStableChangeTime

    // 简化的缓冲逻辑：直接返回当前手势（后续可优化）
    if (gesture !== currentStable) {
      if (side === 'Left') {
        this.leftStableGesture = gesture
        this.leftStableChangeTime[gesture] = timestamp
      } else {
        this.rightStableGesture = gesture
        this.rightStableChangeTime[gesture] = timestamp
      }
    }

    return side === 'Left' ? this.leftStableGesture : this.rightStableGesture
  }

  // ===== 指针更新 =====

  private updatePointer(hand: ResolvedHand, rawGesture: Gesture, stableGesture: Gesture, timestamp: number): void {
    const indexTip = hand.landmarks[8]

    const rawX = this.mirrorPointerX ? 1 - indexTip.x : indexTip.x
    const rawY = indexTip.y

    this.smoothX += (rawX - this.smoothX) * this.SMOOTH_FACTOR
    this.smoothY += (rawY - this.smoothY) * this.SMOOTH_FACTOR

    const normalizedX = Math.max(0, Math.min(1, this.smoothX))
    const normalizedY = Math.max(0, Math.min(1, this.smoothY))

    const armed = stableGesture === 'peace' || stableGesture === 'point'

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

    console.log('[HandTracker] calling pointerCallback')
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

    // 重置状态
    this.leftStableGesture = 'unknown'
    this.rightStableGesture = 'unknown'
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
