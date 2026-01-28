// 组件数据
        let components = []
        let selectedComponentId = null
        let hasUnsavedChanges = false

        // 生成唯一ID
        function generateId() {
            return 'comp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
        }

        // Toast 提示
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast')
            toast.textContent = message
            toast.className = 'toast ' + type
            toast.classList.add('show')
            setTimeout(() => {
                toast.classList.remove('show')
            }, 3000)
        }

        // 初始化
        async function init() {
            await loadComponents()
            renderComponentList()
            setupEventListeners()
        }

        // 加载组件
        async function loadComponents() {
            try {
                const result = await window.electronAPI.loadLayout()
                if (result.success && result.layout && result.layout.customComponents) {
                    components = result.layout.customComponents
                } else {
                    components = []
                }
            } catch (e) {
                console.error('加载组件失败:', e)
                components = []
            }
        }

        // 保存所有组件
        async function saveAllComponents() {
            try {
                const result = await window.electronAPI.loadLayout()
                const layout = (result.success && result.layout) ? result.layout : {}
                layout.customComponents = components

                const saveResult = await window.electronAPI.saveLayout(layout)
                if (saveResult.success) {
                    hasUnsavedChanges = false
                    showToast('所有组件已保存', 'success')

                    // 通知前台刷新
                    if (window.electronAPI.sendToFrontend) {
                        window.electronAPI.sendToFrontend({ type: 'custom-components-updated', components })
                    }
                } else {
                    showToast('保存失败: ' + saveResult.error, 'error')
                }
            } catch (e) {
                console.error('保存失败:', e)
                showToast('保存失败: ' + e.message, 'error')
            }
        }

        // 保存当前组件
        async function saveCurrentComponent(shouldRenderList = true) {
            if (!selectedComponentId) return

            const comp = components.find(c => c.id === selectedComponentId)
            if (!comp) return

            const oldName = comp.name

            // 从表单读取数据
            comp.name = document.getElementById('propName').value || '未命名组件'
            comp.width = document.getElementById('propWidth').value || 'auto'
            comp.height = document.getElementById('propHeight').value || 'auto'

            // 获取导出目标页面
            const targetCheckboxes = document.querySelectorAll('#targetPages input[type="checkbox"]')
            comp.targetPages = []
            targetCheckboxes.forEach(cb => {
                if (cb.checked) comp.targetPages.push(cb.value)
            })

            // 根据类型读取特定属性
            if (comp.type === 'text') {
                comp.content = document.getElementById('propTextContent').value || ''
                comp.fontSize = parseInt(document.getElementById('propFontSize').value) || 16
                comp.fontWeight = document.getElementById('propFontWeight').value || 'normal'
                comp.color = document.getElementById('propTextColorText').value || '#ffffff'
                comp.textAlign = document.getElementById('propTextAlign').value || 'left'
                comp.backgroundColor = document.getElementById('propBgColorText').value || 'transparent'
                comp.html = generateTextHtml(comp)
            } else if (comp.type === 'image') {
                comp.imageUrl = document.getElementById('propImageUrl').value || ''
                comp.imageWidth = document.getElementById('propImageWidth').value || 'auto'
                comp.imageHeight = document.getElementById('propImageHeight').value || 'auto'
                comp.objectFit = document.getElementById('propObjectFit').value || 'contain'
                comp.html = generateImageHtml(comp)
            } else if (comp.type === 'html') {
                comp.html = document.getElementById('codeEditor').value || ''
                comp.customCss = document.getElementById('propCustomCss').value || ''
            }

            hasUnsavedChanges = true

            // 只有当名字改变或被强制要求时才重新渲染列表，避免输入焦点丢失
            if (shouldRenderList || comp.name !== oldName) {
                renderComponentList()
            }
            updatePreview()
            // 不再显示Toast，避免打扰，因为现在是实时保存到内存
        }

        // 生成文本 HTML
        function generateTextHtml(comp) {
            const styles = [
                `font-size: ${comp.fontSize || 16}px`,
                `font-weight: ${comp.fontWeight || 'normal'}`,
                `color: ${comp.color || '#ffffff'}`,
                `text-align: ${comp.textAlign || 'left'}`,
                `background-color: ${comp.backgroundColor || 'transparent'}`,
                'padding: 8px 12px',
                'border-radius: 4px'
            ]
            return `<div style="${styles.join('; ')}">${escapeHtml(comp.content || '')}</div>`
        }

        // 生成图片 HTML
        function generateImageHtml(comp) {
            if (!comp.imageUrl && !comp.imageData) {
                return '<div style="padding: 20px; color: #aaa; text-align: center;">暂无图片</div>'
            }
            const src = comp.imageData || comp.imageUrl
            const styles = [
                `width: ${comp.imageWidth || 'auto'}`,
                `height: ${comp.imageHeight || 'auto'}`,
                `object-fit: ${comp.objectFit || 'contain'}`
            ]
            return `<img src="${src}" style="${styles.join('; ')}" />`
        }

        // HTML 转义
        function escapeHtml(text) {
            const div = document.createElement('div')
            div.textContent = text
            return div.innerHTML
        }

        // 渲染组件列表
        function renderComponentList() {
            const list = document.getElementById('componentList')
            const count = document.getElementById('componentCount')

            count.textContent = components.length + ' 个'

            if (components.length === 0) {
                list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-title">暂无组件</div>
                    <div class="empty-state-desc">点击上方"新建组件"创建您的第一个自定义组件</div>
                </div>`
                return
            }

            list.innerHTML = components.map(comp => {
                const typeIcons = { text: '📝', image: '🖼️', html: '🌐' }
                const isActive = comp.id === selectedComponentId
                return `
          <div class="component-item ${isActive ? 'active' : ''}" data-id="${comp.id}" onclick="selectComponent('${comp.id}')">
            <div class="component-icon">${typeIcons[comp.type] || '📦'}</div>
            <div class="component-info">
              <div class="component-name">${escapeHtml(comp.name || '未命名')}</div>
              <div class="component-type">${comp.type === 'text' ? '文本' : comp.type === 'image' ? '图片' : 'HTML'}</div>
            </div>
            <div class="component-actions">
              <button onclick="event.stopPropagation(); duplicateComponent('${comp.id}')" title="复制">📋</button>
              <button class="delete" onclick="event.stopPropagation(); deleteComponent('${comp.id}')" title="删除">🗑️</button>
            </div>
          </div>
        `
            }).join('')
        }

        // 选择组件
        function selectComponent(id) {
            selectedComponentId = id
            const comp = components.find(c => c.id === id)
            if (!comp) return

            // 显示编辑区和属性面板
            document.getElementById('editorArea').style.display = 'flex'
            document.getElementById('editorPlaceholder').style.display = 'none'
            document.getElementById('propertiesPanel').style.display = 'block'

            // 填充基本属性
            document.getElementById('propName').value = comp.name || ''
            document.getElementById('propType').value = comp.type
            document.getElementById('propWidth').value = comp.width || 'auto'
            document.getElementById('propHeight').value = comp.height || 'auto'

            // 根据类型显示不同属性面板
            document.getElementById('textProperties').style.display = comp.type === 'text' ? 'block' : 'none'
            document.getElementById('imageProperties').style.display = comp.type === 'image' ? 'block' : 'none'
            document.getElementById('htmlProperties').style.display = comp.type === 'html' ? 'block' : 'none'

            // 填充类型特定属性
            if (comp.type === 'text') {
                document.getElementById('propTextContent').value = comp.content || ''
                document.getElementById('propFontSize').value = comp.fontSize || 16
                document.getElementById('propFontWeight').value = comp.fontWeight || 'normal'
                document.getElementById('propTextColor').value = comp.color || '#ffffff'
                document.getElementById('propTextColorText').value = comp.color || '#ffffff'
                document.getElementById('propTextAlign').value = comp.textAlign || 'left'
                document.getElementById('propBgColorText').value = comp.backgroundColor || 'transparent'
            } else if (comp.type === 'image') {
                document.getElementById('propImageUrl').value = comp.imageUrl || ''
                document.getElementById('propImageWidth').value = comp.imageWidth || 'auto'
                document.getElementById('propImageHeight').value = comp.imageHeight || 'auto'
                document.getElementById('propObjectFit').value = comp.objectFit || 'contain'
                updateImagePreview(comp.imageData || comp.imageUrl)
            } else if (comp.type === 'html') {
                document.getElementById('codeEditor').value = comp.html || ''
                document.getElementById('propCustomCss').value = comp.customCss || ''
            }

            // 填充导出目标
            const targetCheckboxes = document.querySelectorAll('#targetPages input[type="checkbox"]')
            targetCheckboxes.forEach(cb => {
                cb.checked = comp.targetPages && comp.targetPages.includes(cb.value)
            })

            // 更新代码编辑器
            document.getElementById('codeEditor').value = comp.html || ''

            renderComponentList()
            updatePreview()
        }

        // 更新预览
        function updatePreview() {
            const comp = components.find(c => c.id === selectedComponentId)
            const previewContent = document.getElementById('previewContent')

            if (!comp) {
                previewContent.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👀</div><div class="empty-state-desc">选择一个组件查看预览</div></div>'
                return
            }

            let html = comp.html || ''
            if (comp.customCss) {
                html = `` + html
            }

            // 添加容器样式
            const containerStyle = `
                width: ${comp.width || 'auto'};
                height: ${comp.height || 'auto'};
                min-width: 50px;
                min-height: 30px;
            `

            previewContent.innerHTML = `<div style="${containerStyle}">${html}</div>`
        }

        // 刷新预览
        function refreshPreview() {
            saveCurrentComponent()
            updatePreview()
            showToast('预览已刷新')
        }

        // 切换编辑器标签
        function switchEditorTab(tab) {
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'))
            document.querySelector(`.editor-tab[data-tab="${tab}"]`).classList.add('active')

            document.querySelectorAll('.editor-panel').forEach(p => p.classList.remove('active'))
            document.getElementById(tab + 'Panel').classList.add('active')

            if (tab === 'code') {
                const comp = components.find(c => c.id === selectedComponentId)
                if (comp) {
                    document.getElementById('codeEditor').value = comp.html || ''
                }
            }
        }

        // 新建组件
        function createNewComponent() {
            document.getElementById('newComponentModal').classList.add('show')
            document.getElementById('newComponentName').value = ''
            document.getElementById('newComponentName').focus()

            // 重置类型选择
            document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'))
            document.querySelector('.type-option[data-type="text"]').classList.add('selected')
        }

        function closeNewComponentModal() {
            document.getElementById('newComponentModal').classList.remove('show')
        }

        function confirmNewComponent() {
            const name = document.getElementById('newComponentName').value.trim() || '新组件'
            const typeOption = document.querySelector('.type-option.selected')
            const type = typeOption ? typeOption.dataset.type : 'text'

            const newComponent = {
                id: generateId(),
                name,
                type,
                targetPages: ['frontend'],
                width: '200',
                height: type === 'text' ? 'auto' : '100',
                createdAt: new Date().toISOString()
            }

            // 根据类型设置默认值
            if (type === 'text') {
                newComponent.content = '示例文本'
                newComponent.fontSize = 16
                newComponent.fontWeight = 'normal'
                newComponent.color = '#ffffff'
                newComponent.textAlign = 'left'
                newComponent.backgroundColor = 'transparent'
                newComponent.html = generateTextHtml(newComponent)
            } else if (type === 'image') {
                newComponent.imageUrl = ''
                newComponent.objectFit = 'contain'
                newComponent.html = generateImageHtml(newComponent)
            } else if (type === 'html') {
                newComponent.html = '<div style="padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; color: #fff;">自定义 HTML 内容</div>'
                newComponent.customCss = ''
            }

            components.push(newComponent)
            hasUnsavedChanges = true
            closeNewComponentModal()
            renderComponentList()
            selectComponent(newComponent.id)
            showToast('组件已创建', 'success')
        }

        // 复制组件
        function duplicateComponent(id) {
            const comp = components.find(c => c.id === id)
            if (!comp) return

            const newComp = {
                ...JSON.parse(JSON.stringify(comp)),
                id: generateId(),
                name: comp.name + ' (副本)',
                createdAt: new Date().toISOString()
            }

            components.push(newComp)
            hasUnsavedChanges = true
            renderComponentList()
            selectComponent(newComp.id)
            showToast('组件已复制')
        }

        // 删除组件
        function deleteComponent(id) {
            if (!confirm('确定要删除这个组件吗？')) return

            components = components.filter(c => c.id !== id)
            hasUnsavedChanges = true

            if (selectedComponentId === id) {
                selectedComponentId = null
                document.getElementById('editorArea').style.display = 'none'
                document.getElementById('editorPlaceholder').style.display = 'flex'
                document.getElementById('propertiesPanel').style.display = 'none'
            }

            renderComponentList()
            showToast('组件已删除')
        }

        // 删除当前组件
        function deleteCurrentComponent() {
            if (selectedComponentId) {
                deleteComponent(selectedComponentId)
            }
        }

        // 选择图片
        async function selectImage() {
            try {
                const result = await window.electronAPI.invoke('select-component-image')
                if (result.success && result.data) {
                    const comp = components.find(c => c.id === selectedComponentId)
                    if (comp) {
                        comp.imageData = result.data // base64
                        comp.imageUrl = ''
                        updateImagePreview(result.data)
                        hasUnsavedChanges = true
                        document.getElementById('propImageUrl').value = ''
                    }
                }
            } catch (e) {
                console.error('选择图片失败:', e)
                showToast('选择图片失败', 'error')
            }
        }

        // 更新图片预览
        function updateImagePreview(src) {
            const preview = document.getElementById('imagePreview')
            if (src) {
                preview.innerHTML = `<img src="${src}" alt="预览">`
            } else {
                preview.innerHTML = '<span class="image-preview-placeholder">暂无图片</span>'
            }
        }

        // 清除图片
        function clearImage() {
            const comp = components.find(c => c.id === selectedComponentId)
            if (comp) {
                comp.imageData = ''
                comp.imageUrl = ''
                updateImagePreview('')
                hasUnsavedChanges = true
            }
        }

        // 设置事件监听
        function setupEventListeners() {
            // 类型选择
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'))
                    opt.classList.add('selected')
                })
            })

            // 颜色选择器同步并触发保存
            const syncColor = (pickerId, textId) => {
                const picker = document.getElementById(pickerId)
                const text = document.getElementById(textId)

                picker.addEventListener('input', e => {
                    text.value = e.target.value
                    saveCurrentComponent(false)
                })
                text.addEventListener('input', e => {
                    const color = e.target.value
                    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        picker.value = color
                        saveCurrentComponent(false)
                    }
                })
            }

            syncColor('propTextColor', 'propTextColorText')
            syncColor('propBgColor', 'propBgColorText')

            // 代码编辑器变化
            document.getElementById('codeEditor').addEventListener('input', e => {
                const comp = components.find(c => c.id === selectedComponentId)
                if (comp) {
                    comp.html = e.target.value
                    hasUnsavedChanges = true
                    updatePreview() // 实时更新预览
                }
            })

            // 图片 URL 变化
            document.getElementById('propImageUrl').addEventListener('input', e => {
                const comp = components.find(c => c.id === selectedComponentId)
                if (comp && comp.type === 'image') {
                    comp.imageUrl = e.target.value
                    comp.imageData = ''
                    updateImagePreview(e.target.value)
                    hasUnsavedChanges = true
                    saveCurrentComponent(false) // 触发 HTML 生成
                }
            })

            // 自动保存属性变化 (使用 input 事件以实现实时预览)
            const autoSaveInputs = ['propName', 'propWidth', 'propHeight', 'propTextContent', 'propFontSize', 'propFontWeight', 'propTextAlign', 'propImageWidth', 'propImageHeight', 'propObjectFit', 'propCustomCss']
            autoSaveInputs.forEach(id => {
                const el = document.getElementById(id)
                if (el) {
                    el.addEventListener('input', () => {
                        // 名字修改需要刷新列表，其他不需要
                        const isName = id === 'propName'
                        saveCurrentComponent(isName)
                    })
                }
            })

            // 导出目标变化
            document.querySelectorAll('#targetPages input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    saveCurrentComponent(false)
                })
            })

            // 键盘快捷键
            document.addEventListener('keydown', e => {
                // Ctrl+S 保存
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault()
                    saveAllComponents()
                }
                // Ctrl+N 新建
                if (e.ctrlKey && e.key === 'n') {
                    e.preventDefault()
                    createNewComponent()
                }
                // F12 开发者工具
                if (e.key === 'F12') {
                    e.preventDefault()
                    window.electronAPI?.invoke?.('toggle-devtools')
                }
            })

            // 关闭前警告
            window.addEventListener('beforeunload', e => {
                if (hasUnsavedChanges) {
                    e.preventDefault()
                    e.returnValue = '有未保存的更改，确定要离开吗？'
                }
            })
        }

        // 初始化
        document.addEventListener('DOMContentLoaded', init)