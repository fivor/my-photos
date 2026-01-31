# My Photos (Serverless Photo Gallery)

一个基于 Cloudflare R2 + Workers + React 构建的现代化、高性能、Serverless 个人相册系统。

## ✨ 核心特性

*   **Serverless 架构**：后端完全运行在 Cloudflare Workers 上，无需服务器维护，成本极低。
*   **全球加速**：利用 Cloudflare R2 存储照片，配合 CDN 全球边缘缓存，加载速度飞快。
*   **现代化 UI**：基于 React + Tailwind CSS 构建，支持深色/浅色模式，响应式设计适配移动端。
*   **多格式支持**：支持 JPG, PNG, WEBP, GIF, AVIF, TIFF, BMP 等多种图片格式上传与预览。
*   **智能压缩**：前端/后端双重压缩优化，自动生成 WebP 缩略图，节省流量并提升速度。
*   **相册管理**：支持创建多级相册、拖拽上传、批量管理（移动、删除、恢复）。
*   **访客系统**：支持生成专属访客账号，可精确控制每个访客能看到的特定相册。
*   **隐私保护**：所有 API 请求均经过 JWT 鉴权，支持回收站机制防止误删。

## 🛠️ 技术栈

**前端 (Frontend):**
*   **框架**: React 18 + TypeScript + Vite
*   **样式**: Tailwind CSS + Lucide React (图标)
*   **状态管理**: Zustand
*   **路由**: React Router v7
*   **组件库**: React Photo View (灯箱), React Dropzone (上传)
*   **部署**: Vercel (推荐) / GitHub Pages / Cloudflare Pages

**后端 (Backend):**
*   **运行时**: Cloudflare Workers
*   **存储**: Cloudflare R2 (对象存储)
*   **鉴权**: JWT (JSON Web Tokens)
*   **图像处理**: @jsquash (WebAssembly 图像压缩/解码)

## 🚀 快速开始

### 1. 前置准备
*   一个 [Cloudflare](https://www.cloudflare.com/) 账号。
*   一个域名（托管在 Cloudflare 上以获得最佳体验）。
*   Node.js 环境 (v18+)。

### 2. 后端部署 (Cloudflare Workers)

1.  **安装 Wrangler CLI**:
    ```bash
    npm install -g wrangler
    ```

2.  **配置 R2 存储桶**:
    *   在 Cloudflare 后台创建一个 R2 Bucket，命名为 `photo-gallery`。
    *   在 Bucket 设置中绑定自定义域名（如 `im.example.com`），并开启 "Public Access"（或者配置 Access 策略）。
    *   **重要**: 在 Cloudflare 域名 DNS 设置中，为该图片域名配置 Page Rule: `Cache Level: Cache Everything`，以开启 CDN 缓存。

3.  **配置 Wrangler**:
    修改 `wrangler.toml`:
    ```toml
    name = "photo-gallery-worker"
    # 修改为你的图片域名
    [vars]
    R2_PUBLIC_DOMAIN = "https://im.example.com" 
    ```

4.  **设置密钥**:
    ```bash
    wrangler secret put ADMIN_PASSWORD  # 设置管理员密码
    wrangler secret put JWT_SECRET      # 设置 JWT 签名密钥（随机字符串）
    wrangler secret put VISITOR_PASSWORD # 设置全局访客密码（可选）
    ```

5.  **部署后端**:
    ```bash
    npm run deploy:worker
    ```
    记下部署后的 Worker URL（如 `https://photo-api.yourname.workers.dev`）。

### 3. 前端部署 (Vercel)

1.  **Fork 本仓库**。
2.  **在 Vercel 中导入项目**。
3.  **配置环境变量**:
    *   `VITE_API_BASE`: 填入你的 Worker URL (例如 `https://photo-api.yourname.workers.dev/api`，注意带 `/api` 后缀)。
4.  **部署并绑定域名**:
    *   部署完成后，绑定你的前端域名（如 `a.example.com`）。
    *   由于 Vercel 自带全球 CDN，建议在 `vercel.json` 中保持默认缓存策略。

## ⚙️ 环境变量说明

| 变量名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `VITE_API_BASE` | Frontend Env | 后端 API 地址，用于前端请求 |
| `R2_PUBLIC_DOMAIN` | Backend Var | R2 存储桶绑定的公开域名 |
| `ADMIN_PASSWORD` | Backend Secret | 管理员登录密码 |
| `JWT_SECRET` | Backend Secret | 用于生成 Token 的密钥 |

## 📂 目录结构

```
.
├── api/                 # Cloudflare Worker 后端代码
│   ├── index.ts        # 入口文件
│   └── utils/          # 后端工具函数 (Auth, Storage, Response)
├── src/                 # React 前端代码
│   ├── components/     # UI 组件 (Sidebar, Timeline, etc.)
│   ├── pages/          # 页面组件 (Gallery, Upload, Login)
│   ├── context/        # 全局状态上下文
│   ├── hooks/          # 自定义 Hooks
│   └── utils/          # 前端工具函数
├── vercel.json         # Vercel 部署配置
├── wrangler.toml       # Cloudflare Worker 配置
└── vite.config.ts      # Vite 构建配置
```

## 📝 开发指南

1.  **安装依赖**:
    ```bash
    npm install
    ```

2.  **本地开发**:
    ```bash
    npm run dev
    ```
    *注意：本地开发默认连接生产环境的 API（如果 `.env` 未配置本地 Mock）。*

3.  **构建**:
    ```bash
    npm run build
    ```

## 📄 License

MIT License
