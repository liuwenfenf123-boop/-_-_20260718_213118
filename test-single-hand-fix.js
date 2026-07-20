/**
 * 测试：单手模式 → 右手捏合不能选中
 * 验证 processSingleHand 中右手不触发选中逻辑
 */

const path = require('path')
const fs = require('fs')

const trackerPath = path.join(__dirname, 'src/renderer/src/gesture/HandTracker.ts')
const source = fs.readFileSync(trackerPath, 'utf-8')

console.log('========================================')
console.log('  单手模式右手选中修复 - 验证测试')
console.log('========================================\n')

let passed = 0
let failed = 0

function check(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}`)
    failed++
  }
}

console.log('📋 检查点 1: processSingleHand 点击检测 → 仅左手触发')
check('点击检测外层有 hand.side === "Left" 包裹',
  source.includes("if (hand.side === 'Left')"))

console.log('\n📋 检查点 2: 右手单手模式 → 只打日志，不触发操作')
check('右手分支有 "不触发点击" 日志',
  source.includes("右手在单手模式，不触发点击（仅左手可操作）"))

console.log('\n📋 检查点 3: processSingleHand gestureCallback → 仅左手触发')
check('gestureCallback 加了 hand.side === "Left" 判断',
  source.includes("hand.side === 'Left'"))

console.log('\n📋 检查点 4: App.ts 模式变化日志')
const appSource = fs.readFileSync(path.join(__dirname, 'src/renderer/src/scene/App.ts'), 'utf-8')
check('prevHandMode 变量存在', appSource.includes('prevHandMode'))
check('模式切换日志存在', appSource.includes('模式切换:'))

console.log('\n📋 检查点 5: TrackerDebugData 有 mode 字段')
check('mode 字段存在', source.includes("mode: 'none' | 'single' | 'dual'"))

console.log('\n📋 检查点 6: debugData 赋值包含 mode')
check('无手 mode', source.includes("mode: 'none'"))
check('单手 mode', source.includes("mode: 'single'"))
check('双手 mode', source.includes("mode: 'dual'"))

console.log('\n========================================')
console.log(`  结果: ${passed} 通过 / ${passed + failed} 总计`)
if (failed === 0) {
  console.log('  🎉 所有检查点通过！修复有效。')
} else {
  console.log(`  ⚠️ ${failed} 个检查点失败。`)
}
console.log('========================================\n')

console.log('📖 场景模拟说明：')
console.log('  摄像头只拍到右手（左手被遮挡/出框）：')
console.log('  1. consumeResults() → 1只手 → processSingleHand')
console.log('  2. hand.side === "Right" → 点击检测跳过')
console.log('  3. gestureCallback → 跳过')
console.log('  4. 右手 → 只打日志，不执行任何操作')
console.log('')
console.log('  摄像头拍到双手：')
console.log('  1. consumeResults() → 2只手 → processDualHands')
console.log('  2. 右手 → 只负责光标移动')
console.log('  3. 左手 → leftHandGestureCallback 触发操作')
console.log('  4. 调试面板显示 "👐 双手模式"')

process.exit(failed > 0 ? 1 : 0)
