/**
 * ASG 自定义动画系统
 * 用于在前端页面应用自定义CSS动画效果
 * 
 * 支持的动画类型:
 * - entrance: 开场动画 (元素首次出现时)
 * - select: 选择动画 (选中角色/道具时)
 * - blink: 闪烁效果 (等待/高亮状态循环)
 * - custom: 自定义动画
 */

(function () {
    'use strict'

    // 动画系统状态
    const AnimationSystem = {
        animations: [],
        styleElement: null,
        isInitialized: false,
        activeAnimations: new Map(), // 跟踪正在播放的动画
    }

    // 默认动画配置
    const DEFAULT_ANIMATIONS = {
        // 开场动画 - 角色入场
        'default-entrance-survivor': {
            id: 'default-entrance-survivor',
            name: '求生者入场',
            category: 'entrance',
            duration: 0.8,
            delay: 0,
            easing: 'ease-out',
            iterationCount: '1',
            direction: 'normal',
            fillMode: 'both',
            keyframes: `@keyframes asg-entrance-survivor {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}`,
            targets: ['survivor1', 'survivor2', 'survivor3', 'survivor4']
        },

        'default-entrance-hunter': {
            id: 'default-entrance-hunter',
            name: '监管者入场',
            category: 'entrance',
            duration: 1.0,
            delay: 0.2,
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            iterationCount: '1',
            direction: 'normal',
            fillMode: 'both',
            keyframes: `@keyframes asg-entrance-hunter {
  from {
    opacity: 0;
    transform: scale(1.3) rotate(-5deg);
    filter: blur(10px);
  }
  60% {
    opacity: 0.8;
    transform: scale(0.95) rotate(2deg);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0);
    filter: blur(0);
  }
}`,
            targets: ['hunter']
        },

        // 选择动画
        'default-select': {
            id: 'default-select',
            name: '选择动画',
            category: 'select',
            duration: 0.4,
            delay: 0,
            easing: 'ease-out',
            iterationCount: '1',
            direction: 'normal',
            fillMode: 'forwards',
            keyframes: `@keyframes asg-select {
  0% {
    transform: scale(1);
    box-shadow: none;
  }
  50% {
    transform: scale(1.05);
    box-shadow: none;
  }
  100% {
    transform: scale(1);
    box-shadow: none;
  }
}`,
            targets: ['survivor1', 'survivor2', 'survivor3', 'survivor4', 'hunter']
        },

        // 闪烁效果 - 待选状态
        'default-blink-pending': {
            id: 'default-blink-pending',
            name: '待选闪烁',
            category: 'blink',
            duration: 1.5,
            delay: 0,
            easing: 'ease-in-out',
            iterationCount: 'infinite',
            direction: 'alternate',
            fillMode: 'both',
            keyframes: `@keyframes asg-blink-pending {
  0% {
    box-shadow: none;
    border-color: transparent;
  }
  100% {
    box-shadow: none;
    border-color: transparent;
  }
}`,
            targets: ['survivor1', 'survivor2', 'survivor3', 'survivor4', 'hunter']
        },

        // 禁用动画
        'default-ban': {
            id: 'default-ban',
            name: '禁用效果',
            category: 'select',
            duration: 0.5,
            delay: 0,
            easing: 'ease-out',
            iterationCount: '1',
            direction: 'normal',
            fillMode: 'forwards',
            keyframes: `@keyframes asg-ban {
  0% {
    opacity: 1;
    filter: none;
    transform: scale(1);
  }
  30% {
    transform: scale(1.1);
    filter: brightness(1.5);
  }
  100% {
    opacity: 0.6;
    filter: grayscale(100%);
    transform: scale(1);
  }
}`,
            targets: []
        }
    }

    /**
     * 初始化动画系统
     */
    async function init() {
        if (AnimationSystem.isInitialized) return

        console.log('[AnimationSystem] 初始化动画系统...')

        // 创建样式元素
        AnimationSystem.styleElement = document.createElement('style')
        AnimationSystem.styleElement.id = 'asg-custom-animations'
        document.head.appendChild(AnimationSystem.styleElement)

        // [Fix] 立即注入默认样式，确保 keyframes 在第一时间可用
        // 防止"初次播放动画时不执行"的问题（因为此时 await loadAnimations 可能还未完成）
        injectStyles()

        // 加载自定义动画
        await loadAnimations()

        // 再次注入CSS（包含自定义动画）
        injectStyles()

        // 监听动画更新
        setupListeners()

        AnimationSystem.isInitialized = true
        console.log('[AnimationSystem] 动画系统初始化完成，共加载', AnimationSystem.animations.length, '个动画')
    }

    /**
     * 加载自定义动画
     */
    async function loadAnimations() {
        try {
            // 确保 electronAPI 可用
            if (!window.electronAPI) {
                AnimationSystem.animations = []
                return
            }
            const result = await window.electronAPI.loadLayout()
            if (result.success && result.layout && result.layout.customAnimations) {
                AnimationSystem.animations = result.layout.customAnimations
                console.log('[AnimationSystem] 加载了', AnimationSystem.animations.length, '个自定义动画')
            } else {
                AnimationSystem.animations = []
            }
        } catch (e) {
            console.error('[AnimationSystem] 加载动画失败:', e)
            AnimationSystem.animations = []
        }
    }

    /**
     * 注入CSS样式
     */
    function injectStyles() {
        let css = '/* ASG Custom Animations */\n\n'

        // 添加默认动画
        Object.values(DEFAULT_ANIMATIONS).forEach(anim => {
            css += generateAnimationCss(anim) + '\n\n'
        })

        // 添加自定义动画
        AnimationSystem.animations.forEach(anim => {
            css += generateAnimationCss(anim) + '\n\n'
        })

        AnimationSystem.styleElement.textContent = css
    }

    /**
     * 生成动画CSS
     */
    function generateAnimationCss(anim) {
        const animName = getAnimationName(anim)
        const keyframes = (anim.keyframes || '').replace(/%NAME%/g, animName)

        return `${keyframes}

.asg-animate-${anim.id.replace(/[^a-zA-Z0-9-]/g, '')} {
  animation-name: ${animName};
  animation-duration: ${anim.duration || 1}s;
  animation-timing-function: ${anim.easing || 'ease'};
  animation-delay: ${anim.delay || 0}s;
  animation-iteration-count: ${anim.iterationCount || 1};
  animation-direction: ${anim.direction || 'normal'};
  animation-fill-mode: ${anim.fillMode || 'forwards'};
}`
    }

    /**
     * 获取动画名称
     */
    function getAnimationName(anim) {
        // 从keyframes中提取动画名称
        const match = anim.keyframes?.match(/@keyframes\s+([a-zA-Z0-9_-]+)/)
        return match ? match[1] : 'asg-anim-' + anim.id.replace(/[^a-zA-Z0-9]/g, '')
    }

    /**
     * 设置监听器
     */
    function setupListeners() {
        // 监听动画更新事件
        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('update-data', async (data) => {
                if (data && data.type === 'custom-animations-updated') {
                    console.log('[AnimationSystem] 收到动画更新通知')
                    AnimationSystem.animations = data.animations || []
                    injectStyles()
                }
            })

            // 监听广播动画控制
            window.electronAPI.on('broadcast-animation', (payload) => {
                const { target, animationId, options, action } = payload
                if (action === 'stop') {
                    stopAnimation(target, true) // true = isRemote
                } else {
                    applyAnimation(target, animationId, options, true) // true = isRemote
                }
            })
        }
    }

    /**
     * 应用动画到元素
     * @param {string|HTMLElement} target - 目标元素ID或元素
     * @param {string} animationId - 动画ID或类别
     * @param {Object} options - 可选配置
     * @param {boolean} isRemote - 是否为远程调用（避免无限递归广播）
     */
    function applyAnimation(target, animationId, options = {}, isRemote = false) {
        const targetId = typeof target === 'string' ? target : target.id
        const element = typeof target === 'string' ? document.getElementById(target) : target

        // 如果本地没有该元素，尝试广播给其他窗口
        if (!element) {
            if (!isRemote && window.electronAPI && window.electronAPI.send) {
                console.log('[AnimationSystem] 本地未找到元素，尝试广播:', targetId)
                window.electronAPI.send('broadcast-animation', {
                    target: targetId,
                    animationId,
                    options,
                    action: 'play'
                })
            } else if (isRemote) {
                // 远程请求且本地也没有，忽略
            } else {
                console.warn('[AnimationSystem] 找不到目标元素且无法广播:', targetId)
            }
            return
        }

        // 查找动画 (优先本地执行)
        let animation = findAnimation(animationId)
        if (!animation) {
            console.warn('[AnimationSystem] 找不到动画:', animationId)
            return
        }

        // 合并选项
        const config = {
            duration: options.duration || animation.duration,
            delay: options.delay !== undefined ? options.delay : animation.delay,
            easing: options.easing || animation.easing,
            iterationCount: options.iterationCount || animation.iterationCount,
            onComplete: options.onComplete
        }

        // 停止之前的动画
        stopAnimation(element, true) // 这里传true是为了避免在该函数内再次广播stop，因为马上就要播放新的了

        // 获取动画名称
        const animName = getAnimationName(animation)

        // 强制显示元素 (用户请求：播放动画时强制取消隐藏)
        element.classList.remove('layout-hidden')

        // 清除可能导致隐藏的内联样式
        element.style.removeProperty('display')
        element.style.removeProperty('visibility')
        element.style.removeProperty('opacity')

        // 检查计算样式，如果仍然是隐藏的，则强制显示
        const computed = window.getComputedStyle(element)
        if (computed.display === 'none') {
            // 针对特定组件类型的特殊处理
            if (element.classList.contains('timer-progress-bar') ||
                element.classList.contains('ban-container') ||
                element.classList.contains('global-ban-container')) {
                element.style.setProperty('display', 'flex', 'important')
            } else {
                element.style.setProperty('display', 'block', 'important')
            }
        }
        if (computed.visibility === 'hidden') {
            element.style.setProperty('visibility', 'visible', 'important')
        }

        // 显式重置透明度，防止 residual opacity: 0
        element.style.setProperty('opacity', '1', 'important')

        console.log('[AnimationSystem] 强制显示元素并播放动画:', element.id)

        // [Fix] 强制浏览器重排 (Force Reflow)
        void element.offsetHeight;

        // [Fix] 使用双重 requestAnimationFrame 确保在下一帧渲染后再应用动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.animation = `${animName} ${config.duration}s ${config.easing} ${config.delay}s ${config.iterationCount} ${animation.direction || 'normal'} ${animation.fillMode || 'forwards'}`

                // 跟踪活动动画
                AnimationSystem.activeAnimations.set(element, {
                    animation,
                    startTime: Date.now()
                })
            })
        })

        // 动画结束回调
        if (config.onComplete && config.iterationCount !== 'infinite') {
            const totalDuration = (config.duration + config.delay) * 1000
            setTimeout(() => {
                if (AnimationSystem.activeAnimations.has(element)) {
                    AnimationSystem.activeAnimations.delete(element)
                    config.onComplete(element)
                }
            }, totalDuration)
        }

        console.log('[AnimationSystem] 应用动画:', animation.name, '到', element.id || element)
    }

    /**
     * 查找动画
     */
    function findAnimation(idOrCategory) {
        // 先在自定义动画中查找
        let animation = AnimationSystem.animations.find(a => a.id === idOrCategory)
        if (animation) return animation

        // 在默认动画中查找
        animation = DEFAULT_ANIMATIONS[idOrCategory]
        if (animation) return animation

        // 按类别查找第一个匹配的自定义动画
        animation = AnimationSystem.animations.find(a => a.category === idOrCategory)
        if (animation) return animation

        // 按类别查找默认动画
        animation = Object.values(DEFAULT_ANIMATIONS).find(a => a.category === idOrCategory)
        return animation
    }

    /**
     * 停止元素上的动画
     */
    function stopAnimation(target, isRemote = false) {
        const targetId = typeof target === 'string' ? target : target.id
        const element = typeof target === 'string' ? document.getElementById(target) : target

        if (!element) {
            if (!isRemote && window.electronAPI && window.electronAPI.send) {
                window.electronAPI.send('broadcast-animation', {
                    target: targetId,
                    action: 'stop'
                })
            }
            return
        }

        element.style.animation = 'none'
        element.offsetHeight // 强制reflow
        AnimationSystem.activeAnimations.delete(element)
    }

    /**
     * 应用开场动画
     * @param {string|HTMLElement} target - 目标元素
     * @param {number} staggerDelay - 错开延迟（用于多个元素依次入场）
     */
    function playEntranceAnimation(target, staggerDelay = 0) {
        const targetId = typeof target === 'string' ? target : target.id
        const element = typeof target === 'string' ? document.getElementById(target) : target
        // if (!element) return // 移除此检查，允许远程调用

        // 查找适合该元素的入场动画
        let animation = findAnimationForTarget(targetId, 'entrance')

        if (!animation) {
            // 使用默认入场动画
            if (targetId === 'hunter') {
                animation = DEFAULT_ANIMATIONS['default-entrance-hunter']
            } else if (targetId && targetId.startsWith('survivor')) {
                animation = DEFAULT_ANIMATIONS['default-entrance-survivor']
            } else {
                animation = null
            }
        }

        if (animation) {
            animation.fillMode = 'both'
            applyAnimation(targetId, animation.id, { delay: staggerDelay })
        }
    }

    /**
     * 应用选择动画
     */
    function playSelectAnimation(target) {
        console.log('[AnimationSystem] playSelectAnimation 被调用, target:', target)
        const targetId = typeof target === 'string' ? target : target.id
        // const element = ... NO check here

        let animation = findAnimationForTarget(targetId, 'select')
        if (!animation) {
            animation = DEFAULT_ANIMATIONS['default-select']
        }

        if (animation) {
            applyAnimation(targetId, animation.id)

            // 联动播放
            if (animation.targets) {
                animation.targets.forEach(t => {
                    if (t === targetId) return
                    // 对于targets中的元素，直接尝试应用动画（内部会自动广播）
                    // 自定义组件的特殊判断需要保留吗？
                    // 如果无法判断是否为 custom-component (因为在远程)，我们最好怎么做？
                    // 假设用户配置的 targets 都是想要动画的。
                    // 但是 customComponents 这个特殊标记是针对 class 的。
                    if (t === 'customComponents') {
                        document.querySelectorAll('.custom-component').forEach(comp => {
                            applyAnimation(comp, animation.id)
                        })
                        // 无法广播 generic class selector without significant changes. 
                        // Suggest user to use explicit IDs for cross-window linkage.
                    } else {
                        // 直接应用，由 applyAnimation 处理存在性
                        applyAnimation(t, animation.id)
                    }
                })
            }
        }

        // 3. 触发特定角色的选择事件
        const specificCategory = `select-${targetId}`
        const specificAnims = AnimationSystem.animations.filter(a => a.category === specificCategory)

        specificAnims.forEach(anim => {
            if (anim.targets) {
                anim.targets.forEach(t => {
                    if (t === 'customComponents') {
                        document.querySelectorAll('.custom-component').forEach(c => applyAnimation(c, anim.id))
                    } else {
                        applyAnimation(t, anim.id)
                    }
                })
            }
        })
    }

    /**
     * 应用闪烁动画
     */
    function playBlinkAnimation(target) {
        const targetId = typeof target === 'string' ? target : target.id

        let animation = findAnimationForTarget(targetId, 'blink')
        if (!animation) {
            animation = DEFAULT_ANIMATIONS['default-blink-pending']
        }

        if (animation) {
            applyAnimation(targetId, animation.id)

            // [Fix] 移除自动广播到所有 targets 的逻辑。
            // animation.targets 是该动画支持的目标列表(whitelist)，而不是联动列表。
            // 如果需要联动，应当使用 specificCategory 或者专门的联动配置。
            /*
            if (animation.targets) {
                animation.targets.forEach(t => {
                    if (t === targetId) return
                    if (t === 'customComponents') {
                        document.querySelectorAll('.custom-component').forEach(comp => {
                            applyAnimation(comp, animation.id)
                        })
                    } else {
                        applyAnimation(t, animation.id)
                    }
                })
            }
            */
        }

        const specificCategory = `blink-${targetId}`
        const specificAnims = AnimationSystem.animations.filter(a => a.category === specificCategory)

        specificAnims.forEach(anim => {
            if (anim.targets) {
                anim.targets.forEach(t => {
                    if (t === 'customComponents') {
                        document.querySelectorAll('.custom-component').forEach(c => applyAnimation(c, anim.id))
                    } else {
                        applyAnimation(t, anim.id)
                    }
                })
            }
        })
    }

    /**
     * 停止闪烁动画
     */
    function stopBlinkAnimation(target) {
        const targetId = typeof target === 'string' ? target : target.id

        stopAnimation(targetId)

        // [Fix] 同样移除停止时的广播逻辑
        /*
        const animation = findAnimationForTarget(targetId, 'blink')
        if (animation && animation.targets) {
            animation.targets.forEach(t => {
                if (t === targetId) return
                if (t === 'customComponents') {
                    document.querySelectorAll('.custom-component').forEach(comp => stopAnimation(comp))
                } else {
                    stopAnimation(t)
                }
            })
        }
        */

        const specificCategory = `blink-${targetId}`
        const specificAnims = AnimationSystem.animations.filter(a => a.category === specificCategory)

        specificAnims.forEach(anim => {
            if (anim.targets) {
                anim.targets.forEach(t => {
                    if (t === 'customComponents') {
                        document.querySelectorAll('.custom-component').forEach(c => stopAnimation(c))
                    } else {
                        stopAnimation(t)
                    }
                })
            }
        })
    }

    /**
     * 查找适用于目标的动画
     */
    function findAnimationForTarget(targetId, category) {
        // 在自定义动画中查找针对该目标的动画
        const el = document.getElementById(targetId)
        const isCustom = el && el.classList.contains('custom-component')

        return AnimationSystem.animations.find(a =>
            a.category === category &&
            a.targets &&
            (a.targets.includes(targetId) || (isCustom && a.targets.includes('customComponents')))
        )
    }

    /**
     * 批量应用开场动画
     * @param {string[]} targets - 目标元素ID数组
     * @param {number} stagger - 每个元素之间的延迟
     */
    function playEntranceSequence(targets, stagger = 0.1) {
        // 如果未指定目标，则自动发现所有需要播放入场动画的元素
        if (!targets) {
            targets = ['survivor1', 'survivor2', 'survivor3', 'survivor4', 'hunter']

            // 查找所有在自定义动画中被标记为目标的元素
            if (AnimationSystem.animations) {
                AnimationSystem.animations.forEach(anim => {
                    if (anim.category === 'entrance' && anim.targets) {
                        anim.targets.forEach(t => {
                            // 特殊处理自定义组件组
                            if (t === 'customComponents') {
                                document.querySelectorAll('.custom-component').forEach(comp => {
                                    if (comp.id && !targets.includes(comp.id)) {
                                        targets.push(comp.id)
                                    }
                                })
                            }
                            // 避免重复添加，并确保元素存在于DOM中
                            else if (!targets.includes(t) && document.getElementById(t)) {
                                targets.push(t)
                            }
                        })
                    }
                })
            }
        }

        targets.forEach((target, index) => {
            playEntranceAnimation(target, index * stagger)
        })
    }

    /**
     * 获取所有已注册的动画
     */
    function getAnimations() {
        return {
            custom: [...AnimationSystem.animations],
            default: Object.values(DEFAULT_ANIMATIONS)
        }
    }

    /**
     * 重新加载动画
     */
    async function reload() {
        await loadAnimations()
        injectStyles()
        console.log('[AnimationSystem] 动画已重新加载')
    }

    // 导出到全局
    window.ASGAnimations = {
        init,
        reload,
        applyAnimation,
        stopAnimation,
        playEntranceAnimation,
        playSelectAnimation,
        playBlinkAnimation,
        stopBlinkAnimation,
        playEntranceSequence,
        getAnimations,
        findAnimation,
        DEFAULT_ANIMATIONS
    }

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }

})()
