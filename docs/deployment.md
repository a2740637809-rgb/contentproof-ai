# 静态演示部署

公开站点只部署 `frontend` 的演示模式，不连接访客设备或保存敏感内容。

```bash
cd frontend
npm ci
npm test
npm run build
npm run test:e2e
```

GitHub Actions 将 `frontend/dist` 发布到 GitHub Pages。完整本地版本仍需按 README 启动 FastAPI、SQLite 与 Ollama。
