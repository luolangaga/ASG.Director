const messages = {
  'zh-CN': {
    'store.pageTitle': '🎨 Idvevent布局包商店',
    'store.checkUpdatesBtn': '🔄 检查更新',
    'store.uploadBtn': '📤 上传布局包',
    'store.searchPlaceholder': '搜索布局包...',
    'store.categoryTitle': '分类',
    'store.viewBrowse': '🏪 浏览商店',
    'store.viewInstalled': '📦 已安装',
    'store.viewMine': '👤 我的上传',
    'store.sortLabel': '排序方式',
    'store.sortDownloads': '最多下载',
    'store.sortRating': '最高评分',
    'store.sortNewest': '最新发布',
    'store.sortUpdated': '最近更新',
    'store.contentTitleBrowse': '浏览商店',
    'store.contentTitleInstalled': '已安装的布局包',
    'store.contentTitleMine': '我的上传',
    'store.versionLabel': '版本',
    'store.downloadTimes': '次下载',
    'store.rateThisPack': '为这个布局包评分',
    'store.downloadingPack': '正在下载布局包...',
    'store.downloadInstallBtn': '📥 下载安装',
    'store.uploadTitle': '📤 上传布局包',
    'store.uploadDescription': '支持两种上传方式：直接打包当前布局，或手动上传本地 .bppack 文件。',
    'store.uploadMethodLabel': '上传方式 *',
    'store.uploadSourceCurrent': '打包当前布局',
    'store.uploadSourceFile': '手动上传 .bppack',
    'store.selectPackFileLabel': '选择布局包文件（.bppack） *',
    'store.selectFileBtn': '选择文件',
    'store.noFileSelected': '未选择文件',
    'store.fileSelected': '已选择文件',
    'store.selectLayoutsLabel': '选择要上传的布局（打包当前布局时生效） *',
    'store.layoutFrontendA': '前台 (A队)',
    'store.layoutFrontendB': '前台 (B队)',
    'store.layoutScoreboardA': '比分板 (A队)',
    'store.layoutScoreboardB': '比分板 (B队)',
    'store.layoutScoreboardOverview': '总比分板',
    'store.layoutCharacterDisplay': '角色展示',
    'store.uploadNameLabel': '布局包名称 *',
    'store.uploadNamePlaceholder': '例如：简约深色主题',
    'store.uploadVersionLabel': '版本号 *',
    'store.uploadVersionPlaceholder': '例如：1.0.0',
    'store.uploadAuthorLabel': '作者名称 *',
    'store.uploadAuthorPlaceholder': '你的名字或昵称',
    'store.uploadIntroLabel': '简介描述',
    'store.uploadIntroPlaceholder': '描述一下这个布局包的特点...',
    'store.uploadTagsLabel': '标签（逗号分隔）',
    'store.uploadTagsPlaceholder': '例如：简约,深色,比赛',
    'store.uploadPreviewLabel': '预览图片',
    'store.selectImageBtn': '选择图片',
    'store.publicRelease': '公开发布（其他人可以看到和下载）',
    'store.autoVersion': '🔄 同ID包自动版本递增（将覆盖上方版本号）',
    'store.packageIdLabel': 'PackageId（留空自动生成，填写已有ID可更新旧版本）',
    'store.packageIdPlaceholder': '例如：abc123def456',
    'store.cancelBtn': '取消',
    'store.uploadConfirmBtn': '📤 上传',
    'store.toastAuthExpired': '登录已过期，请在主界面重新登录',
    'store.toastNeedLogin': '请先登录 Idvevent 账号再{action}',
    'store.actionDefault': '进行此操作',
    'store.actionManageMyPacks': '查看/管理我的布局包',
    'store.actionDeletePack': '删除布局包',
    'store.actionUploadPack': '上传布局包',
    'store.loading': '加载中...',
    'store.countTotalPacks': '共 {count} 个布局包',
    'store.loadFailedRetry': '加载失败，请稍后重试',
    'store.loadFailedWithError': '加载失败：{message}',
    'store.noPacks': '暂无布局包',
    'store.inUse': '✓ 使用中',
    'store.installed': '已安装',
    'store.noDescription': '暂无描述',
    'store.prevPage': '上一页',
    'store.nextPage': '下一页',
    'store.installedAt': '安装于 {time}',
    'store.viewDetails': '查看详情',
    'store.noInstalledPacks': '还没有安装任何布局包',
    'store.loadFailed': '加载失败',
    'store.notLoggedIn': '未登录',
    'store.noUploadedPacks': '你还没有上传任何布局包',
    'store.authorLabel': '作者：{name}',
    'store.idLabel': 'ID：{id}',
    'store.updatedAt': '更新于 {time}',
    'store.deleteBtn': '🗑️ 删除',
    'store.confirmDelete': '确定要删除这个布局包吗？此操作不可恢复。',
    'store.deleted': '已删除',
    'store.deleteFailed': '删除失败：{message}',
    'store.unknownError': '未知错误',
    'store.ratingPeople': '{rating} ({count}人评价)',
    'store.noRating': '暂无评分',
    'store.getDetailFailed': '获取详情失败',
    'store.confirmInstallWarning': '⚠️ 警告：安装布局包将覆盖您当前的布局配置、背景图片及自定义组件设置！\n\n如果您当前的布局尚未导出备份，请先关闭此窗口并在前台窗口右键导出备份，否则您的修改将会丢失。\n\n确定要继续安装并覆盖当前布局吗？',
    'store.installing': '⏳ 安装中...',
    'store.installSuccess': '布局包安装成功！',
    'store.downloadFailed': '下载失败：{message}',
    'store.rateSuccess': '评分成功！',
    'store.rateFailed': '评分失败',
    'store.selectFileFailed': '选择文件失败',
    'store.selectPackFailed': '选择布局包失败：{message}',
    'store.selectImageFailed': '选择图片失败',
    'store.requiredFields': '请填写必填项',
    'store.selectBppackFirst': '请先选择要上传的 .bppack 文件',
    'store.selectOneLayout': '请至少选择一个布局类型',
    'store.uploading': '正在上传...',
    'store.uploadSuccess': '上传成功！',
    'store.uploadFailed': '上传失败：{message}',
    'store.checkingUpdates': '正在检查更新...',
    'store.foundUpdates': '发现 {count} 个更新可用',
    'store.allLatest': '所有布局包都是最新版本',
    'store.checkUpdatesFailed': '检查更新失败'
  },
  'en-US': {
    'store.pageTitle': '🎨 Idvevent Layout Pack Store',
    'store.checkUpdatesBtn': '🔄 Check Updates',
    'store.uploadBtn': '📤 Upload Pack',
    'store.searchPlaceholder': 'Search layout packs...',
    'store.categoryTitle': 'Categories',
    'store.viewBrowse': '🏪 Browse Store',
    'store.viewInstalled': '📦 Installed',
    'store.viewMine': '👤 My Uploads',
    'store.sortLabel': 'Sort By',
    'store.sortDownloads': 'Most Downloaded',
    'store.sortRating': 'Highest Rated',
    'store.sortNewest': 'Newest',
    'store.sortUpdated': 'Recently Updated',
    'store.contentTitleBrowse': 'Browse Store',
    'store.contentTitleInstalled': 'Installed Packs',
    'store.contentTitleMine': 'My Uploads',
    'store.versionLabel': 'Version',
    'store.downloadTimes': 'downloads',
    'store.rateThisPack': 'Rate this pack',
    'store.downloadingPack': 'Downloading pack...',
    'store.downloadInstallBtn': '📥 Download & Install',
    'store.uploadTitle': '📤 Upload Layout Pack',
    'store.uploadDescription': 'Two methods are supported: pack current layouts directly, or upload a local .bppack file.',
    'store.uploadMethodLabel': 'Upload Method *',
    'store.uploadSourceCurrent': 'Pack Current Layouts',
    'store.uploadSourceFile': 'Upload .bppack File',
    'store.selectPackFileLabel': 'Select Layout Pack File (.bppack) *',
    'store.selectFileBtn': 'Select File',
    'store.noFileSelected': 'No file selected',
    'store.fileSelected': 'File selected',
    'store.selectLayoutsLabel': 'Select layouts to upload (for packing current layouts) *',
    'store.layoutFrontendA': 'Frontend (Team A)',
    'store.layoutFrontendB': 'Frontend (Team B)',
    'store.layoutScoreboardA': 'Scoreboard (Team A)',
    'store.layoutScoreboardB': 'Scoreboard (Team B)',
    'store.layoutScoreboardOverview': 'Overview Scoreboard',
    'store.layoutCharacterDisplay': 'Character Display',
    'store.uploadNameLabel': 'Pack Name *',
    'store.uploadNamePlaceholder': 'e.g. Minimal Dark Theme',
    'store.uploadVersionLabel': 'Version *',
    'store.uploadVersionPlaceholder': 'e.g. 1.0.0',
    'store.uploadAuthorLabel': 'Author *',
    'store.uploadAuthorPlaceholder': 'Your name or nickname',
    'store.uploadIntroLabel': 'Description',
    'store.uploadIntroPlaceholder': 'Describe the highlights of this pack...',
    'store.uploadTagsLabel': 'Tags (comma-separated)',
    'store.uploadTagsPlaceholder': 'e.g. minimal,dark,tournament',
    'store.uploadPreviewLabel': 'Preview Image',
    'store.selectImageBtn': 'Select Image',
    'store.publicRelease': 'Public release (visible and downloadable by others)',
    'store.autoVersion': '🔄 Auto-increment version for same package ID',
    'store.packageIdLabel': 'PackageId (leave empty to auto-generate; fill existing ID to update)',
    'store.packageIdPlaceholder': 'e.g. abc123def456',
    'store.cancelBtn': 'Cancel',
    'store.uploadConfirmBtn': '📤 Upload',
    'store.toastAuthExpired': 'Login expired. Please sign in again from the main page.',
    'store.toastNeedLogin': 'Please sign in to your Idvevent account before {action}.',
    'store.actionDefault': 'continuing',
    'store.actionManageMyPacks': 'managing your packs',
    'store.actionDeletePack': 'deleting packs',
    'store.actionUploadPack': 'uploading packs',
    'store.loading': 'Loading...',
    'store.countTotalPacks': '{count} packs',
    'store.loadFailedRetry': 'Load failed. Please try again later.',
    'store.loadFailedWithError': 'Load failed: {message}',
    'store.noPacks': 'No packs available',
    'store.inUse': '✓ In Use',
    'store.installed': 'Installed',
    'store.noDescription': 'No description',
    'store.prevPage': 'Previous',
    'store.nextPage': 'Next',
    'store.installedAt': 'Installed at {time}',
    'store.viewDetails': 'View Details',
    'store.noInstalledPacks': 'No packs installed yet',
    'store.loadFailed': 'Load failed',
    'store.notLoggedIn': 'Not logged in',
    'store.noUploadedPacks': 'You have not uploaded any packs yet',
    'store.authorLabel': 'Author: {name}',
    'store.idLabel': 'ID: {id}',
    'store.updatedAt': 'Updated at {time}',
    'store.deleteBtn': '🗑️ Delete',
    'store.confirmDelete': 'Delete this layout pack? This action cannot be undone.',
    'store.deleted': 'Deleted',
    'store.deleteFailed': 'Delete failed: {message}',
    'store.unknownError': 'Unknown error',
    'store.ratingPeople': '{rating} ({count} ratings)',
    'store.noRating': 'No rating yet',
    'store.getDetailFailed': 'Failed to fetch pack details',
    'store.confirmInstallWarning': '⚠️ Warning: Installing this pack will overwrite your current layout settings, background images, and custom components.\n\nIf you have not exported a backup yet, please close this window and export one from the frontend first.\n\nContinue and overwrite current layout?',
    'store.installing': '⏳ Installing...',
    'store.installSuccess': 'Pack installed successfully!',
    'store.downloadFailed': 'Download failed: {message}',
    'store.rateSuccess': 'Rating submitted!',
    'store.rateFailed': 'Rating failed',
    'store.selectFileFailed': 'Failed to select file',
    'store.selectPackFailed': 'Failed to select layout pack: {message}',
    'store.selectImageFailed': 'Failed to select image',
    'store.requiredFields': 'Please fill in required fields',
    'store.selectBppackFirst': 'Please select a .bppack file first',
    'store.selectOneLayout': 'Please select at least one layout type',
    'store.uploading': 'Uploading...',
    'store.uploadSuccess': 'Upload successful!',
    'store.uploadFailed': 'Upload failed: {message}',
    'store.checkingUpdates': 'Checking updates...',
    'store.foundUpdates': '{count} updates available',
    'store.allLatest': 'All layout packs are up to date',
    'store.checkUpdatesFailed': 'Failed to check updates'
  }
}

