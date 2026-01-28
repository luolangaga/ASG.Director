function switchView(viewId) {
      document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('view-' + viewId);
      if (target) target.classList.add('active');

      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const nav = document.getElementById('nav-' + viewId);
      if (nav) nav.classList.add('active');

      // Clear plugin menu highlights
      document.querySelectorAll('.plugin-menu-item').forEach(el => el.classList.remove('active'));

      const main = document.getElementById('mainContainer');
      const plugs = document.getElementById('pluginPagesContainer');
      if (main) main.classList.remove('hidden');
      if (plugs) {
        plugs.querySelectorAll('.plugin-page-container').forEach(p => p.classList.remove('active'));
      }
    }

    function switchSettingTab(tabId, e) {
      document.querySelectorAll('[id^="setting-tab-"]').forEach(el => el.style.display = 'none');
      document.getElementById('setting-tab-' + tabId).style.display = 'block';
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      if (e && e.target) e.target.classList.add('active');
    }