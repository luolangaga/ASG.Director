/**
 * Idvevent Director 新手引导系统
 * 为首次使用的用户提供交互式引导教程
 */

// 在这里直接填网络图片 URL，就会显示在主页面教程弹窗里；留空则不显示。
const ONBOARDING_IMAGE_SLOTS = {
  obsBrowserSource: 'http://api.idvevent.cn/uploads/markdown/20260316142438-377a07a5.png',
  obsCustomDock: 'http://api.idvevent.cn/uploads/markdown/20260316144817-30d64db9.png',
  obsWorkflow: ''
}

const ASGOnboarding = {
  // 本地存储key
  STORAGE_KEY: 'asg_onboarding_completed',
  CURRENT_STEP_KEY: 'asg_onboarding_current_step',

  // 当前步骤
  currentStep: 0,

  // 引导步骤配置
  steps: [
    {
      id: 'welcome',
      title: '欢迎使用 ASG.Director',
      content: `
        <div style="padding:12px 14px; border-radius:12px; border:1px solid rgba(255,84,84,0.48); background:rgba(255,84,84,0.14); color:#ffd6d6; margin-bottom:14px; line-height:1.7;">
          <strong>强烈推荐你观看这个教程。</strong><br>
          我们和很多其他 BP 软件在概念上不同：<strong>本地 BP 是主控，节目画面优先给 OBS 浏览器源，控制面板再挂进 OBS 侧边栏</strong>。
        </div>
        <p>主页面教程现在只负责做总引导，不会再在这个窗口里把所有细节讲完。</p>
        <p>接下来你会看到几个直接打开新窗口的入口：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>本地 BP 引导窗口</li>
          <li>3D 角色展示教程入口</li>
        </ul>
        <p style="font-size:12px; color:#aaa;">OBS 的细节说明会继续放在这个弹窗里，并且支持直接插网络图片。</p>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'workflow',
      title: '先记住这条主流程',
      content: `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0;">
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;">
            <div style="font-size:18px; margin-bottom:6px;">1. 控制比赛</div>
            <div style="font-size:12px; color:#aaa;">进入本地 BP，录入队伍、角色、地图、比分和赛后信息。</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;">
            <div style="font-size:18px; margin-bottom:6px;">2. 输出到 OBS</div>
            <div style="font-size:12px; color:#aaa;">优先使用首页里的本地页面 URL，直接做浏览器源。</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;">
            <div style="font-size:18px; margin-bottom:6px;">3. 把控制挂进 OBS</div>
            <div style="font-size:12px; color:#aaa;">把 OBS BP 控制、OBS 自动化侧边栏挂到 OBS 停靠栏里。</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;">
            <div style="font-size:18px; margin-bottom:6px;">4. 需要演出再开 3D</div>
            <div style="font-size:12px; color:#aaa;">3D 角色展示是独立窗口，用来做更重的场景、镜头和光影。</div>
          </div>
        </div>
        <p style="font-size:12px; color:#aaa;">BP前台固定分辨率已经是 <strong>1686×934</strong>，不再是可随意改的尺寸。</p>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'launch-guides',
      title: '从这里打开需要的新窗口',
      content: `
        <p>主页面只负责做总引导。下面两个按钮会直接打开对应窗口或入口：</p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:16px;">
          <button class="onboarding-action-card" onclick="ASGOnboarding.openLocalBpGuide()">
            <span class="onboarding-action-icon">📋</span>
            <span class="onboarding-action-title">打开本地BP教程</span>
            <span class="onboarding-action-desc">进入单独窗口，直接看 BP 操作流程。</span>
          </button>
          <button class="onboarding-action-card" onclick="ASGOnboarding.openModel3DGuide()">
            <span class="onboarding-action-icon">🎬</span>
            <span class="onboarding-action-title">打开 3D 教程入口</span>
            <span class="onboarding-action-desc">切到 3D 模型页并启动 3D 角色展示专属教程。</span>
          </button>
        </div>
        <div style="margin-top:14px; font-size:12px; color:#aaa; line-height:1.7;">
          OBS 的浏览器源和侧边栏说明继续看下面几步，不会再单独弹新页面。
        </div>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'obs-browser-source',
      title: 'OBS：给节目画面加浏览器源',
      content: `
        <p>节目画面用的页面，推荐都走 <strong>浏览器源</strong>：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>OBS → 来源 → <strong>+</strong> → <strong>浏览器</strong></li>
          <li>名称自定，例如“BP前台”“角色展示”“比分板-A队”</li>
          <li>粘贴 Director 首页复制的 URL，不要勾“本地文件”</li>
          <li>按固定宽高填写：BP前台 1686×934，角色展示 1366×768，比分板 1280×720</li>
        </ul>
        <p style="font-size:12px; color:#aaa;">这些页面通常不需要额外打开对应前台窗口，OBS 直接抓 URL 就行。</p>
      `,
      media: [
        {
          src: ONBOARDING_IMAGE_SLOTS.obsBrowserSource,
          alt: 'OBS 浏览器源示意图',
          caption: '这里可以放你的浏览器源示意图，直接填网络图片 URL。'
        }
      ],
      target: '#localPagesCard',
      position: 'center',
      highlight: true,
      viewId: 'home'
    },
    {
      id: 'obs-dock',
      title: 'OBS：把控制挂到侧边栏',
      content: `
        <p><strong>OBS BP控制</strong> 和 <strong>OBS自动化侧边栏</strong> 不是节目画面，它们更适合挂到 OBS 侧边栏。</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>OBS 顶部菜单 → <strong>视图 → 自定义浏览器停靠栏</strong></li>
          <li>名称可以填“ASG BP控制”或“ASG 自动化”</li>
          <li>URL 分别填首页里的 <strong>OBS BP控制</strong> / <strong>OBS自动化侧边栏</strong></li>
          <li>停靠完成后直接拖到 OBS 左右两侧即可</li>
        </ul>
        <p style="font-size:12px; color:#aaa;">如果你想在这个弹窗里放图，继续用下面的图片槽位配置即可。</p>
      `,
      media: [
        {
          src: ONBOARDING_IMAGE_SLOTS.obsCustomDock,
          alt: 'OBS 自定义浏览器停靠栏示意图',
          caption: '这里可以放你的 OBS 停靠栏示意图。'
        },
        {
          src: ONBOARDING_IMAGE_SLOTS.obsWorkflow,
          alt: 'Director 与 OBS 工作流示意图',
          caption: '这里可以放一张总流程图，例如“本地BP -> 浏览器源/停靠栏 -> OBS”。'
        }
      ],
      target: '#localPagesCard',
      position: 'center',
      highlight: true,
      viewId: 'home'
    },
    {
      id: 'local-pages-summary',
      title: '首页最关键的区域还是这里',
      content: `
        <p><strong>自定义页面（OBS）</strong> 是给 OBS 提供 URL 的地方。</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li><strong>BP前台</strong> 固定分辨率：<strong>1686×934</strong></li>
          <li><strong>角色展示</strong> 固定分辨率：<strong>1366×768</strong></li>
          <li><strong>比分板</strong> 固定分辨率：<strong>1280×720</strong></li>
          <li><strong>OBS BP控制 / OBS自动化侧边栏</strong> 是给 OBS 停靠栏用的控制页面</li>
        </ul>
        <p style="font-size:12px; color:#aaa;">2D 页面优先浏览器源，3D 角色展示优先窗口捕获。</p>
      `,
      target: '#localPagesCard',
      position: 'top',
      highlight: true,
      viewId: 'home'
    },
    {
      id: 'complete',
      title: '准备就绪',
      content: `
        <p>核心流程已经完整了：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>用本地 BP 控比赛</li>
          <li>用首页 URL 给 OBS 加浏览器源</li>
          <li>把控制面板挂进 OBS 侧边栏</li>
          <li>需要高级演出时，再打开 3D 角色展示做窗口捕获</li>
        </ul>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px;">
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="ASGOnboarding.quickAction('localBp')">
            <div style="font-size:24px;">📋</div>
            <div style="font-size:12px; margin-top:4px;">开始本地BP</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="ASGOnboarding.openModel3DGuide()">
            <div style="font-size:24px;">🎬</div>
            <div style="font-size:12px; margin-top:4px;">打开 3D 入口</div>
          </div>
        </div>
      `,
      target: null,
      position: 'center'
    }
  ],

  // 创建引导UI
  createUI() {
    // 如果已存在则移除
    const existing = document.getElementById('asg-onboarding-overlay');
    if (existing) existing.remove();

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'asg-onboarding-overlay';
    overlay.innerHTML = `
      <style>
        #asg-onboarding-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          pointer-events: none;
        }
        
        #asg-onboarding-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        
        #asg-onboarding-backdrop.show {
          opacity: 1;
          pointer-events: auto;
        }
        
        .asg-onboarding-highlight {
          position: absolute;
          border: 3px solid #FFD700;
          border-radius: 12px;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 
                      0 0 30px rgba(255, 215, 0, 0.5),
                      inset 0 0 20px rgba(255, 215, 0, 0.1);
          pointer-events: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100001;
        }
        
        .asg-onboarding-highlight::before {
          content: '';
          position: absolute;
          inset: -3px;
          border: 3px solid #FFD700;
          border-radius: 12px;
          animation: pulse-border 2s infinite;
        }
        
        @keyframes pulse-border {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.02); }
        }
        
        #asg-onboarding-card {
          position: absolute;
          width: 640px;
          max-width: 94vw;
          height: min(84vh, 860px);
          max-height: 84vh;
          background: linear-gradient(145deg, #1e1e2e 0%, #2a2a3e 100%);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 20px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5),
                      0 0 40px rgba(255, 215, 0, 0.1);
          pointer-events: none;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100002;
          display: flex;
          flex-direction: column;
        }
        
        #asg-onboarding-card.show {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        
        .onboarding-header {
          padding: 24px 24px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }
        
        .onboarding-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .onboarding-body {
          padding: 20px 24px;
          color: #e0e0e0;
          font-size: 14px;
          line-height: 1.7;
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
        
        .onboarding-body p {
          margin: 0 0 10px;
        }
        
        .onboarding-body ul {
          margin: 8px 0;
        }
        
        .onboarding-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(42, 42, 62, 0.92), rgba(30, 30, 46, 0.98));
        }

        .onboarding-action-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          text-align: left;
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .onboarding-action-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 215, 0, 0.35);
          background: rgba(255, 255, 255, 0.08);
        }

        .onboarding-action-icon {
          font-size: 24px;
          line-height: 1;
        }

        .onboarding-action-title {
          font-size: 14px;
          font-weight: 700;
        }

        .onboarding-action-desc {
          font-size: 12px;
          color: #b9bfd2;
          line-height: 1.7;
        }

        .onboarding-media {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }

        .onboarding-media-item {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.18);
        }

        .onboarding-media-item img {
          display: block;
          width: 100%;
          height: auto;
          max-height: 320px;
          object-fit: contain;
          background: rgba(0, 0, 0, 0.16);
        }

        .onboarding-media-item figcaption {
          padding: 10px 12px;
          font-size: 12px;
          color: #b9bfd2;
        }
        
        .onboarding-progress {
          display: flex;
          gap: 6px;
        }
        
        .onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s;
        }
        
        .onboarding-dot.active {
          background: #FFD700;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }
        
        .onboarding-dot.completed {
          background: #48bb78;
        }
        
        .onboarding-buttons {
          display: flex;
          gap: 10px;
        }
        
        .onboarding-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        
        .onboarding-btn-skip {
          background: transparent;
          color: #888;
        }
        
        .onboarding-btn-skip:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .onboarding-btn-prev {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .onboarding-btn-prev:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .onboarding-btn-next {
          background: linear-gradient(135deg, #FFD700 0%, #FF8C00 100%);
          color: #1a1a2e;
          box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
        }
        
        .onboarding-btn-next:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
        }
        
        .onboarding-btn-complete {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: #fff;
          box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
        }
        
        .onboarding-btn-complete:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
        }
        
        .onboarding-arrow {
          position: absolute;
          width: 0;
          height: 0;
          border: 12px solid transparent;
        }
        
        .onboarding-arrow-top {
          border-bottom-color: rgba(255, 215, 0, 0.3);
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .onboarding-arrow-bottom {
          border-top-color: rgba(255, 215, 0, 0.3);
          bottom: -24px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .onboarding-arrow-left {
          border-right-color: rgba(255, 215, 0, 0.3);
          left: -24px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        .onboarding-arrow-right {
          border-left-color: rgba(255, 215, 0, 0.3);
          right: -24px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        .onboarding-icon-float {
          animation: float 3s ease-in-out infinite;
        }
      </style>
      
      <div id="asg-onboarding-backdrop"></div>
      <div class="asg-onboarding-highlight" id="asg-onboarding-highlight" style="display:none;"></div>
      <div id="asg-onboarding-card">
        <div class="onboarding-header">
          <h3 class="onboarding-title" id="onboarding-title"></h3>
        </div>
        <div class="onboarding-body" id="onboarding-body"></div>
        <div class="onboarding-footer">
          <div class="onboarding-progress" id="onboarding-progress"></div>
          <div class="onboarding-buttons" id="onboarding-buttons"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 绑定关闭事件
    document.getElementById('asg-onboarding-backdrop').addEventListener('click', () => {
      // 点击背景不关闭，需要用户明确选择跳过
    });
  },

  // 显示当前步骤
  showStep(stepIndex) {
    const step = this.steps[stepIndex];
    if (!step) return;

    this.currentStep = stepIndex;
    localStorage.setItem(this.CURRENT_STEP_KEY, stepIndex.toString());
    this.prepareStepContext(step);

    const card = document.getElementById('asg-onboarding-card');
    const backdrop = document.getElementById('asg-onboarding-backdrop');
    const highlight = document.getElementById('asg-onboarding-highlight');
    const titleEl = document.getElementById('onboarding-title');
    const bodyEl = document.getElementById('onboarding-body');
    const progressEl = document.getElementById('onboarding-progress');
    const buttonsEl = document.getElementById('onboarding-buttons');

    // 隐藏当前卡片用于动画
    card.classList.remove('show');

    setTimeout(() => {
      // 更新内容
      titleEl.innerHTML = step.title;
      bodyEl.innerHTML = this.renderStepContent(step);

      // 更新进度点
      progressEl.innerHTML = this.steps.map((s, i) => {
        let className = 'onboarding-dot';
        if (i < stepIndex) className += ' completed';
        if (i === stepIndex) className += ' active';
        return `<div class="${className}"></div>`;
      }).join('');

      // 更新按钮
      let buttonsHtml = '';

      if (stepIndex === 0) {
        buttonsHtml = `
          <button class="onboarding-btn onboarding-btn-skip" onclick="ASGOnboarding.skip()">跳过引导</button>
          <button class="onboarding-btn onboarding-btn-next" onclick="ASGOnboarding.next()">开始学习 →</button>
        `;
      } else if (stepIndex === this.steps.length - 1) {
        buttonsHtml = `
          <button class="onboarding-btn onboarding-btn-prev" onclick="ASGOnboarding.prev()">← 上一步</button>
          <button class="onboarding-btn onboarding-btn-complete" onclick="ASGOnboarding.complete()">完成引导 ✓</button>
        `;
      } else {
        buttonsHtml = `
          <button class="onboarding-btn onboarding-btn-skip" onclick="ASGOnboarding.skip()">跳过</button>
          <button class="onboarding-btn onboarding-btn-prev" onclick="ASGOnboarding.prev()">← 上一步</button>
          <button class="onboarding-btn onboarding-btn-next" onclick="ASGOnboarding.next()">下一步 →</button>
        `;
      }
      buttonsEl.innerHTML = buttonsHtml;

      // 处理高亮和定位
      this.repositionCardForStep(step, card, highlight, backdrop);
      this.bindMediaReflow(step, card, highlight, backdrop);

      // 显示卡片
      setTimeout(() => {
        card.classList.add('show');
      }, 50);

    }, 200);
  },

  renderStepContent(step) {
    const baseContent = step && typeof step.content === 'string' ? step.content : ''
    const media = Array.isArray(step && step.media) ? step.media : []
    if (!media.length) return baseContent

    const mediaHtml = media.map(item => {
      if (!item || !item.src) return ''
      const alt = this.escapeHtml(item.alt || '')
      const caption = this.escapeHtml(item.caption || '')
      return `
        <figure class="onboarding-media-item">
          <img src="${item.src}" alt="${alt}">
          ${caption ? `<figcaption>${caption}</figcaption>` : ''}
        </figure>
      `
    }).join('')

    return `${baseContent}<div class="onboarding-media">${mediaHtml}</div>`
  },

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text == null ? '' : String(text)
    return div.innerHTML
  },

  bindMediaReflow(step, card, highlight, backdrop) {
    const images = Array.from(card.querySelectorAll('.onboarding-media-item img'))
    images.forEach(img => {
      const handle = () => {
        window.requestAnimationFrame(() => {
          this.repositionCardForStep(step, card, highlight, backdrop)
        })
      }
      if (!img.complete) {
        img.addEventListener('load', handle, { once: true })
        img.addEventListener('error', handle, { once: true })
      }
    })
  },

  repositionCardForStep(step, card, highlight, backdrop) {
    if (step.target && step.highlight) {
      const targetEl = document.querySelector(step.target)
      if (targetEl) {
        if (targetEl.scrollIntoView) {
          targetEl.scrollIntoView({ block: step.scrollBlock || 'center', inline: 'nearest' })
        }
        const rect = targetEl.getBoundingClientRect()
        const padding = 8

        highlight.style.display = 'block'
        highlight.style.left = (rect.left - padding) + 'px'
        highlight.style.top = (rect.top - padding) + 'px'
        highlight.style.width = (rect.width + padding * 2) + 'px'
        highlight.style.height = (rect.height + padding * 2) + 'px'

        backdrop.classList.remove('show')
        this.positionCard(card, rect, step.position)
        return
      }
    }

    this.centerCard(card)
    highlight.style.display = 'none'
    backdrop.classList.add('show')
  },

  // 定位卡片相对于目标元素
  positionCard(card, targetRect, position) {
    const cardWidth = Math.min(card.offsetWidth || 640, window.innerWidth - 40);
    const cardHeight = card.offsetHeight || 350;
    const padding = 20;

    let left, top;
    let arrowClass = '';

    switch (position) {
      case 'bottom':
        left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
        top = targetRect.bottom + padding;
        arrowClass = 'onboarding-arrow-top';
        break;
      case 'top':
        left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
        top = targetRect.top - cardHeight - padding;
        arrowClass = 'onboarding-arrow-bottom';
        break;
      case 'left':
        left = targetRect.left - cardWidth - padding;
        top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
        arrowClass = 'onboarding-arrow-right';
        break;
      case 'right':
        left = targetRect.right + padding;
        top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
        arrowClass = 'onboarding-arrow-left';
        break;
      default:
        this.centerCard(card);
        return;
    }

    // 边界检测
    left = Math.max(20, Math.min(left, window.innerWidth - cardWidth - 20));
    top = Math.max(20, Math.min(top, window.innerHeight - cardHeight - 20));

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.transform = 'none';

    // 移除旧箭头
    const oldArrow = card.querySelector('.onboarding-arrow');
    if (oldArrow) oldArrow.remove();

    // 添加箭头
    if (arrowClass) {
      const arrow = document.createElement('div');
      arrow.className = `onboarding-arrow ${arrowClass}`;
      card.appendChild(arrow);
    }
  },

  // 居中卡片
  centerCard(card) {
    card.style.left = '50%';
    card.style.top = '50%';
    card.style.transform = 'translate(-50%, -50%)';

    // 移除箭头
    const oldArrow = card.querySelector('.onboarding-arrow');
    if (oldArrow) oldArrow.remove();
  },

  prepareStepContext(step) {
    if (!step) return;

    if (step.viewId && typeof switchView === 'function') {
      try {
        switchView(step.viewId);
      } catch (error) {
        console.warn('[ASG Onboarding] 切换视图失败:', error);
      }
    }

    if (step.settingTab && typeof switchSettingTab === 'function') {
      try {
        switchSettingTab(step.settingTab);
      } catch (error) {
        console.warn('[ASG Onboarding] 切换设置标签失败:', error);
      }
    }
  },

  // 下一步
  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    }
  },

  // 上一步
  prev() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  },

  // 跳过引导
  async skip() {
    if (!confirm('确定要跳过主页面教程吗？')) return
    await this.finish('skipped')
  },

  // 完成引导
  async complete() {
    await this.finish('completed')
  },

  closeOverlay() {
    const overlay = document.getElementById('asg-onboarding-overlay');
    const card = document.getElementById('asg-onboarding-card');
    const backdrop = document.getElementById('asg-onboarding-backdrop');

    if (card) card.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
    }, 400);
  },

  async markSeen(status) {
    try {
      if (window.electronAPI && typeof window.electronAPI.markMainOnboardingSeen === 'function') {
        await window.electronAPI.markMainOnboardingSeen(status)
      }
    } catch (error) {
      console.warn('[ASG Onboarding] 写入 OKTeach.txt 失败:', error)
    }
  },

  async finish(status) {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    localStorage.removeItem(this.CURRENT_STEP_KEY);
    await this.markSeen(status)
    this.closeOverlay()

    if (typeof showStatus === 'function') {
      if (status === 'skipped') {
        showStatus('已跳过主页面教程。如果有不懂的内容，可以点击左下角的 ❓ 重新查看教程。', 'info');
      } else {
        showStatus('主页面教程已完成。以后如果有不懂的内容，可以点击左下角的 ❓ 重新查看教程。', 'success');
      }
    }
  },

  // ----------------------------------------------------------------------
  // 3D 角色展示专属教程（兼容旧的 startMMDTutorial 调用）
  // ----------------------------------------------------------------------
  model3dSteps: [
    {
      id: 'model3d-intro',
      title: '3D 角色展示入口',
      content: `
              <p>新的 <strong>角色模型3D展示</strong> 已经是独立工作流。</p>
              <p>先在这里完成模型资源检查，再进入 3D 窗口做场景编辑。</p>
              <ul style="margin:10px 0; padding-left:20px; line-height:1.6;">
                <li>入口：设置中心 → 3D 模型</li>
                <li>先检测官方模型资源，再打开 3D 展示窗口</li>
                <li>OBS 最终通过窗口捕获拿到 3D 画面</li>
              </ul>
            `,
      target: '#model3dSettingsCard',
      position: 'top',
      highlight: true,
      viewId: 'settings',
      settingTab: '3d'
    },
    {
      id: 'model3d-download',
      title: '1. 先准备模型资源',
      content: `
              <p>第一次使用时，优先点 <strong>“检测/下载官方模型”</strong>。</p>
              <p>如果本机还没有模型资源，打开 3D 展示窗口前会提示下载。</p>
              <p style="font-size:12px; color:#aaa;">这样可以避免开窗后才发现模型缺失。</p>
            `,
      target: 'button[onclick="checkOfficialModelsAndDownloadFromSettings()"]',
      position: 'bottom',
      highlight: true,
      viewId: 'settings',
      settingTab: '3d'
    },
    {
      id: 'model3d-open',
      title: '2. 打开 3D 角色展示窗口',
      content: `
              <p>点击 <strong>“打开角色模型3D展示”</strong> 进入独立的 3D 编辑与渲染窗口。</p>
              <p>场景、灯光、镜头、视频屏幕、摄像头屏幕等操作都在那个窗口完成。</p>
            `,
      target: 'button[onclick="openCharacterModel3DFromSettings()"]',
      position: 'bottom',
      highlight: true,
      viewId: 'settings',
      settingTab: '3d'
    },
    {
      id: 'model3d-obs',
      title: '3. 在 OBS 中捕获 3D 窗口',
      content: `
              <p>3D 展示不是本地页面 URL，它走的是<strong>窗口捕获</strong>。</p>
              <ul style="margin:10px 0; padding-left:20px; line-height:1.6;">
                <li>OBS → 来源 → + → 窗口捕获</li>
                <li>窗口选择“角色模型3D展示”</li>
                <li>需要透明演出时，再按你的场景做裁切或透明处理</li>
              </ul>
            `,
      target: '#model3dSettingsCard',
      position: 'top',
      highlight: true,
      viewId: 'settings',
      settingTab: '3d'
    }
  ],

  startModel3DTutorial() {
    // 先切换到3D Tab
    if (typeof switchSettingTab === 'function') {
      switchSettingTab('3d');
      // 模拟点击事件样式
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const tabBtn = document.querySelector('button[onclick*="switchSettingTab(\'3d\'"]');
      if (tabBtn) tabBtn.classList.add('active');
    }

    // 保存当前步骤列表和进度，以便恢复
    const originalSteps = this.steps;
    const originalStepIndex = this.currentStep;

    // 临时替换为 3D 步骤
    this.steps = this.model3dSteps;
    this.createUI(); // 重建UI

    // 启动引导
    setTimeout(() => {
      const backdrop = document.getElementById('asg-onboarding-backdrop');
      if (backdrop) backdrop.classList.add('show');
      this.showStep(0);
    }, 500);

    // 重写 complete/skip 方法以恢复原始状态
    const restore = () => {
      this.steps = originalSteps;
      this.currentStep = originalStepIndex;
      // 重新创建UI以便下次使用标准引导
      setTimeout(() => this.createUI(), 500);
    };

    // 劫持 exit 方法
    const originalComplete = this.complete.bind(this);
    const originalSkip = this.skip.bind(this);
    this.complete = () => {
      this.closeOverlay();
      restore();
      // 恢复原始 complete 方法
      this.complete = originalComplete;
      this.skip = originalSkip;
    };

    this.skip = () => {
      this.closeOverlay();
      restore();
      this.skip = originalSkip;
      this.complete = originalComplete;
    };
  },

  startMMDTutorial() {
    return this.startModel3DTutorial();
  },

  // 快捷操作
  quickAction(action) {
    this.complete();

    setTimeout(() => {
      switch (action) {
        case 'localBp':
          const localBpBtn = document.getElementById('localBpBtn');
          if (localBpBtn) localBpBtn.click();
          break;
        case 'store':
          if (typeof switchView === 'function') {
            switchView('settings');
          }
          setTimeout(() => {
            if (typeof openStore === 'function') {
              openStore();
            }
          }, 300);
          break;
        case 'settings3d':
          if (typeof switchView === 'function') {
            switchView('settings');
          }
          setTimeout(() => {
            if (typeof switchSettingTab === 'function') {
              switchSettingTab('3d');
            }
          }, 150);
          break;
      }
    }, 100);
  },

  async openLocalBpGuide() {
    try {
      const result = await (window.electronAPI?.openLocalBpGuide?.() || window.electronAPI?.invoke?.('open-local-bp-guide'))
      if (!result || !result.success) {
        throw new Error(result?.error || '打开本地BP教程失败')
      }
      if (typeof showStatus === 'function') {
        showStatus('本地BP教程窗口已打开。', 'success')
      }
    } catch (error) {
      if (typeof showStatus === 'function') {
        showStatus(`打开失败: ${error?.message || error}`, 'error')
      }
    }
  },

  openModel3DGuide() {
    if (typeof switchView === 'function') {
      switchView('settings')
    }
    setTimeout(() => {
      if (typeof this.startModel3DTutorial === 'function') {
        this.startModel3DTutorial()
      }
    }, 180)
  },

  async shouldShow() {
    try {
      if (window.electronAPI && typeof window.electronAPI.getMainOnboardingStatus === 'function') {
        const status = await window.electronAPI.getMainOnboardingStatus()
        if (status && status.success) return !!status.shouldShow
      }
    } catch (error) {
      console.warn('[ASG Onboarding] 读取 OKTeach.txt 状态失败:', error)
    }
    return localStorage.getItem(this.STORAGE_KEY) !== 'true';
  },

  // 重置引导（用于测试或用户手动触发）
  async reset(options = {}) {
    if (options.clearSeenFile && window.electronAPI && typeof window.electronAPI.resetMainOnboardingSeen === 'function') {
      try {
        await window.electronAPI.resetMainOnboardingSeen()
      } catch (error) {
        console.warn('[ASG Onboarding] 删除 OKTeach.txt 失败:', error)
      }
    }
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_STEP_KEY);
    console.log('[Idvevent Onboarding] 引导已重置');
  },

  // 启动引导
  async start(options = {}) {
    const force = !!(options && options.force)
    if (!force && !(await this.shouldShow())) {
      console.log('[ASG Onboarding] 用户已完成引导，跳过');
      return false;
    }

    // 确保在 Home 视图，以便目标元素可见
    if (typeof switchView === 'function') {
      try {
        switchView('home');
      } catch (e) {
        console.warn('[ASG Onboarding] 切换到 Home 视图失败', e);
      }
    }

    console.log('[Idvevent Onboarding] 启动新手引导');
    this.createUI();

    // 检查是否有中断的进度
    const savedStep = localStorage.getItem(this.CURRENT_STEP_KEY);
    const startStep = savedStep ? parseInt(savedStep) : 0;

    setTimeout(() => {
      const backdrop = document.getElementById('asg-onboarding-backdrop');
      if (backdrop) backdrop.classList.add('show');
      this.showStep(startStep);
    }, 500);

    return true;
  },

  // 强制启动（忽略已完成状态）
  async forceStart() {
    localStorage.removeItem(this.CURRENT_STEP_KEY);
    await this.start({ force: true });
  }
};

// 导出到全局
window.ASGOnboarding = ASGOnboarding;

// 页面加载完成后自动检查并启动
// 页面加载完成后自动检查并启动
document.addEventListener('DOMContentLoaded', () => {
  // 延迟启动以确保页面完全加载
  setTimeout(async () => {
    try {
      await ASGOnboarding.start()
    } catch (error) {
      console.warn('[ASG Onboarding] 自动启动失败:', error)
    }
  }, 1000);
});
