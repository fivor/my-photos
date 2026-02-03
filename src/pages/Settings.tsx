import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Globe, Users, Plus, Trash2, Check, Pencil, X, Shield, Layout, UserPlus, Key, Sun, Moon } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { Visitor, Folder, Metadata } from '../types';
import { useTheme } from '../hooks/useTheme';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'general' | 'visitors' | 'security'>('general');
  const [siteTitle, setSiteTitle] = useState(() => localStorage.getItem('site_title') || 'My Photo Gallery');
  const [language, setLanguage] = useState<'zh' | 'en'>(() => (localStorage.getItem('language') as 'zh' | 'en') || 'zh');
  const [favicon, setFavicon] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  
  // Security Flow State
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityStep, setSecurityStep] = useState<'idle' | 'verify_email' | 'new_password'>('idle');
  const [securityLoading, setSecurityLoading] = useState(false);
  
  const { theme, toggleTheme } = useTheme();
  
  // Visitor Management State
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newVisitor, setNewVisitor] = useState<{ name: string; password: string }>({ name: '', password: '' });
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ scanned: number, deleted: string[], kept: number } | null>(null);
  
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ processed: number, errors: number, logs?: string[] } | null>(null);

  const [message, setMessage] = useState('');

  // Define translations based on current language
  const t = {
    settings: language === 'zh' ? '设置' : 'Settings',
    general: language === 'zh' ? '通用设置' : 'General',
    visitors: language === 'zh' ? '访客设置' : 'Visitors',
    security: language === 'zh' ? '安全设置' : 'Security',
    siteTitle: language === 'zh' ? '网站标题' : 'Site Title',
    language: language === 'zh' ? '语言' : 'Language',
    adminPwd: language === 'zh' ? '新管理员密码' : 'New Admin Password',
    placeholderPwd: language === 'zh' ? '留空保持不变' : 'Leave blank to keep current',
    save: language === 'zh' ? '保存更改' : 'Save Changes',
    saving: language === 'zh' ? '保存中...' : 'Saving...',
    addVisitor: language === 'zh' ? '添加访客' : 'Add Visitor',
    updateVisitor: language === 'zh' ? '更新访客' : 'Update Visitor',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    edit: language === 'zh' ? '编辑' : 'Edit',
    visitorName: language === 'zh' ? '备注名称' : 'Name/Note',
    visitorPwd: language === 'zh' ? '访问密码' : 'Access Password',
    allowedAlbums: language === 'zh' ? '允许上传的相册' : 'Allowed Upload Albums',
    noVisitors: language === 'zh' ? '暂无访客配置' : 'No visitors configured',
    delete: language === 'zh' ? '删除' : 'Delete',
    visitorDesc: language === 'zh' ? '管理访客账户及其对特定相册的上传权限。' : 'Manage visitor accounts and their upload permissions for specific albums.',
    securityDesc: language === 'zh' ? '管理管理员密码和其他安全选项。' : 'Manage admin password and other security options.',
    generalDesc: language === 'zh' ? '配置网站的基本信息和显示偏好。' : 'Configure basic site information and display preferences.',
    cleanup: language === 'zh' ? '清理文件' : 'Cleanup Files',
    cleanupDesc: language === 'zh' ? '扫描 R2 存储并删除数据库中不存在的文件。' : 'Scan R2 storage and delete files that do not exist in the database.',
    cleanupBtn: language === 'zh' ? '开始清理' : 'Start Cleanup',
    cleaning: language === 'zh' ? '清理中...' : 'Cleaning...',
    cleaned: language === 'zh' ? '清理完成' : 'Cleanup Completed',
    cleanupResult: language === 'zh' ? '清理结果' : 'Cleanup Result',
    scanned: language === 'zh' ? '扫描文件数' : 'Scanned Files',
    deleted: language === 'zh' ? '删除文件数' : 'Deleted Files',
    kept: language === 'zh' ? '现有文件数' : 'Total Files Remaining',
    reindex: language === 'zh' ? '重建 AI 索引' : 'Rebuild AI Index',
    reindexDesc: language === 'zh' ? '重新扫描所有照片，生成向量索引和 AI 描述（针对旧照片）。' : 'Rescan all photos to generate vector embeddings and AI descriptions (for old photos).',
    reindexBtn: language === 'zh' ? '开始重建' : 'Start Rebuild',
    reindexing: language === 'zh' ? '重建中...' : 'Rebuilding...',
    reindexResult: language === 'zh' ? '重建进度' : 'Rebuild Progress',
    processed: language === 'zh' ? '已处理' : 'Processed',
    errors: language === 'zh' ? '失败' : 'Errors',
  };

  useEffect(() => {
    // Apply title
    document.title = siteTitle;
    // Apply language
    document.documentElement.lang = language;
    
    // Load from cache first
    const cachedVisitors = localStorage.getItem('cachedVisitors');
    const cachedFolders = localStorage.getItem('cachedFolders');
    if (cachedVisitors) setVisitors(JSON.parse(cachedVisitors));
    if (cachedFolders) setFolders(JSON.parse(cachedFolders));
    
    fetchData();
  }, [siteTitle, language]);

  const fetchData = async () => {
    try {
      const data: Metadata = await apiRequest('/data');
      if (data.config) {
          if (data.config.siteTitle) setSiteTitle(data.config.siteTitle);
      }
      if (data.visitors) {
          setVisitors(data.visitors);
          localStorage.setItem('cachedVisitors', JSON.stringify(data.visitors));
      }
      if (data.folders) {
          setFolders(data.folders);
          localStorage.setItem('cachedFolders', JSON.stringify(data.folders));
      }
    } catch (e) {
      console.error('Failed to load settings data', e);
    }
  };

  const handleBindEmail = async () => {
    if (!inputEmail || !inputEmail.includes('@')) {
        alert('请输入有效的邮箱地址');
        return;
    }
    
    try {
        setSecurityLoading(true);
        // 1. User enters email (inputEmail)
        // 2. User clicks "Send Code"
        // 3. Backend checks if inputEmail matches stored email.
        
        alert('请先点击发送验证码进行验证');
    } catch (e) {
        alert('操作失败');
    } finally {
        setSecurityLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!inputEmail) {
        alert('请输入绑定的管理员邮箱');
        return;
    }
    
    try {
        setSecurityLoading(true);
        const res = await apiRequest<{ success?: boolean, error?: string, debug_code?: string, debug?: any }>('/auth/send-code', {
            method: 'POST',
            body: JSON.stringify({ email: inputEmail })
        });
        
        if (res.success === false) {
             console.log('Debug Info:', res.debug);
             
             // Check if we have a fallback code (Email failed)
             if (res.debug_code) {
                 // Prompt user with the code directly since email failed
                 alert(`邮件发送失败 (${res.error})。\n\n为了不影响使用，系统已生成临时验证码：\n\n${res.debug_code}\n\n请复制此验证码继续操作。`);
                 setSecurityStep('verify_email');
                 return;
             }

             alert(`验证失败: 请确认输入的邮箱是当前绑定的管理员邮箱。\n(Debug: Stored=${res.debug?.stored}, Received=${res.debug?.received})`);
             return;
        }
        
        if (res.debug_code) {
            alert('验证码已发送，请查收邮件');
        } else {
            alert('验证码已发送，请查收邮件');
        }
        setSecurityStep('verify_email');
    } catch (e: any) {
        console.error('Send Code Error:', e);
        alert(`发送失败: ${e.message || '未知错误'}`);
    } finally {
        setSecurityLoading(false);
    }
  };

  const handleVerifyAndAction = async (action: 'update_email' | 'change_password') => {
    if (!verificationCode) {
        alert('请输入验证码');
        return;
    }
    
    if (action === 'change_password' && !adminPassword) {
        alert('请输入新密码');
        return;
    }

    if (action === 'update_email' && (!inputEmail || !inputEmail.includes('@'))) {
         alert('请输入有效的邮箱');
         return;
    }
    
    try {
        setSecurityLoading(true);
        
        if (action === 'change_password') {
            await apiRequest('/auth/verify-and-change-password', {
                method: 'POST',
                body: JSON.stringify({ 
                    email: inputEmail,
                    code: verificationCode,
                    newPassword: adminPassword 
                })
            });
            alert('密码修改成功，请重新登录');
            localStorage.removeItem('token');
            navigate('/login');
        } else {
            // Update Email
            // Security-wise, the code must be verified server-side AT THE MOMENT of action.
            
            // Let's implement: Verify Code -> If Success -> Allow changing password OR binding new email.
            
            const verifyRes = await apiRequest<{ valid: boolean }>('/auth/verify-code', {
                 method: 'POST',
                 body: JSON.stringify({ email: inputEmail, code: verificationCode })
            });
            
            if (verifyRes.valid) {
                 // Code is valid. Now perform action.
                 if (action === 'update_email') {
                     // Since inputEmail is the OLD email (used for verification), 
                     // we now need the NEW email.
                     const newEmail = prompt("验证通过。请输入新的管理员邮箱：");
                     if (newEmail && newEmail.includes('@')) {
                         await apiRequest('/auth/bind-email', {
                             method: 'POST',
                             body: JSON.stringify({ email: newEmail })
                         });
                         alert('邮箱更新成功');
                         setInputEmail(newEmail); // Update display
                         setSecurityStep('idle');
                         setVerificationCode('');
                     }
                 }
            } else {
                alert('验证码错误');
            }
        }
    } catch (e: any) {
        alert(`操作失败: ${e.message || '验证失败'}`);
    } finally {
        setSecurityLoading(false);
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFavicon(file);
      setFaviconPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveVisitor = async () => {
    if (!newVisitor.password) {
      alert(language === 'zh' ? '请输入密码' : 'Password is required');
      return;
    }

    try {
      if (editingVisitorId) {
        // Update existing visitor
        const visitorToUpdate = visitors.find(v => v.id === editingVisitorId);
        if (!visitorToUpdate) return;
        
        const updatedVisitor: Visitor = {
          ...visitorToUpdate,
          name: newVisitor.name || visitorToUpdate.name,
          password: newVisitor.password
        };

        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({ action: 'update_visitor', data: updatedVisitor })
        });
        
        setVisitors(visitors.map(v => v.id === editingVisitorId ? updatedVisitor : v));
      } else {
        // Add new visitor
        const visitor: Visitor = {
          id: crypto.randomUUID(),
          name: newVisitor.name || `Visitor ${visitors.length + 1}`,
          password: newVisitor.password,
          allowedFolders: []
        };
        
        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({ action: 'add_visitor', data: visitor })
        });
        setVisitors([...visitors, visitor]);
      }
      
      // Reset form
      setNewVisitor({ name: '', password: '' });
      setEditingVisitorId(null);
    } catch (e) {
      alert(language === 'zh' ? '操作失败' : 'Operation failed');
    }
  };
  
  const startEdit = (visitor: Visitor) => {
    setEditingVisitorId(visitor.id);
    setNewVisitor({ name: visitor.name, password: visitor.password });
  };
  
  const cancelEdit = () => {
    setEditingVisitorId(null);
    setNewVisitor({ name: '', password: '' });
  };

  const handleUpdateVisitor = async (id: string, updates: Partial<Visitor>) => {
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_visitor', data: { id, ...updates } })
      });
    } catch (e) {
      console.error('Failed to update visitor', e);
      throw e; 
    }
  };

  const handleDeleteVisitor = async (id: string) => {
    if (!confirm(language === 'zh' ? '确定要删除该访客吗？' : 'Are you sure you want to delete this visitor?')) return;
    
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_visitor', data: { id } })
      });
      setVisitors(visitors.filter(v => v.id !== id));
    } catch (e) {
      alert(language === 'zh' ? '删除失败' : 'Failed to delete');
    }
  };

  const toggleFolderPermission = (visitorId: string, folderId: string, currentAllowed: string[]) => {
    const newAllowed = currentAllowed.includes(folderId)
      ? currentAllowed.filter(id => id !== folderId)
      : [...currentAllowed, folderId];
    
    // Optimistic update locally first
    setVisitors(visitors.map(v => 
      v.id === visitorId 
        ? { ...v, allowedFolders: newAllowed } 
        : v
    ));

    // Then trigger API call in background
    handleUpdateVisitor(visitorId, { allowedFolders: newAllowed }).catch(() => {
       alert(language === 'zh' ? '更新权限失败' : 'Failed to update permission');
    });
  };

  const handleCleanup = async () => {
    if (cleanupResult) {
       // If already cleaned, maybe confirm to clean again?
       // Or just reset?
       // For now, allow cleaning again.
    }
    
    if (!confirm(language === 'zh' ? '确定要开始清理文件吗？这可能需要一些时间。' : 'Are you sure you want to start cleaning up files? This may take some time.')) return;
    
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await apiRequest<{ deleted: string[], scanned: number, kept: number }>('/admin/cleanup', {
        method: 'POST'
      });
      setCleanupResult(res);
      alert(language === 'zh' ? '清理完成！' : 'Cleanup completed!');
    } catch (e) {
      console.error(e);
      alert(language === 'zh' ? '清理失败' : 'Cleanup failed');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleReindex = async () => {
     if (!confirm(language === 'zh' ? '确定要重建 AI 索引吗？这将扫描所有照片并重新生成向量和标签。这可能需要很长时间。' : 'Are you sure you want to rebuild AI index? This will scan all photos. It may take a long time.')) return;
     
     setReindexLoading(true);
     setReindexResult({ processed: 0, errors: 0 });
     
     try {
        let offset = 0;
        let hasMore = true;
        let totalProcessed = 0;
        let totalErrors = 0;
        const limit = 5; // Small batch to avoid timeout
        
        while (hasMore) {
           const res = await apiRequest<{ processed: number, errors: number, hasMore: boolean, logs?: string[] }>('/admin/reindex', {
              method: 'POST',
              body: JSON.stringify({ limit, offset })
           });
           
           totalProcessed += res.processed;
           totalErrors += res.errors;
           hasMore = res.hasMore;
           offset += limit;
           
           setReindexResult({ 
               processed: totalProcessed, 
               errors: totalErrors,
               logs: res.logs 
           });
           
           if (res.processed === 0 && hasMore) {
               // Safety break
               break;
           }
        }
        
        alert(language === 'zh' ? '索引重建完成！' : 'Index rebuild completed!');
     } catch (e) {
        console.error(e);
        alert(language === 'zh' ? '索引重建中断' : 'Reindex interrupted');
     } finally {
        setReindexLoading(false);
     }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let faviconUrl = faviconPreview;

      // Upload favicon if changed
       if (favicon) {
         const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string, publicUrl: string }>('/upload-url', {
           method: 'POST',
           body: JSON.stringify({
             filename: `favicon-${Date.now()}-${favicon.name}`,
             folder: 'config'
           })
         });
         
         await fetch(uploadUrl, { method: 'PUT', body: favicon });
         faviconUrl = publicUrl;
       }
 
       // Save config to backend
      await apiRequest('/data', { 
        method: 'POST',
        body: JSON.stringify({
          action: 'update_config', 
          data: { 
            siteTitle, 
            favicon: faviconUrl 
          } 
        })
      });
      
      // Save local settings
      localStorage.setItem('site_title', siteTitle);
      localStorage.setItem('language', language);

      // Update favicon immediately
      if (faviconUrl) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      
      setMessage(language === 'zh' ? '设置保存成功' : 'Settings saved successfully');
    } catch (e) {
      console.error(e);
      setMessage(language === 'zh' ? '保存失败' : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      <nav className="border-b border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/gallery" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">{t.settings}</h1>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        {/* Left Sidebar for Settings Navigation */}
        <aside className="w-full md:w-64 space-y-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Globe size={18} />
            {t.general}
          </button>
          <button
            onClick={() => setActiveTab('visitors')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'visitors' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Users size={18} />
            {t.visitors}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Shield size={18} />
            {t.security}
          </button>
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[500px]">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold mb-1">{t.general}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.generalDesc}</p>
                </div>
                
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.siteTitle}</label>
                    <input
                      type="text"
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.language}</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'zh' | 'en')}
                      className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="zh">中文 (Chinese)</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Visitor Settings */}
            {activeTab === 'visitors' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold mb-1">{t.visitors}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.visitorDesc}</p>
                </div>

                {/* Add/Edit Form */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border border-gray-200 dark:border-gray-700/50">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    {editingVisitorId ? <Pencil size={16} /> : <UserPlus size={16} />}
                    {editingVisitorId ? t.updateVisitor : t.addVisitor}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newVisitor.name}
                        onChange={(e) => setNewVisitor({...newVisitor, name: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder={t.visitorName}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newVisitor.password}
                        onChange={(e) => setNewVisitor({...newVisitor, password: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder={t.visitorPwd}
                      />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {editingVisitorId && (
                        <button 
                          type="button"
                          onClick={cancelEdit}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          {t.cancel}
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={handleSaveVisitor}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {editingVisitorId ? t.save : t.addVisitor}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visitor List Table */}
                <div className="space-y-3">
                  {visitors.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                      <p className="text-gray-500 dark:text-gray-400">{t.noVisitors}</p>
                    </div>
                  ) : (
                    visitors.map((visitor) => (
                      <div key={visitor.id} className={`group bg-white dark:bg-gray-800 border rounded-lg overflow-hidden transition-all ${editingVisitorId === visitor.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        {/* Visitor Header */}
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center border-b border-gray-100 dark:border-gray-700/50">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">{visitor.name}</div>
                              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
                              <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                                <Key size={10} /> {visitor.password}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              type="button"
                              onClick={() => startEdit(visitor)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title={t.edit}
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteVisitor(visitor.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title={t.delete}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Permissions */}
                        <div className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {folders.map(folder => {
                              const isAllowed = (visitor.allowedFolders || []).includes(folder.id);
                              return (
                                <button
                                  key={folder.id}
                                  type="button"
                                  onClick={() => toggleFolderPermission(visitor.id, folder.id, visitor.allowedFolders || [])}
                                  className={`
                                    text-xs px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5
                                    ${isAllowed 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                                      : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
                                  `}
                                >
                                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isAllowed ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                                    {isAllowed && <Check size={8} className="text-white" />}
                                  </div>
                                  {folder.name}
                                </button>
                              );
                            })}
                            {folders.length === 0 && (
                                <span className="text-xs text-gray-400 italic">No albums available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold mb-1">{t.security}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.securityDesc}</p>
                </div>

                {/* Email Binding */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">账户绑定</h3>
                    <div className="space-y-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              管理员邮箱
                            </label>
                            <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={inputEmail}
                                  onChange={(e) => setInputEmail(e.target.value)}
                                  placeholder="请输入已绑定的管理员邮箱"
                                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Change & Email Update */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">安全操作</h3>
                    
                    {securityStep === 'idle' && (
                        <button
                          type="button"
                          onClick={handleSendCode}
                          disabled={securityLoading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Key size={16} />
                          发送验证码
                        </button>
                    )}

                    {securityStep === 'verify_email' && (
                        <div className="space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-w-lg animate-fade-in">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  验证码
                                </label>
                                <input
                                  type="text"
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value)}
                                  placeholder="输入邮件收到的验证码"
                                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                />
                             </div>
                             
                             <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                 <h4 className="text-sm font-semibold mb-2">选择操作：</h4>
                                 
                                 {/* Option 1: Change Password */}
                                 <div className="mb-4">
                                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                       设置新密码
                                     </label>
                                     <div className="flex gap-2">
                                         <input
                                           type="password"
                                           value={adminPassword}
                                           onChange={(e) => setAdminPassword(e.target.value)}
                                           placeholder="新密码 (留空则不修改)"
                                           className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                         />
                                         <button
                                           type="button"
                                           onClick={() => handleVerifyAndAction('change_password')}
                                           disabled={securityLoading || !adminPassword}
                                           className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                         >
                                           修改密码
                                         </button>
                                     </div>
                                 </div>

                                 {/* Option 2: Update Email */}
                                 <div>
                                     <button
                                       type="button"
                                       onClick={() => handleVerifyAndAction('update_email')}
                                       disabled={securityLoading}
                                       className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                     >
                                       验证通过后更换绑定邮箱 &rarr;
                                     </button>
                                 </div>
                             </div>

                             <div className="flex gap-2 pt-2">
                                 <button
                                   type="button"
                                   onClick={() => setSecurityStep('idle')}
                                   className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                 >
                                   取消
                                 </button>
                             </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                   <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{t.cleanup}</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.cleanupDesc}</p>
                   
                   <button
                     type="button"
                     onClick={handleCleanup}
                     disabled={cleanupLoading}
                     className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${cleanupResult ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                   >
                      {cleanupLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : cleanupResult ? <Check size={16} /> : <Trash2 size={16} />}
                      {cleanupLoading ? t.cleaning : cleanupResult ? t.cleaned : t.cleanupBtn}
                   </button>
                   
                   {cleanupResult && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-sm mb-2">{t.cleanupResult}</h4>
                        <div className="text-sm space-y-1">
                           <div className="flex justify-between">
                              <span className="text-gray-500">{t.scanned}:</span>
                              <span className="font-mono">{cleanupResult.scanned}</span>
                           </div>
                           <div className="flex justify-between text-green-600 dark:text-green-400">
                              <span>{t.kept}:</span>
                              <span className="font-mono">{cleanupResult.kept}</span>
                           </div>
                           <div className="flex justify-between text-red-600 dark:text-red-400">
                              <span>{t.deleted}:</span>
                              <span className="font-mono">{cleanupResult.deleted.length}</span>
                           </div>
                           {cleanupResult.deleted.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                 <p className="text-xs text-gray-500 mb-1">Deleted files:</p>
                                 <div className="max-h-24 overflow-y-auto text-xs font-mono text-gray-500 bg-white dark:bg-gray-800 p-2 rounded">
                                    {cleanupResult.deleted.map(k => <div key={k}>{k}</div>)}
                                 </div>
                              </div>
                           )}
                        </div>
                      </div>
                   )}
                </div>

                {/* AI Reindex Section */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                   <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{t.reindex}</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.reindexDesc}</p>
                   
                   <button
                     type="button"
                     onClick={handleReindex}
                     disabled={reindexLoading}
                     className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white`}
                   >
                      {reindexLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <Layout size={16} />}
                      {reindexLoading ? t.reindexing : t.reindexBtn}
                   </button>
                   
                   {reindexResult && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-sm mb-2">{t.reindexResult}</h4>
                        <div className="text-sm space-y-1">
                           <div className="flex justify-between text-green-600 dark:text-green-400">
                              <span>{t.processed}:</span>
                              <span className="font-mono">{reindexResult.processed}</span>
                           </div>
                           {reindexResult.errors > 0 && (
                               <div className="flex justify-between text-red-600 dark:text-red-400">
                                  <span>{t.errors}:</span>
                                  <span className="font-mono">{reindexResult.errors}</span>
                               </div>
                           )}
                           
                           {reindexResult.logs && reindexResult.logs.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs font-semibold mb-1 text-gray-500">Last Batch Logs:</p>
                                <div className="bg-black text-white p-2 rounded text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                                   {reindexResult.logs.join('\n')}
                                </div>
                              </div>
                           )}
                        </div>
                      </div>
                   )}
                </div>
              </div>
            )}

            {/* Save Button (Fixed Bottom Right or Inline) */}
            {activeTab === 'general' && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? t.saving : (
                    <>
                      <Save size={18} /> {t.save}
                    </>
                  )}
                </button>
              </div>
            )}
            
            {message && (
              <div className={`p-4 rounded-lg text-center text-sm ${message.includes('Success') || message.includes('成功') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'}`}>
                {message}
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}