const i18n = window.ASGI18n.init(messages)

let currentView = 'browse'
let currentPage = 1
let totalPages = 1
let currentPackId = null
let searchQuery = ''

function t(key, params) {
  return i18n.t(key, params)
}

function setContentTitle() {
  const titles = {
    browse: t('store.contentTitleBrowse'),
    installed: t('store.contentTitleInstalled'),
    'my-packs': t('store.contentTitleMine')
  }
  document.getElementById('contentTitle').textContent = titles[currentView] || titles.browse
}

async function init() {
  i18n.bindSelector('languageSelect')
  i18n.apply(document)
  setContentTitle()
  loadPacks()
}

if (window.electronAPI && window.electronAPI.on) {
  window.electronAPI.on('auth-expired', () => {
    try {
      showToast(t('store.toastAuthExpired'), 'error')
      if (currentView === 'my-packs') {
        switchView('browse')
      }
    } catch (e) {
      console.warn('auth-expired handler error', e)
    }
  })
}

document.addEventListener('asg-i18n-changed', () => {
  setContentTitle()
  if (currentView === 'installed') {
    loadInstalled()
  } else if (currentView === 'my-packs') {
    loadMyPacks()
  } else {
    loadPacks()
  }
})

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
    showToast(t('store.toastNeedLogin', { action: actionName || t('store.actionDefault') }), 'error')
    return false
  }
  return true
}

