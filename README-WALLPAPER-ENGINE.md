# 观鱼1 Wallpaper Engine 安装说明

本目录已经是 Wallpaper Engine Web 壁纸标准结构：`project.json` 为项目描述，`index.html` 为入口，`assets/` 与 `src/` 为本地资源和模块，运行时不依赖构建工具或网络。

1. 在 Wallpaper Engine 编辑器中选择“打开壁纸”，指向本目录。
2. 如果你的版本只有“打开离线壁纸”，选择“网页/HTML”，再选择本目录中的 `index.html`。`app.bundle.js` 已经包含全部模块，因此不能只移动 HTML，整个目录必须保留在原位。
3. `project.json` 中的 `weather` 属性可手动切换晴/雨；FPS、鱼群数量、鱼速等属性由现有属性监听器接收。
4. 启动时通过公网 IP 粗略定位并查询一次 Open-Meteo，之后每 15 分钟只查询天气代码。位置只解析一次；页面隐藏、离线或请求进行中时跳过，不影响渲染。无需定位权限；网络失败时使用晴天。Wallpaper Engine 属性面板仍可手动切换晴/雨。

点击水面、投喂和落叶都会使用同一套 Canvas/GPU 兼容涟漪；落叶会额外产生两道延迟减弱的回波。
