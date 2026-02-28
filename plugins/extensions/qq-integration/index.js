const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shell } = require('electron');

// Default config
let config = {
  groupId: '', // User needs to set this
  host: '127.0.0.1',
  port: 3000
};

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      console.log('[QQ Integration] Config loaded:', config);
    }
  } catch (e) {
    console.error('[QQ Integration] Failed to load config:', e);
  }
}

function saveConfig(newConfig) {
  try {
    config = { ...config, ...newConfig };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('[QQ Integration] Config saved:', config);
    return true;
  } catch (e) {
    console.error('[QQ Integration] Failed to save config:', e);
    return false;
  }
}

function sendGroupMessage(message) {
  if (!config.groupId) {
    console.warn('[QQ Integration] Group ID not configured');
    return;
  }

  const postData = JSON.stringify({
    group_id: config.groupId,
    message: message
  });

  const options = {
    hostname: config.host,
    port: config.port,
    path: '/send_group_msg',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    // Consume response
    res.on('data', () => {});
  });

  req.on('error', (e) => {
    console.error(`[QQ Integration] Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

module.exports = {
  activate: function(context) {
    const { api, log } = context;
    log('[QQ Integration] Activated');
    
    loadConfig();
    
    // Register command to install LiteLoader
    context.subscriptions.push(
      api.commands.registerCommand('qq-integration.installLiteLoader', async () => {
        const scriptPath = path.join(__dirname, 'install-liteloader.ps1');
        log('Running install script:', scriptPath);
        
        try {
            // Use 'cmd.exe /c start' to force a new visible window
            // "LiteLoader Installer" is the window title (first quoted arg)
            const args = [
                '/c', 
                'start', 
                '"LiteLoader Installer"', 
                'powershell.exe', 
                '-NoExit', 
                '-ExecutionPolicy', 'Bypass', 
                '-File', `"${scriptPath}"`
            ];
            
            const child = spawn('cmd.exe', args, {
                windowsHide: false,
                shell: true // Ensure shell execution for 'start' command
            });
            
            child.on('error', (err) => {
                console.error('[Installer Error]', err);
                log(`Installer error: ${err.message}`);
            });

            log('Installer process spawned via cmd /c start');
        } catch (e) {
            log(`Failed to spawn installer: ${e.message}`);
            throw e;
        }
      })
    );

    // Register config commands
    context.subscriptions.push(
      api.commands.registerCommand('qq-integration.getConfig', async () => {
        return config;
      })
    );

    context.subscriptions.push(
      api.commands.registerCommand('qq-integration.saveConfig', async (newConfig) => {
        return saveConfig(newConfig);
      })
    );

    // Register Page
    context.subscriptions.push(
      api.components.registerPage({
        id: 'qq-integration-settings',
        pluginId: 'qq-integration',
        title: 'QQ Integration',
        icon: '📧',
        order: 50,
        file: path.join(__dirname, 'settings.html')
      })
    );

    // Register Menu Item
    context.subscriptions.push(
      api.components.registerMenuItem({
        id: 'qq-integration-menu',
        pluginId: 'qq-integration',
        label: 'QQ Integration',
        icon: '📧',
        order: 50,
        pageId: 'qq-integration-settings',
        group: 'plugins'
      })
    );
    
    // Listen for BP events
    // PluginAPI emits events directly
    const bpEvents = ['bp:character-picked', 'bp:character-banned'];
    
    bpEvents.forEach(eventName => {
        api.on(eventName, (data) => {
            log(`Event ${eventName} received`, data);
            
            let msg = '';
            if (eventName === 'bp:character-picked') {
                msg = `[BP Pick] ${data.isHunter ? 'Hunter' : 'Survivor'} Selected: ${data.character}`;
            } else if (eventName === 'bp:character-banned') {
                msg = `[BP Ban] ${data.isHunter ? 'Hunter' : 'Survivor'} Banned: ${data.character}`;
            }
            
            if (msg) {
                sendGroupMessage(msg);
            }
        });
    });
  },
  
  deactivate: function() {
    console.log('[QQ Integration] Deactivated');
  }
};
