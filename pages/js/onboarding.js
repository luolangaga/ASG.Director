/**
 * ASG Director 新手引导系统
 * 为首次使用的用户提供交互式引导教程
 */

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
      title: '欢迎使用 ASG Director! 🎉',
      content: `
        <p>感谢您选择 ASG Director 作为您的赛事导播工具！</p>
        <p>接下来我们将带您快速了解核心功能，让您成为专业导播只需 3 分钟！</p>
        <div style="display:flex; gap:20px; margin-top:20px; justify-content:center;">
          <div style="text-align:center;">
            <div style="font-size:40px;">📋</div>
            <div style="font-size:13px; color:#aaa; margin-top:4px;">本地BP</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:40px;">🎨</div>
            <div style="font-size:13px; color:#aaa; margin-top:4px;">编辑模式</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:40px;">🛒</div>
            <div style="font-size:13px; color:#aaa; margin-top:4px;">组件商店</div>
          </div>
        </div>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'local-bp',
      title: '本地 BP 模式 📋',
      content: `
        <p><strong>本地BP</strong> 是您进行赛事导播的核心功能。</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>无需联网，单机操作即可完成BP</li>
          <li>支持队伍信息、角色选择、天赋配置</li>
          <li>一键推送到OBS前端展示</li>
        </ul>
        <p>点击 <strong>"立即开始"</strong> 按钮即可进入本地BP控制台！</p>
      `,
      target: '#localBpBtn',
      position: 'bottom',
      highlight: true
    },
    {
      id: 'local-bp-features',
      title: '本地BP控制台功能 🎮',
      content: `
        <p>在本地BP控制台中，您可以：</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0;">
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
            <div style="font-size:18px; margin-bottom:4px;">🎮 BP控制</div>
            <div style="font-size:12px; color:#aaa;">选择角色、配置Ban位</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
            <div style="font-size:18px; margin-bottom:4px;">🗺️ 对局信息</div>
            <div style="font-size:12px; color:#aaa;">设置队伍名称、Logo</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
            <div style="font-size:18px; margin-bottom:4px;">🧠 天赋技能</div>
            <div style="font-size:12px; color:#aaa;">配置选手天赋和技能</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
            <div style="font-size:18px; margin-bottom:4px;">📊 比分管理</div>
            <div style="font-size:12px; color:#aaa;">实时更新比赛分数</div>
          </div>
        </div>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'edit-mode',
      title: '编辑模式 ✨',
      content: `
        <p>ASG Director 支持强大的<strong>实时编辑功能</strong>！</p>
        <div style="background:linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1)); padding:16px; border-radius:12px; margin:12px 0; border:1px solid rgba(255,215,0,0.3);">
          <div style="font-weight:bold; margin-bottom:8px;">💡 快捷键提示</div>
          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <div><kbd style="background:#333; padding:4px 8px; border-radius:4px;">F2</kbd> 切换编辑模式</div>
            <div><kbd style="background:#333; padding:4px 8px; border-radius:4px;">F12</kbd> 开发者工具</div>
          </div>
        </div>
        <p>在编辑模式下，您可以：</p>
        <ul style="margin:8px 0; padding-left:20px; line-height:1.6;">
          <li>拖拽调整组件位置</li>
          <li>双击修改字体样式</li>
          <li>右键打开组件设置</li>
        </ul>
      `,
      target: null,
      position: 'center'
    },
    {
      id: 'settings',
      title: '表现设置 🎨',
      content: `
        <p>在这里您可以个性化您的导播界面：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li><strong>3D模型</strong> - 配置MMD角色模型</li>
          <li><strong>渲染分辨率</strong> - 调整OBS输出分辨率</li>
          <li><strong>字体与资源</strong> - 自定义字体和组件</li>
        </ul>
      `,
      target: '#nav-settings',
      position: 'right',
      highlight: true
    },
    {
      id: 'store',
      title: '组件包商店 🛒',
      content: `
        <p><strong>布局商店</strong>是获取精美导播界面的最佳方式！</p>
        <div style="background:rgba(72,187,120,0.15); padding:16px; border-radius:12px; margin:12px 0; border:1px solid rgba(72,187,120,0.3);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:32px;">📦</div>
            <div>
              <div style="font-weight:bold;">10+ 精品布局包</div>
              <div style="font-size:12px; color:#81c784;">官方与社区共同贡献</div>
            </div>
          </div>
        </div>
        <p>一键下载，即刻使用专业级导播界面！</p>
      `,
      target: '#nav-tools',
      position: 'right',
      highlight: true
    },
    {
      id: 'plugins',
      title: '插件系统 🧩',
      content: `
        <p>ASG Director 支持<strong>插件扩展</strong>，让功能更加丰富！</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>从插件商店下载社区插件</li>
          <li>插件会在侧边栏显示入口</li>
          <li>支持自定义页面和功能</li>
        </ul>
        <div style="font-size:12px; color:#aaa; margin-top:12px;">
          💡 提示：您可以在「工具与商店」中管理已安装的插件
        </div>
      `,
      target: '#pluginMenubar',
      position: 'right',
      highlight: true
    },
    {
      id: 'complete',
      title: '准备就绪！🚀',
      content: `
        <p>恭喜您完成了新手引导！</p>
        <div style="text-align:center; margin:20px 0;">
          <div style="font-size:60px; margin-bottom:12px;">🎊</div>
          <div style="font-size:16px; font-weight:bold; color:#FFD700;">现在开始您的专业导播之旅吧！</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px;">
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="ASGOnboarding.quickAction('localBp')">
            <div style="font-size:24px;">📋</div>
            <div style="font-size:12px; margin-top:4px;">开始本地BP</div>
          </div>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="ASGOnboarding.quickAction('store')">
            <div style="font-size:24px;">🛒</div>
            <div style="font-size:12px; margin-top:4px;">浏览商店</div>
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
          width: 420px;
          max-width: 90vw;
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
        }
        
        #asg-onboarding-card.show {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        
        .onboarding-header {
          padding: 24px 24px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
      bodyEl.innerHTML = step.content;

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
      if (step.target && step.highlight) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const padding = 8;

          highlight.style.display = 'block';
          highlight.style.left = (rect.left - padding) + 'px';
          highlight.style.top = (rect.top - padding) + 'px';
          highlight.style.width = (rect.width + padding * 2) + 'px';
          highlight.style.height = (rect.height + padding * 2) + 'px';

          backdrop.classList.remove('show');

          // 定位卡片
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

      // 显示卡片
      setTimeout(() => {
        card.classList.add('show');
      }, 50);

    }, 200);
  },

  // 定位卡片相对于目标元素
  positionCard(card, targetRect, position) {
    const cardWidth = 420;
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
  skip() {
    if (confirm('确定要跳过新手引导吗？\n\n您可以随时在设置中重新开始引导。')) {
      this.complete();
    }
  },

  // 完成引导
  complete() {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    localStorage.removeItem(this.CURRENT_STEP_KEY);

    const overlay = document.getElementById('asg-onboarding-overlay');
    const card = document.getElementById('asg-onboarding-card');
    const backdrop = document.getElementById('asg-onboarding-backdrop');

    card.classList.remove('show');
    backdrop.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
    }, 400);

    // 显示完成提示
    if (typeof showStatus === 'function') {
      showStatus('🎉 新手引导完成！祝您使用愉快！', 'success');
    }
  },

  // ----------------------------------------------------------------------
  // MMD 模型配置专属教程
  // ----------------------------------------------------------------------
  mmdSteps: [
    {
      id: 'mmd-intro',
      title: '配置 3D MMD 模型 💃',
      content: `
              <p>ASG Director 支持加载精美的 MMD (MikuMikuDance) 模型！</p>
              <p>为了让他动起来，您需要准备两个重要的资源目录：</p>
              <ul style="margin:10px 0; padding-left:20px; line-height:1.6;">
                <li><strong>模型文件 (.pmx)</strong>：角色的 3D 模型文件</li>
                <li><strong>动作文件 (.vmd)</strong>：让角色动起来的动作数据</li>
              </ul>
              <div style="font-size:12px; color:#aaa; margin-top:10px;">
                💡 提示：目前仅支持 PMX 格式的模型文件。
              </div>
            `,
      target: '#model3dSettingsCard',
      position: 'center',
      highlight: true
    },
    {
      id: 'mmd-survivor',
      title: '1. 设置求生者模型目录 🏃‍♀️',
      content: `
              <p>请点击文件夹图标，选择存放<strong>求生者模型</strong>的文件夹。</p>
              <p>文件夹结构建议：</p>
              <pre style="background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; font-size:11px; margin:6px 0;">
📂 Survivors/
  📂 Doctor/
    📄 doctor.pmx
    📂 tex/
  📂 Gardener/
    📄 gardener.pmx</pre>
              <p style="font-size:12px; color:#aaa;">系统会自动扫描该目录下的所有 .pmx 文件。</p>
            `,
      target: '#survivorModelDir',
      position: 'bottom',
      highlight: true
    },
    {
      id: 'mmd-hunter',
      title: '2. 设置监管者模型目录 👹',
      content: `
              <p>同样地，选择存放<strong>监管者模型</strong>的文件夹。</p>
              <p>请确保模型文件的贴图路径正确，否则可能会导致模型显示为全白。</p>
            `,
      target: '#hunterModelDir',
      position: 'bottom',
      highlight: true
    },
    {
      id: 'mmd-motion',
      title: '3. 设置待机动作 🎬',
      content: `
              <p>选择存放<strong>动作文件 (.vmd)</strong> 的目录。</p>
              <p>系统会从中随机选择动作作为待机动画，让角色在 BP 界面上生动地站立！</p>
            `,
      target: '#survivorMotionDir',
      position: 'bottom',
      highlight: true
    },
    {
      id: 'mmd-apply',
      title: '4. 保存并应用 ✅',
      content: `
              <p>配置完成后，别忘了点击底部的 <strong>"保存并应用"</strong> 按钮。</p>
              <p>如果有红字报错，请检查控制台或日志，通常是因为文件路径包含特殊字符或文件损坏。</p>
            `,
      target: 'button[onclick="applyModel3dSettings(true)"]',
      position: 'top',
      highlight: true
    }
  ],

  startMMDTutorial() {
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

    // 临时替换为 MMD 步骤
    this.steps = this.mmdSteps;
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
    this.complete = () => {
      originalComplete();
      restore();
      // 恢复原始 complete 方法
      this.complete = originalComplete;
    };

    const originalSkip = this.skip.bind(this);
    this.skip = () => {
      // 这里我们不需要 confirm，直接跳过并恢复
      document.getElementById('asg-onboarding-card').classList.remove('show');
      document.getElementById('asg-onboarding-backdrop').classList.remove('show');
      setTimeout(() => {
        if (document.getElementById('asg-onboarding-overlay'))
          document.getElementById('asg-onboarding-overlay').remove();
      }, 400);

      restore();
      this.skip = originalSkip;
    };
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
            switchView('tools');
          }
          setTimeout(() => {
            if (typeof openStore === 'function') {
              openStore();
            }
          }, 300);
          break;
      }
    }, 100);
  },

  // 检查是否需要显示引导
  shouldShow() {
    return localStorage.getItem(this.STORAGE_KEY) !== 'true';
  },

  // 重置引导（用于测试或用户手动触发）
  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_STEP_KEY);
    console.log('[ASG Onboarding] 引导已重置');
  },

  // 启动引导
  start() {
    if (!this.shouldShow()) {
      console.log('[ASG Onboarding] 用户已完成引导，跳过');
      return false;
    }

    console.log('[ASG Onboarding] 启动新手引导');
    this.createUI();

    // 检查是否有中断的进度
    const savedStep = localStorage.getItem(this.CURRENT_STEP_KEY);
    const startStep = savedStep ? parseInt(savedStep) : 0;

    setTimeout(() => {
      const backdrop = document.getElementById('asg-onboarding-backdrop');
      backdrop.classList.add('show');
      this.showStep(startStep);
    }, 500);

    return true;
  },

  // 强制启动（忽略已完成状态）
  forceStart() {
    this.reset();
    this.start();
  }
};

// 导出到全局
window.ASGOnboarding = ASGOnboarding;

// 页面加载完成后自动检查并启动
document.addEventListener('DOMContentLoaded', () => {
  // 延迟启动以确保页面完全加载
  setTimeout(() => {
    ASGOnboarding.start();
  }, 1000);
});
