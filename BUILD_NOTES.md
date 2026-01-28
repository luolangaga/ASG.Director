Electron 构建注意事项

当 `electron-builder` 在打包时需要从 GitHub 下载 Electron 发行版，如果你的网络环境不能直接访问 GitHub，会导致类似

  "dial tcp ... connectex: A connection attempt failed ..."

的错误。

解决办法：

1) 使用国内镜像（推荐）

- 通过设置环境变量使用镜像（仅在需要下载 electron 时）：

  Windows Powershell:

  ```powershell
  $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron"
  npm install
  npm run build
  ```

  或者使用我们在 `package.json` 中加入的脚本（需要安装 `cross-env`）：

  ```powershell
  npm run postinstall:mirror
  npm run build
  ```

2) 手动下载并放置 Electron 二进制（离线）

- 从可用的网络环境下载对应版本的 Electron zip，例如：
  https://npmmirror.com/mirrors/electron/v28.3.3/

- 将解压后的内容放入 `node_modules/electron/dist`（替换或覆盖现有内容）。

3) 使用代理

- 配置 `HTTP(S)_PROXY` 或 `npm` 的 `proxy` / `https-proxy` 配置，确保下载请求能通过代理访问外网。

如果需要，我可以：

- 帮你设置 `cross-env` 并更新 `package.json` scripts（我注意到当前项目未安装 `cross-env`）。
- 尝试在当前环境运行 `npm run build` 并收集完整的日志。