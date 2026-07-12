# 星轨启动器 — Bug 修复报告

**修复日期：** 2026年7月11日  
**修复版本：** 星轨启动器（最新版）  
**修复人：** AI 助手  

---

## 修复概览

本次修复共处理 **3 个代码 Bug** 和 **1 项项目清理**，涉及 2 个文件，删除 8 个残留文件。修复后全功能测试 18/18 通过。

---

## Bug 1：App.ts 中 onGesture 重复注册

**严重程度：** ⚠️ 中  
**文件：** `src/renderer/src/scene/App.ts`  
**原行号：** L417-L419

### 问题描述

`onGesture` 回调被注册了两次，第二次注册覆盖了第一次，导致 `handleGesture` 方法从未被调用。

第一次注册（`initHandTracker` 方法内）：
```typescript
this.handTracker.onGesture((gesture, handX, handY) => {
  this.handleGesture(gesture, handX, handY)
})
```

第二次注册（`setupHandTracking` 方法内）：
```typescript
this.handTracker.onGesture((gesture, _handX, _handY) => {
  this.handleGestureForOrb(gesture)
})
```

由于 `HandTracker.onGesture` 内部实现为 `this.callback = callback`，只保留最后一次赋值，第一次注册的 `handleGesture` 被永久覆盖。

### 影响范围

- `handleGesture` 方法从未被调用，该方法虽然内部只是委托给 `handleGestureForOrb`，但保留了键盘模拟手势的入口点
- 实际影响不大，因为第二次注册直接调用了 `handleGestureForOrb`

### 修复方案

删除第一次冗余注册，保留第二次注册（直接调用 `handleGestureForOrb`，逻辑更清晰）。

### 修复后代码

```typescript
// 删除了这段冗余代码
// this.handTracker.onGesture((gesture, handX, handY) => {
//   this.handleGesture(gesture, handX, handY)
// })
```

---

## Bug 2：HandTracker.ts PINCH_THRESHOLD 常量被硬编码绕过

**严重程度：** ⚠️ 低  
**文件：** `src/renderer/src/gesture/HandTracker.ts`  
**原行号：** L262

### 问题描述

类中声明了常量 `private readonly PINCH_THRESHOLD = 0.08`，但在 `classifyGesture` 方法中使用了硬编码的 `0.08` 而非 `this.PINCH_THRESHOLD`。

```typescript
// 声明了常量但未使用
private readonly PINCH_THRESHOLD = 0.08

// 实际使用的是硬编码数字
if (thumbIndexDist < 0.08 && !middleExtended && !ringExtended && !pinkyExtended) {
```

### 影响范围

- 如果想调整捏合灵敏度，修改常量值不会生效，必须修改硬编码
- 容易造成维护混乱

### 修复方案

将硬编码 `0.08` 替换为 `this.PINCH_THRESHOLD`。

### 修复后代码

```typescript
if (thumbIndexDist < this.PINCH_THRESHOLD && !middleExtended && !ringExtended && !pinkyExtended) {
```

---

## Bug 3：HandTracker.ts 死字段

**严重程度：** ℹ️ 低  
**文件：** `src/renderer/src/gesture/HandTracker.ts`  
**原行号：** L45-L54, L68, L149-L154

### 问题描述

类中存在 5 个从不真正使用的成员变量和方法：

| 死字段/方法 | 类型 | 说明 |
|------------|------|------|
| `isPinching` | `boolean` | 只在手消失时设为 `false`，从不设为 `true` |
| `cursorLocked` | `boolean` | 只在手消失时设为 `false`，从不设为 `true` |
| `lockedScreenX` | `number` | 从不写入 |
| `lockedScreenY` | `number` | 从不写入 |
| `scrollCallback` + `onScroll()` | 方法 | 已标记废弃，仅输出警告 |

### 影响范围

- 增加代码体积和维护负担
- 可能误导新开发者认为这些字段有实际作用

### 修复方案

删除所有死字段声明、`onScroll` 方法、以及手消失时对 `isPinching` 和 `cursorLocked` 的无效赋值。

### 修复后代码

删除了：
```typescript
// 已删除
private isPinching = false
private cursorLocked = false
private lockedScreenX = 0
private lockedScreenY = 0
private scrollCallback: ((amount: number) => void) | null = null

onScroll(callback: (amount: number) => void) { ... }
this.isPinching = false
this.cursorLocked = false
```

---

## 清理：残留调试文件

**严重程度：** ℹ️ 无影响  
**文件数：** 8 个

### 删除清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `test_write.tmp` | 空文件 | 0B，测试残留 |
| `test-shapes.ts` | 测试代码 | 4KB，形态测试 |
| `debug-electron.js` | 调试脚本 | Electron 调试 |
| `simple-test.js` | 调试脚本 | 简单测试 |
| `test-builtin.js` | 调试脚本 | 内置模块测试 |
| `test-builtin2.js` | 调试脚本 | 内置模块测试2 |
| `test-require.js` | 调试脚本 | require 测试 |
| `test-electron.js` | 调试脚本 | Electron 测试 |

所有文件均为开发调试阶段遗留，不影响项目运行。

---

## 验证结果

修复后运行全功能自动化测试，**18/18 全部通过**：

| # | 功能 | 结果 |
|---|------|------|
| 1 | 页面加载 | ✅ 通过 |
| 2 | 形态面板（31个按钮） | ✅ 通过 |
| 3 | 30种形态逐个切换 | ✅ 通过 |
| 4 | 飞剑刀光特效 | ✅ 通过 |
| 5 | 冲击波涟漪特效 | ✅ 通过 |
| 6 | 滚轮缩放 | ✅ 通过 |
| 7 | 左键拖拽旋转 | ✅ 通过 |
| 8 | 星座面板（12星座） | ✅ 通过 |
| 9 | 6套主题切换 | ✅ 通过 |
| 10 | 流体模式 | ✅ 通过 |
| 11 | 粒子数量切换 | ✅ 通过 |
| 12 | 自动旋转 | ✅ 通过 |
| 13 | 双手模式 | ✅ 通过 |
| 14 | 手势映射面板 | ✅ 通过 |
| 15 | 标签模式 | ✅ 通过 |
| 16 | 星座连线 | ✅ 通过 |
| 17 | Q/E 形态切换 | ✅ 通过 |
| 18 | W/S 分类切换 | ✅ 通过 |

---

## 修复文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/renderer/src/scene/App.ts` | 删除重复的 onGesture 注册 |
| `src/renderer/src/gesture/HandTracker.ts` | 修复 PINCH_THRESHOLD 硬编码 + 清理 5 个死字段 + 删除 onScroll 方法 |
| 8 个残留文件 | 全部删除 |