import { useState as Silian_useState, useRef as Silian_useRef, useCallback as Silian_useCallback, useEffect as Silian_useEffect } from 'react';
import { Progress as Silian_Progress } from '@/components/ui/progress';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '@/components/ui/Alert';
import { Card as Silian_Card, CardContent as Silian_CardContent } from '@/components/ui/Card';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { Upload as Silian_Upload, X as Silian_X, File as Silian_File, Image as Silian_Image, AlertCircle as Silian_AlertCircle, CheckCircle2 as Silian_CheckCircle2 } from 'lucide-react';
import { fileUploader as Silian_fileUploader } from '@/lib/upload';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { cn as Silian_cn } from '@/lib/utils';

const Silian_FileUpload = ({
  multiple: Silian_multiple = false,
  directory: Silian_directory = 'uploads',
  entityType: Silian_entityType = null,
  entityId: Silian_entityId = null,
  onUploadSuccess: Silian_onUploadSuccess = () => {},
  onUploadError: Silian_onUploadError = () => {},
  onStateChange: Silian_onStateChange = () => {},
  className: Silian_className = '',
  accept: Silian_accept = 'image/*',
  maxFiles: Silian_maxFiles = 5,
  disabled: Silian_disabled = false,
  showPreview: Silian_showPreview = true,
  compressImages: Silian_compressImages = false
}) => {
  const { t: Silian_t } = Silian_useTranslation(['errors', 'upload', 'validation']);
  const [Silian_files, Silian_setFiles] = Silian_useState([]);
  const [Silian_uploading, Silian_setUploading] = Silian_useState(false);
  const [Silian_uploadProgress, Silian_setUploadProgress] = Silian_useState(0);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const [Silian_dragActive, Silian_setDragActive] = Silian_useState(false);
  const Silian_fileInputRef = Silian_useRef(null);
  const [Silian_mode, Silian_setMode] = Silian_useState('direct'); // direct | legacy

  // 处理文件选择
  const Silian_handleFileSelect = Silian_useCallback(async (Silian_selectedFiles) => {
    Silian_setError('');

    const Silian_fileArray = Array.from(Silian_selectedFiles);

    // 检查文件数量限制
    if (Silian_multiple && Silian_fileArray.length > Silian_maxFiles) {
      Silian_setError(Silian_t('errors.tooManyFiles', { max: Silian_maxFiles }));
      return;
    }

    if (!Silian_multiple && Silian_fileArray.length > 1) {
      Silian_setError(Silian_t('errors.singleFileOnly'));
      return;
    }

    // 验证文件
    const Silian_validatedFiles = [];
    for (const Silian_file of Silian_fileArray) {
      const Silian_validation = Silian_fileUploader.validateFile(Silian_file);
      if (Silian_validation.isValid) {
        let Silian_processedFile = Silian_file;

        // 如果启用图片压缩且是图片文件
        if (Silian_compressImages && Silian_fileUploader.isImageFile(Silian_file)) {
          try {
            Silian_processedFile = await Silian_fileUploader.compressImage(Silian_file);
          } catch (Silian_compressionError) {
            console.warn('Image compression failed, using original file:', Silian_compressionError);
          }
        }

        Silian_validatedFiles.push({
          file: Silian_processedFile,
          id: Math.random().toString(36).substr(2, 9),
          preview: Silian_showPreview && Silian_fileUploader.isImageFile(Silian_processedFile)
            ? Silian_fileUploader.createPreviewUrl(Silian_processedFile)
            : null,
          status: 'pending',
          progress: 0,
          error: null
        });
      } else {
        Silian_setError(Silian_validation.errors.join('; '));
        return;
      }
    }

    Silian_setFiles(Silian_validatedFiles);
  }, [Silian_multiple, Silian_maxFiles, Silian_compressImages, Silian_showPreview, Silian_t]);

  // 处理文件上传
  const Silian_handleUpload = Silian_useCallback(async (Silian_overrideFiles = null) => {
    const Silian_sourceFiles = Silian_overrideFiles ?? Silian_files;
    const Silian_pendingFiles = Silian_sourceFiles.filter((Silian_file) => Silian_file.status === 'pending');
    if (Silian_pendingFiles.length === 0 || Silian_uploading) return;

    Silian_setUploading(true);
    Silian_setUploadProgress(0);
    Silian_setError('');

    try {
      const Silian_filesToUpload = Silian_pendingFiles.map(Silian_f => Silian_f.file);

      const Silian_uploadOptions = {
        directory: Silian_directory,
        entityType: Silian_entityType,
        entityId: Silian_entityId,
        mode: Silian_mode,
        onProgress: (Silian_progressEvent) => {
          // direct 多文件时我们包装为 loaded: overall,total:100
          if (Silian_progressEvent.total === 100) {
            Silian_setUploadProgress(Math.round(Silian_progressEvent.loaded));
          } else if (Silian_progressEvent.total) {
            const Silian_progress = Math.round((Silian_progressEvent.loaded * 100) / Silian_progressEvent.total);
            Silian_setUploadProgress(Silian_progress);
          }
        }
      };

      let Silian_result;
      try {
        if (Silian_multiple && Silian_filesToUpload.length > 1) {
          Silian_result = await Silian_fileUploader.uploadMultipleFiles(Silian_filesToUpload, Silian_uploadOptions);
        } else {
          Silian_result = await Silian_fileUploader.uploadFile(Silian_filesToUpload[0], Silian_uploadOptions);
        }
      } catch (Silian_e) {
        if (Silian_mode === 'direct') {
          console.warn('Direct upload failed, fallback to legacy mode', Silian_e);
          Silian_setMode('legacy');
          // 重置进度后回退
          Silian_setUploadProgress(0);
          const Silian_fallbackOptions = { ...Silian_uploadOptions, mode: 'legacy' };
          if (Silian_multiple && Silian_filesToUpload.length > 1) {
            Silian_result = await Silian_fileUploader.uploadMultipleFiles(Silian_filesToUpload, Silian_fallbackOptions);
          } else {
            Silian_result = await Silian_fileUploader.uploadFile(Silian_filesToUpload[0], Silian_fallbackOptions);
          }
        } else {
          throw Silian_e;
        }
      }

      // 更新文件状态
      Silian_setFiles(Silian_prevFiles =>
        Silian_prevFiles.map((Silian_file) => (
          Silian_pendingFiles.some((Silian_pending) => Silian_pending.id === Silian_file.id)
            ? { ...Silian_file, status: 'success', progress: 100, error: null }
            : Silian_file
        ))
      );

      Silian_onUploadSuccess(Silian_result);

      // 清理预览URL
      Silian_sourceFiles.forEach(Silian_f => {
        if (Silian_f.preview) {
          Silian_fileUploader.revokePreviewUrl(Silian_f.preview);
        }
      });

      // 重置状态
      setTimeout(() => {
        Silian_setFiles([]);
        Silian_setUploadProgress(0);
      }, 2000);

    } catch (Silian_uploadError) {
      Silian_setError(Silian_uploadError.message);
      Silian_setFiles(Silian_prevFiles =>
        Silian_prevFiles.map((Silian_file) => (
          Silian_pendingFiles.some((Silian_pending) => Silian_pending.id === Silian_file.id)
            ? { ...Silian_file, status: 'error', error: Silian_uploadError.message }
            : Silian_file
        ))
      );
      Silian_onUploadError(Silian_uploadError);
    } finally {
      Silian_setUploading(false);
    }
  }, [Silian_files, Silian_uploading, Silian_directory, Silian_entityType, Silian_entityId, Silian_mode, Silian_multiple, Silian_onUploadSuccess, Silian_onUploadError]);

  Silian_useEffect(() => {
    if (!Silian_uploading && Silian_files.some((Silian_file) => Silian_file.status === 'pending')) {
      void Silian_handleUpload(Silian_files);
    }
  }, [Silian_files, Silian_uploading, Silian_handleUpload]);

  // 移除文件
  const Silian_removeFile = Silian_useCallback((Silian_fileId) => {
    Silian_setFiles(Silian_prevFiles => {
      const Silian_fileToRemove = Silian_prevFiles.find(Silian_f => Silian_f.id === Silian_fileId);
      if (Silian_fileToRemove?.preview) {
        Silian_fileUploader.revokePreviewUrl(Silian_fileToRemove.preview);
      }
      return Silian_prevFiles.filter(Silian_f => Silian_f.id !== Silian_fileId);
    });
  }, []);

  // 拖拽处理
  const Silian_handleDrag = Silian_useCallback((Silian_e) => {
    Silian_e.preventDefault();
    Silian_e.stopPropagation();
    if (Silian_e.type === 'dragenter' || Silian_e.type === 'dragover') {
      Silian_setDragActive(true);
    } else if (Silian_e.type === 'dragleave') {
      Silian_setDragActive(false);
    }
  }, []);

  const Silian_handleDrop = Silian_useCallback((Silian_e) => {
    Silian_e.preventDefault();
    Silian_e.stopPropagation();
    Silian_setDragActive(false);

    if (Silian_disabled || Silian_uploading) return;

    const Silian_droppedFiles = Silian_e.dataTransfer.files;
    if (Silian_droppedFiles?.length > 0) {
      Silian_handleFileSelect(Silian_droppedFiles);
    }
  }, [Silian_disabled, Silian_uploading, Silian_handleFileSelect]);

  // 点击上传区域
  const Silian_handleClick = Silian_useCallback(() => {
    if (!Silian_disabled && !Silian_uploading) {
      Silian_fileInputRef.current?.click();
    }
  }, [Silian_disabled, Silian_uploading]);

  // 文件输入变化
  const Silian_handleFileInputChange = Silian_useCallback((Silian_e) => {
    const Silian_selectedFiles = Silian_e.target.files;
    if (Silian_selectedFiles?.length > 0) {
      Silian_handleFileSelect(Silian_selectedFiles);
    }
    // 重置input值，允许重复选择同一文件
    Silian_e.target.value = '';
  }, [Silian_handleFileSelect]);

  Silian_useEffect(() => {
    const Silian_pendingCount = Silian_files.filter((Silian_file) => Silian_file.status === 'pending').length;
    const Silian_successCount = Silian_files.filter((Silian_file) => Silian_file.status === 'success').length;
    const Silian_errorCount = Silian_files.filter((Silian_file) => Silian_file.status === 'error').length;

    Silian_onStateChange({
      totalCount: Silian_files.length,
      pendingCount: Silian_pendingCount,
      successCount: Silian_successCount,
      errorCount: Silian_errorCount,
      uploading: Silian_uploading,
      mode: Silian_mode,
      hasPendingUploads: Silian_uploading || Silian_pendingCount > 0,
      hasUploadErrors: Silian_errorCount > 0,
      isSubmissionBlocked: Silian_uploading || Silian_pendingCount > 0 || Silian_errorCount > 0,
    });
  }, [Silian_files, Silian_uploading, Silian_mode, Silian_onStateChange]);

  return (
    <div className={Silian_cn('space-y-4', Silian_className)}>
      {/* 上传区域 */}
      <div
        className={Silian_cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          'cursor-pointer border-border bg-background',
          Silian_dragActive ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
          Silian_disabled && 'opacity-50 cursor-not-allowed',
          Silian_uploading && 'pointer-events-none'
        )}
        onDragEnter={Silian_handleDrag}
        onDragLeave={Silian_handleDrag}
        onDragOver={Silian_handleDrag}
        onDrop={Silian_handleDrop}
        onClick={Silian_handleClick}
      >
        <input
          ref={Silian_fileInputRef}
          type="file"
          multiple={Silian_multiple}
          accept={Silian_accept}
          onChange={Silian_handleFileInputChange}
          className="hidden"
          disabled={Silian_disabled || Silian_uploading}
        />

        <Silian_Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 flex items-center justify-center gap-2 text-lg font-medium text-foreground">
          <span>
            {Silian_dragActive
              ? Silian_t('upload.dropFiles')
              : Silian_t('upload.clickOrDrag')
            }
          </span>
          <span
            onClick={(Silian_e) => { Silian_e.stopPropagation(); Silian_setMode(Silian_m => Silian_m === 'direct' ? 'legacy' : 'direct'); }}
            className={Silian_cn('text-xs px-2 py-0.5 rounded border cursor-pointer select-none',
              Silian_mode === 'direct'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-border bg-muted text-muted-foreground')}
            title={Silian_mode === 'direct' ? '当前：直传（点击切换为旧兼容模式）' : '当前：旧模式（点击切换为直传）'}
          >{Silian_mode === 'direct' ? 'Direct' : 'Legacy'}</span>
        </p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>
            {Silian_multiple
              ? Silian_t('upload.supportMultiple', { max: Silian_maxFiles })
              : Silian_t('upload.supportSingle')
            }
          </span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {Silian_t('upload.supportedFormats')}: {Silian_t('upload.supportedFormatsDetail')}
        </p>
      </div>

      {/* 错误提示 */}
      {Silian_error && (
        <Silian_Alert variant="destructive">
          <Silian_AlertCircle className="h-4 w-4" />
          <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
        </Silian_Alert>
      )}

      {/* 文件列表 */}
      {Silian_files.length > 0 && (
        <div className="space-y-2">
          {Silian_files.map((Silian_fileItem) => (
            <Silian_Card key={Silian_fileItem.id} className="p-3">
              <Silian_CardContent className="p-0">
                <div className="flex items-center space-x-3">
                  {/* 文件图标/预览 */}
                  <div className="flex-shrink-0">
                    {Silian_fileItem.preview ? (
                      <img
                        src={Silian_fileItem.preview}
                        alt={Silian_fileItem.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        {Silian_fileUploader.isImageFile(Silian_fileItem.file) ? (
                          <Silian_Image className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <Silian_File className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {Silian_fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Silian_fileUploader.formatFileSize(Silian_fileItem.file.size)}
                    </p>

                    {/* 状态 */}
                    <div className="flex items-center space-x-2 mt-1">
                      {Silian_fileItem.status === 'pending' && (
                        <Silian_Badge variant="secondary">
                          {Silian_t('upload.pending')}
                        </Silian_Badge>
                      )}
                      {Silian_fileItem.status === 'success' && (
                        <Silian_Badge variant="default" className="bg-green-100 text-green-800">
                          <Silian_CheckCircle2 className="h-3 w-3 mr-1" />
                          {Silian_t('upload.success')}
                        </Silian_Badge>
                      )}
                      {Silian_fileItem.status === 'error' && (
                        <Silian_Badge variant="destructive">
                          <Silian_AlertCircle className="h-3 w-3 mr-1" />
                          {Silian_t('upload.error')}
                        </Silian_Badge>
                      )}
                    </div>

                    {/* 错误信息 */}
                    {Silian_fileItem.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {Silian_fileItem.error}
                      </p>
                    )}
                  </div>

                  {/* 移除按钮 */}
                  {Silian_fileItem.status !== 'success' && !Silian_uploading && (
                    <Silian_Button
                      variant="ghost"
                      size="sm"
                      onClick={() => Silian_removeFile(Silian_fileItem.id)}
                      className="flex-shrink-0"
                    >
                      <Silian_X className="h-4 w-4" />
                    </Silian_Button>
                  )}
                </div>
              </Silian_CardContent>
            </Silian_Card>
          ))}
        </div>
      )}

      {/* 上传进度 */}
      {Silian_uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{Silian_t('upload.uploading')}</span>
            <span>{Silian_uploadProgress}%</span>
          </div>
          <Silian_Progress value={Silian_uploadProgress} className="w-full" />
        </div>
      )}

    </div>
  );
};

export default Silian_FileUpload;

