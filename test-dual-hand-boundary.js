/**
 * Test: dual-hand mode keeps pointing and actions separated.
 * Right hand should not reach the generic app operation path.
 */

const path = require('path')
const fs = require('fs')

const appSource = fs.readFileSync(path.join(__dirname, 'src/renderer/src/scene/App.ts'), 'utf-8')
const trackerSource = fs.readFileSync(path.join(__dirname, 'src/renderer/src/gesture/HandTracker.ts'), 'utf-8')
const ornamentSource = fs.readFileSync(path.join(__dirname, 'src/renderer/src/scene/OrnamentSystem.ts'), 'utf-8')
const indexSource = fs.readFileSync(path.join(__dirname, 'src/renderer/index.html'), 'utf-8')

let passed = 0
let failed = 0

function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`)
    passed++
  } else {
    console.log(`FAIL ${name}`)
    failed++
  }
}

console.log('Dual-hand gesture boundary test')

check('App does not register generic onGesture operation handler',
  !appSource.includes('this.handTracker.onGesture((gesture'))

check('App registers dedicated left-hand operation handler',
  appSource.includes('this.handTracker.onLeftHandGesture'))

check('Tracker does not send rightStable to generic gestureCallback in dual-hand mode',
  !trackerSource.includes('this.gestureCallback(rightStable'))

check('Tracker still sends left operations through leftHandGestureCallback',
  trackerSource.includes('this.leftHandGestureCallback?.(leftGesture, leftStable)'))

check('Right pointer movement only arms on open_palm',
  trackerSource.includes("const armed = stableGesture === 'open_palm'"))

check('Single left hand does not update pointer',
  trackerSource.includes("if (hand.side === 'Right') {\n      this.updatePointer(hand, gesture, stableGesture, timestamp)\n    }"))

check('Pinch threshold is relaxed for easier selection',
  trackerSource.includes('PINCH_RATIO_THRESHOLD = 0.5') &&
  trackerSource.includes('metrics.pinchRatio < this.PINCH_RATIO_THRESHOLD'))

check('Stable gesture vote threshold is responsive',
  trackerSource.includes('VOTE_THRESHOLD = 3'))

check('Left pinch selection requires recent right-hand aiming',
  appSource.includes('lastRightPointerArmedAt') &&
  appSource.includes('now - this.lastRightPointerArmedAt > 800'))

check('Selection pauses camera auto-rotation',
  appSource.includes("if (!this.clickedCenterTarget && !this.isRightDragging && !this.isLeftDragging && this.cameraAutoRotateEnabled)"))

check('Selection no longer moves group every animation frame',
  !appSource.includes('const viewDistance = this.cameraDistance * 0.45'))

check('Selection does not move ornaments toward camera',
  !appSource.includes('targetCenter = this.camera.position.clone()'))

check('Ornament selection does not move app to scene center',
  !ornamentSource.includes("gsap.to(ornament.mesh.position, { x: 0, y: 0.5, z: 0"))

check('Held left pinch can still trigger operation',
  trackerSource.includes("const leftPinchHeld = leftStable === 'pinch'") &&
  trackerSource.includes('leftOperationChanged || leftPinchHeld'))

check('Gesture combos do not open shape or constellation panels',
  !appSource.includes('双比耶 → 切换面板') &&
  !appSource.includes('双捏合 → 星座面板') &&
  appSource.includes('双捏合 → 已禁用星座面板切换'))

check('Same-side dual hands are assigned by wrist position',
  trackerSource.includes('按手腕位置稳定分配') &&
  trackerSource.includes('const leftIndex = firstX <= secondX ? 0 : 1'))

check('Double fist does not reset selection or camera state',
  appSource.includes("DebugLogger.important('App:组合手势', '双拳 → 已忽略')") &&
  !appSource.includes('双拳 → 全部取消'))

check('Gesture pinch zoom is disabled to prevent camera jumps',
  trackerSource.includes('手势缩放关闭') &&
  trackerSource.includes('this.dualPinchZoomDelta = 0') &&
  !trackerSource.includes('this.updatePinchZoom(left, leftStable)'))

check('Left pinch clicks UI before 3D ray selection',
  appSource.includes('private clickHandUiTarget(): boolean') && (() => {
    const start = appSource.indexOf('private handleHandSelect(): boolean')
    const end = appSource.indexOf('private handleLeftHandOperation', start)
    const body = appSource.slice(start, end)
    return body.indexOf('if (this.clickHandUiTarget())') < body.indexOf('this.raycaster.setFromCamera(this.mouseNDC, this.camera)')
  })())

check('Hand cursor can target shape and constellation controls',
  appSource.includes('[data-shape]') &&
  appSource.includes('[data-constellation]') &&
  appSource.includes('.shape-btn') &&
  appSource.includes('.constellation-btn'))

check('Hand hover styles exist for UI controls',
  indexSource.includes('.shape-btn.hand-hover') &&
  indexSource.includes('.constellation-btn.hand-hover') &&
  indexSource.includes('.debug-btn.hand-hover'))

console.log(`Result: ${passed}/${passed + failed} passed`)
process.exit(failed > 0 ? 1 : 0)
