
// 初始化
window.addEventListener('DOMContentLoaded', () => {
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
            container.innerHTML = '<div class="loading"><div class="icon">😕</div><p>获取推荐失败，请前往完整商店查看</p></div>';
        }
    } catch (error) {
        console.error('Failed to load packs:', error);
        container.innerHTML = `<div class="loading"><p>加载失败: ${error.message}</p></div>`;
    }
}

// 渲染卡片
function renderPacks(packs) {
    const container = document.getElementById('packsGrid');

    if (!packs || packs.length === 0) {
        container.innerHTML = '<div class="loading"><p>暂无推荐内容</p></div>';
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
            <button class="btn-install">立即安装</button>
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

    const confirmed = confirm(`⚠️ 警告：安装 "${name}" 将覆盖您当前的布局、背景及组件配置！\n\n如果您当前已有正在使用的布局且未导出备份，请先取消并导出，否则原有设置将被不可逆地覆盖。\n\n确定要继续安装吗？`);
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
            alert('安装失败: ' + (result.error || '未知错误'));
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        overlay.classList.remove('show');
        alert('安装出错: ' + error.message);
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
