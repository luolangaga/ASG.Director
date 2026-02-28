/**
 * Idvevent 动画编辑器引导系统
 * 指导用户如何创建和编辑自定义动画
 */

const AnimationOnboarding = {
    STORAGE_KEY: 'asg_animation_onboarding_completed',
    currentStep: 0,

    steps: [
        {
            title: '欢迎使用动画编辑器! 🎬',
            content: `
        <p>在这里，您可以为导播端的任何元素创建炫酷的 CSS 动画。</p>
        <p>无论是入场、选中还是闪烁效果，都可以完全自定义。</p>
        <div style="margin-top:10px; font-size:13px; color:#aaa;">
          支持标准 CSS Keyframes 语法，并提供多种预设效果。
        </div>
      `,
            target: null,
            position: 'center'
        },
        {
            title: '第一步：新建动画 ➕',
            content: `
        <p>点击这里开始创建一个新动画。</p>
        <p>创建时可以选择动画类型：</p>
        <ul style="margin:8px 0; padding-left:20px;">
          <li>🚀 <strong>开场动画</strong>：元素出现时播放</li>
          <li>👆 <strong>选择动画</strong>：选中角色时播放</li>
          <li>✨ <strong>闪烁效果</strong>：持续循环播放</li>
        </ul>
      `,
            target: 'button[onclick="createNewAnimation()"]',
            position: 'bottom',
            highlight: true
        },
        {
            title: '编辑参数与代码 ⚙️',
            content: `
        <p>选中动画后，这里会显示详细设置。</p>
        <p>您可以调整<strong>时长、延迟、缓动函数</strong>等参数，也可以在下方直接编写 <strong>CSS 代码</strong>。</p>
        <p>修改后记得点击保存哦！</p>
      `,
            target: '#propertiesPanel', // 指向右侧属性面板
            position: 'left',
            highlight: false // 只是大致指向
        },
        {
            title: '实时预览 ▶️',
            content: `
        <p>在这个区域，您可以实时看到动画效果。</p>
        <p>点击播放按钮来测试您的动画，确保它看起来非常完美。</p>
      `,
            target: '.preview-section',
            position: 'right',
            highlight: true
        },
        {
            title: '快捷预设 ⚡',
            content: `
        <p>不想写代码？没问题！</p>
        <p>使用这些<strong>快捷预设按钮</strong>，一键应用常用的淡入、滑动、缩放等效果。</p>
      `,
            target: '.preset-grid',
            position: 'left',
            highlight: true
        },
        {
            title: '现在开始吧！🚀',
            content: `
        <p>您已经准备好制作精彩的动画效果了。</p>
        <p>发挥您的创意，升级您的导播视觉体验！</p>
      `,
            target: null,
            position: 'center'
        }
    ],

    createUI() {
        const existing = document.getElementById('anim-onboarding-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'anim-onboarding-overlay';
        overlay.innerHTML = `
      <style>
        #anim-onboarding-overlay { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
        #anim-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); pointer-events: auto; opacity: 0; transition: opacity 0.4s; }
        #anim-backdrop.show { opacity: 1; }
        
        .anim-highlight {
          position: absolute;
          border: 3px solid #ff9800;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 20px rgba(255, 152, 0, 0.4);
          border-radius: 6px;
          pointer-events: none;
          z-index: 10001;
          transition: all 0.3s;
        }

        .anim-card {
          position: absolute;
          width: 360px;
          background: #1e1e2d;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          z-index: 10002;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.4s;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          pointer-events: auto;
        }
        
        .anim-card.show { opacity: 1; transform: translateY(0); }
        
        .ac-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .ac-title { margin: 0; font-size: 18px; color: #ff9800; }
        .ac-body { padding: 20px; font-size: 14px; line-height: 1.6; color: #ddd; }
        .ac-footer { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
        
        .ac-dots { display: flex; gap: 6px; }
        .ac-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.2); }
        .ac-dot.active { background: #ff9800; }
        .ac-dot.done { background: #ffb74d; }
        
        .ac-btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
        .ac-btn-next { background: #ff9800; color: #000; font-weight: bold; }
        .ac-btn-prev { background: rgba(255,255,255,0.1); color: #fff; }
        .ac-btn-skip { background: transparent; color: #777; }
        .ac-btn:hover { opacity: 0.9; }
      </style>
      <div id="anim-backdrop"></div>
      <div id="anim-highlight" class="anim-highlight" style="display:none"></div>
      <div id="anim-card" class="anim-card">
        <div class="ac-header"><h3 class="ac-title" id="ac-title"></h3></div>
        <div class="ac-body" id="ac-body"></div>
        <div class="ac-footer">
          <div class="ac-dots" id="ac-dots"></div>
          <div style="display:flex; gap:10px;" id="ac-btns"></div>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);
    },

    showStep(index) {
        if (!this.steps[index]) return;
        this.currentStep = index;

        // 确保 UI 存在
        if (!document.getElementById('anim-card')) this.createUI();

        const card = document.getElementById('anim-card');
        const highlight = document.getElementById('anim-highlight');
        const backdrop = document.getElementById('anim-backdrop');

        // 内容 update
        document.getElementById('ac-title').innerHTML = this.steps[index].title;
        document.getElementById('ac-body').innerHTML = this.steps[index].content;

        // Dots
        document.getElementById('ac-dots').innerHTML = this.steps.map((_, i) =>
            `<div class="ac-dot ${i === index ? 'active' : (i < index ? 'done' : '')}"></div>`
        ).join('');

        // Buttons
        let btns = '';
        if (index > 0) btns += `<button class="ac-btn ac-btn-prev" onclick="AnimationOnboarding.prev()">上一步</button>`;
        if (index < this.steps.length - 1) {
            btns += `<button class="ac-btn ac-btn-next" onclick="AnimationOnboarding.next()">下一步</button>`;
            if (index === 0) btns = `<button class="ac-btn ac-btn-skip" onclick="AnimationOnboarding.skip()">跳过</button>` + btns;
        } else {
            btns += `<button class="ac-btn ac-btn-next" onclick="AnimationOnboarding.complete()">开始探索</button>`;
        }
        document.getElementById('ac-btns').innerHTML = btns;

        // Positioning
        const step = this.steps[index];
        if (step.target && step.highlight) {
            const el = document.querySelector(step.target);
            if (el && el.offsetParent !== null) { // Check visibility
                const rect = el.getBoundingClientRect();
                highlight.style.display = 'block';
                highlight.style.left = (rect.left - 5) + 'px';
                highlight.style.top = (rect.top - 5) + 'px';
                highlight.style.width = (rect.width + 10) + 'px';
                highlight.style.height = (rect.height + 10) + 'px';

                backdrop.classList.remove('show');
                this.positionCard(card, rect, step.position);
            } else {
                // Fallback if element not found or hidden
                this.centerCard(card);
                highlight.style.display = 'none';
                backdrop.classList.add('show');
            }
        } else {
            this.centerCard(card);
            highlight.style.display = 'none';
            backdrop.classList.add('show');
        }

        setTimeout(() => card.classList.add('show'), 50);
    },

    positionCard(card, rect, pos) {
        const cw = 360, ch = card.offsetHeight || 250;
        let x = window.innerWidth / 2 - cw / 2, y = window.innerHeight / 2 - ch / 2;

        if (pos === 'right') { x = rect.right + 20; y = rect.top; }
        if (pos === 'left') { x = rect.left - cw - 20; y = rect.top; }
        if (pos === 'bottom') { x = rect.left; y = rect.bottom + 20; }

        // Bounds check
        if (x < 20) x = 20;
        if (x + cw > window.innerWidth - 20) x = window.innerWidth - cw - 20;
        if (y < 20) y = 20;
        if (y + ch > window.innerHeight - 20) y = window.innerHeight - ch - 20;

        card.style.left = x + 'px';
        card.style.top = y + 'px';
        card.style.transform = 'none';
    },

    centerCard(card) {
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';
    },

    next() { this.showStep(this.currentStep + 1); },
    prev() { this.showStep(this.currentStep - 1); },
    skip() { this.complete(); },

    complete() {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        const card = document.getElementById('anim-card');
        if (card) card.classList.remove('show');

        const backdrop = document.getElementById('anim-backdrop');
        if (backdrop) backdrop.classList.remove('show');

        setTimeout(() => {
            const overlay = document.getElementById('anim-onboarding-overlay');
            if (overlay) overlay.remove();
        }, 400);
    },

    start() {
        if (localStorage.getItem(this.STORAGE_KEY) === 'true') return;
        this.createUI();
        // Delay slightly to allow UI render
        setTimeout(() => {
            const backdrop = document.getElementById('anim-backdrop');
            if (backdrop) backdrop.classList.add('show');
            this.showStep(0);
        }, 100);
    },

    forceStart() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.start();
    }
};

window.AnimationOnboarding = AnimationOnboarding;
document.addEventListener('DOMContentLoaded', () => {
    // AnimationOnboarding.start() // User requested manual start only
});
