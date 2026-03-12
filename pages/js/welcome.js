
const messages = {
    'zh-CN': {
        'welcome.documentTitle': '欢迎使用 Idvevent Director',
        'welcome.title': '欢迎使用!',
        'welcome.subtitle': '检测到您是首次使用，当前没有任何样式配置。',
        'welcome.description': '为了获得最佳体验，我们强烈建议您安装一个初始布局包。',
        'welcome.recommendedTitle': '🔥 精选推荐布局包',
        'welcome.loadingRecommended': '正在获取推荐布局...',
        'welcome.skip': '暂时跳过 (没有任何样式)',
        'welcome.openStore': '前往完整商店',
        'welcome.downloadingPack': '正在下载布局包...',
        'welcome.loadFailed': '获取推荐失败，请前往完整商店查看',
        'welcome.loadError': '加载失败: {message}',
        'welcome.noRecommendations': '暂无推荐内容',
        'welcome.installNow': '立即安装',
        'welcome.installWarning': '⚠️ 警告：安装 "{name}" 将覆盖您当前的布局、背景及组件配置！\n\n如果您当前已有正在使用的布局且未导出备份，请先取消并导出，否则原有设置将被不可逆地覆盖。\n\n确定要继续安装吗？',
        'welcome.installFailed': '安装失败: {message}',
        'welcome.installError': '安装出错: {message}'
    },
    'en-US': {
        'welcome.documentTitle': 'Welcome to Idvevent Director',
        'welcome.title': 'Welcome!',
        'welcome.subtitle': 'This appears to be your first run, and no style pack is configured yet.',
        'welcome.description': 'For the best experience, we strongly recommend installing a starter layout pack.',
        'welcome.recommendedTitle': '🔥 Recommended Starter Packs',
        'welcome.loadingRecommended': 'Fetching recommended packs...',
        'welcome.skip': 'Skip for now (no styles)',
        'welcome.openStore': 'Open Full Store',
        'welcome.downloadingPack': 'Downloading pack...',
        'welcome.loadFailed': 'Failed to fetch recommendations. Please open the full store.',
        'welcome.loadError': 'Load failed: {message}',
        'welcome.noRecommendations': 'No recommended packs yet',
        'welcome.installNow': 'Install Now',
        'welcome.installWarning': '⚠️ Warning: Installing "{name}" will overwrite your current layout, background, and component settings.\n\nIf you have an active layout and no backup yet, cancel now and export a backup first.\n\nContinue installation?',
        'welcome.installFailed': 'Install failed: {message}',
        'welcome.installError': 'Install error: {message}'
    }
};

const i18n = window.ASGI18n.init(messages);

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    i18n.bindSelector('languageSelect');
    i18n.apply(document);
    loadRecommendedPacks();
});

// 加载推荐布局包
async function loadRecommendedPacks() {
    const container = document.getElementById('packsGrid');

    try {
        // 调用 electronAPI 获取商店列表
        // 参数：按下载量排序，取前6个
        const params = {
            page: 1,
            pageSize: 6,
            sortBy: 'downloads',
            descending: true
        };

        // 注意：这里复用 main.js 中已有的 store-get-packs 处理程序
        const result = await window.electronAPI.storeGetPacks(params);

        if (result.success && result.data && result.data.items) {
            renderPacks(result.data.items);
        } else {
            container.innerHTML = `<div class="loading"><div class="icon">😕</div><p>${i18n.t('welcome.loadFailed')}</p></div>`;
        }
    } catch (error) {
        console.error('Failed to load packs:', error);
        container.innerHTML = `<div class="loading"><p>${i18n.t('welcome.loadError', { message: error.message })}</p></div>`;
    }
}

// 渲染卡片
function renderPacks(packs) {
    const container = document.getElementById('packsGrid');

    if (!packs || packs.length === 0) {
        container.innerHTML = `<div class="loading"><p>${i18n.t('welcome.noRecommendations')}</p></div>`;
        return;
    }

    container.innerHTML = packs.map(pack => {
        const previewUrl = pack.previewImageUrl
            ? `https://api.idvevent.cn${pack.previewImageUrl}`
            : null;

        return `
      <div class="pack-card" onclick="installPack(${pack.id}, '${escapeHtml(pack.name)}')">
        <div class="pack-preview">
          ${previewUrl
                ? `<img src="${previewUrl}" alt="${escapeHtml(pack.name)}" onerror="this.style.display='none';this.parentElement.innerHTML='📦'">`
                : '📦'}
          
          <div class="install-overlay">
            <button class="btn-install">${i18n.t('welcome.installNow')}</button>
          </div>
        </div>
        <div class="pack-info">
          <div class="pack-name">${escapeHtml(pack.name)}</div>
          <div class="pack-author">by ${escapeHtml(pack.author)}</div>
          <div class="pack-stats">
             <span>📥 ${pack.downloadCount || 0}</span>
             <span>⭐ ${pack.rating ? pack.rating.toFixed(1) : '-'}</span>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// 安装布局包
async function installPack(id, name) {
    const btn = event.target.closest('.pack-card').querySelector('.btn-install');
    const originalText = btn.textContent;

    if (btn.disabled) return;

    const confirmed = confirm(i18n.t('welcome.installWarning', { name }));
    if (!confirmed) return;

    // 显示进度条
    const overlay = document.getElementById('downloadProgressOverlay');
    const fill = document.getElementById('downloadProgressFill');
    const text = document.getElementById('downloadProgressText');

    overlay.classList.add('show');
    fill.style.width = '0%';
    text.textContent = '0';

    // 监听进度 (electronAPI.on 返回一个 removeListener 函数)
    const removeListener = window.electronAPI.on('download-progress', (progress) => {
        fill.style.width = `${progress}%`;
        text.textContent = Math.round(progress);
    });

    try {
        btn.disabled = true;
        btn.textContent = '⏳';

        // 使用 main.js 中已有的下载逻辑
        const result = await window.electronAPI.storeDownloadPack(id);

        if (result.success) {
            fill.style.width = '100%';
            text.textContent = '100';
            btn.textContent = '✔ Success';
            btn.style.background = '#4caf50';
            btn.style.color = '#fff';

            // 延迟关闭窗口
            setTimeout(() => {
                window.close(); // 关闭欢迎窗口，主窗口应该已经在底下
            }, 1000);

        } else {
            overlay.classList.remove('show');
            alert(i18n.t('welcome.installFailed', { message: result.error || 'Unknown error' }));
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        overlay.classList.remove('show');
        alert(i18n.t('welcome.installError', { message: error.message }));
        btn.textContent = originalText;
        btn.disabled = false;
    } finally {
        window.electronAPI.removeAllListeners('download-progress');
    }
}

// 跳过
function skipWelcome() {
    // 设置标志不再显示 (main.js 会处理，这里只需要关闭窗口)
    window.close();
}

// 打开完整商店
async function openFullStore() {
    await window.electronAPI.openStore();
    window.close();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