async function switchView(view) {
  if (view === 'my-packs') {
    const ok = await ensureLoggedIn(t('store.actionManageMyPacks'))
    if (!ok) {
      view = 'browse'
    }
  }

  currentView = view
  currentPage = 1

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view)
  })

  setContentTitle()

  if (view === 'installed') {
    loadInstalled()
  } else if (view === 'my-packs') {
    loadMyPacks()
  } else {
    loadPacks()
  }
}

function handleSearch(event) {
  if (event.key === 'Enter') {
    searchQuery = event.target.value.trim()
    currentPage = 1
    loadPacks()
  }
}

async function loadPacks() {
  if (currentView === 'my-packs') {
    return loadMyPacks()
  }

  const container = document.getElementById('packsList')
  container.innerHTML = `<div class="loading"><div class="loading-spinner"></div>${t('store.loading')}</div>`

  try {
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
      sortBy,
      descending: true
    }
    if (searchQuery) {
      params.search = searchQuery
    }

    const result = await window.electronAPI.storeGetPacks(params)

    if (result.success && result.data) {
      renderPacks(result.data.items || [], installedMap)
      totalPages = result.data.totalPages || 1
      document.getElementById('packCount').textContent = t('store.countTotalPacks', { count: result.data.totalCount || 0 })
      renderPagination()
    } else {
      container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><p>${t('store.loadFailedRetry')}</p></div>`
    }
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><p>${t('store.loadFailedWithError', { message: error.message })}</p></div>`
  }
}

