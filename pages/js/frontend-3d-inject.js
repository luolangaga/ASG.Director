
; (function inject3DSettings() {
  const panel = document.querySelector('#layoutSettingsPanel .settings-modal')
  if (!panel) return
  const section = document.createElement('div')
  section.className = 'settings-section'
  section.innerHTML = `
  <h4>3D角色展示</h4>
  <div class="settings-grid">
    <div class="settings-item"><label>启用3D模型</label><input id="enable3dModels" type="checkbox"></div>
    <div class="settings-item"><label>目标帧率</label><input id="model3dTargetFPS" type="number" min="15" max="60" value="30"></div>
    <div class="settings-item"><label>求生者模型目录</label><input id="survivorModelDir" type="text" placeholder="例如 C:/Models/Survivor"></div>
    <div class="settings-item"><label>监管者模型目录</label><input id="hunterModelDir" type="text" placeholder="例如 C:/Models/Hunter"></div>
    <div class="settings-item"><label>求生者动作目录</label><input id="survivorMotionDir" type="text" placeholder="例如 C:/Motions/Survivor"></div>
    <div class="settings-item"><label>监管者动作目录</label><input id="hunterMotionDir" type="text" placeholder="例如 C:/Motions/Hunter"></div>
    <div class="settings-item"><label>默认VMD动作</label><input id="defaultMotionVmd" type="text" placeholder="例如 C:/Motions/default.vmd"></div>
  </div>
  
  <h4 style="margin-top:16px;">渲染质量</h4>
  <div class="settings-grid">
    <div class="settings-item"><label>抗锯齿</label>
      <select id="render3dAntialias">
        <option value="false">关闭</option>
        <option value="true" selected>开启</option>
      </select>
    </div>
    <div class="settings-item"><label>像素比</label>
      <select id="render3dPixelRatio">
        <option value="0.5">0.5x (低)</option>
        <option value="1" selected>1x (标准)</option>
        <option value="1.5">1.5x (高)</option>
        <option value="2">2x (超高)</option>
      </select>
    </div>
    <div class="settings-item"><label>启用阴影</label><input id="render3dEnableShadows" type="checkbox"></div>
    <div class="settings-item"><label>阴影质量</label>
      <select id="render3dShadowQuality">
        <option value="512">低 (512)</option>
        <option value="1024" selected>中 (1024)</option>
        <option value="2048">高 (2048)</option>
      </select>
    </div>
  </div>
  
  <h4 style="margin-top:16px;">风格化渲染</h4>
  <div class="settings-grid">
    <div class="settings-item"><label>卡通描边</label><input id="render3dEnableOutline" type="checkbox" checked></div>
    <div class="settings-item"><label>描边粗细</label><input id="render3dOutlineThickness" type="range" min="0.001" max="0.02" step="0.001" value="0.003"></div>
    <div class="settings-item"><label>描边颜色</label><input id="render3dOutlineColor" type="color" value="#000000"></div>
    <div class="settings-item"><label>描边透明度</label><input id="render3dOutlineAlpha" type="range" min="0" max="1" step="0.1" value="1"></div>
    <div class="settings-item"><label>Toon着色</label><input id="render3dEnableToon" type="checkbox"></div>
    <div class="settings-item"><label>Toon渐变级数</label>
      <select id="render3dToonGradient">
        <option value="3">3级 (硬边)</option>
        <option value="5" selected>5级 (标准)</option>
        <option value="8">8级 (柔和)</option>
      </select>
    </div>
  </div>
  
  <h4 style="margin-top:16px;">光照设置</h4>
  <div class="settings-grid">
    <div class="settings-item"><label>环境光颜色</label><input id="render3dAmbientColor" type="color" value="#ffffff"></div>
    <div class="settings-item"><label>环境光强度</label><input id="render3dAmbientIntensity" type="range" min="0" max="2" step="0.1" value="0.5"></div>
    <div class="settings-item"><label>方向光颜色</label><input id="render3dDirectionalColor" type="color" value="#ffffff"></div>
    <div class="settings-item"><label>方向光强度</label><input id="render3dDirectionalIntensity" type="range" min="0" max="3" step="0.1" value="0.7"></div>
    <div class="settings-item"><label>光源位置 X</label><input id="render3dLightPosX" type="range" min="-50" max="50" value="10"></div>
    <div class="settings-item"><label>光源位置 Y</label><input id="render3dLightPosY" type="range" min="-50" max="50" value="20"></div>
    <div class="settings-item"><label>光源位置 Z</label><input id="render3dLightPosZ" type="range" min="-50" max="50" value="10"></div>
  </div>
  `
  panel.appendChild(section)
})()
