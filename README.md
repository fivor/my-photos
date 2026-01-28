# Cloudflare R2 个人相册

一个基于 React、Cloudflare Workers 和 R2 存储构建的无服务器（Serverless）照片管理网站。

## 功能特性

- **照片管理**：支持拖拽上传照片，通过相册/文件夹进行分类管理。
- **时间线视图**：通过精美的时间线界面，按日期倒序浏览照片。
- **日历导航**：使用月视图日历快速跳转到特定日期。
- **照片查看器**：集成的图片查看器，支持缩放、旋转和全屏浏览。
- **双重访问控制**：
  - **访客模式**：使用共享密码登录，仅拥有查看权限。
  - **管理员模式**：拥有完全权限，可进行上传、编辑和系统设置。
- **无服务器架构**：由 Cloudflare Workers 和 R2 驱动，低成本且高性能。

## 准备工作

- **Node.js**：版本 16 或更高。
- **Cloudflare 账户**：用于 R2 存储和 Workers 服务。
- **Wrangler CLI**：通过 `npm install -g wrangler` 安装。

## 安装指南

### 1. 后端设置 (Cloudflare)

1.  **登录 Cloudflare**：
    ```bash
    wrangler login
    ```

2.  **创建 R2 存储桶**：
    - 前往 Cloudflare 控制台 > R2。
    - 创建一个名为 `photo-gallery` 的存储桶（或者在 `wrangler.toml` 中修改为你自己的名称）。
    - **重要**：允许该存储桶的公开访问，或者为其配置自定义域名以提供图片访问服务。

3.  **部署 Worker**：
    ```bash
    npm run deploy:worker
    ```
    *(注意：请确保 `package.json` 的 scripts 中包含 `"deploy:worker": "wrangler deploy"`)*

4.  **设置密钥 (Secrets)**：
    设置你的管理员密码、访客密码和 JWT 密钥：
    ```bash
    wrangler secret put ADMIN_PASSWORD
    wrangler secret put VISITOR_PASSWORD
    wrangler secret put JWT_SECRET
    ```

### 2. 前端设置

1.  **安装依赖**：
    ```bash
    npm install
    ```

2.  **配置 API 地址**：
    - 如果你将前端托管在 GitHub Pages，后端托管在 Cloudflare Workers：
    - 打开 `src/utils/api.ts`。
    - 将 `API_BASE` 修改为你 Worker 的实际 URL（例如 `https://photo-gallery-worker.your-name.workers.dev`）。

3.  **本地开发**：
    ```bash
    npm run dev
    ```

### 3. 部署到 GitHub Pages

1.  **更新 `vite.config.ts`**：
    将 base URL 设置为你的仓库名称：
    ```typescript
    export default defineConfig({
      base: '/your-repo-name/', // 将此处修改为你的仓库名，例如 '/my-photos/'
      // ...
    })
    ```

2.  **构建项目**：
    ```bash
    npm run build
    ```

3.  **部署**：
    - 将生成的 `dist` 文件夹内容推送到 `gh-pages` 分支。
    - 或者使用 GitHub Action 在推送时自动部署。

## 使用说明

1.  **初始化设置**：
    - 访问你部署好的网站。
    - 使用你在 Cloudflare secrets 中设置的 **管理员密码 (Admin Password)** 登录。
    - 进入 **上传 (Upload)** 页面。

2.  **上传照片**：
    - 创建一个新的相册（文件夹）。
    - 拖拽照片到上传区域。
    - 如果需要，可以编辑照片的描述和日期。
    - 点击“开始上传”。

3.  **分享**：
    - 将网站链接和 **访客密码 (Visitor Password)** 分享给朋友或家人。
    - 他们可以浏览时间线和日历，但无法上传或编辑照片。

## 项目结构

- `src/`: 前端 React 代码。
  - `components/`: UI 组件（时间线、日历等）。
  - `pages/`: 页面视图（画廊、上传、设置、登录）。
  - `context/`: 认证状态管理。
  - `utils/`: API 和辅助函数。
- `api/`: Cloudflare Worker 代码（后端）。
  - `index.ts`: 主要 API 入口。
  - `utils/`: 认证和存储逻辑。

## 技术栈

- **前端**: React, TypeScript, Tailwind CSS, Vite.
- **后端**: Cloudflare Workers.
- **存储**: Cloudflare R2 (对象存储).
- **核心库**: `react-photo-view`, `date-fns`, `react-dropzone`, `lucide-react`.

## 许可证

MIT