function renderPacks(packs, installedMap = {}) {
  const container = document.getElementById('packsList')

  if (!packs.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>${t('store.noPacks')}</p></div>`
    return
  }

  container.innerHTML = packs.map(pack => {
    const installed = installedMap[pack.id]
    const isActive = installed && installed.isActive
    const statusBadge = isActive
      ? `<span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 5px;">${t('store.inUse')}</span>`
      : installed
        ? `<span style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 5px;">${t('store.installed')}</span>`
        : ''

    return `
      <div class="pack-card" onclick="showDetail(${pack.id})" style="${isActive ? 'border: 2px solid #4caf50;' : ''}">
        <div class="pack-preview">
          ${pack.previewImageUrl
          ? `<img src="https://api.idvevent.cn${pack.previewImageUrl}" alt="${pack.name}" onerror="this.parentElement.innerHTML='📦'">`
          : '📦'}
        </div>
        <div class="pack-info">
          <div class="pack-name">${escapeHtml(pack.name)}${statusBadge}</div>
          <div class="pack-meta">
            <span class="version">v${escapeHtml(pack.version)}</span>
            <span>by ${escapeHtml(pack.author)}</span>
          </div>
          <div class="pack-description">${escapeHtml(pack.description || t('store.noDescription'))}</div>
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

function renderPagination() {
  const container = document.getElementById('pagination')
  if (totalPages <= 1) {
    container.innerHTML = ''
    return
  }

  let html = ''
  html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>${t('store.prevPage')}</button>`

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span style="color: #888;">...</span>'
    }
  }

  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>${t('store.nextPage')}</button>`
  container.innerHTML = html
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return
  currentPage = page
  loadPacks()
}

async function loadInstalled() {
  const container = document.getElementById('packsList')
  container.innerHTML = `<div class="loading"><div class="loading-spinner"></div>${t('store.loading')}</div>`
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
              ${t('store.installedAt', { time: i18n.formatDateTime(pack.installedAt) })}
            </div>
          </div>
          <button class="btn btn-outline" onclick="showDetail(${pack.id})">${t('store.viewDetails')}</button>
        </div>
      `).join('') + '</div>'
    } else {
      container.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>${t('store.noInstalledPacks')}</p></div>`
    }
  } catch (_) {
    container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><p>${t('store.loadFailed')}</p></div>`
  }
}

