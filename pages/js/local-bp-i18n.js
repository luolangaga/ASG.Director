(function () {
  function getLocale() {
    try {
      return window.ASGI18n.normalizeLocale(localStorage.getItem('asg.director.locale') || navigator.language)
    } catch (_) {
      return 'zh-CN'
    }
  }

  function setLocale(locale) {
    try {
      localStorage.setItem('asg.director.locale', locale)
    } catch (_) { }
    applyLocale(locale)
  }

  function setText(selector, text) {
    const el = document.querySelector(selector)
    if (el) el.textContent = text
  }

  function setHtml(selector, html) {
    const el = document.querySelector(selector)
    if (el) el.innerHTML = html
  }

  function applyLocale(locale) {
    const isEn = locale === 'en-US'
    document.documentElement.lang = locale

    const langBtn = document.getElementById('localBpLangBtn')
    if (langBtn) {
      langBtn.textContent = isEn ? 'EN' : '中'
      langBtn.title = isEn ? 'Switch language (partial texts)' : '切换语言（部分文案）'
    }

    setHtml('.top-menu .logo', `<svg class="icon-svg" aria-hidden="true"><use href="#icon-movie"></use></svg>${isEn ? 'Local BP Console' : '本地BP控制台'}`)
    setHtml('.menu-tab[data-page="bp"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-game"></use></svg>${isEn ? 'BP Control' : 'BP控制'}`)
    setHtml('.menu-tab[data-page="ocr"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-security"></use></svg>${isEn ? 'OCR Console' : 'OCR控制台'}`)
    setHtml('.menu-tab[data-page="baseinfo"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-map"></use></svg>${isEn ? 'Match Base Info' : '对局基础信息'}`)
    setHtml('.menu-tab[data-page="talents"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-psychology"></use></svg>${isEn ? 'Talents & Skills' : '天赋与技能'}`)
    setHtml('.menu-tab[data-page="score"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-bar-chart"></use></svg>${isEn ? 'Score Manager' : '比分管理'}`)
    setHtml('.menu-tab[data-page="postmatch"]', `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-insights"></use></svg>${isEn ? 'Post Match' : '赛后数据'}`)

    const actionBtns = document.querySelectorAll('.top-menu .menu-action')
    if (actionBtns[0]) actionBtns[0].innerHTML = `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-explore"></use></svg>${isEn ? 'BP Guide' : 'BP引导'}`
    if (actionBtns[1]) actionBtns[1].innerHTML = `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-map"></use></svg>${isEn ? 'Layout Edit' : '布局编辑'}`
    if (actionBtns[2]) actionBtns[2].innerHTML = `<svg class="tab-icon icon-svg" aria-hidden="true"><use href="#icon-help"></use></svg>${isEn ? 'Help' : '帮助'}`

    setText('#localBpLayoutEditBar .localbp-layout-edit-hint', isEn ? 'Layout edit mode: drag module headers to reorder, resize from bottom-right, and switch tabs while editing.' : '布局编辑中：拖拽模块标题排序，右下角可缩放，可切换目标Tab')
    const editBarBtns = document.querySelectorAll('#localBpLayoutEditBar .btn')
    if (editBarBtns[0]) editBarBtns[0].textContent = isEn ? 'Reset Layout' : '重置布局'
    if (editBarBtns[1]) editBarBtns[1].textContent = isEn ? 'Done' : '完成编辑'

    setHtml('#page-bp .collapsible-header h1', `${isEn ? 'BP Control' : 'BP控制'} <span class="collapse-arrow">▼</span>`)
    const opBtns = document.querySelectorAll('#page-bp .controls .btn-operator')
    const opTexts = isEn
      ? ['Refresh Frontend', 'Character Display', 'Character 3D Model', 'Reset BP', 'Reset BP (Keep Global Ban)', 'Open All Windows']
      : ['更新前端显示', '角色展示', '角色模型3D展示', '重置BP', '重置BP (保留全局禁用)', '一键打开所有窗口']
    opBtns.forEach((btn, idx) => {
      if (opTexts[idx]) btn.textContent = opTexts[idx]
    })

    setHtml('.timer-label', `<svg class="icon-inline icon-svg" aria-hidden="true"><use href="#icon-schedule"></use></svg>${isEn ? 'Countdown' : '倒计时'}`)
    const timerBtns = document.querySelectorAll('.timer-actions .btn')
    const timerTexts = isEn ? ['Start', 'Pause', 'Reset'] : ['开始', '暂停', '重置']
    timerBtns.forEach((btn, idx) => {
      if (timerTexts[idx]) btn.textContent = timerTexts[idx]
    })
    setText('.timer-option-label', isEn ? 'Indeterminate mode' : '无进度模式')
    setText('.timer-duration-label', isEn ? 'Duration (sec)' : '时长(秒)')
  }

  window.toggleLocalBpLanguage = function toggleLocalBpLanguage() {
    const current = getLocale()
    const next = current === 'en-US' ? 'zh-CN' : 'en-US'
    setLocale(next)
  }

  window.applyLocalBpLocale = applyLocale
  document.addEventListener('DOMContentLoaded', () => applyLocale(getLocale()))
})()
