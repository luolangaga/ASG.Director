let currentView = 'browse'
let currentPage = 1
let totalPages = 1
let currentPackId = null
let searchQuery = ''

// 初始化
async function init() {
  loadPacks()
}

if (window.electronAPI && window.electronAPI.on) {
  window.electronAPI.on('auth-expired', () => {
    try {
      showToast('登录已过期，请在主界面重新登录', 'error')
      if (currentView === 'my-packs') {
        switchView('browse')
      }
    } catch (e) {
      console.warn('auth-expired handler error', e)
    }
  })
}

// 显示Toast
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = `toast show ${type}`
  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}

async function ensureLoggedIn(actionName) {
  const auth = await window.electronAPI.getAuthStatus()
  if (!auth?.isLoggedIn) {
    showToast(`请先登录 ASG 账号再${actionName || '进行此操作'}`, 'error')
    return false
  }
  return true
}

// 切换视图
async function switchView(view) {
  if (view === 'my-packs') {
    const ok = await ensureLoggedIn('查看/管理我的布局包')
    if (!ok) {
      view = 'browse'
    }
  }

  currentView = view
  currentPage = 1

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view)
  })

  const titles = {
    'browse': '浏览商店',
    'installed': '已安装的布局包',
    'my-packs': '我的上传'
  }
  document.getElementById('contentTitle').textContent = titles[view]

  if (view === 'installed') {
    loadInstalled()
  } else if (view === 'my-packs') {
    loadMyPacks()
  } else {
    loadPacks()
  }
}

// 搜索
function handleSearch(event) {
  if (event.key === 'Enter') {
    searchQuery = event.target.value.trim()
    currentPage = 1
    loadPacks()
  }
}

// 加载布局包列表
async function loadPacks() {
  if (currentView === 'my-packs') {
    return loadMyPacks()
  }

  const container = document.getElementById('packsList')
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>'

  try {
    // 获取已安装的包列表
    const installedResult = await window.electronAPI.storeGetInstalled()
    const installedPacks = installedResult.success ? installedResult.data : []
    const installedMap = {}
    installedPacks.forEach(p => {
      installedMap[p.id] = p
    })

    const sortBy = document.getElementById('sortBy').value
    const params = {
      page: currentPage,
      pageSize: 12,
      sortBy: sortBy,
      descending: true
    }
    if (searchQuery) {
      params.search = searchQuery
    }

    const result = await window.electronAPI.storeGetPacks(params)

    if (result.success && result.data) {
      renderPacks(result.data.items || [], installedMap)
      totalPages = result.data.totalPages || 1
      document.getElementById('packCount').textContent = `共 ${result.data.totalCount || 0} 个布局包`
      renderPagination()
    } else {
      container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>加载失败，请稍后重试</p></div>'
    }
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>加载失败：' + error.message + '</p></div>'
  }
}