async function loadMyPacks() {
  const container = document.getElementById('packsList')
  container.innerHTML = `<div class="loading"><div class="loading-spinner"></div>${t('store.loading')}</div>`
  document.getElementById('pagination').innerHTML = ''
  document.getElementById('packCount').textContent = ''

  try {
    const ok = await ensureLoggedIn(t('store.actionManageMyPacks'))
    if (!ok) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>${t('store.notLoggedIn')}</p></div>`
      return
    }

    const result = await window.electronAPI.storeGetMyPacks()
    if (result.success && Array.isArray(result.data)) {
      const packs = result.data
      document.getElementById('packCount').textContent = t('store.countTotalPacks', { count: packs.length })

      if (!packs.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>${t('store.noUploadedPacks')}</p></div>`
        return
      }

      container.innerHTML = '<div class="installed-list">' + packs.map(pack => {
        const meta = []
        if (pack.author) {
          meta.push(t('store.authorLabel', { name: escapeHtml(pack.author) }))
        }
        meta.push(t('store.idLabel', { id: escapeHtml(pack.packageId || '') }))
        if (pack.updatedAt) {
          meta.push(t('store.updatedAt', { time: i18n.formatDateTime(pack.updatedAt) }))
        }
        return `
          <div class="installed-item">
            <div class="installed-item-info">
              <div class="installed-item-name">
                ${escapeHtml(pack.name)}
                <span style="color: #888; font-size: 12px;">v${escapeHtml(pack.version)}</span>
              </div>
              <div class="installed-item-meta">${meta.join(' · ')}</div>
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-outline" onclick="showDetail(${pack.id})">${t('store.viewDetails')}</button>
              <button class="btn btn-outline" onclick="deleteMyPack(${pack.id})">${t('store.deleteBtn')}</button>
            </div>
          </div>
        `
      }).join('') + '</div>'
    } else {
      container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><p>${t('store.loadFailedRetry')}</p></div>`
    }
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><p>${t('store.loadFailedWithError', { message: error.message })}</p></div>`
  }
}

