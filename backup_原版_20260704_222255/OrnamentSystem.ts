import * as THREE from 'three'
import gsap from 'gsap'
import { appConfig, AppEntry } from '../config/appConfig'
import { AudioManager } from './AudioManager'

interface Ornament {
  mesh: THREE.Group
  bubbleMesh: THREE.Mesh
  iconSprite: THREE.Sprite
  ringMesh: THREE.Mesh
  outerRing: THREE.Mesh
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

  constructor(scene: THREE.Scene, audio: AudioManager) {
    this.scene = scene
    this.audio = audio
    this.raycastGeometry = new THREE.SphereGeometry(0.8, 16, 16)
    this.raycastMaterial = new THREE.MeshBasicMaterial({ visible: false })
    this.createOrnaments()
    this.createRaycastSpheres()
  }

  private createRaycastSpheres() {
    for (let i = 0; i < this.ornaments.length; i++) {
      const sphere = new THREE.Mesh(this.raycastGeometry, this.raycastMaterial)
      sphere.userData = { appName: this.ornaments[i].app.name, ornamentIndex: i }
      this.raycastSpheres.push(sphere)
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

  private createOrnaments() {
    const positions = [
      new THREE.Vector3(1.3, -0.9, 1.0),
      new THREE.Vector3(-1.1, -0.6, 1.2),
      new THREE.Vector3(0.9, 0.5, 1.3),
      new THREE.Vector3(-1.2, 0.3, 1.0),
      new THREE.Vector3(0.3, -1.6, 0.9),
      new THREE.Vector3(-0.6, -1.4, 1.1),
      new THREE.Vector3(1.6, -0.2, 0.7),
      new THREE.Vector3(-1.4, -1.0, 0.8),
      new THREE.Vector3(0.5, 0.1, 1.5),
      new THREE.Vector3(-0.3, 0.9, 1.2),
      new THREE.Vector3(1.1, 1.3, 0.6),
      new THREE.Vector3(-0.8, -0.3, 1.4)
    ]

    appConfig.apps.forEach((app, index) => {
      const pos = positions[index % positions.length]
      const color = new THREE.Color(app.color)

      const group = new THREE.Group()
      group.position.copy(pos)
      group.userData = { appIndex: index, appName: app.name }

      const bubbleGeo = new THREE.SphereGeometry(0.24, 48, 48)
      const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        roughness: 0.02,
        metalness: 0.0,
        transparent: true,
        opacity: 0.28,
        transmission: 0.85,
        thickness: 0.35,
        ior: 1.33,
        emissive: color,
        emissiveIntensity: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat)
      bubbleMesh.renderOrder = 0
      group.add(bubbleMesh)

      const iconTexture = this.createIconTexture(app.name, app.color)
      const iconMat = new THREE.SpriteMaterial({
        map: iconTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      })
      const iconSprite = new THREE.Sprite(iconMat)
      iconSprite.scale.set(0.22, 0.22, 1)
      iconSprite.renderOrder = 1
      group.add(iconSprite)

      const ringGeo = new THREE.TorusGeometry(0.32, 0.025, 16, 64)
      const ringMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.15,
        metalness: 0.9,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.55
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      group.add(ringMesh)

      const outerRingGeo = new THREE.TorusGeometry(0.45, 0.015, 8, 80)
      const outerRingMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.1,
        metalness: 0.95,
        emissive: color,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.3
      })
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat)
      outerRing.rotation.x = Math.PI * 0.4
      group.add(outerRing)

      this.scene.add(group)

      this.ornaments.push({
        mesh: group,
        bubbleMesh,
        iconSprite,
        ringMesh,
        outerRing,
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
    const meshes = this.ornaments.map(o => o.mesh)
    const intersects = raycaster.intersectObjects(meshes, true)
    let hitOrnament: Ornament | null = null
    if (intersects.length > 0) {
      const hitObj = intersects[0].object
      hitOrnament = this.ornaments.find(o =>
        o.mesh === hitObj || o.bubbleMesh === hitObj || o.iconSprite === hitObj ||
        o.ringMesh === hitObj || o.outerRing === hitObj ||
        o.mesh.children.includes(hitObj)
      ) || null
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

    const bubbleMat = ornament.bubbleMesh.material as THREE.MeshPhysicalMaterial
    gsap.to(bubbleMat, { opacity: 0.42, emissiveIntensity: 0.35, duration: 0.3 })

    gsap.to(ornament.iconSprite.scale, { x: 0.26, y: 0.26, z: 1, duration: 0.3 })
    gsap.to(ornament.iconSprite.material, { opacity: 1.0, duration: 0.3 })

    const statusEl = document.getElementById('status')
    if (statusEl) {
      statusEl.textContent = `悬停: ${ornament.app.name} — 比耶停留选中`
      statusEl.style.color = ornament.app.color
    }

    const label = document.getElementById('ornament-label')
    if (label) {
      label.querySelector('.app-name')!.textContent = ornament.app.name
      label.querySelector('.app-gesture span')!.textContent = '比耶停留选中'
      label.classList.add('visible')
    }
  }

  private onHoverEnd(ornament: Ornament) {
    if (this.selectedOrnament === ornament) this.selectedOrnament = null
    if (ornament.selected) return

    gsap.to(ornament.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' })

    const bubbleMat = ornament.bubbleMesh.material as THREE.MeshPhysicalMaterial
    gsap.to(bubbleMat, { opacity: 0.28, emissiveIntensity: 0.15, duration: 0.3 })

    gsap.to(ornament.iconSprite.scale, { x: 0.22, y: 0.22, z: 1, duration: 0.3 })
    gsap.to(ornament.iconSprite.material, { opacity: 0.95, duration: 0.3 })

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

    gsap.to(ornament.mesh.position, { x: 0, y: 0.5, z: 0, duration: 0.6, ease: 'power3.out' })
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
      label.querySelector('.app-gesture span')!.textContent = '张开手掌启动'
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
    gsap.to(bubbleMat, { opacity: 0.28, emissiveIntensity: 0.15, duration: 0.6, ease: 'power2.inOut' })

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

    const bubbleMat = ornament.bubbleMesh.material as THREE.MeshPhysicalMaterial
    gsap.to(bubbleMat, {
      emissiveIntensity: 4.0, duration: 0.12, yoyo: true, repeat: 1,
      onComplete: () => gsap.to(bubbleMat, { emissiveIntensity: 0.15, duration: 0.6 })
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

    for (const ornament of this.ornaments) {
      if (ornament.selected) {
        ornament.ringMesh.rotation.z += 0.08
        ornament.ringMesh.rotation.x += 0.04
        ornament.outerRing.rotation.z -= 0.05
        ornament.outerRing.rotation.y += 0.06
      } else if (!ornament.hovered) {
        // 只在没做位置动画时才写呼吸位移，否则会掐断 gsap 的回弹动画
        if (!ornament.positionAnimating) {
          const breathe = Math.sin(time * 1.5 + ornament.basePosition.x * 2) * 0.04
          ornament.mesh.position.y = ornament.basePosition.y + breathe
        }
        ornament.ringMesh.rotation.z += 0.008
        ornament.ringMesh.rotation.x += 0.004
        ornament.outerRing.rotation.z -= 0.005
        ornament.outerRing.rotation.y += 0.007
      } else {
        ornament.ringMesh.rotation.z += 0.05
        ornament.outerRing.rotation.z -= 0.03
      }

      const target = ornament.hovered ? 1 : 0
      ornament.hoverProgress += (target - ornament.hoverProgress) * 0.12
    }
  }
}
