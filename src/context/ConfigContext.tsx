import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

type Language = 'en' | 'zh';

interface ConfigContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  siteTitle: string;
  setSiteTitle: (title: string) => void;
  t: (key: string) => string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    'login.title': 'Enter Password',
    'login.visitor': 'Visitor Access',
    'login.admin': 'Admin Access',
    'login.button': 'Login',
    'login.error': 'Invalid password',
    'gallery.title': 'Photo Gallery',
    'gallery.upload': 'Upload',
    'gallery.settings': 'Settings',
    'gallery.logout': 'Logout',
    'gallery.albums': 'Albums',
    'gallery.noPhotos': 'No photos found. Upload some photos to get started!',
    'gallery.heicPreview': 'HEIC Preview not supported',
    'gallery.failedLoad': 'Failed to load',
    'upload.title': 'Upload Photos',
    'upload.targetAlbum': 'Target Album',
    'upload.selectAlbum': 'Select an album',
    'upload.createAlbum': 'Create new album',
    'upload.albumName': 'Album name',
    'upload.create': 'Create',
    'upload.cancel': 'Cancel',
    'upload.dragDrop': 'Drag & drop photos here, or click to select files',
    'upload.selected': 'Selected Photos',
    'upload.noSelected': 'No photos selected',
    'upload.uploaded': 'Uploaded',
    'upload.error': 'Error',
    'upload.dateTaken': 'Date Taken',
    'upload.description': 'Description',
    'upload.startUpload': 'Start Upload',
    'upload.uploading': 'Uploading...',
    'settings.title': 'Settings',
    'settings.general': 'General Settings',
    'settings.siteTitle': 'Site Title',
    'settings.language': 'Language',
    'settings.siteIcon': 'Site Icon',
    'settings.uploadIcon': 'Upload Icon',
    'settings.security': 'Security',
    'settings.securityNote': 'Note: Updating passwords will require re-login for all users.',
    'settings.visitorPwd': 'New Visitor Password',
    'settings.adminPwd': 'New Admin Password',
    'settings.placeholderPwd': 'Leave blank to keep current',
    'settings.save': 'Save Changes',
    'settings.saving': 'Saving...',
    'settings.success': 'Settings saved successfully',
    'settings.fail': 'Failed to save settings',
    'trash.title': 'Trash',
    'trash.itemsDeleted': 'Items are permanently deleted after 30 days',
    'trash.daysLeft': 'days left',
    'trash.restore': 'Restore',
    'trash.delete': 'Delete',
    'trash.empty': 'Empty Trash',
    'trash.emptyState': 'Trash is empty',
    'trash.cancel': 'Cancel',
    'trash.select': 'Select',
    'trash.confirmDelete': 'Are you sure you want to permanently delete this photo? This action cannot be undone!',
    'trash.confirmEmpty': 'Are you sure you want to empty trash? All photos will be lost!',
    'trash.confirmBatchDelete': 'Are you sure you want to permanently delete selected photos?',
    'trash.failedRestore': 'Failed to restore photo',
    'trash.failedDelete': 'Failed to delete photo',
    'trash.failedEmpty': 'Failed to empty trash',
  },
  zh: {
    'login.title': '输入密码',
    'login.visitor': '访客访问',
    'login.admin': '管理员访问',
    'login.button': '登录',
    'login.error': '密码错误',
    'gallery.title': '照片库',
    'gallery.upload': '上传',
    'gallery.settings': '设置',
    'gallery.logout': '退出',
    'gallery.albums': '相册',
    'gallery.noPhotos': '没有照片。上传一些照片开始吧！',
    'gallery.heicPreview': '暂不支持 HEIC 预览',
    'gallery.failedLoad': '加载失败',
    'upload.title': '上传照片',
    'upload.targetAlbum': '目标相册',
    'upload.selectAlbum': '选择相册',
    'upload.createAlbum': '新建相册',
    'upload.albumName': '相册名称',
    'upload.create': '创建',
    'upload.cancel': '取消',
    'upload.dragDrop': '拖放照片到这里，或点击选择文件',
    'upload.selected': '已选照片',
    'upload.noSelected': '未选择照片',
    'upload.uploaded': '已上传',
    'upload.error': '错误',
    'upload.dateTaken': '拍摄日期',
    'upload.description': '描述',
    'upload.startUpload': '开始上传',
    'upload.uploading': '上传中...',
    'settings.title': '设置',
    'settings.general': '通用设置',
    'settings.siteTitle': '网站标题',
    'settings.language': '语言',
    'settings.siteIcon': '网站图标',
    'settings.uploadIcon': '上传图标',
    'settings.security': '安全设置',
    'settings.securityNote': '注意：修改密码将需要所有用户重新登录。',
    'settings.visitorPwd': '新访客密码',
    'settings.adminPwd': '新管理员密码',
    'settings.placeholderPwd': '留空保持不变',
    'settings.save': '保存更改',
    'settings.saving': '保存中...',
    'settings.success': '设置保存成功',
    'settings.fail': '保存失败',
    'trash.title': '回收站',
    'trash.itemsDeleted': '项目将在30天后永久删除',
    'trash.daysLeft': '天后删除',
    'trash.restore': '恢复',
    'trash.delete': '删除',
    'trash.empty': '清空回收站',
    'trash.emptyState': '回收站为空',
    'trash.cancel': '取消',
    'trash.select': '选择',
    'trash.confirmDelete': '温馨提示：确定要永久删除这张照片吗？此操作无法撤销！',
    'trash.confirmEmpty': '温馨提示：确定要清空垃圾桶吗？所有照片将无法找回！',
    'trash.confirmBatchDelete': '温馨提示：确定要永久删除选中的照片吗？',
    'trash.failedRestore': '恢复照片失败',
    'trash.failedDelete': '删除照片失败',
    'trash.failedEmpty': '清空回收站失败',
  }
};

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'zh';
  });
  
  const [siteTitle, setSiteTitleState] = useState(() => {
    return localStorage.getItem('site_title') || 'My Photo Gallery';
  });

  useEffect(() => {
    // Fetch public config
    fetch(`${API_BASE}/public-config`)
      .then(res => res.json())
      .then((data: any) => {
        if (data.siteTitle) {
           setSiteTitleState(data.siteTitle);
           localStorage.setItem('site_title', data.siteTitle);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    document.title = siteTitle;
    localStorage.setItem('site_title', siteTitle);
  }, [siteTitle]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setSiteTitle = (title: string) => {
    setSiteTitleState(title);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <ConfigContext.Provider value={{ language, setLanguage, siteTitle, setSiteTitle, t }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}