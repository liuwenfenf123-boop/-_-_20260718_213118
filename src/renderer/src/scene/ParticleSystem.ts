import * as THREE from 'three'
import gsap from 'gsap'
import { AudioManager } from './AudioManager'

interface ParticleData {
  heapPos: THREE.Vector3
  targetPos: THREE.Vector3
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  baseColor: THREE.Color
  ornamentIndex: number
  phase: number
}

export type ParticleShape =
  // 自然形态
  | 'christmas_tree' | 'cherry_blossom' | 'waterfall' | 'cloud' | 'flame' | 'wave' | 'mountain'
  // 几何形态
  | 'sphere' | 'torus' | 'cube' | 'pyramid' | 'heart' | 'star5' | 'infinity' | 'spiral'
  // 科幻形态
  | 'blackhole' | 'wormhole' | 'energy_orb' | 'matrix_rain' | 'dna' | 'galaxy' | 'tornado'
  | 'spiral_galaxy'
  // 生物形态
  | 'jellyfish' | 'butterfly' | 'fish_school' | 'flower'
  // 抽象形态
  | 'firework' | 'kaleidoscope' | 'vortex' | 'lightning'

export const SHAPE_CATEGORIES: Record<string, ParticleShape[]> = {
  '自然系': ['christmas_tree', 'cherry_blossom', 'waterfall', 'cloud', 'flame', 'wave', 'mountain'],
  '几何系': ['sphere', 'torus', 'cube', 'pyramid', 'heart', 'star5', 'infinity', 'spiral'],
  '科幻系': ['blackhole', 'wormhole', 'energy_orb', 'matrix_rain', 'dna', 'galaxy', 'spiral_galaxy', 'tornado'],
  '生命系': ['jellyfish', 'butterfly', 'fish_school', 'flower'],
  '抽象系': ['firework', 'kaleidoscope', 'vortex', 'lightning']
}

export const SHAPE_LABELS: Record<ParticleShape, string> = {
  // 自然系
  'christmas_tree': '圣诞树',
  'cherry_blossom': '樱花飘落',
  'waterfall': '瀑布下落',
  'cloud': '云海漂浮',
  'flame': '火焰跳动',
  'wave': '海洋波浪',
  'mountain': '山脉起伏',
  // 几何系
  'sphere': '球体',
  'torus': '环面',
  'cube': '立方体',
  'pyramid': '金字塔',
  'heart': '心跳',
  'star5': '五角星',
  'infinity': '无限符号',
  'spiral': '螺旋',
  // 科幻系
  'blackhole': '黑洞',
  'wormhole': '虫洞',
  'energy_orb': '能量球',
  'matrix_rain': '矩阵雨',
  'dna': 'DNA双螺旋',
  'galaxy': '星系旋臂',
  'spiral_galaxy': '螺旋星系',
  'tornado': '龙卷风',
  // 生命系
  'jellyfish': '水母',
  'butterfly': '蝴蝶',
  'fish_school': '鱼群',
  'flower': '花朵',
  // 抽象系
  'firework': '烟花',
  'kaleidoscope': '万花筒',
  'vortex': '涡旋',
  'lightning': '闪电'
}

// 形态动态参数：旋转速度(rad/s)、Y流动量、流动速度、跳动强度
export interface ShapeDynamics {
  rotationSpeed: number
  flowY: number
  flowSpeed: number
  jitter: number
}

export const SHAPE_DYNAMICS: Record<ParticleShape, ShapeDynamics> = {
  'christmas_tree': { rotationSpeed: 0.05, flowY: 0, flowSpeed: 0, jitter: 0 },
  'cherry_blossom': { rotationSpeed: 0.08, flowY: -0.3, flowSpeed: 0.3, jitter: 0.02 },  // 花瓣飘落
  'waterfall':      { rotationSpeed: 0, flowY: -1.5, flowSpeed: 1.2, jitter: 0.03 },     // 水流下落
  'cloud':          { rotationSpeed: 0.02, flowY: 0.1, flowSpeed: 0.2, jitter: 0.04 },  // 缓慢飘动
  'flame':          { rotationSpeed: 0, flowY: 0.5, flowSpeed: 1.5, jitter: 0.12 },     // 火焰跳动上升
  'wave':           { rotationSpeed: 0, flowY: 0, flowSpeed: 0, jitter: 0.05 },         // 波浪起伏
  'mountain':       { rotationSpeed: 0.03, flowY: 0, flowSpeed: 0, jitter: 0 },
  'sphere':         { rotationSpeed: 0.15, flowY: 0, flowSpeed: 0, jitter: 0 },
  'torus':          { rotationSpeed: 0.25, flowY: 0, flowSpeed: 0, jitter: 0 },
  'cube':           { rotationSpeed: 0.12, flowY: 0, flowSpeed: 0, jitter: 0 },
  'pyramid':        { rotationSpeed: 0.18, flowY: 0, flowSpeed: 0, jitter: 0 },
  'heart':          { rotationSpeed: 0.08, flowY: 0, flowSpeed: 0, jitter: 0.02 },      // 心跳
  'star5':          { rotationSpeed: 0.2, flowY: 0, flowSpeed: 0, jitter: 0 },
  'infinity':       { rotationSpeed: 0, flowY: 0, flowSpeed: 0.8, jitter: 0 },          // 沿轨迹流动
  'spiral':         { rotationSpeed: 0.4, flowY: 0, flowSpeed: 0, jitter: 0 },
  'blackhole':      { rotationSpeed: 0.6, flowY: 0, flowSpeed: 0, jitter: 0 },          // 快速旋转
  'wormhole':       { rotationSpeed: 0.5, flowY: 0, flowSpeed: 0, jitter: 0 },
  'energy_orb':     { rotationSpeed: 0.3, flowY: 0, flowSpeed: 0, jitter: 0.05 },
  'matrix_rain':    { rotationSpeed: 0, flowY: -2.0, flowSpeed: 2.0, jitter: 0 },       // 数字雨下落
  'dna':            { rotationSpeed: 0.3, flowY: 0, flowSpeed: 0, jitter: 0 },
  'galaxy':         { rotationSpeed: 0.15, flowY: 0, flowSpeed: 0, jitter: 0 },
  'spiral_galaxy':  { rotationSpeed: 0.12, flowY: 0, flowSpeed: 0, jitter: 0.02 },  // 螺旋星系：缓慢旋转 + 微弱抖动
  'tornado':        { rotationSpeed: 0.8, flowY: 0, flowSpeed: 0, jitter: 0.03 },       // 龙卷风旋转
  'jellyfish':      { rotationSpeed: 0.05, flowY: 0.2, flowSpeed: 0.4, jitter: 0.04 },  // 漂浮
  'butterfly':      { rotationSpeed: 0, flowY: 0.15, flowSpeed: 0.6, jitter: 0.06 },    // 翅膀扇动
  'fish_school':    { rotationSpeed: 0.1, flowY: 0, flowSpeed: 0, jitter: 0.03 },
  'flower':         { rotationSpeed: 0.04, flowY: 0, flowSpeed: 0, jitter: 0.01 },
  'firework':       { rotationSpeed: 0.05, flowY: -0.5, flowSpeed: 0.5, jitter: 0.08 },
  'kaleidoscope':   { rotationSpeed: 0.35, flowY: 0, flowSpeed: 0, jitter: 0 },
  'vortex':         { rotationSpeed: 0.7, flowY: 0, flowSpeed: 0, jitter: 0 },
  'lightning':      { rotationSpeed: 0, flowY: 0, flowSpeed: 0, jitter: 0.15 }           // 闪电抖动
}

export class ParticleSystem {
  private scene: THREE.Scene
  private audio: AudioManager
  private points: THREE.Points
  private geometry: THREE.BufferGeometry
  private material: THREE.ShaderMaterial
  private particleCount: number
  private particles: ParticleData[] = []
  private currentShape: ParticleShape = 'christmas_tree'

  private handX = 0
  private handY = 0
  private handActive = false
  private burstActive = false
  private burstCenter = new THREE.Vector3()
  private burstTime = 0
  private prevHandX = 0
  private prevHandY = 0
  private rotationAngle = 0
  // 飞剑刀光特效
  private slashActive = false
  private slashCenter = new THREE.Vector3()
  private slashDir = new THREE.Vector3()
  private slashTime = 0