// 渲染布局包列表
function renderPacks(packs, installedMap = {}) {
  const container = document.getElementById('packsList')

  if (!packs.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>暂无布局包</p></div>'
    return
  }

  container.innerHTML = packs.map(pack => {
    const installed = installedMap[pack.id]
    const isActive = installed && installed.isActive
    const statusBadge = isActive
      ? '<span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 5px;">✓ 使用中</span>'
      : installed
        ? '<span style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 5px;">已安装</span>'
        : ''

    return `
        <div class="pack-card" onclick="showDetail(${pack.id})" style="${isActive ? 'border: 2px solid #4caf50;' : ''}">
          <div class="pack-preview">
            ${pack.previewImageUrl
        ? `<img src="https://api.idvevent.cn${pack.previewImageUrl}" alt="${pack.name}" onerror="this.parentElement.innerHTML='📦'">`
        : '📦'
      }
          </div>
          <div class="pack-info">
            <div class="pack-name">${escapeHtml(pack.name)}${statusBadge}</div>
            <div class="pack-meta">
              <span class="version">v${escapeHtml(pack.version)}</span>
              <span>by ${escapeHtml(pack.author)}</span>
            </div>
            <div class="pack-description">${escapeHtml(pack.description || '暂无描述')}</div>
            ${pack.tags && pack.tags.length ? `
              <div class="pack-tags">
                ${pack.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
              </div>
            ` : ''}
            <div class="pack-stats">
              <div class="stat">📥 ${pack.downloadCount || 0}</div>
              <div class="stat rating">⭐ ${pack.rating ? pack.rating.toFixed(1) : '-'} (${pack.ratingCount || 0})</div>
            </div>
          </div>
        </div>
      `
  }).join('')
}

// 渲染分页
function renderPagination() {
  const container = document.getElementById('pagination')

  if (totalPages <= 1) {
    container.innerHTML = ''
    return
  }

  let html = ''
  html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span style="color: #888;">...</span>'
    }
  }

  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`

  container.innerHTML = html
}

// 跳转页面
function goToPage(page) {
  if (page < 1 || page > totalPages) return
  currentPage = page
  loadPacks()
}

// 加载已安装列表
async function loadInstalled() {
  const container = document.getElementById('packsList')
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>'
  document.getElementById('pagination').innerHTML = ''
  document.getElementById('packCount').textContent = ''

  try {
    const result = await window.electronAPI.storeGetInstalled()

    if (result.success && result.data && result.data.length) {
      container.innerHTML = '<div class="installed-list">' + result.data.map(pack => `
            <div class="installed-item">
              <div class="installed-item-info">
                <div class="installed-item-name">
                  ${escapeHtml(pack.name)}
                  <span style="color: #888; font-size: 12px;">v${escapeHtml(pack.version)}</span>
                </div>
                <div class="installed-item-meta">
                  安装于 ${new Date(pack.installedAt).toLocaleString()}
                </div>
              </div>
              <button class="btn btn-outline" onclick="showDetail(${pack.id})">查看详情</button>
            </div>
          `).join('') + '</div>'
    } else {
      container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>还没有安装任何布局包</p></div>'
    }
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>加载失败</p></div>'
  }
}

// 加载我上传的布局包
async function loadMyPacks() {
  const container = document.getElementById('packsList')
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>加载中...</div>'
  document.getElementById('pagination').innerHTML = ''
  document.getElementById('packCount').textContent = ''

  try {
    const ok = await ensureLoggedIn('查看/管理我的布局包')
    if (!ok) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>未登录</p></div>'
      return
    }

    const result = await window.electronAPI.storeGetMyPacks()
    if (result.success && Array.isArray(result.data)) {
      const packs = result.data
      document.getElementById('packCount').textContent = `共 ${packs.length} 个布局包`

      if (!packs.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>你还没有上传任何布局包</p></div>'
        return
      }

      container.innerHTML = '<div class="installed-list">' + packs.map(pack => `
            <div class="installed-item">
              <div class="installed-item-info">
                <div class="installed-item-name">
                  ${escapeHtml(pack.name)}
                  <span style="color: #888; font-size: 12px;">v${escapeHtml(pack.version)}</span>
                </div>
                <div class="installed-item-meta">
                  ${pack.author ? `作者：${escapeHtml(pack.author)} · ` : ''}ID：${escapeHtml(pack.packageId || '')}${pack.updatedAt ? ` · 更新于 ${new Date(pack.updatedAt).toLocaleString()}` : ''}
                </div>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="btn btn-outline" onclick="showDetail(${pack.id})">查看详情</button>
                <button class="btn btn-outline" onclick="deleteMyPack(${pack.id})">🗑️ 删除</button>
              </div>
            </div>
          `).join('') + '</div>'
    } else {
      container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>加载失败，请稍后重试</p></div>'
    }
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>加载失败：' + error.message + '</p></div>'
  }
}

async function deleteMyPack(id) {
  if (id == null) return
  const ok = await ensureLoggedIn('删除布局包')
  if (!ok) return
  if (!confirm('确定要删除这个布局包吗？此操作不可恢复。')) return

  try {
    const result = await window.electronAPI.storeDeletePack(id)
    if (result.success) {
      showToast('已删除', 'success')
      loadMyPacks()
    } else {
      showToast('删除失败：' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    showToast('删除失败：' + error.message, 'error')
  }
}

// 显示详情
async function showDetail(id) {
  currentPackId = id

  try {
    const result = await window.electronAPI.storeGetPackDetail(id)

    if (result.success && result.data) {
      const pack = result.data

      document.getElementById('modalPreview').innerHTML = pack.previewImageUrl
        ? `<img src="https://api.idvevent.cn${pack.previewImageUrl}" alt="${pack.name}">`
        : '<span>📦</span>'
      document.getElementById('modalTitle').textContent = pack.name
      document.getElementById('modalVersion').textContent = pack.version
      document.getElementById('modalAuthor').textContent = pack.author
      document.getElementById('modalDownloads').textContent = pack.downloadCount || 0
      document.getElementById('modalRating').textContent = pack.rating
        ? `${pack.rating.toFixed(1)} (${pack.ratingCount}人评价)`
        : '暂无评分'
      document.getElementById('modalDescription').textContent = pack.description || '暂无描述'

      const tagsContainer = document.getElementById('modalTags')
      if (pack.tags && pack.tags.length) {
        tagsContainer.innerHTML = pack.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
      } else {
        tagsContainer.innerHTML = ''
      }

      // 重置评分
      document.querySelectorAll('#ratingStars .star').forEach(star => {
        star.classList.remove('active')
      })

      document.getElementById('detailModal').classList.add('show')
    }
  } catch (error) {
    showToast('获取详情失败', 'error')
  }
}

// 关闭详情弹窗
function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show')
  currentPackId = null
}

// 下载布局包
async function downloadPack() {
  if (!currentPackId) return

  const confirmed = confirm('⚠️ 警告：安装布局包将覆盖您当前的布局配置、背景图片及自定义组件设置！\n\n如果您当前的布局尚未导出备份，请先关闭此窗口并在前台窗口右键导出备份，否则您的修改将会丢失。\n\n确定要继续安装并覆盖当前布局吗？')
  if (!confirmed) return

  const btn = document.getElementById('downloadBtn')
  const progressContainer = document.getElementById('storeDownloadProgress')
  const progressFill = document.getElementById('storeProgressFill')
  const progressText = document.getElementById('storeProgressText')

  btn.disabled = true
  btn.textContent = '⏳ 安装中...'

  if (progressContainer) {
    progressContainer.style.display = 'block'
    progressFill.style.width = '0%'
    progressText.textContent = '0%'
  }

  // 监听下载进度
  const removeListener = window.electronAPI.on('download-progress', (progress) => {
    if (progressFill) progressFill.style.width = `${progress}%`
    if (progressText) progressText.textContent = `${Math.round(progress)}%`
  })

  try {
    const result = await window.electronAPI.storeDownloadPack(currentPackId)

    if (result.success) {
      if (progressFill) progressFill.style.width = '100%'
      if (progressText) progressText.textContent = '100%'
      showToast(result.message || '布局包安装成功！', 'success')

      setTimeout(() => {
        closeDetailModal()
        loadPacks()
      }, 500)
    } else {
      showToast('下载失败：' + (result.error || '未知错误'), 'error')
      if (progressContainer) progressContainer.style.display = 'none'
    }
  } catch (error) {
    showToast('下载失败：' + error.message, 'error')
    if (progressContainer) progressContainer.style.display = 'none'
  } finally {
    window.electronAPI.removeAllListeners('download-progress')
    btn.disabled = false
    btn.textContent = '📥 下载安装'
  }
}

// 评分
document.getElementById('ratingStars').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('star')) return
  if (!currentPackId) return

  const rating = parseInt(e.target.dataset.rating)

  // 更新UI
  document.querySelectorAll('#ratingStars .star').forEach(star => {
    star.classList.toggle('active', parseInt(star.dataset.rating) <= rating)
  })

  // 提交评分
  try {
    const result = await window.electronAPI.storeRatePack(currentPackId, rating)
    if (result.success) {
      showToast('评分成功！', 'success')
      if (result.data) {
        document.getElementById('modalRating').textContent =
          `${result.data.rating.toFixed(1)} (${result.data.ratingCount}人评价)`
      }
    }
  } catch (error) {
    showToast('评分失败', 'error')
  }
})

// 显示上传弹窗
function showUploadModal() {
  ; (async () => {
    const ok = await ensureLoggedIn('上传布局包')
    if (!ok) return
    document.getElementById('uploadModal').classList.add('show')
  })()
}

// 关闭上传弹窗
function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('show')
}

// 选择预览图片
async function selectPreviewImage() {
  try {
    const result = await window.electronAPI.storeSelectPreview()
    if (result.success && result.path) {
      document.getElementById('uploadPreviewPath').value = result.path
      document.getElementById('uploadPreviewThumb').innerHTML = `<img src="file://${result.path}" alt="preview">`
    }
  } catch (error) {
    showToast('选择图片失败', 'error')
  }
}

// 上传布局包
async function uploadPack() {
  const ok = await ensureLoggedIn('上传布局包')
  if (!ok) return

  const name = document.getElementById('uploadName').value.trim()
  const version = document.getElementById('uploadVersion').value.trim()
  const author = document.getElementById('uploadAuthor').value.trim()
  const description = document.getElementById('uploadDescription').value.trim()
  const tags = document.getElementById('uploadTags').value.trim()
  const previewPath = document.getElementById('uploadPreviewPath').value
  const isPublic = document.getElementById('uploadPublic').checked
  const autoIncrementVersion = document.getElementById('uploadAutoIncrementVersion').checked
  const packageId = document.getElementById('uploadPackageId').value.trim()

  // 获取选中的布局类型
  const includeFrontendA = document.getElementById('uploadFrontendA').checked
  const includeFrontendB = document.getElementById('uploadFrontendB').checked
  const includeScoreboardA = document.getElementById('uploadScoreboardA').checked
  const includeScoreboardB = document.getElementById('uploadScoreboardB').checked

  if (!name || !version || !author) {
    showToast('请填写必填项', 'error')
    return
  }

  if (!includeFrontendA && !includeFrontendB && !includeScoreboardA && !includeScoreboardB) {
    showToast('请至少选择一个布局类型', 'error')
    return
  }

  const metadata = {
    name,
    version,
    author,
    description,
    tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
    previewPath: previewPath || null,
    isPublic,
    autoIncrementVersion,
    packageId: packageId || null,
    // 新增：布局选择
    includeLayouts: {
      'frontend-a': includeFrontendA,
      'frontend-b': includeFrontendB,
      'scoreboard-a': includeScoreboardA,
      'scoreboard-b': includeScoreboardB
    }
  }

  showToast('正在上传...', 'info')

  try {
    const result = await window.electronAPI.storeUploadPack(metadata)

    if (result.success) {
      showToast('上传成功！', 'success')
      closeUploadModal()
      loadPacks()
    } else {
      showToast('上传失败：' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    showToast('上传失败：' + error.message, 'error')
  }
}

// 检查更新
async function checkUpdates() {
  showToast('正在检查更新...', 'info')

  try {
    const result = await window.electronAPI.storeCheckUpdates()

    if (result.success && result.data.updates && result.data.updates.length) {
      const updates = result.data.updates
      showToast(`发现 ${updates.length} 个更新可用`, 'success')
      // 这里可以显示更新列表
    } else {
      showToast('所有布局包都是最新版本', 'success')
    }
  } catch (error) {
    showToast('检查更新失败', 'error')
  }
}

// HTML转义
function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 点击弹窗外部关闭
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show')
    }
  })
})

// 启动
init()