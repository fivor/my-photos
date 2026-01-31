# Photo — Cloudflare R2 个人相册

一个基于 React + TypeScript 的单页应用，配套 Cloudflare Workers 和 R2 的无服务器照片管理系统。适合作为个人相册、家庭相册或小型图片展示站点。

## 亮点

- 支持拖拽与批量上传、相册/文件夹管理。
- 时间线和日历视图，按日期组织照片并快速跳转。
- 简洁的图片查看器，支持放大/全屏展示。
- 双重访问控制：管理员（上传/管理）和访客（只读）。
- 无服务器架构：使用 Cloudflare Workers 做 API 与上传代理，使用 R2 存储图片。

## 技术栈

- 前端：React, TypeScript, Vite, Tailwind CSS
- 后端：Cloudflare Workers (TypeScript)
- 存储：Cloudflare R2
- 常用库：`react-photo-view`, `react-dropzone`, `date-fns`, `lucide-react`, `zustand`

## 快速开始（本地开发）

1. 安装依赖：

```bash
npm install
```

2. 运行开发服务器：

```bash
npm run dev
```

3. 在 `src/utils/api.ts` 中确认 `API_BASE`（指向你的 Worker URL，开发模式下可为相对路径）。

## Cloudflare 部署（Worker + R2）

1. 登录 Wrangler：

```bash
wrangler login
```

2. 在 Cloudflare 仪表盘创建一个 R2 Bucket（例如 `photo-gallery`），并在 `wrangler.toml` 中绑定为 `BUCKET`。

3. 设置密钥（不要提交到仓库）：

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put VISITOR_PASSWORD
wrangler secret put JWT_SECRET
```

4. 部署 Worker：

```bash
npm run deploy:worker
```

注意：`API` 路径默认在 Worker 下挂载为 `/api/*`。如果你使用自定义域或提供了一个 `R2_PUBLIC_DOMAIN`，请在 Worker 的 `env` 配置或 Cloudflare 中设置对应变量。

## 构建与 GitHub Pages 部署

1. 构建静态文件：

```bash
npm run build
```

2. 使用 `gh-pages` 将 `dist` 发布到 `gh-pages` 分支，或通过你自己的静态托管服务部署。

## 项目目录（简要）

- `src/` — 前端代码
  - `components/` — UI 组件（时间线、日历、查看器）
  - `pages/` — 页面（`Gallery`, `Upload`, `Settings`, `Login`）
  - `context/` — `AuthContext`, `ConfigContext`
  - `utils/` — `api.ts`, `image.ts` 等
- `api/` — Cloudflare Worker 代码（`index.ts` 为主入口，包含认证、数据与上传代理）

## 主要 API 端点（Worker）

- `POST /api/auth/login` — 登录，返回 JWT（管理员或访客，基于 secrets 验证密码）
- `GET /api/public-config` — 获取公开的站点配置（站点标题、favicon）
- `GET /api/data` — 获取元数据（photos、folders、config），需要授权
- `POST /api/data` — 管理数据（上传后更新、移动、删除、更新配置），仅限管理员
- `POST /api/upload-url` — 生成上传用的临时信息（Worker 返回代理上载地址与 key）
- `PUT /api/upload-file?key=...` — Worker 接收上传流并写入 R2（由前端直接 PUT）
- `GET /api/proxy-image?url=...` — 简单的图片代理，用于跨域或 HEIC 预览

## 上传流程（概述）

1. 前端请求 `POST /api/upload-url` 并获得 `uploadUrl`（本项目用 Worker 作为上传代理）。
2. 前端对 `uploadUrl` 发起 `PUT`，将图片流上传到 `/api/upload-file?key=...`。
3. Worker 将数据写入 R2（`env.BUCKET.put(key, body, { httpMetadata })`）。
4. 上传成功后，前端会通过 `POST /api/data`（`update_photos`）将元数据写入 Worker 管理的 metadata 存储。

## 安全与注意事项

- 不要将任何 secrets（管理员密码、JWT_SECRET、wrangler.toml 中敏感字段）提交到仓库。
- 使用 `wrangler secret put` 管理运行时密钥。
- 若需要公开访问图片，请确保 R2 或 CDN 的访问策略配置正确，以免意外泄露未授权资源。

## 本地测试建议

- 在开发时可以直接用 `npm run dev` 运行前端，Worker 端可以使用 `wrangler dev` 做本地测试代理。

## 贡献

欢迎提交 issue 或 PR。请确保不包含敏感信息。

## 许可证

MIT
