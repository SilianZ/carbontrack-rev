import Silian_api from './api';
import Silian_axios from 'axios';

/**
 * 文件上传工具类
 */
export class FileUploader {
  constructor(Silian_options = {}) {
    this.maxFileSize = Silian_options.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.allowedTypes = Silian_options.allowedTypes || [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    this.allowedExtensions = Silian_options.allowedExtensions || [
      'jpg', 'jpeg', 'png', 'gif', 'webp'
    ];
  }

  /**
   * 计算文件 SHA256 (hex)
   */
  async computeSHA256(Silian_file) {
    const Silian_arrayBuffer = await Silian_file.arrayBuffer();
    const Silian_hashBuffer = await crypto.subtle.digest('SHA-256', Silian_arrayBuffer);
    const Silian_hashArray = Array.from(new Uint8Array(Silian_hashBuffer));
    return Silian_hashArray.map(Silian_b => Silian_b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 申请预签名（含去重）
   */
  async presignDirectUpload({ originalName: Silian_originalName, mimeType: Silian_mimeType, directory: Silian_directory='uploads', fileSize: Silian_fileSize, sha256: Silian_sha256, entityType: Silian_entityType, entityId: Silian_entityId, expiresIn: Silian_expiresIn=600 }) {
    const Silian_payload = {
      original_name: Silian_originalName,
      mime_type: Silian_mimeType,
      directory: Silian_directory,
      file_size: Silian_fileSize,
      sha256: Silian_sha256,
      entity_type: Silian_entityType,
      entity_id: Silian_entityId,
      expires_in: Silian_expiresIn
    };
    const { data: Silian_data } = await Silian_api.post('/files/presign', Silian_payload);
    if (!Silian_data.success) throw new Error(Silian_data.message || '获取预签名失败');
    return Silian_data.data; // 返回 data 内部结构
  }

  /**
   * 调用确认接口（包含引用计数递增）
   */
  async confirmDirectUpload({ filePath: Silian_filePath, originalName: Silian_originalName, sha256: Silian_sha256, entityType: Silian_entityType, entityId: Silian_entityId }) {
    const { data: Silian_data } = await Silian_api.post('/files/confirm', {
      file_path: Silian_filePath,
      original_name: Silian_originalName,
      sha256: Silian_sha256,
      entity_type: Silian_entityType,
      entity_id: Silian_entityId
    });
    if (!Silian_data.success) throw new Error(Silian_data.message || '上传确认失败');
    return Silian_data.data;
  }

  /**
   * 使用预签名 URL 直传单个文件（包含去重 + 确认）
   * 返回统一结构：{ success, data: { file_path, public_url, sha256, duplicate, ... } }
   */
  async directUploadSingle(Silian_file, Silian_options = {}) {
    // 1. 验证
    const Silian_validation = this.validateFile(Silian_file);
    if (!Silian_validation.isValid) {
      throw new Error(Silian_validation.errors.join('; '));
    }

    const Silian_sha256 = await this.computeSHA256(Silian_file);
    const Silian_presign = await this.presignDirectUpload({
      originalName: Silian_file.name,
      mimeType: Silian_file.type,
      directory: Silian_options.directory,
      fileSize: Silian_file.size,
      sha256: Silian_sha256,
      entityType: Silian_options.entityType,
      entityId: Silian_options.entityId
    });

    // 2. 若 duplicate 则直接 confirm (以递增引用) 并返回
    if (Silian_presign.duplicate) {
      const Silian_confirmed = await this.confirmDirectUpload({
        filePath: Silian_presign.file_path,
        originalName: Silian_file.name,
        sha256: Silian_sha256,
        entityType: Silian_options.entityType,
        entityId: Silian_options.entityId
      });
      return {
        success: true,
        data: {
          ...Silian_confirmed,
          file_path: Silian_presign.file_path,
          public_url: Silian_presign.public_url,
          duplicate: true,
          sha256: Silian_sha256
        }
      };
    }

    // 3. PUT 直传
    await Silian_axios.request({
      url: Silian_presign.url,
      method: Silian_presign.method || 'PUT',
      headers: Silian_presign.headers || { 'Content-Type': Silian_file.type },
      data: Silian_file,
      onUploadProgress: Silian_options.onProgress
    });

    // 4. 确认
    const Silian_confirmed = await this.confirmDirectUpload({
      filePath: Silian_presign.file_path,
      originalName: Silian_file.name,
      sha256: Silian_sha256,
      entityType: Silian_options.entityType,
      entityId: Silian_options.entityId
    });

    return {
      success: true,
      data: {
        ...Silian_confirmed,
        file_path: Silian_presign.file_path,
        public_url: Silian_presign.public_url,
        duplicate: false,
        sha256: Silian_sha256
      }
    };
  }

  /**
   * 多文件直传（串行，避免同时多大文件发压；可改并发）
   * 返回: { success, data: { results: [...], uploaded_count, duplicate_count } }
   */
  async directUploadMultiple(Silian_files, Silian_options = {}) {
    const Silian_results = [];
    let Silian_duplicateCount = 0;
    for (let Silian_i = 0; Silian_i < Silian_files.length; Silian_i++) {
      const Silian_f = Silian_files[Silian_i];
      const Silian_perFileProgressWrapper = (Silian_evt) => {
        // 计算总体进度：已完成 + 当前文件进度
        if (Silian_options.onProgress && Silian_evt.total) {
          const Silian_singleRatio = Silian_evt.loaded / Silian_evt.total;
            const Silian_overall = ((Silian_i + Silian_singleRatio) / Silian_files.length) * 100;
            Silian_options.onProgress({ ...Silian_evt, loaded: Silian_overall, total: 100 });
        }
      };
      const Silian_res = await this.directUploadSingle(Silian_f, { ...Silian_options, onProgress: Silian_perFileProgressWrapper });
      if (Silian_res.data.duplicate) Silian_duplicateCount += 1;
      Silian_results.push(Silian_res.data);
    }
    return {
      success: true,
      data: {
        results: Silian_results,
        uploaded_count: Silian_results.length,
        duplicate_count: Silian_duplicateCount
      }
    };
  }

  /**
   * 验证文件
   */
  validateFile(Silian_file) {
    const Silian_errors = [];

    // 检查文件大小
    if (Silian_file.size > this.maxFileSize) {
      Silian_errors.push(`文件大小不能超过 ${this.formatFileSize(this.maxFileSize)}`);
    }

    // 检查文件类型
    if (!this.allowedTypes.includes(Silian_file.type)) {
      Silian_errors.push(`不支持的文件类型。支持的类型：${this.allowedTypes.join(', ')}`);
    }

    // 检查文件扩展名
    const Silian_extension = this.getFileExtension(Silian_file.name);
    if (!this.allowedExtensions.includes(Silian_extension)) {
      Silian_errors.push(`不支持的文件扩展名。支持的扩展名：${this.allowedExtensions.join(', ')}`);
    }

    return {
      isValid: Silian_errors.length === 0,
      errors: Silian_errors
    };
  }

  /**
   * 上传单个文件
   */
  async uploadFile(Silian_file, Silian_options = {}) {
    // 若显式要求 direct 模式
    if (Silian_options.mode === 'direct') {
      return this.directUploadSingle(Silian_file, Silian_options);
    }
    const Silian_validation = this.validateFile(Silian_file);
    if (!Silian_validation.isValid) {
      throw new Error(Silian_validation.errors.join('; '));
    }

    const Silian_formData = new FormData();
    Silian_formData.append('file', Silian_file);

    if (Silian_options.directory) {
      Silian_formData.append('directory', Silian_options.directory);
    }

    if (Silian_options.entityType) {
      Silian_formData.append('entity_type', Silian_options.entityType);
    }

    if (Silian_options.entityId) {
      Silian_formData.append('entity_id', Silian_options.entityId.toString());
    }

    try {
      const Silian_response = await Silian_api.post('/files/upload', Silian_formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: Silian_options.onProgress
      });

      return Silian_response.data;
    } catch (Silian_error) {
      throw new Error(Silian_error.response?.data?.message || '文件上传失败');
    }
  }

  /**
   * 上传多个文件
   */
  async uploadMultipleFiles(Silian_files, Silian_options = {}) {
    if (Silian_options.mode === 'direct') {
      return this.directUploadMultiple(Silian_files, Silian_options);
    }
    // 验证所有文件
    const Silian_validationResults = Silian_files.map(Silian_file => ({
      file: Silian_file,
      validation: this.validateFile(Silian_file)
    }));

    const Silian_invalidFiles = Silian_validationResults.filter(Silian_result => !Silian_result.validation.isValid);
    if (Silian_invalidFiles.length > 0) {
      const Silian_errors = Silian_invalidFiles.map(Silian_result =>
        `${Silian_result.file.name}: ${Silian_result.validation.errors.join('; ')}`
      );
      throw new Error('文件验证失败:\n' + Silian_errors.join('\n'));
    }

    const Silian_formData = new FormData();
    Silian_files.forEach(Silian_file => {
      Silian_formData.append('files[]', Silian_file);
    });

    if (Silian_options.directory) {
      Silian_formData.append('directory', Silian_options.directory);
    }

    if (Silian_options.entityType) {
      Silian_formData.append('entity_type', Silian_options.entityType);
    }

    if (Silian_options.entityId) {
      Silian_formData.append('entity_id', Silian_options.entityId.toString());
    }

    try {
      const Silian_response = await Silian_api.post('/files/upload-multiple', Silian_formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: Silian_options.onProgress
      });

      return Silian_response.data;
    } catch (Silian_error) {
      throw new Error(Silian_error.response?.data?.message || '文件上传失败');
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(Silian_filePath) {
    try {
      const Silian_encodedPath = encodeURIComponent(Silian_filePath);
      const Silian_response = await Silian_api.delete(`/files/${Silian_encodedPath}`);
      return Silian_response.data;
    } catch (Silian_error) {
      throw new Error(Silian_error.response?.data?.message || '文件删除失败');
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(Silian_filePath) {
    try {
      const Silian_encodedPath = encodeURIComponent(Silian_filePath);
      const Silian_response = await Silian_api.get(`/files/${Silian_encodedPath}/info`);
      return Silian_response.data;
    } catch (Silian_error) {
      throw new Error(Silian_error.response?.data?.message || '获取文件信息失败');
    }
  }

  /**
   * 生成预签名URL
   */
  async generatePresignedUrl(Silian_filePath, Silian_expiresIn = 600) {
    try {
      const Silian_encodedPath = encodeURIComponent(Silian_filePath);
      const Silian_response = await Silian_api.get(`/files/${Silian_encodedPath}/presigned-url`, {
        params: { expires_in: Silian_expiresIn }
      });
      return Silian_response.data;
    } catch (Silian_error) {
      throw new Error(Silian_error.response?.data?.message || '生成预签名URL失败');
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(Silian_filename) {
    return Silian_filename.split('.').pop().toLowerCase();
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(Silian_bytes) {
    if (Silian_bytes === 0) return '0 B';

    const Silian_k = 1024;
    const Silian_sizes = ['B', 'KB', 'MB', 'GB'];
    const Silian_i = Math.floor(Math.log(Silian_bytes) / Math.log(Silian_k));

    return parseFloat((Silian_bytes / Math.pow(Silian_k, Silian_i)).toFixed(1)) + ' ' + Silian_sizes[Silian_i];
  }

  /**
   * 检查是否为图片文件
   */
  isImageFile(Silian_file) {
    return Silian_file.type.startsWith('image/');
  }

  /**
   * 创建图片预览URL
   */
  createPreviewUrl(Silian_file) {
    if (!this.isImageFile(Silian_file)) {
      return null;
    }
    return URL.createObjectURL(Silian_file);
  }

  /**
   * 释放预览URL
   */
  revokePreviewUrl(Silian_url) {
    if (Silian_url) {
      URL.revokeObjectURL(Silian_url);
    }
  }

  /**
   * 压缩图片（可选功能）
   */
  async compressImage(Silian_file, Silian_options = {}) {
    const {
      maxWidth: Silian_maxWidth = 1920,
      maxHeight: Silian_maxHeight = 1080,
      quality: Silian_quality = 0.8,
      outputFormat: Silian_outputFormat = 'image/jpeg'
    } = Silian_options;

    return new Promise((Silian_resolve, Silian_reject) => {
      const Silian_canvas = document.createElement('canvas');
      const Silian_ctx = Silian_canvas.getContext('2d');
      const Silian_img = new Image();

      Silian_img.onload = () => {
        // 计算新的尺寸
        let { width: Silian_width, height: Silian_height } = Silian_img;

        if (Silian_width > Silian_maxWidth) {
          Silian_height = (Silian_height * Silian_maxWidth) / Silian_width;
          Silian_width = Silian_maxWidth;
        }

        if (Silian_height > Silian_maxHeight) {
          Silian_width = (Silian_width * Silian_maxHeight) / Silian_height;
          Silian_height = Silian_maxHeight;
        }

        // 设置画布尺寸
        Silian_canvas.width = Silian_width;
        Silian_canvas.height = Silian_height;

        // 绘制图片
        Silian_ctx.drawImage(Silian_img, 0, 0, Silian_width, Silian_height);

        // 转换为Blob
        Silian_canvas.toBlob(
          (Silian_blob) => {
            if (Silian_blob) {
              // 创建新的File对象
              const Silian_compressedFile = new File([Silian_blob], Silian_file.name, {
                type: Silian_outputFormat,
                lastModified: Date.now()
              });
              Silian_resolve(Silian_compressedFile);
            } else {
              Silian_reject(new Error('图片压缩失败'));
            }
          },
          Silian_outputFormat,
          Silian_quality
        );
      };

      Silian_img.onerror = () => Silian_reject(new Error('图片加载失败'));
      Silian_img.src = URL.createObjectURL(Silian_file);
    });
  }
}

// 创建默认实例
export const fileUploader = new FileUploader();

// 便捷函数
export const uploadFile = (Silian_file, Silian_options) => fileUploader.uploadFile(Silian_file, Silian_options);
export const uploadMultipleFiles = (Silian_files, Silian_options) => fileUploader.uploadMultipleFiles(Silian_files, Silian_options);
export const deleteFile = (Silian_filePath) => fileUploader.deleteFile(Silian_filePath);
export const getFileInfo = (Silian_filePath) => fileUploader.getFileInfo(Silian_filePath);
export const generatePresignedUrl = (Silian_filePath, Silian_expiresIn) => fileUploader.generatePresignedUrl(Silian_filePath, Silian_expiresIn);

// 管理员功能
export const adminAPI = {
  // 获取存储统计
  async getStorageStats() {
    try {
      const Silian_response = await Silian_api.get('/admin/files/stats');
      return Silian_response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '获取存储统计失败');
    }
  },

  // 清理过期文件
  async cleanupExpiredFiles(Silian_directory = 'temp', Silian_daysOld = 7) {
    try {
      const Silian_response = await Silian_api.post('/admin/files/cleanup', {
        directory: Silian_directory,
        days_old: Silian_daysOld
      });
      return Silian_response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '清理过期文件失败');
    }
  }
};

export default fileUploader;