  // ===== 流体动力学模式 =====
  private fluidMode = false
  private fluidState: 'vortex' | 'attract' | 'repel' = 'vortex'
  private fluidTargetX = 0
  private fluidTargetY = 0
  private fluidTargetZ = 0
  private blastTimer = 0
  private readonly BLAST_FRAMES = 35
  private fluidVx!: Float32Array
  private fluidVy!: Float32Array
  private fluidVz!: Float32Array
  private fluidMass!: Float32Array
  private fluidSpeed!: Float32Array

  constructor(scene: THREE.Scene, audio: AudioManager) {
    this.scene = scene
    this.audio = audio
    this.particleCount = 15000
    this.geometry = new THREE.BufferGeometry()

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHandPos: { value: new THREE.Vector2(0, 0) },
        uHandActive: { value: 0 },
        uHandVel: { value: new THREE.Vector2(0, 0) },
        uBurstCenter: { value: new THREE.Vector3(0, 0, 0) },
        uBurstTime: { value: 0 },
        uMorphFlash: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uRotation: { value: 0 },
        uFlowY: { value: 0 },
        uFlowSpeed: { value: 0 },
        uJitter: { value: 0 },
        // 飞剑刀光
        uSlashCenter: { value: new THREE.Vector3(0, 0, 0) },
        uSlashDir: { value: new THREE.Vector3(0, 0, 0) },
        uSlashTime: { value: 0 },
        // 冲击波涟漪
        uRippleCenter: { value: new THREE.Vector3(0, 0, 0) },
        uRippleTime: { value: 0 },
        uFluidMode: { value: 0 },
        uFluidTarget: { value: new THREE.Vector3(0, 0, 0) }
      },
      vertexShader: /* glsl */ `
        attribute vec3 aTargetPos;
        attribute vec3 aHeapPos;
        attribute float aMixFactor;
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aPhase;

        varying vec3 vColor;
        varying float vAlpha;
        varying float vDistToHand;
        varying float vRepel;
        varying float vBurst;
        varying float vCore;
        varying float vSlashGlow;
        varying float vFluidSpeed;

        uniform float uTime;
        uniform vec2 uHandPos;
        uniform float uHandActive;
        uniform vec2 uHandVel;
        uniform vec3 uBurstCenter;
        uniform float uBurstTime;
        uniform float uMorphFlash;
        uniform float uPixelRatio;
        uniform float uRotation;
        uniform float uFlowY;
        uniform float uFlowSpeed;
        uniform float uJitter;
        uniform vec3 uSlashCenter;
        uniform vec3 uSlashDir;
        uniform float uSlashTime;
        uniform vec3 uRippleCenter;
        uniform float uRippleTime;
        uniform float uFluidMode;
        uniform vec3 uFluidTarget;
        attribute float aVelocity;

        // 简易噪声
        float hash(float n) { return fract(sin(n) * 43758.5453); }

        void main() {
          vec3 displayPos;
          if (uFluidMode > 0.5) {
            displayPos = position;
          } else {
            displayPos = mix(aHeapPos, aTargetPos, aMixFactor);
          }

          // 形态特定动态：整体绕 Y 轴旋转
          if (abs(uRotation) > 0.001) {
            float cs = cos(uRotation);
            float sn = sin(uRotation);
            displayPos.xz = mat2(cs, -sn, sn, cs) * displayPos.xz;
          }

          // Y 方向流动（水流、矩阵雨）：粒子根据 phase 循环下落
          if (abs(uFlowSpeed) > 0.001) {
            float flow = mod(uTime * uFlowSpeed + aPhase * 2.0, 6.2831853);
            displayPos.y += sin(flow) * uFlowY;
            // 循环包裹：当粒子掉出底部时回到顶部
            if (uFlowY < 0.0 && displayPos.y < -3.0) displayPos.y += 6.0;
            if (uFlowY > 0.0 && displayPos.y >  3.0) displayPos.y -= 6.0;
          }

          // 跳动抖动（火焰、闪电）
          if (abs(uJitter) > 0.001) {
            displayPos.x += sin(uTime * 8.0 + aPhase * 5.0) * uJitter;
            displayPos.z += cos(uTime * 7.0 + aPhase * 4.0) * uJitter * 0.6;
            displayPos.y += sin(uTime * 10.0 + aPhase * 3.0) * uJitter * 0.4;
          }

          // 多频率呼吸运动（更有机）
          float breathe = sin(uTime * 1.2 + aPhase) * 0.05;
          float micro    = sin(uTime * 3.7 + aPhase * 2.3) * 0.02;
          displayPos.y += breathe + micro;
          displayPos.x += cos(uTime * 0.8 + aPhase) * 0.04 + sin(uTime * 1.6 + aPhase * 1.7) * 0.015;
          displayPos.z += sin(uTime * 0.6 + aPhase * 1.3) * 0.025;

          // 手部交互：斥力 + 切向涡旋（范围收窄，避免大面积扩散）
          vec2 toHand = displayPos.xy - uHandPos;
          float distToHand = length(toHand);
          float falloff = exp(-distToHand * distToHand * 0.6);   // 衰减更快，影响范围更小
          float repel = uHandActive * falloff * 1.6;             // 推力减弱
          vec2 repelDir = normalize(toHand + 0.001);
          // 涡旋分量：垂直于径向
          vec2 tangent = vec2(-repelDir.y, repelDir.x);
          float swirl = uHandActive * falloff * 0.4;
          displayPos.xy += repelDir * repel + tangent * swirl;
          displayPos.z  += repel * 0.5;

          // 手部速度拖动粒子（局部动量传递）
          displayPos.xy += uHandVel * falloff * 0.25;

          // 爆发效果
          float burstDist = length(displayPos - uBurstCenter);
          float burstForce = uBurstTime * exp(-burstDist * 0.5) * exp(-uBurstTime * 0.3) * 1.5;
          vec3 burstDir = normalize(displayPos - uBurstCenter + 0.001);
          displayPos += burstDir * burstForce;

          // 飞剑刀光：沿 swipe 方向劈开粒子，留下亮白光痕
          float slashGlow = 0.0;
          if (uSlashTime > 0.01) {
            vec3 toSlash = displayPos - uSlashCenter;
            // 计算粒子在刀光平面上的投影距离（垂直于刀光方向的距离）
            float perpDist = length(toSlash - dot(toSlash, uSlashDir) * uSlashDir);
            // 沿刀光方向的投影距离
            float alongDist = abs(dot(toSlash, uSlashDir));
            // 刀光带：更宽更长更炫酷
            float bladeWidth = 0.5 + uSlashTime * 0.3;  // 刀光宽度
            float bladeLength = 3.0 + uSlashTime * 1.5;  // 刀光长度（更长）
            float inBlade = smoothstep(bladeWidth, 0.0, perpDist) * smoothstep(bladeLength, 0.0, alongDist);
            // 刀光核心（更亮的中心线）
            float coreWidth = 0.15 + uSlashTime * 0.1;
            float inCore = smoothstep(coreWidth, 0.0, perpDist) * smoothstep(bladeLength * 0.9, 0.0, alongDist);
            // 刀光力：粒子沿刀光方向被推开 + 垂直方向扩散
            float slashForce = uSlashTime * inBlade * 3.0 * exp(-uSlashTime * 1.5);
            displayPos += uSlashDir * slashForce * 2.0;  // 沿刀光方向劈开（更强）
            displayPos += normalize(toSlash + 0.001) * slashForce * 0.8; // 向外扩散
            // 刀光亮度：核心 + 外层
            slashGlow = inBlade * exp(-uSlashTime * 1.5) * 0.8 + inCore * exp(-uSlashTime * 1.2) * 1.2;
          }

          // 冲击波涟漪：点击处向外扩散的环状波纹
          if (uRippleTime > 0.01) {
            float rippleDist = length(displayPos - uRippleCenter);
            float ringRadius = uRippleTime * 5.0; // 环向外扩散
            float ringWidth = 0.15 + uRippleTime * 0.3;
            float inRing = smoothstep(ringWidth, 0.0, abs(rippleDist - ringRadius));
            float rippleForce = uRippleTime * inRing * 0.8 * exp(-uRippleTime * 1.5);
            vec3 rippleDir = normalize(displayPos - uRippleCenter + 0.001);
            displayPos += rippleDir * rippleForce;
            slashGlow += inRing * exp(-uRippleTime * 1.5) * 0.5;
          }

          vec4 mvPosition = modelViewMatrix * vec4(displayPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // 大小随距离 + 交互放大 + 脉冲
          float pulse = 1.0 + sin(uTime * 4.0 + aPhase * 3.0) * 0.08;
          float sizeBoost = 1.0 + burstForce * 2.0 + repel * 1.5 + uMorphFlash * 0.8 + slashGlow * 2.0;
          gl_PointSize = aSize * (420.0 / -mvPosition.z) * sizeBoost * pulse * uPixelRatio * 0.5;

          // 颜色：交互时增亮 + 切换闪光
          vec3 col = aColor;
          col += burstForce * 0.3 + repel * 0.12;
          col += uMorphFlash * vec3(0.25, 0.35, 0.5); // 柔和闪蓝
          // 交互时偏暖（高亮）— 减弱避免挡住饰品
          col = mix(col, col + vec3(0.25, 0.18, 0.06), clamp(repel * 0.3, 0.0, 0.4));
          // 刀光让粒子变白变亮
          col = mix(col, vec3(1.0, 0.95, 0.8), clamp(slashGlow, 0.0, 0.9));

          vColor = col;
          // 基础亮度保持 0.45（艺术效果），交互增亮减弱（避免挡饰品）
          vAlpha = 0.45 + repel * 0.4 + burstForce * 0.6 + uMorphFlash * 0.5 + slashGlow * 2.0;
          vDistToHand = distToHand;
          vRepel = repel;
          vBurst = burstForce;
          vCore = aSize;
          vSlashGlow = slashGlow;
          vFluidSpeed = aVelocity;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vDistToHand;
        varying float vRepel;
        varying float vBurst;
        varying float vCore;
        varying float vSlashGlow;

        uniform float uFluidMode;
        varying float vFluidSpeed;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;

          if (uFluidMode > 0.5) {
            float speed = vFluidSpeed;
            vec3 col;
            float alpha;
            float glow = 0.0;
            if (speed > 12.0) {
              // 高速/核心：白热过曝，带光晕
              col = vec3(1.0, 1.0, 1.0);
              alpha = 1.0;
              glow = (speed - 12.0) * 0.15;
            } else if (speed > 3.0) {
              // 中速：电光青 → 白热渐变
              float t = (speed - 3.0) / 9.0;
              col = mix(vec3(0.0, 0.85, 1.0), vec3(1.0, 1.0, 1.0), t);
              alpha = mix(0.7, 1.0, t);
            } else {
              // 低速/外围：深水蓝青
              float t = speed / 3.0;
              col = mix(vec3(0.0, 0.3, 0.5), vec3(0.0, 0.85, 1.0), t);
              alpha = mix(0.25, 0.7, t);
            }
            // 粒子形状：核心硬 + 外围软光晕
            float halo = pow(1.0 - smoothstep(0.0, 0.6, d), 2.0);
            float core = exp(-d * d * 12.0);
            float shape = halo * 0.7 + core * 0.5;
            // 速度增亮
            col *= 1.0 + speed * 0.04;
            col += vec3(0.5, 0.8, 1.0) * glow * core;
            gl_FragColor = vec4(col, clamp(shape * alpha, 0.0, 1.0));
            return;
          }

          // 柔和星系感：halo占比更高，ring减弱，core更软
          float halo  = pow(1.0 - smoothstep(0.05, 0.55, d), 1.8);
          float ring  = smoothstep(0.55, 0.40, d) - smoothstep(0.40, 0.20, d);
          float core  = exp(-d * 7.0);

          float alpha = halo * 0.55 + ring * 0.15 + core * 0.35;
          alpha *= vAlpha;

          // 颜色：halo为主，保留本色，核心微亮
          vec3 col = vColor * halo * 0.9;
          col += vColor * ring * 0.3;
          col += mix(vColor, vec3(1.0), 0.30) * core * 0.45;

          // 交互时增加饱和度与亮度
          col += vColor * vRepel * 0.3;
          col += vec3(1.0, 0.9, 0.7) * vBurst * 0.4;
          // 刀光/涟漪让粒子发亮白光（更强）
          col += vec3(1.0, 0.98, 0.85) * vSlashGlow * 1.8;

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this.points = new THREE.Points(this.geometry, this.material)
  }

  generate(count: number, shape: ParticleShape = 'christmas_tree') {
    this.particleCount = count
    this.currentShape = shape
    this.particles = []

    const positions = new Float32Array(count * 3)
    const heapPositions = new Float32Array(count * 3)
    const targetPositions = new Float32Array(count * 3)
    const mixFactors = new Float32Array(count)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // 堆叠位置
      const heapAngle = Math.random() * Math.PI * 2
      const heapPhi = Math.acos(2 * Math.random() - 1)
      const heapRadius = 2.5 + Math.random() * 3
      const heapPos = new THREE.Vector3(
        Math.sin(heapPhi) * Math.cos(heapAngle) * heapRadius,
        Math.sin(heapPhi) * Math.sin(heapAngle) * heapRadius - 1.5,
        Math.cos(heapPhi) * heapRadius
      )

      const targetPos = this.generateShapePosition(i, count, shape)
      const color = this.generateColor(i, count, shape, targetPos)

      positions[i3] = heapPos.x
      positions[i3 + 1] = heapPos.y
      positions[i3 + 2] = heapPos.z

      heapPositions[i3] = heapPos.x
      heapPositions[i3 + 1] = heapPos.y
      heapPositions[i3 + 2] = heapPos.z

      targetPositions[i3] = targetPos.x
      targetPositions[i3 + 1] = targetPos.y
      targetPositions[i3 + 2] = targetPos.z

      mixFactors[i] = 0.0
      // 多档大小：少量大粒子 + 中等 + 大量尘埃
      const sizeRoll = Math.random()
      if (sizeRoll < 0.04)      sizes[i] = 0.12 + Math.random() * 0.10  // 4% 大粒子（主结构）
      else if (sizeRoll < 0.25) sizes[i] = 0.05 + Math.random() * 0.05  // 21% 中等
      else                      sizes[i] = 0.015 + Math.random() * 0.03  // 75% 细尘埃
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b
      phases[i] = Math.random() * Math.PI * 2

      this.particles.push({
        heapPos,
        targetPos,
        currentPos: heapPos.clone(),
        velocity: new THREE.Vector3(),
        baseColor: color,
        ornamentIndex: -1,
        phase: phases[i]
      })
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('aHeapPos', new THREE.BufferAttribute(heapPositions, 3))
    this.geometry.setAttribute('aTargetPos', new THREE.BufferAttribute(targetPositions, 3))
    this.geometry.setAttribute('aMixFactor', new THREE.BufferAttribute(mixFactors, 1))
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

    this.scene.add(this.points)

    setTimeout(() => {
      this.morphToTarget(3.0)
    }, 600)
  }

  private generateShapePosition(i: number, count: number, shape: ParticleShape): THREE.Vector3 {
    switch (shape) {
      // Nature
      case 'christmas_tree': return this.shapeChristmasTree(i, count)
      case 'cherry_blossom': return this.shapeCherryBlossom(i, count)
      case 'waterfall': return this.shapeWaterfall(i, count)
      case 'cloud': return this.shapeCloud(i, count)
      case 'flame': return this.shapeFlame(i, count)
      case 'wave': return this.shapeWave(i, count)
      case 'mountain': return this.shapeMountain(i, count)
      // Geometry
      case 'sphere': return this.shapeSphere(i, count)
      case 'torus': return this.shapeTorus(i, count)
      case 'cube': return this.shapeCube(i, count)
      case 'pyramid': return this.shapePyramid(i, count)
      case 'heart': return this.shapeHeart(i, count)
      case 'star5': return this.shapeStar5(i, count)
      case 'infinity': return this.shapeInfinity(i, count)
      case 'spiral': return this.shapeSpiral(i, count)
      // Sci-Fi
      case 'blackhole': return this.shapeBlackhole(i, count)
      case 'wormhole': return this.shapeWormhole(i, count)
      case 'energy_orb': return this.shapeEnergyOrb(i, count)
      case 'matrix_rain': return this.shapeMatrixRain(i, count)
      case 'dna': return this.shapeDNA(i, count)
      case 'galaxy': return this.shapeGalaxy(i, count)
      case 'spiral_galaxy': return this.shapeSpiralGalaxy(i, count)
      case 'tornado': return this.shapeTornado(i, count)
      // Life
      case 'jellyfish': return this.shapeJellyfish(i, count)
      case 'butterfly': return this.shapeButterfly(i, count)
      case 'fish_school': return this.shapeFishSchool(i, count)
      case 'flower': return this.shapeFlower(i, count)
      // Abstract
      case 'firework': return this.shapeFirework(i, count)
      case 'kaleidoscope': return this.shapeKaleidoscope(i, count)
      case 'vortex': return this.shapeVortex(i, count)
      case 'lightning': return this.shapeLightning(i, count)
      default: return this.shapeChristmasTree(i, count)
    }
  }

  // ==================== NATURE SHAPES ====================

  private shapeChristmasTree(i: number, count: number): THREE.Vector3 {
    const treeHeight = 5.0
    const baseRadius = 2.2
    const trunkHeight = 0.9
    const trunkRadius = 0.3

    if (i < count * 0.06) {
      const t = Math.random()
      return new THREE.Vector3(
        (Math.random() - 0.5) * trunkRadius * 2,
        -treeHeight / 2 + t * trunkHeight,
        (Math.random() - 0.5) * trunkRadius * 2
      )
    } else if (i < count * 0.12) {
      const starAngle = Math.random() * Math.PI * 2
      const starR = Math.random() * 0.3
      return new THREE.Vector3(
        Math.cos(starAngle) * starR,
        treeHeight / 2 + Math.random() * 0.3,
        Math.sin(starAngle) * starR
      )
    } else {
      const t = Math.random()
      const y = -treeHeight / 2 + trunkHeight + t * (treeHeight - trunkHeight)
      const layerMod = Math.sin(t * Math.PI * 8) * 0.08
      const maxR = baseRadius * (1 - t) * 0.85 + layerMod
      const angle = Math.random() * Math.PI * 2
      const r = Math.pow(Math.random(), 0.6) * maxR
      return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
    }
  }

  private shapeCherryBlossom(i: number, count: number): THREE.Vector3 {
    const t = i / count
    if (t < 0.15) {
      // 树干
      const h = -2.5 + t / 0.15 * 3
      return new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        h,
        (Math.random() - 0.5) * 0.3
      )
    } else if (t < 0.2) {
      // 树枝
      const branchAngle = Math.random() * Math.PI * 2
      const branchR = Math.random() * 1.5
      return new THREE.Vector3(
        Math.cos(branchAngle) * branchR,
        0.5 + Math.random() * 0.5,
        Math.sin(branchAngle) * branchR
      )
    } else {
      // 花朵（多个球形花簇）
      const clusterCount = 5
      const cluster = i % clusterCount
      const clusterAngle = (cluster / clusterCount) * Math.PI * 2
      const clusterR = 1.2 + Math.random() * 0.8
      const petetAngle = Math.random() * Math.PI * 2
      const petetR = Math.random() * 0.6
      return new THREE.Vector3(
        Math.cos(clusterAngle) * clusterR + Math.cos(petetAngle) * petetR,
        1.0 + Math.sin(clusterAngle * 2) * 0.5 + Math.random() * 0.4,
        Math.sin(clusterAngle) * clusterR + Math.sin(petetAngle) * petetR
      )
    }
  }

  private shapeWaterfall(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const width = 2.5
    const height = 6.0

    if (t < 0.3) {
      // 顶部水源
      return new THREE.Vector3(
        (Math.random() - 0.5) * width,
        height / 2 - Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
      )
    } else if (t < 0.85) {
      // 下落水流
      const fallT = (t - 0.3) / 0.55
      const x = (Math.random() - 0.5) * width * (1 - fallT * 0.3)
      const y = height / 2 - fallT * height
      const z = (Math.random() - 0.5) * 0.3 + Math.sin(fallT * 10) * 0.1
      return new THREE.Vector3(x, y, z)
    } else {
      // 底部水花
      const splashAngle = Math.random() * Math.PI * 2
      const splashR = Math.random() * 1.5
      return new THREE.Vector3(
        Math.cos(splashAngle) * splashR,
        -height / 2 + Math.random() * 0.5,
        Math.sin(splashAngle) * splashR
      )
    }
  }

  private shapeCloud(i: number, count: number): THREE.Vector3 {
    const cloudCount = 5
    const cloud = i % cloudCount
    const cloudAngle = (cloud / cloudCount) * Math.PI * 2
    const cloudR = 1.0 + Math.random() * 0.5

    const puffAngle = Math.random() * Math.PI * 2
    const puffR = Math.random() * 0.8
    const puffY = (Math.random() - 0.5) * 0.4

    return new THREE.Vector3(
      Math.cos(cloudAngle) * cloudR + Math.cos(puffAngle) * puffR,
      Math.sin(puffY) * 0.5 + 0.5,
      Math.sin(cloudAngle) * cloudR + Math.sin(puffAngle) * puffR
    )
  }

  private shapeFlame(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const height = 5.0
    const baseWidth = 1.5

    const y = -height / 2 + t * height
    const width = baseWidth * (1 - t * 0.8)
    const flicker = Math.sin(t * 20) * 0.2

    return new THREE.Vector3(
      (Math.random() - 0.5) * width + flicker,
      y,
      (Math.random() - 0.5) * width * 0.5
    )
  }

  private shapeWave(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const waveCount = 3
    const wave = i % waveCount
    const waveOffset = (wave / waveCount) * Math.PI * 2

    const x = (t - 0.5) * 8
    const y = Math.sin(t * Math.PI * 4 + waveOffset) * 1.5 + wave * 0.3 - 0.3
    const z = (Math.random() - 0.5) * 0.5 + Math.cos(t * Math.PI * 2) * 0.3

    return new THREE.Vector3(x, y, z)
  }

  private shapeMountain(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const peakCount = 3
    const peak = i % peakCount
    const peakOffset = (peak - 1) * 2.5

    if (t < 0.7) {
      const mountainT = t / 0.7
      const height = 3.0 * (1 - Math.abs(mountainT - 0.5) * 2)
      const x = (mountainT - 0.5) * 5 + peakOffset
      const y = -2.5 + height + Math.random() * 0.2
      const z = (Math.random() - 0.5) * 1.5
      return new THREE.Vector3(x, y, z)
    } else {
      // 雪顶
      const x = (Math.random() - 0.5) * 1 + peakOffset
      const y = 0.5 + Math.random() * 0.5
      const z = (Math.random() - 0.5) * 0.5
      return new THREE.Vector3(x, y, z)
    }
  }

  // ==================== GEOMETRY SHAPES ====================

  private shapeSphere(i: number, count: number): THREE.Vector3 {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 2.0 + (Math.random() - 0.5) * 0.15
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.sin(phi) * Math.sin(theta) * r,
      Math.cos(phi) * r
    )
  }

  private shapeTorus(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const R = 2.0 // 主半径
    const r = 0.6 // 管半径
    const theta = t * Math.PI * 2
    const phi = Math.random() * Math.PI * 2

    return new THREE.Vector3(
      (R + r * Math.cos(phi)) * Math.cos(theta),
      r * Math.sin(phi),
      (R + r * Math.cos(phi)) * Math.sin(theta)
    )
  }

  private shapeCube(i: number, count: number): THREE.Vector3 {
    const size = 3.0
    const face = i % 6
    const u = (Math.random() - 0.5) * size
    const v = (Math.random() - 0.5) * size
    const half = size / 2

    switch (face) {
      case 0: return new THREE.Vector3(half, u, v)
      case 1: return new THREE.Vector3(-half, u, v)
      case 2: return new THREE.Vector3(u, half, v)
      case 3: return new THREE.Vector3(u, -half, v)
      case 4: return new THREE.Vector3(u, v, half)
      default: return new THREE.Vector3(u, v, -half)
    }
  }

  private shapePyramid(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const height = 4.0
    const baseSize = 3.0

    if (t < 0.8) {
      const layerT = t / 0.8
      const y = -height / 2 + layerT * height
      const size = baseSize * (1 - layerT)
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * size
      return new THREE.Vector3(
        Math.cos(angle) * r * 0.7,
        y,
        Math.sin(angle) * r * 0.7
      )
    } else {
      // 顶点
      return new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        height / 2 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.3
      )
    }
  }

  private shapeHeart(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const angle = t * Math.PI * 2
    const scale = 0.15

    // 心形参数方程
    const x = 16 * Math.pow(Math.sin(angle), 3)
    const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)

    return new THREE.Vector3(
      x * scale + (Math.random() - 0.5) * 0.2,
      y * scale + (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.5
    )
  }

  private shapeStar5(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const points = 5
    const outerR = 2.5
    const innerR = 1.0
    const angle = t * Math.PI * 2

    const r = (Math.floor(angle / (Math.PI / points)) % 2 === 0)
      ? outerR + (Math.random() - 0.5) * 0.3
      : innerR + (Math.random() - 0.5) * 0.3

    const actualR = outerR * (0.5 + 0.5 * Math.cos(angle * points))

    return new THREE.Vector3(
      Math.cos(angle) * actualR + (Math.random() - 0.5) * 0.2,
      Math.sin(angle) * actualR + (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.4
    )
  }

  private shapeInfinity(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const angle = t * Math.PI * 2
    const scale = 2.0

    // 无限符号参数方程
    const x = Math.cos(angle) / (1 + Math.sin(angle) * Math.sin(angle))
    const y = Math.sin(angle) * Math.cos(angle) / (1 + Math.sin(angle) * Math.sin(angle))

    return new THREE.Vector3(
      x * scale + (Math.random() - 0.5) * 0.15,
      y * scale + (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.3
    )
  }

  private shapeSpiral(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const angle = t * Math.PI * 20
    const radius = 0.3 + t * 2.0
    const y = -2.5 + t * 5.0
    const spread = 0.08
    return new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * spread,
      y + (Math.random() - 0.5) * spread,
      Math.sin(angle) * radius + (Math.random() - 0.5) * spread
    )
  }

  // ==================== SCI-FI SHAPES ====================

  private shapeBlackhole(i: number, count: number): THREE.Vector3 {
    const t = i / count

    if (t < 0.2) {
      // 中心黑洞
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 0.5
      return new THREE.Vector3(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 0.3,
        Math.sin(angle) * r
      )
    } else if (t < 0.7) {
      // 吸积盘
      const diskT = (t - 0.2) / 0.5
      const angle = diskT * Math.PI * 10 + Math.random() * 0.5
      const r = 0.8 + diskT * 2.0
      const y = (Math.random() - 0.5) * 0.1
      return new THREE.Vector3(
        Math.cos(angle) * r,
        y,
        Math.sin(angle) * r
      )
    } else {
      // 喷射流
      const jetT = (t - 0.7) / 0.3
      const direction = i % 2 === 0 ? 1 : -1
      return new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        direction * (3.0 + jetT * 2.0),
        (Math.random() - 0.5) * 0.3
      )
    }
  }

  private shapeWormhole(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const angle = t * Math.PI * 15
    const radius = 1.5 + Math.sin(t * Math.PI * 5) * 0.5
    const z = (t - 0.5) * 6.0

    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      z
    )
  }

  private shapeEnergyOrb(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const layerCount = 3
    const layer = i % layerCount
    const layerR = 1.0 + layer * 0.5

    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = layerR + (Math.random() - 0.5) * 0.2

    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.sin(phi) * Math.sin(theta) * r,
      Math.cos(phi) * r
    )
  }

  private shapeMatrixRain(i: number, count: number): THREE.Vector3 {
    const columns = 50
    const col = i % columns
    const colX = (col / columns - 0.5) * 8
    const colZ = (Math.random() - 0.5) * 3

    const t = i / count
    const y = 3.0 - t * 6.0

    return new THREE.Vector3(
      colX + (Math.random() - 0.5) * 0.1,
      y,
      colZ + (Math.random() - 0.5) * 0.1
    )
  }

  private shapeDNA(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const y = -2.5 + t * 5.0
    const strand = i % 2 === 0 ? 0 : Math.PI
    const angle = t * Math.PI * 10 + strand
    const radius = 1.2
    const spread = 0.05

    if (i % 20 < 2) {
      const barT = (i % 20) / 2
      const barAngle = t * Math.PI * 10
      return new THREE.Vector3(
        Math.cos(barAngle) * radius * (1 - barT * 2) + (Math.random() - 0.5) * 0.03,
        y,
        Math.sin(barAngle) * radius * (1 - barT * 2) + (Math.random() - 0.5) * 0.03
      )
    }

    return new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * spread,
      y + (Math.random() - 0.5) * spread,
      Math.sin(angle) * radius + (Math.random() - 0.5) * spread
    )
  }

  private shapeGalaxy(i: number, count: number): THREE.Vector3 {
    const arm = i % 4
    const t = Math.random()
    const armAngle = (arm / 4) * Math.PI * 2
    const spiralAngle = t * Math.PI * 3
    const radius = t * 2.5
    const angle = armAngle + spiralAngle
    const spread = 0.1 + t * 0.2

    return new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 0.15,
      Math.sin(angle) * radius + (Math.random() - 0.5) * spread
    )
  }

  // 螺旋星系：5条旋臂 + 幂分布（中心更密）+ 盘面鼓包 + 旋臂扰动
  // 参考独立 galaxy-particle-animation.html 的视觉风格
  private shapeSpiralGalaxy(i: number, count: number): THREE.Vector3 {
    const ARMS = 5
    const arm = i % ARMS
    const armOffset = (arm / ARMS) * Math.PI * 2  // golden angle spread

    // 半径幂分布：中心更密
    const r = Math.pow(Math.random(), 0.55) * 3.2

    // 旋臂角度（旋臂展开 + 半径相关的螺旋）
    const spiralTightness = 1.1
    const baseAngle = armOffset + r * spiralTightness + (Math.random() - 0.5) * 0.4

    // 旋臂厚度扰动（垂直于旋臂方向的小幅扩散）
    const armSpread = 0.15 + r * 0.05
    const perpX = -Math.sin(baseAngle) * (Math.random() - 0.5) * armSpread
    const perpZ =  Math.cos(baseAngle) * (Math.random() - 0.5) * armSpread

    // 盘面鼓包：中心厚、外缘薄
    const diskBulge = Math.exp(-r * 1.0) * 0.6
    const y = (Math.random() - 0.5) * diskBulge + (Math.random() - 0.5) * 0.05

    return new THREE.Vector3(
      Math.cos(baseAngle) * r + perpX,
      y,
      Math.sin(baseAngle) * r + perpZ
    )
  }

  private shapeTornado(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const y = -2.5 + t * 5.0
    const radius = 0.2 + (1 - t) * 2.5
    const angle = t * Math.PI * 30 + Math.random() * 0.3
    const spread = 0.05 + (1 - t) * 0.15
    return new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * spread,
      y,
      Math.sin(angle) * radius + (Math.random() - 0.5) * spread
    )
  }

  // ==================== LIFE SHAPES ====================

  private shapeJellyfish(i: number, count: number): THREE.Vector3 {
    const t = i / count

    if (t < 0.4) {
      // 伞盖
      const capAngle = Math.random() * Math.PI * 2
      const capR = Math.random() * 1.5
      const capY = Math.sqrt(1 - Math.pow(capR / 1.5, 2)) * 1.0
      return new THREE.Vector3(
        Math.cos(capAngle) * capR,
        1.0 + capY,
        Math.sin(capAngle) * capR
      )
    } else {
      // 触须
      const tentacleCount = 8
      const tentacle = i % tentacleCount
      const tentacleAngle = (tentacle / tentacleCount) * Math.PI * 2
      const tentacleT = (t - 0.4) / 0.6
      const tentacleR = 1.0 - tentacleT * 0.5
      const wave = Math.sin(tentacleT * Math.PI * 4) * 0.2

      return new THREE.Vector3(
        Math.cos(tentacleAngle) * tentacleR + wave,
        1.0 - tentacleT * 3.0,
        Math.sin(tentacleAngle) * tentacleR + wave
      )
    }
  }

  private shapeButterfly(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const wing = i % 2 === 0 ? 1 : -1

    if (t < 0.1) {
      // 身体
      return new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 2.0,
        0
      )
    } else {
      // 翅膀
      const wingT = (t - 0.1) / 0.9
      const wingAngle = wingT * Math.PI
      const wingR = 2.0 * Math.sin(wingAngle)
      const wingY = Math.cos(wingAngle) * 1.5

      return new THREE.Vector3(
        wing * wingR + (Math.random() - 0.5) * 0.2,
        wingY + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.3
      )
    }
  }

  private shapeFishSchool(i: number, count: number): THREE.Vector3 {
    const fishCount = 20
    const fish = i % fishCount
    const fishAngle = (fish / fishCount) * Math.PI * 2
    const fishR = 1.5 + Math.random() * 1.0

    const bodyAngle = Math.random() * Math.PI * 2
    const bodyR = Math.random() * 0.3

    return new THREE.Vector3(
      Math.cos(fishAngle) * fishR + Math.cos(bodyAngle) * bodyR,
      (Math.random() - 0.5) * 1.0 + Math.sin(bodyAngle) * bodyR * 0.5,
      Math.sin(fishAngle) * fishR + Math.sin(bodyAngle) * bodyR
    )
  }

  private shapeFlower(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const petalCount = 8

    if (t < 0.15) {
      // 花心
      const centerAngle = Math.random() * Math.PI * 2
      const centerR = Math.random() * 0.4
      return new THREE.Vector3(
        Math.cos(centerAngle) * centerR,
        0,
        Math.sin(centerAngle) * centerR
      )
    } else {
      // 花瓣
      const petal = i % petalCount
      const petalAngle = (petal / petalCount) * Math.PI * 2
      const petalT = (t - 0.15) / 0.85
      const petalR = 0.5 + petalT * 1.5
      const petalWidth = Math.sin(petalT * Math.PI) * 0.5

      return new THREE.Vector3(
        Math.cos(petalAngle) * petalR + (Math.random() - 0.5) * petalWidth,
        (Math.random() - 0.5) * 0.2,
        Math.sin(petalAngle) * petalR + (Math.random() - 0.5) * petalWidth
      )
    }
  }

  // ==================== ABSTRACT SHAPES ====================

  private shapeFirework(i: number, count: number): THREE.Vector3 {
    const burstCount = 5
    const burst = i % burstCount
    const burstAngle = (burst / burstCount) * Math.PI * 2
    const burstR = 1.5

    const t = i / count
    const explodeT = Math.random()
    const explodeAngle = Math.random() * Math.PI * 2
    const explodeR = explodeT * 1.5

    return new THREE.Vector3(
      Math.cos(burstAngle) * burstR + Math.cos(explodeAngle) * explodeR,
      Math.sin(burstAngle) * burstR + Math.sin(explodeAngle) * explodeR - explodeT * 0.5,
      (Math.random() - 0.5) * 0.5
    )
  }

  private shapeKaleidoscope(i: number, count: number): THREE.Vector3 {
    const segments = 12
    const segment = i % segments
    const segmentAngle = (segment / segments) * Math.PI * 2

    const t = i / count
    const r = Math.random() * 2.5
    const localAngle = (Math.random() - 0.5) * (Math.PI / segments)

    return new THREE.Vector3(
      Math.cos(segmentAngle + localAngle) * r,
      Math.sin(segmentAngle + localAngle) * r,
      (Math.random() - 0.5) * 0.3
    )
  }

  private shapeVortex(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const angle = t * Math.PI * 30
    const radius = 0.1 + t * 2.5
    const y = -3.0 + t * 6.0

    return new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * 0.1,
      y,
      Math.sin(angle) * radius + (Math.random() - 0.5) * 0.1
    )
  }

  private shapeLightning(i: number, count: number): THREE.Vector3 {
    const t = i / count
    const segments = 10
    const segment = Math.floor(t * segments)
    const segmentT = (t * segments) % 1

    const baseX = (Math.random() - 0.5) * 0.5
    const baseY = 3.0 - t * 6.0
    const zigzag = Math.sin(segment * 2.5) * 0.8

    return new THREE.Vector3(
      baseX + zigzag + (Math.random() - 0.5) * 0.2,
      baseY,
      (Math.random() - 0.5) * 0.3
    )
  }

  // ==================== COLOR GENERATION ====================

  private generateColor(i: number, count: number, shape: ParticleShape, pos: THREE.Vector3): THREE.Color {
    const t = i / count

    switch (shape) {
      // Nature
      case 'christmas_tree': {
        if (i < count * 0.12 && i >= count * 0.06) {
          return new THREE.Color(1, 0.85 + Math.random() * 0.15, 0.2 + Math.random() * 0.3)
        }
        const rand = Math.random()
        if (rand < 0.65) return new THREE.Color(0.05 + Math.random() * 0.15, 0.25 + Math.random() * 0.55, 0.08 + Math.random() * 0.2)
        if (rand < 0.8) return new THREE.Color(1, 0.65 + Math.random() * 0.35, 0.1 + Math.random() * 0.2)
        if (rand < 0.9) return new THREE.Color(0.85 + Math.random() * 0.15, 0.05 + Math.random() * 0.15, 0.05 + Math.random() * 0.15)
        if (rand < 0.97) return new THREE.Color(0.1, 0.35 + Math.random() * 0.35, 0.75 + Math.random() * 0.25)
        return new THREE.Color(0.9, 0.5 + Math.random() * 0.3, 0.9)
      }
      case 'cherry_blossom': {
        if (t < 0.2) return new THREE.Color(0.4 + Math.random() * 0.2, 0.25 + Math.random() * 0.15, 0.15)
        return new THREE.Color(1, 0.7 + Math.random() * 0.2, 0.8 + Math.random() * 0.15)
      }
      case 'waterfall': return new THREE.Color(0.3 + Math.random() * 0.2, 0.6 + Math.random() * 0.2, 0.9 + Math.random() * 0.1)
      case 'cloud': return new THREE.Color(0.9 + Math.random() * 0.1, 0.92 + Math.random() * 0.08, 0.95 + Math.random() * 0.05)
      case 'flame': {
        const heat = 1 - t
        return new THREE.Color(1, 0.3 + heat * 0.5, heat * 0.2)
      }
      case 'wave': return new THREE.Color(0.1 + Math.random() * 0.1, 0.4 + Math.random() * 0.3, 0.7 + Math.random() * 0.2)
      case 'mountain': {
        if (t > 0.7) return new THREE.Color(0.95, 0.97, 1.0) // 雪顶
        return new THREE.Color(0.35 + Math.random() * 0.15, 0.25 + Math.random() * 0.1, 0.15 + Math.random() * 0.1)
      }
      // Geometry
      case 'sphere': {
        const dist = pos.length() / 2.0
        return new THREE.Color().setHSL(0.6 - dist * 0.4, 0.7, 0.5 + dist * 0.2)
      }
      case 'torus': return new THREE.Color().setHSL(t, 0.8, 0.55)
      case 'cube': {
        const face = i % 6
        const hue = face / 6
        return new THREE.Color().setHSL(hue, 0.7, 0.5)
      }
      case 'pyramid': return new THREE.Color(0.85 + Math.random() * 0.15, 0.7 + Math.random() * 0.2, 0.3 + Math.random() * 0.2)
      case 'heart': return new THREE.Color(0.9 + Math.random() * 0.1, 0.1 + Math.random() * 0.2, 0.2 + Math.random() * 0.2)
      case 'star5': return new THREE.Color(1, 0.85 + Math.random() * 0.15, 0.2 + Math.random() * 0.3)
      case 'infinity': return new THREE.Color().setHSL(t * 0.5 + 0.5, 0.9, 0.6)
      case 'spiral': return new THREE.Color().setHSL(t * 0.8, 0.8, 0.55)
      // Sci-Fi
      case 'blackhole': {
        if (t < 0.2) return new THREE.Color(0.1, 0.05, 0.15)
        if (t < 0.7) return new THREE.Color(0.8 + Math.random() * 0.2, 0.4 + Math.random() * 0.3, 0.1)
        return new THREE.Color(0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.3, 1)
      }
      case 'wormhole': return new THREE.Color().setHSL(0.7 + t * 0.2, 0.9, 0.5 + Math.random() * 0.2)
      case 'energy_orb': {
        const layer = i % 3
        return new THREE.Color().setHSL(0.5 + layer * 0.1, 0.9, 0.6 + Math.random() * 0.2)
      }
      case 'matrix_rain': return new THREE.Color(0.1, 0.8 + Math.random() * 0.2, 0.2 + Math.random() * 0.2)
      case 'dna': {
        if (i % 2 === 0) return new THREE.Color().setHSL(0.55, 0.9, 0.55)
        return new THREE.Color().setHSL(0.0, 0.9, 0.55)
      }
      case 'galaxy': {
        // 紫核 → 蓝中 → 金边（柔和星系感）
        const dist = pos.length() / 3.2
        const cCore  = new THREE.Color(0.30, 0.12, 0.80)  // 紫罗兰核
        const cMid   = new THREE.Color(0.22, 0.48, 1.00)  // 亮蓝中
        const cEdge  = new THREE.Color(1.00, 0.78, 0.22)  // 金边
        const c = new THREE.Color()
        if (dist < 0.35) c.copy(cCore).lerp(cMid, dist / 0.35)
        else             c.copy(cMid).lerp(cEdge, (dist - 0.35) / 0.65)
        // 旋臂间微小色调变化
        const arm = i % 4
        c.r += Math.sin(arm * 2.1) * 0.04
        c.g += Math.sin(arm * 2.1) * 0.03
        c.b += Math.sin(arm * 2.1) * 0.06
        return c
      }
      case 'spiral_galaxy': {
        // 紫核 → 蓝中 → 金边（参考 galaxy-particle-animation.html）
        const dist = pos.length() / 3.2
        const cCore  = new THREE.Color(0.30, 0.12, 0.80)  // 紫罗兰核
        const cMid   = new THREE.Color(0.22, 0.48, 1.00)  // 亮蓝中
        const cEdgePale = new THREE.Color(1.00, 0.92, 0.60)  // 淡金外缘
        const c = new THREE.Color()
        if (dist < 0.35) c.copy(cCore).lerp(cMid, dist / 0.35)
        else             c.copy(cMid).lerp(cEdgePale, (dist - 0.35) / 0.65)
        // 旋臂色调微扰
        const arm = i % 5
        c.r += Math.sin(arm * 2.1 + Math.random() * 3.14) * 0.06
        c.g += Math.sin(arm * 2.1 + Math.random() * 3.14) * 0.04
        c.b += Math.sin(arm * 2.1 + Math.random() * 3.14) * 0.10
        // 中心鼓包加亮紫
        const coreGlow = Math.exp(-dist * 1.8) * 0.4
        c.r += coreGlow * 0.55
        c.g += coreGlow * 0.45
        c.b += coreGlow * 1.00
        return c
      }
      case 'tornado': return new THREE.Color().setHSL(0.55 + t * 0.15, 0.7, 0.4 + t * 0.3)
      // Life
      case 'jellyfish': {
        if (t < 0.4) return new THREE.Color(0.6 + Math.random() * 0.3, 0.3 + Math.random() * 0.3, 0.8 + Math.random() * 0.2)
        return new THREE.Color(0.5 + Math.random() * 0.3, 0.7 + Math.random() * 0.2, 0.9 + Math.random() * 0.1)
      }
      case 'butterfly': {
        if (t < 0.1) return new THREE.Color(0.2, 0.15, 0.1)
        const wingHue = Math.random() * 0.3 + 0.6
        return new THREE.Color().setHSL(wingHue, 0.8, 0.5 + Math.random() * 0.2)
      }
      case 'fish_school': return new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.6, 0.5 + Math.random() * 0.2)
      case 'flower': {
        if (t < 0.15) return new THREE.Color(1, 0.85, 0.2)
        const petalHue = Math.random() * 0.15 + 0.85
        return new THREE.Color().setHSL(petalHue % 1, 0.8, 0.6 + Math.random() * 0.2)
      }
      // Abstract
      case 'firework': {
        const burst = i % 5
        const burstHue = burst * 0.2
        return new THREE.Color().setHSL(burstHue, 0.9, 0.6 + Math.random() * 0.3)
      }
      case 'kaleidoscope': return new THREE.Color().setHSL(t, 0.9, 0.6)
      case 'vortex': return new THREE.Color().setHSL(0.6 + t * 0.3, 0.8, 0.5 + t * 0.3)
      case 'lightning': return new THREE.Color(0.7 + Math.random() * 0.3, 0.8 + Math.random() * 0.2, 1)
      default:
        return new THREE.Color(1, 1, 1)
    }
  }

  // ==================== MORPHING ====================

  morphToShape(shape: ParticleShape) {
    if (shape === this.currentShape) return
    this.currentShape = shape

    const targetPositions = this.geometry.attributes.aTargetPos.array as Float32Array
    const colors = this.geometry.attributes.aColor.array as Float32Array

    // 超新星爆炸闪光：uMorphFlash 从 1.0 剧烈衰减
    this.material.uniforms.uMorphFlash.value = 1.0
    gsap.to(this.material.uniforms.uMorphFlash, {
      value: 0,
      duration: 2.0,
      ease: 'power3.out'
    })

    // 超新星爆炸：粒子先炸开回堆状（mixFactor→0），再重组到新形态
    const mixFactors = this.geometry.attributes.aMixFactor.array as Float32Array
    for (let i = 0; i < this.particleCount; i++) {
      // 先炸开：mixFactor降到 0（完全回到堆状）
      gsap.to({ v: mixFactors[i] }, {
        v: 0,
        duration: 0.5 + Math.random() * 0.2,
        delay: Math.random() * 0.15,
        ease: 'power3.in',
        onUpdate: function () { mixFactors[i] = this.targets()[0].v },
        onComplete: () => {
          // 再重组到新形态
          gsap.to({ v: mixFactors[i] }, {
            v: 1.0,
            duration: 1.6 + Math.random() * 0.4,
            ease: 'elastic.out(1.0, 0.5)',
            onUpdate: function () { mixFactors[i] = this.targets()[0].v }
          })
        }
      })
    }

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      const newPos = this.generateShapePosition(i, this.particleCount, shape)
      const newColor = this.generateColor(i, this.particleCount, shape, newPos)

      this.particles[i].targetPos.copy(newPos)
      this.particles[i].baseColor.copy(newColor)

      gsap.to({ tx: targetPositions[i3], ty: targetPositions[i3 + 1], tz: targetPositions[i3 + 2] }, {
        tx: newPos.x, ty: newPos.y, tz: newPos.z,
        duration: 2.2,
        delay: 0.3 + Math.random() * 0.6,
        ease: 'power3.inOut',
        onUpdate: function () {
          targetPositions[i3] = this.targets()[0].tx
          targetPositions[i3 + 1] = this.targets()[0].ty
          targetPositions[i3 + 2] = this.targets()[0].tz
        }
      })

      gsap.to({ r: colors[i3], g: colors[i3 + 1], b: colors[i3 + 2] }, {
        r: newColor.r, g: newColor.g, b: newColor.b,
        duration: 1.8,
        delay: Math.random() * 0.4,
        ease: 'power2.inOut',
        onUpdate: function () {
          colors[i3] = this.targets()[0].r
          colors[i3 + 1] = this.targets()[0].g
          colors[i3 + 2] = this.targets()[0].b
        }
      })
    }

    this.geometry.attributes.aTargetPos.needsUpdate = true
    this.geometry.attributes.aColor.needsUpdate = true
  }

  morphToTarget(duration: number) {
    this.audio.playMorphStart()
    const mixFactors = this.geometry.attributes.aMixFactor.array as Float32Array
    for (let i = 0; i < this.particleCount; i++) {
      gsap.to({ v: mixFactors[i] }, {
        v: 1.0,
        duration,
        delay: Math.random() * 0.8,
        ease: 'power2.out',
        onUpdate: function () {
          mixFactors[i] = this.targets()[0].v
        }
      })
    }
  }

  morphToHeap(duration: number) {
    const mixFactors = this.geometry.attributes.aMixFactor.array as Float32Array
    for (let i = 0; i < this.particleCount; i++) {
      gsap.to({ v: mixFactors[i] }, {
        v: 0.0,
        duration,
        delay: Math.random() * 0.5,
        ease: 'power2.in',
        onUpdate: function () {
          mixFactors[i] = this.targets()[0].v
        }
      })
    }
  }

  getMixAverage(): number {
    const mixFactors = this.geometry.attributes.aMixFactor.array as Float32Array
    return mixFactors.reduce((a, b) => a + b, 0) / this.particleCount
  }

  getCurrentShape(): ParticleShape {
    return this.currentShape
  }

  updateHandPosition(x: number, y: number) {
    // 计算手部速度（用于动量传递）
    this.material.uniforms.uHandVel.value.set(x - this.prevHandX, y - this.prevHandY)
    this.prevHandX = x
    this.prevHandY = y
    this.handX = x
    this.handY = y
    this.handActive = true
  }

  burstAt(x: number, y: number, z: number, count: number) {
    this.audio.playBurst()
    this.burstActive = true
    this.burstCenter.set(x, y, z)
    this.burstTime = 0

    const mixFactors = this.geometry.attributes.aMixFactor.array as Float32Array
    const heapPositions = this.geometry.attributes.aHeapPos.array as Float32Array

    for (let i = 0; i < Math.min(count, this.particleCount); i++) {
      const idx = Math.floor(Math.random() * this.particleCount)
      const px = heapPositions[idx * 3]
      const py = heapPositions[idx * 3 + 1]
      const pz = heapPositions[idx * 3 + 2]
      const dx = px - x
      const dy = py - y
      const dz = pz - z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 2.0) {
        gsap.to({ v: mixFactors[idx] }, {
          v: mixFactors[idx] * 0.2,
          duration: 0.15,
          yoyo: true,
          repeat: 0,
          onUpdate: function () {
            mixFactors[idx] = this.targets()[0].v
          }
        })
      }
    }
  }

  // 飞剑刀光：沿 swipe 方向劈开粒子
  slashAt(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number) {
    this.slashActive = true
    this.slashCenter.set(x, y, z)
    this.slashDir.set(dirX, dirY, dirZ).normalize()
    this.slashTime = 0
    this.material.uniforms.uSlashCenter.value.copy(this.slashCenter)
    this.material.uniforms.uSlashDir.value.copy(this.slashDir)
    this.audio.playHover()
  }

  // 冲击波涟漪：点击处向外扩散
  rippleAt(x: number, y: number, z: number) {
    this.material.uniforms.uRippleCenter.value.set(x, y, z)
    this.material.uniforms.uRippleTime.value = 1.0
    this.audio.playHover()
  }

  update(dt: number, time: number) {
    this.material.uniforms.uTime.value = time
    this.material.uniforms.uHandPos.value.set(this.handX, this.handY)

    const targetActive = this.handActive ? 1.0 : 0
    this.material.uniforms.uHandActive.value +=
      (targetActive - this.material.uniforms.uHandActive.value) * dt * 3

    // 速度衰减（手停住时拖动归零）
    this.material.uniforms.uHandVel.value.multiplyScalar(Math.max(0, 1 - dt * 8))

    // 应用形态动态参数
    const dyn = SHAPE_DYNAMICS[this.currentShape]
    this.rotationAngle += dyn.rotationSpeed * dt
    this.material.uniforms.uRotation.value = this.rotationAngle
    this.material.uniforms.uFlowY.value = dyn.flowY
    this.material.uniforms.uFlowSpeed.value = dyn.flowSpeed
    this.material.uniforms.uJitter.value = dyn.jitter

    if (this.burstActive) {
      this.burstTime += dt
      this.material.uniforms.uBurstCenter.value.copy(this.burstCenter)
      this.material.uniforms.uBurstTime.value = this.burstTime
      if (this.burstTime > 2.0) {
        this.burstActive = false
        this.material.uniforms.uBurstTime.value = 0
      }
    }

    // 飞剑刀光衰减
    if (this.slashActive) {
      this.slashTime += dt
      this.material.uniforms.uSlashTime.value = this.slashTime
      if (this.slashTime > 1.5) {  // 持续时间延长到 1.5 秒
        this.slashActive = false
        this.material.uniforms.uSlashTime.value = 0
      }
    }

    // 冲击波涟漪衰减
    const ripple = this.material.uniforms.uRippleTime.value
    if (ripple > 0.01) {
      this.material.uniforms.uRippleTime.value = Math.max(0, ripple - dt * 0.85)
    }

    this.handActive = false
    this.geometry.attributes.aMixFactor.needsUpdate = true
    this.geometry.attributes.aTargetPos.needsUpdate = true
    this.geometry.attributes.aColor.needsUpdate = true

    if (this.fluidMode) {
      this.updateFluid(dt)
    }
  }

  // ==================== 流体动力学模式 ====================

  enterFluidMode() {
    if (this.fluidMode) return
    this.fluidMode = true
    this.material.uniforms.uFluidMode.value = 1.0

    this.fluidVx = new Float32Array(this.particleCount)
    this.fluidVy = new Float32Array(this.particleCount)
    this.fluidVz = new Float32Array(this.particleCount)
    this.fluidMass = new Float32Array(this.particleCount)
    this.fluidSpeed = new Float32Array(this.particleCount)

    const velocities = new Float32Array(this.particleCount)
    for (let i = 0; i < this.particleCount; i++) {
      // 初始涡旋速度：让粒子立即散开旋转
      const angle = Math.random() * Math.PI * 2
      const speed = 0.3 + Math.random() * 0.7
      this.fluidVx[i] = Math.cos(angle) * speed
      this.fluidVy[i] = (Math.random() - 0.5) * 0.3
      this.fluidVz[i] = Math.sin(angle) * speed
      this.fluidMass[i] = 0.5 + Math.random() * 1.0
      velocities[i] = speed
    }

    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 1))
    this.geometry.attributes.aVelocity.needsUpdate = true
  }

  exitFluidMode() {
    if (!this.fluidMode) return
    this.fluidMode = false
    this.material.uniforms.uFluidMode.value = 0.0
    this.morphToTarget(2.0)
  }

  isFluidMode() {
    return this.fluidMode
  }

  setFluidTarget(x: number, y: number, z: number) {
    this.fluidTargetX = x
    this.fluidTargetY = y
    this.fluidTargetZ = z
    this.material.uniforms.uFluidTarget.value.set(x, y, z)
  }

  setFluidState(state: 'vortex' | 'attract' | 'repel') {
    this.fluidState = state
    if (state === 'repel') {
      this.blastTimer = this.BLAST_FRAMES
    }
  }

  getFluidState() {
    return this.fluidState
  }

  private updateFluid(dt: number) {
    const positions = this.geometry.attributes.position.array as Float32Array
    const velocities = this.geometry.attributes.aVelocity.array as Float32Array

    if (this.fluidState === 'repel') {
      this.blastTimer--
      if (this.blastTimer <= 0) {
        this.fluidState = 'vortex'
      }
    }

    const tx = this.fluidTargetX
    const ty = this.fluidTargetY
    const tz = this.fluidTargetZ
    const state = this.fluidState
    const G = 1.5
    const R = 4.0
    const EPS = 20.0
    const DAMPING = 0.93
    const frameScale = Math.min(dt * 60, 2.0)

    for (let i = 0; i < this.particleCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      let vx = this.fluidVx[i]
      let vy = this.fluidVy[i]
      let vz = this.fluidVz[i]
      const m = this.fluidMass[i]

      const dx = tx - x
      const dy = ty - y
      const dz = tz - z
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001

      const nx = dx / r
      const ny = dy / r
      const nz = dz / r

      if (state === 'attract') {
        const force = (G * m) / (r + EPS) * frameScale
        vx += nx * force
        vy += ny * force
        vz += nz * force
      } else if (state === 'repel') {
        const rForce = R / ((r * r / 1000) + EPS) * frameScale
        vx -= nx * rForce
        vy -= ny * rForce
        vz -= nz * rForce
      } else {
        // VORTEX: 强切向 + 弱径向，创造星系旋臂效果
        vx += (nx * 0.08 - ny * 0.8) * m * frameScale
        vy += (ny * 0.08 + nx * 0.8) * m * frameScale
        vz += nz * 0.03 * m * frameScale
      }

      vx *= DAMPING
      vy *= DAMPING
      vz *= DAMPING

      positions[i * 3]     = x + vx * frameScale
      positions[i * 3 + 1] = y + vy * frameScale
      positions[i * 3 + 2] = z + vz * frameScale

      const px = positions[i * 3]
      const py = positions[i * 3 + 1]
      const pz = positions[i * 3 + 2]
      const distFromCenter = Math.sqrt(px * px + py * py + pz * pz)
      if (distFromCenter > 15) {
        const sc = 15 / distFromCenter
        positions[i * 3]     = px * sc
        positions[i * 3 + 1] = py * sc
        positions[i * 3 + 2] = pz * sc
      }

      this.fluidVx[i] = vx
      this.fluidVy[i] = vy
      this.fluidVz[i] = vz

      velocities[i] = Math.sqrt(vx * vx + vy * vy + vz * vz)
    }

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aVelocity.needsUpdate = true
  }
}