async function deleteMyPack(id) {
  if (id == null) return
  const ok = await ensureLoggedIn(t('store.actionDeletePack'))
  if (!ok) return
  if (!confirm(t('store.confirmDelete'))) return

  try {
    const result = await window.electronAPI.storeDeletePack(id)
    if (result.success) {
      showToast(t('store.deleted'), 'success')
      loadMyPacks()
    } else {
      showToast(t('store.deleteFailed', { message: result.error || t('store.unknownError') }), 'error')
    }
  } catch (error) {
    showToast(t('store.deleteFailed', { message: error.message }), 'error')
  }
}

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
        ? t('store.ratingPeople', { rating: pack.rating.toFixed(1), count: pack.ratingCount })
        : t('store.noRating')
      document.getElementById('modalDescription').textContent = pack.description || t('store.noDescription')

      const tagsContainer = document.getElementById('modalTags')
      tagsContainer.innerHTML = pack.tags && pack.tags.length
        ? pack.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
        : ''

      document.querySelectorAll('#ratingStars .star').forEach(star => {
        star.classList.remove('active')
      })

      document.getElementById('detailModal').classList.add('show')
    }
  } catch (_) {
    showToast(t('store.getDetailFailed'), 'error')
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show')
  currentPackId = null
}

async function downloadPack() {
  if (!currentPackId) return
  if (!confirm(t('store.confirmInstallWarning'))) return

  const btn = document.getElementById('downloadBtn')
  const progressContainer = document.getElementById('storeDownloadProgress')
  const progressFill = document.getElementById('storeProgressFill')
  const progressText = document.getElementById('storeProgressText')

  btn.disabled = true
  btn.textContent = t('store.installing')

  if (progressContainer) {
    progressContainer.style.display = 'block'
    progressFill.style.width = '0%'
    progressText.textContent = '0%'
  }

  window.electronAPI.on('download-progress', (progress) => {
    if (progressFill) progressFill.style.width = `${progress}%`
    if (progressText) progressText.textContent = `${Math.round(progress)}%`
  })

  try {
    const result = await window.electronAPI.storeDownloadPack(currentPackId)
    if (result.success) {
      if (progressFill) progressFill.style.width = '100%'
      if (progressText) progressText.textContent = '100%'
      showToast(result.message || t('store.installSuccess'), 'success')
      setTimeout(() => {
        closeDetailModal()
        loadPacks()
      }, 500)
    } else {
      showToast(t('store.downloadFailed', { message: result.error || t('store.unknownError') }), 'error')
      if (progressContainer) progressContainer.style.display = 'none'
    }
  } catch (error) {
    showToast(t('store.downloadFailed', { message: error.message }), 'error')
    if (progressContainer) progressContainer.style.display = 'none'
  } finally {
    window.electronAPI.removeAllListeners('download-progress')
    btn.disabled = false
    btn.textContent = t('store.downloadInstallBtn')
  }
}

document.getElementById('ratingStars').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('star') || !currentPackId) return
  const rating = parseInt(e.target.dataset.rating, 10)

  document.querySelectorAll('#ratingStars .star').forEach(star => {
    star.classList.toggle('active', parseInt(star.dataset.rating, 10) <= rating)
  })

  try {
    const result = await window.electronAPI.storeRatePack(currentPackId, rating)
    if (result.success) {
      showToast(t('store.rateSuccess'), 'success')
      if (result.data) {
        document.getElementById('modalRating').textContent =
          t('store.ratingPeople', { rating: result.data.rating.toFixed(1), count: result.data.ratingCount })
      }
    }
  } catch (_) {
    showToast(t('store.rateFailed'), 'error')
  }
})

function showUploadModal() {
  ; (async () => {
    const ok = await ensureLoggedIn(t('store.actionUploadPack'))
    if (!ok) return
    updateUploadSourceUI()
    document.getElementById('uploadModal').classList.add('show')
  })()
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('show')
}

