
import os
import shutil

# Paths
base_dir = r"c:\Users\luolan\ASG\ASG.Director\pages"
js_dir = os.path.join(base_dir, "js")
html_path = os.path.join(base_dir, "frontend.html")
frontend_main_js = os.path.join(js_dir, "frontend-main.js")
frontend_3d_inject_js = os.path.join(js_dir, "frontend-3d-inject.js")

# 1. Fix JS Files
# Check if frontend-3d-inject.js exists and looks like the main script (large size)
if os.path.exists(frontend_3d_inject_js):
    size = os.path.getsize(frontend_3d_inject_js)
    if size > 5000: # It's 140KB, so this is safe
        print(f"Moving frontend-3d-inject.js ({size} bytes) to frontend-main.js")
        # Rename/Overwrite
        if os.path.exists(frontend_main_js):
            os.remove(frontend_main_js)
        os.rename(frontend_3d_inject_js, frontend_main_js)

# Create the ACTUAL 3D inject script
inject_code = r"""
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
"""
with open(frontend_3d_inject_js, 'w', encoding='utf-8') as f:
    f.write(inject_code)
print("Created frontend-3d-inject.js")


# 2. Fix HTML
with open(html_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Clean up broken script tag
new_lines = []
for line in lines:
    if 'ontend-main.js"></script>' in line:
        continue # Skip corrupt line
    if '<script src="./js/sig' in line and 'frontend-3d-inject.js' in line:
        continue # Skip truncated last line
    new_lines.append(line)

# Remove the second font modal and everything after (the truncated end)
# We look for "onclick="if(event.target===this) closeFontSelector()""
cut_index = -1
for i, line in enumerate(new_lines):
    if 'onclick="if(event.target===this) closeFontSelector()"' in line:
        cut_index = i
        break

if cut_index != -1:
    print(f"Truncating HTML at line {cut_index} (removing duplicate duplicate modal)")
    new_lines = new_lines[:cut_index]
else:
    # If not found inside lines (maybe it was in the truncated part?), try to find the Global Ban Hunter end
    for i, line in enumerate(new_lines):
        if 'id="globalBanHunters"' in line:
            # Found start, look for closing div
            # roughly 10 lines down
            cut_index = i + 12 # Approximation
            print(f"Truncating HTML after globalBanHunters at line {cut_index}")
            new_lines = new_lines[:cut_index]
            break

# Ensure we end with a newline
if new_lines and not new_lines[-1].endswith('\n'):
    new_lines[-1] += '\n'

# Append Footer
footer = """
  <!-- 坐标显示 -->
  <div id="coordDisplay">X: 0 | Y: 0</div>
  <div id="snapLineV" class="snap-line snap-line-v"></div>
  <div id="snapLineH" class="snap-line snap-line-h"></div>

  <!-- Scripts -->
  <script src="./js/signalr.min.js"></script>
  <script src="./js/frontend-main.js"></script>
  <script src="./js/frontend-3d-inject.js"></script>
  <script src="./js/frontend-onboarding.js"></script>
</body>
</html>
"""

new_content = "".join(new_lines) + footer

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Restored frontend.html")
