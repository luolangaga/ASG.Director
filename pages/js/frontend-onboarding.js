/**
 * ASG Frontend 编辑模式引导系统
 * 指导用户如何使用 F2 编辑模式和布局调整功能
 */

const FrontendOnboarding = {
  STORAGE_KEY: 'asg_frontend_onboarding_completed',
  currentStep: 0,

  steps: [
    {
      id: 'welcome-edit',
      title: '欢迎来到前台可视化编辑! 🎨',
      content: `
        <p>这里是 OBS 捕获的最终画面，但也是您的画布！</p>
        <p>在此页面，您可以自由拖拽、缩放所有元素，打造独一无二的布局。</p>
        <div style="background:rgba(255,215,0,0.1); padding:12px; border-radius:8px; border:1px solid rgba(255,215,0,0.3); margin-top:10px;">
          <strong>🎯 核心快捷键：</strong>
          <div style="margin-top:8px; font-size:16px;">
            <kbd style="background:#333; padding:4px 10px; border-radius:4px; border:1px solid #666;">F2</kbd>
            <span style="margin-left:8px;">开启/关闭 编辑模式</span>
          </div>
        </div>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'enable-edit',
      title: '第一步：开启编辑模式 🛠️',
      content: `
        <p>请按键盘上的 <strong>F2</strong> 键，或点击右上角的编辑按钮来进入编辑模式。</p>
        <p>进入编辑模式后，所有组件都会显示虚线边框。</p>
      `,
      target: '#editToolbar', // 虽然默认隐藏，但这会指向右上角区域
      position: 'bottom',
      highlight: true
    },
    {
      id: 'drag-component',
      title: '拖拽与移动 👋',
      content: `
        <p>进入编辑模式后：</p>
        <ul style="margin:8px 0; padding-left:20px; line-height:1.6;">
          <li><strong>移动</strong>：按住任意组件即可拖拽移动</li>
          <li><strong>缩放</strong>：拖动组件右下角的白色圆点可调整大小</li>
          <li><strong>显示名称</strong>：组件上方会显示其类型标签</li>
        </ul>
      `,
      target: '.draggable-container:first-of-type', // 尝试定位第一个可拖拽元素
      position: 'right',
      highlight: true
    },
    {
      id: 'context-menu',
      title: '右键菜单功能 🖱️',
      content: `
        <p>在编辑模式下，<strong>右键点击</strong>任意组件可打开高级菜单：</p>
        <ul style="margin:8px 0; padding-left:20px; line-height:1.6;">
          <li>👁️ <strong>隐藏/显示</strong>：临时隐藏不需要的组件</li>
          <li>🔒 <strong>锁定位置</strong>：防止误触移动</li>
          <li>⚙️ <strong>组件设置</strong>：修改特定组件参数</li>
        </ul>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'auto-save',
      title: '自动保存与管理 💾',
      content: `
        <p>您的每一次调整都会<strong>自动保存</strong>，无需手动操作！</p>
        <div style="background:rgba(66, 153, 225, 0.1); padding:12px; border-radius:8px; border:1px solid rgba(66, 153, 225, 0.3); margin-top:10px;">
          <div style="font-weight:bold; margin-bottom:4px;">💡 布局管理</div>
          <p style="font-size:13px; margin:0;">
            如需<strong>导出当前布局</strong>（分享给朋友）或<strong>导入新布局</strong>，请前往主页的 <span style="color:#00E5FF">"工具与商店"</span> 页面操作。
          </p>
        </div>
      `,
      target: '#editToolbar',
      position: 'bottom',
      highlight: true
    },
    {
      id: 'complete',
      title: '编辑指南完成！✅',
      content: `
        <p>您现在已经掌握了自定义布局的技巧！</p>
        <div style="text-align:center; margin:20px 0;">
          <button class="frontend-onboarding-btn frontend-onboarding-btn-complete" onclick="FrontendOnboarding.demoEditMode()">
            试一试 F2 切换
          </button>
        </div>
        <p style="font-size:12px; color:#aaa;">提示：双击文字组件还可以快速修改字体大小哦！</p>
      `,
      target: null,
      position: 'center'
    }
  ],

  createUI() {
    const existing = document.getElementById('frontend-onboarding-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frontend-onboarding-overlay';
    // 复用之前的 CSS 样式结构，但做微调适配前台
    overlay.innerHTML = `
      <style>
        #frontend-onboarding-overlay { position: fixed; inset: 0; z-index: 99999; pointer-events: none; }
        #frontend-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.8); pointer-events: auto; opacity: 0; transition: opacity 0.4s; }
        #frontend-backdrop.show { opacity: 1; }
        
        /* 简单的高亮框 */
        .frontend-highlight {
          position: absolute;
          border: 3px solid #00E5FF;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,255,0.4);
          border-radius: 8px;
          pointer-events: none;
          z-index: 100001;
          transition: all 0.3s;
        }
        
        .frontend-card {
          position: absolute;
          width: 380px;
          background: rgba(16, 20, 30, 0.95);
          border: 1px solid rgba(0, 229, 255, 0.3);
          border-radius: 12px;
          color: #fff;
          z-index: 100002;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.4s;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          pointer-events: auto;
        }
        
        .frontend-card.show { opacity: 1; transform: translateY(0); }
        
        .card-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .card-title { margin: 0; font-size: 18px; color: #00E5FF; }
        .card-body { padding: 20px; font-size: 14px; line-height: 1.6; color: #ccc; }
        .card-footer { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
        
        .step-dots { display: flex; gap: 6px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.2); }
        .dot.active { background: #00E5FF; box-shadow: 0 0 8px rgba(0,229,255,0.5); }
        .dot.done { background: #00B8D4; }
        
        .btn-group { display: flex; gap: 10px; }
        .f-btn { padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
        .f-btn-next { background: linear-gradient(135deg, #00E5FF, #00B8D4); color: #000; }
        .f-btn-prev { background: rgba(255,255,255,0.1); color: #fff; }
        .f-btn-skip { background: transparent; color: #888; }
        .f-btn:hover { opacity: 0.9; }
      </style>
      <div id="frontend-backdrop"></div>
      <div id="frontend-highlight" class="frontend-highlight" style="display:none"></div>
      <div id="frontend-card" class="frontend-card">
        <div class="card-header"><h3 class="card-title" id="f-title"></h3></div>
        <div class="card-body" id="f-body"></div>
        <div class="card-footer">
          <div class="step-dots" id="f-dots"></div>
          <div class="btn-group" id="f-btns"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  showStep(index) {
    if (!this.steps[index]) return;
    this.currentStep = index;

    // 初始化 UI
    const card = document.getElementById('frontend-card');
    const highlight = document.getElementById('frontend-highlight');
    const backdrop = document.getElementById('frontend-backdrop');

    // 填充内容
    document.getElementById('f-title').innerHTML = this.steps[index].title;
    document.getElementById('f-body').innerHTML = this.steps[index].content;

    // 更新进度点
    document.getElementById('f-dots').innerHTML = this.steps.map((_, i) =>
      `<div class="dot ${i === index ? 'active' : (i < index ? 'done' : '')}"></div>`
    ).join('');

    // 更新按钮
    let btns = '';
    if (index > 0) btns += `<button class="f-btn f-btn-prev" onclick="FrontendOnboarding.prev()">上一步</button>`;
    if (index < this.steps.length - 1) {
      btns += `<button class="f-btn f-btn-next" onclick="FrontendOnboarding.next()">下一步</button>`;
      if (index === 0) btns = `<button class="f-btn f-btn-skip" onclick="FrontendOnboarding.skip()">跳过</button>` + btns;
    } else {
      btns += `<button class="f-btn f-btn-next" onclick="FrontendOnboarding.complete()">完成</button>`;
    }
    document.getElementById('f-btns').innerHTML = btns;

    // 处理高亮
    const step = this.steps[index];
    if (step.target && step.highlight) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        highlight.style.display = 'block';
        highlight.style.left = (rect.left - 5) + 'px';
        highlight.style.top = (rect.top - 5) + 'px';
        highlight.style.width = (rect.width + 10) + 'px';
        highlight.style.height = (rect.height + 10) + 'px';

        backdrop.classList.remove('show'); // 有高亮时不显示全黑背景，利用 highlight 的 box-shadow

        this.positionCard(card, rect, step.position);
      } else {
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
    // 简化的定位逻辑
    const cw = 380, ch = card.offsetHeight || 300;
    let x = window.innerWidth / 2 - cw / 2, y = window.innerHeight / 2 - ch / 2;

    if (pos === 'right') { x = rect.right + 20; y = rect.top; }
    if (pos === 'bottom') { x = rect.left + rect.width / 2 - cw / 2; y = rect.bottom + 20; }

    // 边界检查
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
    document.getElementById('frontend-card').classList.remove('show');
    document.getElementById('frontend-backdrop').classList.remove('show');
    setTimeout(() => document.getElementById('frontend-onboarding-overlay').remove(), 400);
  },

  demoEditMode() {
    this.complete();
    // 模拟 F2 切换
    if (typeof toggleEditMode === 'function') {
      toggleEditMode();
      setTimeout(() => toggleEditMode(), 2000); // 2秒后自动切回，以免用户困惑
    }
  },

  start() {
    if (localStorage.getItem(this.STORAGE_KEY) === 'true') return;
    this.createUI();
    setTimeout(() => {
      document.getElementById('frontend-backdrop').classList.add('show');
      this.showStep(0);
    }, 800);
  },

  forceStart() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.start();
  }
};

window.FrontendOnboarding = FrontendOnboarding;
document.addEventListener('DOMContentLoaded', () => FrontendOnboarding.start());