function updateUploadSourceUI() {
  const useManualFile = document.getElementById('uploadSourceFile')?.checked
  const fileGroup = document.getElementById('uploadPackFileGroup')
  const layoutOptions = document.getElementById('uploadLayoutOptions')
  if (fileGroup) {
    fileGroup.style.display = useManualFile ? 'block' : 'none'
  }
  if (layoutOptions) {
    layoutOptions.style.opacity = useManualFile ? '0.5' : '1'
    layoutOptions.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.disabled = !!useManualFile
    })
  }
}

async function selectPackFile() {
  try {
    const result = await window.electronAPI.storeSelectPackFile()
    if (!result?.success) {
      throw new Error(result?.error || t('store.selectFileFailed'))
    }
    if (result.canceled) return

    document.getElementById('uploadPackFilePath').value = result.filePath || ''
    document.getElementById('uploadPackFileLabel').textContent = result.fileName || result.filePath || t('store.fileSelected')
  } catch (error) {
    showToast(t('store.selectPackFailed', { message: error.message }), 'error')
  }
}

async function selectPreviewImage() {
  try {
    const result = await window.electronAPI.storeSelectPreview()
    if (result.success && result.path) {
      document.getElementById('uploadPreviewPath').value = result.path
      document.getElementById('uploadPreviewThumb').innerHTML = `<img src="file://${result.path}" alt="preview">`
    }
  } catch (_) {
    showToast(t('store.selectImageFailed'), 'error')
  }
}

async function uploadPack() {
  const ok = await ensureLoggedIn(t('store.actionUploadPack'))
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
  const manualPackPath = document.getElementById('uploadPackFilePath').value.trim()
  const useManualFile = document.getElementById('uploadSourceFile')?.checked

  const includeFrontendA = document.getElementById('uploadFrontendA').checked
  const includeFrontendB = document.getElementById('uploadFrontendB').checked
  const includeScoreboardA = document.getElementById('uploadScoreboardA').checked
  const includeScoreboardB = document.getElementById('uploadScoreboardB').checked
  const includeScoreboardOverview = document.getElementById('uploadScoreboardOverview').checked
  const includeCharacterDisplay = document.getElementById('uploadCharacterDisplay').checked

  if (!name || !version || !author) {
    showToast(t('store.requiredFields'), 'error')
    return
  }
  if (useManualFile && !manualPackPath) {
    showToast(t('store.selectBppackFirst'), 'error')
    return
  }
  if (!useManualFile && !includeFrontendA && !includeFrontendB && !includeScoreboardA && !includeScoreboardB && !includeScoreboardOverview && !includeCharacterDisplay) {
    showToast(t('store.selectOneLayout'), 'error')
    return
  }

  const metadata = {
    name,
    version,
    author,
    description,
    tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    previewPath: previewPath || null,
    filePath: useManualFile ? manualPackPath : null,
    isPublic,
    autoIncrementVersion,
    packageId: packageId || null,
    includeLayouts: {
      'frontend-a': includeFrontendA,
      'frontend-b': includeFrontendB,
      'scoreboard-a': includeScoreboardA,
      'scoreboard-b': includeScoreboardB,
      'scoreboard-overview': includeScoreboardOverview,
      'character-display': includeCharacterDisplay
    }
  }

  showToast(t('store.uploading'), 'info')

  try {
    const result = await window.electronAPI.storeUploadPack(metadata)
    if (result.success) {
      showToast(t('store.uploadSuccess'), 'success')
      closeUploadModal()
      loadPacks()
    } else {
      showToast(t('store.uploadFailed', { message: result.error || t('store.unknownError') }), 'error')
    }
  } catch (error) {
    showToast(t('store.uploadFailed', { message: error.message }), 'error')
  }
}

async function checkUpdates() {
  showToast(t('store.checkingUpdates'), 'info')
  try {
    const result = await window.electronAPI.storeCheckUpdates()
    if (result.success && result.data.updates && result.data.updates.length) {
      showToast(t('store.foundUpdates', { count: result.data.updates.length }), 'success')
    } else {
      showToast(t('store.allLatest'), 'success')
    }
  } catch (_) {
    showToast(t('store.checkUpdatesFailed'), 'error')
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show')
    }
  })
})

init()
