# 云端 AI 相册 (Serverless Photo Gallery)

一个基于 Cloudflare 生态（R2 + Workers + D1 + Vectorize + AI）构建的下一代 Serverless 智能个人相册系统。

它不仅是一个相册，更是一个**拥有 AI 大脑的图像管理中心**。它能看懂你的照片，支持自然语言搜索，并自动进行智能分类。

## ✨ 核心特性

### 🧠 AI 驱动的智能体验
*   **语义搜索**: 不再依赖死板的文件名或标签。你可以直接搜索 *"夕阳下的海滩"*、*"穿着红裙子的女孩"* 或 *"去年冬天的雪景"*，AI 能理解你的意图并精准找到照片。
*   **自动打标**: 上传照片时，AI (ResNet-50) 会自动识别场景和物体，并生成标签（如 `landscape`, `cat`, `food`）。
*   **智能描述**: 利用多模态大模型 (LLaVA)，系统会自动为每张照片生成一段详细的英文描述，用于增强搜索索引。
*   **多语言支持**: 搜索框内置轻量级翻译模型，支持用中文直接搜索，系统会自动翻译并匹配英文索引。

### 🏗️ 极致的 Serverless 架构
*   **全栈上云**: 
    *   **存储**: Cloudflare R2 (海量低成本存储)
    *   **计算**: Cloudflare Workers (全球边缘计算)
    *   **数据库**: Cloudflare D1 (Serverless SQL 数据库)
    *   **向量库**: Cloudflare Vectorize (存储图片特征向量)
    *   **AI 推理**: Cloudflare Workers AI (运行开源模型)
*   **零维护成本**: 无需购买服务器，利用 Cloudflare 免费额度即可运行个人规模的相册。

### 🎨 现代化用户体验
*   **沉浸式画廊**: 瀑布流布局，支持按时间线分组查看。
*   **地图模式**: 自动解析 Exif GPS 信息，在地图上展示你的足迹。
*   **安全隐私**: 
    *   **分级权限**: 管理员拥有完全控制权，访客只能查看被授权的文件夹。
    *   **安全设置**: 支持修改密码、绑定安全邮箱、发送验证码进行敏感操作验证。
    *   **数据备份**: 每周自动全量备份数据库到 R2，支持手动触发清理和重建索引。
*   **高性能**: 支持 HEIC/WebP 格式自动转码，缩略图预生成，PWA 离线访问支持。

---

## 🛠️ 技术栈

**前端:**
*   **核心框架**: React 18 + TypeScript + Vite
*   **UI 组件**: Tailwind CSS + Lucide React + Framer Motion (动画)
*   **地图组件**: Leaflet + React Leaflet
*   **状态管理**: Zustand + Context API
*   **部署平台**: Vercel / GitHub Pages / Cloudflare Pages (三端同步支持)

**后端:**
*   **运行环境**: Cloudflare Workers
*   **存储服务**: Cloudflare R2 (图片) + D1 (元数据)
*   **AI/向量**: Cloudflare Vectorize + Workers AI (@cf/baai/bge-base-en-v1.5, @cf/llava-hf/llava-1.5-7b-hf)
*   **身份验证**: JWT + MailChannels/Resend (邮件服务)

---

## 🚀 部署指南 (三端同步版)

本系统设计为**前后端分离**。后端只需部署一次（在 Cloudflare），前端可以同时部署在 Vercel、GitHub Pages 和 Cloudflare Pages，且数据完全互通。

### 1. 后端部署 (Cloudflare)

1.  **准备工作**:
    *   注册 Cloudflare 账号。
    *   安装 Wrangler: `npm install -g wrangler`。
    *   登录: `wrangler login`。

2.  **创建资源**:
    *   **R2 Bucket**: 创建名为 `photo-gallery` 的存储桶，绑定自定义域名（如 `im.yourdomain.com`）。
    *   **D1 Database**: 创建数据库 `photo-gallery-db`。
    *   **Vectorize Index**: 创建索引 `photo-index-v2` (维度 768, metric: cosine)。

3.  **配置 `wrangler.toml`**:
    *   填入你的 `database_id` 和 R2 域名配置。
    *   确保开启了 AI 绑定。

4.  **初始化数据库**:
    ```bash
    npm run deploy:worker # 首次部署会自动应用 D1 迁移
    ```

5.  **设置密钥**:
    ```bash
    wrangler secret put ADMIN_PASSWORD  # 管理员密码
    wrangler secret put JWT_SECRET      # JWT 签名密钥
    wrangler secret put RESEND_API_KEY  # (可选) 用于发送邮件验证码
    ```

### 2. 前端部署 (多平台)

无论选择哪个平台，核心只需要配置一个环境变量：`VITE_API_BASE`。

#### 方案 A: Vercel (推荐)
1.  导入 GitHub 仓库。
2.  在 Settings -> Environment Variables 添加：
    *   `VITE_API_BASE`: `https://api.yourdomain.com` (你的 Worker 地址)
3.  **注意**: 项目根目录已包含 `.vercelignore`，会自动忽略 `api/` 目录以避免 Serverless Function 限制。

#### 方案 B: Cloudflare Pages (推荐)
1.  在 Cloudflare Dashboard -> Workers & Pages -> Create Application -> Pages -> Connect to Git。
2.  选择仓库，构建设置：
    *   **框架预设 (Framework Preset)**: Vite
    *   **构建命令 (Build Command)**: `npm run build`
    *   **输出目录 (Output Directory)**: `dist`
3.  **环境变量**:
    *   添加 `VITE_API_BASE`: `https://api.yourdomain.com`
4.  点击部署。

#### 方案 C: GitHub Pages
1.  在仓库 Settings -> Pages 中选择 Source 为 `gh-pages` 分支。
2.  修改 `.github/workflows/deploy.yml` (如果使用 Action) 或手动构建：
    ```bash
    # 本地构建并推送
    export VITE_API_BASE=https://api.yourdomain.com
    npm run build
    npm run deploy # 自动推送到 gh-pages 分支
    ```

### 🔄 数据同步原理
由于所有前端部署（Vercel/CF Pages/GH Pages）都指向**同一个 Cloudflare Worker 后端**（通过 `VITE_API_BASE` 配置），因此：
*   你在 Vercel 版上传的照片，在 Cloudflare Pages 版也能立刻看到。
*   你在 GitHub Pages 版修改的设置，会同步影响所有平台。
*   **后端是唯一的数据源** (D1 + R2)，前端只是展示层。

---

## 📝 开发与维护

### 本地开发
```bash
# 1. 安装依赖
npm install

# 2. 启动前端 (默认连接生产环境 API，需在 .env 中配置 VITE_API_BASE)
npm run dev

# 3. 启动后端 (Wrangler 开发模式)
npm run dev:worker
```

### 常用管理命令
*   **重建 AI 索引**: 在设置页面点击 "重建 AI 索引"，系统会重新扫描所有照片生成向量。
*   **清理垃圾文件**: 在设置页面点击 "清理文件"，系统会扫描 R2 并删除数据库中不存在的孤儿文件。
*   **备份**: 系统每周五自动备份数据库到 R2 的 `backups/` 目录。

---

## 📄 开源协议 (License)
MIT License
