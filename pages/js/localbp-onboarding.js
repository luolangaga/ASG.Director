/**
 * ASG Local BP 新手引导系统
 * 为首次进入本地BP控制台的用户提供交互式引导教程
 */

const LocalBPOnboarding = {
    // 本地存储key
    STORAGE_KEY: 'asg_localbp_onboarding_completed',

    // 当前步骤
    currentStep: 0,

    // 引导步骤配置
    steps: [
        {
            id: 'welcome',
            title: '欢迎来到本地BP控制台! 🎮',
            content: `
        <p>这是您进行赛事导播的核心工具！</p>
        <p>让我们快速了解一下各个功能模块：</p>
        <div style="display:flex; gap:16px; margin-top:16px; flex-wrap:wrap; justify-content:center;">
          <div style="text-align:center; padding:12px;">
            <div style="font-size:28px;">🎮</div>
            <div style="font-size:12px; color:#666; margin-top:4px;">BP控制</div>
          </div>
          <div style="text-align:center; padding:12px;">
            <div style="font-size:28px;">🗺️</div>
            <div style="font-size:12px; color:#666; margin-top:4px;">对局信息</div>
          </div>
          <div style="text-align:center; padding:12px;">
            <div style="font-size:28px;">🧠</div>
            <div style="font-size:12px; color:#666; margin-top:4px;">天赋技能</div>
          </div>
          <div style="text-align:center; padding:12px;">
            <div style="font-size:28px;">📊</div>
            <div style="font-size:12px; color:#666; margin-top:4px;">比分管理</div>
          </div>
        </div>
      `,
            target: null,
            position: 'center'
        },
        {
            id: 'bp-control',
            title: 'BP控制面板 🎮',
            content: `
        <p>这是您最常用的功能！</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li><strong>角色选择</strong> - 点击槽位选择角色</li>
          <li><strong>Ban位管理</strong> - 为两队添加禁用角色</li>
          <li><strong>一键推送</strong> - 同步到前端展示</li>
        </ul>
        <div style="background:#f0f7ff; padding:12px; border-radius:8px; margin-top:12px; border-left:4px solid #667eea;">
          💡 <strong>提示：</strong>右键点击槽位可以设置默认图片
        </div>
      `,
            target: '[data-page="bp"]',
            position: 'bottom',
            highlight: true
        },
        {
            id: 'baseinfo',
            title: '对局基础信息 🗺️',
            content: `
        <p>在这里设置比赛的基本信息：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>队伍名称和Logo</li>
          <li>选手ID</li>
          <li>地图信息</li>
          <li>背景图片/视频</li>
        </ul>
        <p style="color:#888; font-size:13px;">这些信息会显示在OBS前端画面中</p>
      `,
            target: '[data-page="baseinfo"]',
            position: 'bottom',
            highlight: true
        },
        {
            id: 'talents',
            title: '天赋与技能 🧠',
            content: `
        <p>配置每位选手的天赋和技能选择！</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0;">
          <div style="background:#f7fafc; padding:12px; border-radius:8px; text-align:center;">
            <div style="font-size:20px;">🏃</div>
            <div style="font-size:12px; color:#666;">求生者天赋</div>
          </div>
          <div style="background:#fff5f5; padding:12px; border-radius:8px; text-align:center;">
            <div style="font-size:20px;">👹</div>
            <div style="font-size:12px; color:#666;">监管者技能</div>
          </div>
        </div>
        <p style="color:#888; font-size:13px;">支持为每位求生者单独配置天赋</p>
      `,
            target: '[data-page="talents"]',
            position: 'bottom',
            highlight: true
        },
        {
            id: 'score',
            title: '比分管理 📊',
            content: `
        <p>实时管理比赛比分！</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>快速调整两队比分</li>
          <li>记录每局详情</li>
          <li>一键同步到记分板</li>
        </ul>
      `,
            target: '[data-page="score"]',
            position: 'bottom',
            highlight: true
        },
        {
            id: 'postmatch',
            title: '赛后数据 📈',
            content: `
        <p>记录和展示赛后统计数据：</p>
        <ul style="margin:12px 0; padding-left:20px; line-height:1.8;">
          <li>选手详细数据</li>
          <li>MVP评选</li>
          <li>数据可视化展示</li>
        </ul>
      `,
            target: '[data-page="postmatch"]',
            position: 'bottom',
            highlight: true
        },
        {
            id: 'update-btn',
            title: '更新前端显示 🔄',
            content: `
        <p>完成设置后，点击此按钮将数据推送到OBS前端！</p>
        <div style="background:#e8f5e9; padding:12px; border-radius:8px; margin-top:12px; border-left:4px solid #48bb78;">
          ✅ 前端窗口会实时更新显示您的配置
        </div>
      `,
            target: null,
            position: 'center'
        },
        {
            id: 'complete',
            title: '开始导播吧！🎬',
            content: `
        <p>恭喜您已经了解了本地BP控制台的所有功能！</p>
        <div style="text-align:center; margin:20px 0;">
          <div style="font-size:50px; margin-bottom:12px;">🎊</div>
          <div style="font-size:15px; font-weight:bold; color:#667eea;">祝您导播顺利！</div>
        </div>
        <div style="background:#f7fafc; padding:12px; border-radius:8px; font-size:13px; color:#666;">
          💡 <strong>小提示：</strong>您可以在顶部找到帮助按钮重新查看引导
        </div>
      `,
            target: null,
            position: 'center'
        }
    ],

    // 创建引导UI
    createUI() {
        // 如果已存在则移除
        const existing = document.getElementById('localbp-onboarding-overlay');
        if (existing) existing.remove();

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'localbp-onboarding-overlay';
        overlay.innerHTML = `
      <style>
        #localbp-onboarding-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          pointer-events: none;
        }
        
        #localbp-onboarding-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          pointer-events: auto;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        
        #localbp-onboarding-backdrop.show {
          opacity: 1;
        }
        
        .localbp-onboarding-highlight {
          position: absolute;
          border: 3px solid #667eea;
          border-radius: 8px;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 
                      0 0 20px rgba(102, 126, 234, 0.5);
          pointer-events: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100001;
        }
        
        .localbp-onboarding-highlight::before {
          content: '';
          position: absolute;
          inset: -3px;
          border: 3px solid #667eea;
          border-radius: 8px;
          animation: localbp-pulse 2s infinite;
        }
        
        @keyframes localbp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.02); }
        }
        
        #localbp-onboarding-card {
          position: absolute;
          width: 380px;
          max-width: 90vw;
          background: #fff;
          border: 2px solid #667eea;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100002;
        }
        
        #localbp-onboarding-card.show {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        
        .localbp-onboarding-header {
          padding: 20px 20px 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .localbp-onboarding-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        
        .localbp-onboarding-body {
          padding: 16px 20px;
          color: #4a5568;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .localbp-onboarding-body p {
          margin: 0 0 10px;
        }
        
        .localbp-onboarding-body ul {
          margin: 8px 0;
        }
        
        .localbp-onboarding-footer {
          padding: 14px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        
        .localbp-onboarding-progress {
          display: flex;
          gap: 5px;
        }
        
        .localbp-onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e2e8f0;
          transition: all 0.3s;
        }
        
        .localbp-onboarding-dot.active {
          background: #667eea;
          box-shadow: 0 0 8px rgba(102, 126, 234, 0.5);
        }
        
        .localbp-onboarding-dot.completed {
          background: #48bb78;
        }
        
        .localbp-onboarding-buttons {
          display: flex;
          gap: 8px;
        }
        
        .localbp-onboarding-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        
        .localbp-onboarding-btn-skip {
          background: transparent;
          color: #a0aec0;
        }
        
        .localbp-onboarding-btn-skip:hover {
          color: #4a5568;
          background: #f7fafc;
        }
        
        .localbp-onboarding-btn-prev {
          background: #f7fafc;
          color: #4a5568;
        }
        
        .localbp-onboarding-btn-prev:hover {
          background: #edf2f7;
        }
        
        .localbp-onboarding-btn-next {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .localbp-onboarding-btn-next:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }
        
        .localbp-onboarding-btn-complete {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
        }
        
        .localbp-onboarding-arrow {
          position: absolute;
          width: 0;
          height: 0;
          border: 10px solid transparent;
        }
        
        .localbp-onboarding-arrow-top {
          border-bottom-color: #667eea;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .localbp-onboarding-arrow-bottom {
          border-top-color: #667eea;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
        }
      </style>
      
      <div id="localbp-onboarding-backdrop"></div>
      <div class="localbp-onboarding-highlight" id="localbp-onboarding-highlight" style="display:none;"></div>
      <div id="localbp-onboarding-card">
        <div class="localbp-onboarding-header">
          <h3 class="localbp-onboarding-title" id="localbp-onboarding-title"></h3>
        </div>
        <div class="localbp-onboarding-body" id="localbp-onboarding-body"></div>
        <div class="localbp-onboarding-footer">
          <div class="localbp-onboarding-progress" id="localbp-onboarding-progress"></div>
          <div class="localbp-onboarding-buttons" id="localbp-onboarding-buttons"></div>
        </div>
      </div>
    `;

        document.body.appendChild(overlay);
    },

    // 显示当前步骤
    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step) return;

        this.currentStep = stepIndex;

        const card = document.getElementById('localbp-onboarding-card');
        const backdrop = document.getElementById('localbp-onboarding-backdrop');
        const highlight = document.getElementById('localbp-onboarding-highlight');
        const titleEl = document.getElementById('localbp-onboarding-title');
        const bodyEl = document.getElementById('localbp-onboarding-body');
        const progressEl = document.getElementById('localbp-onboarding-progress');
        const buttonsEl = document.getElementById('localbp-onboarding-buttons');

        card.classList.remove('show');

        setTimeout(() => {
            titleEl.innerHTML = step.title;
            bodyEl.innerHTML = step.content;

            progressEl.innerHTML = this.steps.map((s, i) => {
                let className = 'localbp-onboarding-dot';
                if (i < stepIndex) className += ' completed';
                if (i === stepIndex) className += ' active';
                return `<div class="${className}"></div>`;
            }).join('');

            let buttonsHtml = '';

            if (stepIndex === 0) {
                buttonsHtml = `
          <button class="localbp-onboarding-btn localbp-onboarding-btn-skip" onclick="LocalBPOnboarding.skip()">跳过</button>
          <button class="localbp-onboarding-btn localbp-onboarding-btn-next" onclick="LocalBPOnboarding.next()">开始 →</button>
        `;
            } else if (stepIndex === this.steps.length - 1) {
                buttonsHtml = `
          <button class="localbp-onboarding-btn localbp-onboarding-btn-prev" onclick="LocalBPOnboarding.prev()">← 返回</button>
          <button class="localbp-onboarding-btn localbp-onboarding-btn-complete" onclick="LocalBPOnboarding.complete()">完成 ✓</button>
        `;
            } else {
                buttonsHtml = `
          <button class="localbp-onboarding-btn localbp-onboarding-btn-skip" onclick="LocalBPOnboarding.skip()">跳过</button>
          <button class="localbp-onboarding-btn localbp-onboarding-btn-prev" onclick="LocalBPOnboarding.prev()">←</button>
          <button class="localbp-onboarding-btn localbp-onboarding-btn-next" onclick="LocalBPOnboarding.next()">下一步 →</button>
        `;
            }
            buttonsEl.innerHTML = buttonsHtml;

            // 处理高亮和定位
            if (step.target && step.highlight) {
                const targetEl = document.querySelector(step.target);
                if (targetEl) {
                    const rect = targetEl.getBoundingClientRect();
                    const padding = 6;

                    highlight.style.display = 'block';
                    highlight.style.left = (rect.left - padding) + 'px';
                    highlight.style.top = (rect.top - padding) + 'px';
                    highlight.style.width = (rect.width + padding * 2) + 'px';
                    highlight.style.height = (rect.height + padding * 2) + 'px';

                    backdrop.classList.remove('show');

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

            setTimeout(() => {
                card.classList.add('show');
            }, 50);

        }, 200);
    },

    positionCard(card, targetRect, position) {
        const cardWidth = 380;
        const cardHeight = card.offsetHeight || 300;
        const padding = 16;

        let left, top;
        let arrowClass = '';

        switch (position) {
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
                top = targetRect.bottom + padding;
                arrowClass = 'localbp-onboarding-arrow-top';
                break;
            case 'top':
                left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
                top = targetRect.top - cardHeight - padding;
                arrowClass = 'localbp-onboarding-arrow-bottom';
                break;
            default:
                this.centerCard(card);
                return;
        }

        left = Math.max(20, Math.min(left, window.innerWidth - cardWidth - 20));
        top = Math.max(20, Math.min(top, window.innerHeight - cardHeight - 20));

        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.style.transform = 'none';

        const oldArrow = card.querySelector('.localbp-onboarding-arrow');
        if (oldArrow) oldArrow.remove();

        if (arrowClass) {
            const arrow = document.createElement('div');
            arrow.className = `localbp-onboarding-arrow ${arrowClass}`;
            card.appendChild(arrow);
        }
    },

    centerCard(card) {
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';

        const oldArrow = card.querySelector('.localbp-onboarding-arrow');
        if (oldArrow) oldArrow.remove();
    },

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        }
    },

    prev() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    },

    skip() {
        this.complete();
    },

    complete() {
        localStorage.setItem(this.STORAGE_KEY, 'true');

        const overlay = document.getElementById('localbp-onboarding-overlay');
        const card = document.getElementById('localbp-onboarding-card');
        const backdrop = document.getElementById('localbp-onboarding-backdrop');

        card.classList.remove('show');
        backdrop.classList.remove('show');

        setTimeout(() => {
            if (overlay) overlay.remove();
        }, 400);
    },

    shouldShow() {
        return localStorage.getItem(this.STORAGE_KEY) !== 'true';
    },

    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('[LocalBP Onboarding] 引导已重置');
    },

    start() {
        if (!this.shouldShow()) {
            console.log('[LocalBP Onboarding] 用户已完成引导，跳过');
            return false;
        }

        console.log('[LocalBP Onboarding] 启动本地BP新手引导');
        this.createUI();

        setTimeout(() => {
            const backdrop = document.getElementById('localbp-onboarding-backdrop');
            backdrop.classList.add('show');
            this.showStep(0);
        }, 500);

        return true;
    },

    forceStart() {
        this.reset();
        this.start();
    }
};

// 导出到全局
window.LocalBPOnboarding = LocalBPOnboarding;

// 页面加载完成后自动检查并启动
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        LocalBPOnboarding.start();
    }, 800);
});
