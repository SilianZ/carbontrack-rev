import { useState, useRef, useCallback, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, File, Image, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fileUploader } from '@/lib/upload';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const FileUpload = ({
  multiple = false,
  directory = 'uploads',
  entityType = null,
  entityId = null,
  onUploadSuccess = () => {},
  onUploadError = () => {},
  onStateChange = () => {},
  className = '',
  accept = 'image/*',
  maxFiles = 5,
  disabled = false,
  showPreview = true,
  compressImages = false
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('direct'); // direct | legacy

  // 处理文件选择
  const handleFileSelect = useCallback(async (selectedFiles) => {
    setError('');
    
    const fileArray = Array.from(selectedFiles);
    
    // 检查文件数量限制
    if (multiple && fileArray.length > maxFiles) {
      setError(t('errors.tooManyFiles', { max: maxFiles }));
      return;
    }
    
    if (!multiple && fileArray.length > 1) {
      setError(t('errors.singleFileOnly'));
      return;
    }

    // 验证文件
    const validatedFiles = [];
    for (const file of fileArray) {
      const validation = fileUploader.validateFile(file);
      if (validation.isValid) {
        let processedFile = file;
        
        // 如果启用图片压缩且是图片文件
        if (compressImages && fileUploader.isImageFile(file)) {
          try {
            processedFile = await fileUploader.compressImage(file);
          } catch (compressionError) {
            console.warn('Image compression failed, using original file:', compressionError);
          }
        }
        
        validatedFiles.push({
          file: processedFile,
          id: Math.random().toString(36).substr(2, 9),
          preview: showPreview && fileUploader.isImageFile(processedFile) 
            ? fileUploader.createPreviewUrl(processedFile) 
            : null,
          status: 'pending',
          progress: 0,
          error: null
        });
      } else {
        setError(validation.errors.join('; '));
        return;
      }
    }

    setFiles(validatedFiles);
  }, [multiple, maxFiles, compressImages, showPreview, t]);

  // 处理文件上传
  const handleUpload = useCallback(async (overrideFiles = null) => {
    const sourceFiles = overrideFiles ?? files;
    const pendingFiles = sourceFiles.filter((file) => file.status === 'pending');
    if (pendingFiles.length === 0 || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const filesToUpload = pendingFiles.map(f => f.file);
      
      const uploadOptions = {
        directory,
        entityType,
        entityId,
        mode,
        onProgress: (progressEvent) => {
          // direct 多文件时我们包装为 loaded: overall,total:100
          if (progressEvent.total === 100) {
            setUploadProgress(Math.round(progressEvent.loaded));
          } else if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      };

      let result;
      try {
        if (multiple && filesToUpload.length > 1) {
          result = await fileUploader.uploadMultipleFiles(filesToUpload, uploadOptions);
        } else {
          result = await fileUploader.uploadFile(filesToUpload[0], uploadOptions);
        }
      } catch (e) {
        if (mode === 'direct') {
          console.warn('Direct upload failed, fallback to legacy mode', e);
          setMode('legacy');
          // 重置进度后回退
          setUploadProgress(0);
          const fallbackOptions = { ...uploadOptions, mode: 'legacy' };
          if (multiple && filesToUpload.length > 1) {
            result = await fileUploader.uploadMultipleFiles(filesToUpload, fallbackOptions);
          } else {
            result = await fileUploader.uploadFile(filesToUpload[0], fallbackOptions);
          }
        } else {
          throw e;
        }
      }

      // 更新文件状态
      setFiles(prevFiles => 
        prevFiles.map(f => ({
          ...f,
          status: 'success',
          progress: 100
        }))
      );

      onUploadSuccess(result);
      
      // 清理预览URL
      sourceFiles.forEach(f => {
        if (f.preview) {
          fileUploader.revokePreviewUrl(f.preview);
        }
      });
      
      // 重置状态
      setTimeout(() => {
        setFiles([]);
        setUploadProgress(0);
      }, 2000);

    } catch (uploadError) {
      setError(uploadError.message);
      setFiles(prevFiles => 
        prevFiles.map(f => ({
          ...f,
          status: 'error',
          error: uploadError.message
        }))
      );
      onUploadError(uploadError);
    } finally {
      setUploading(false);
    }
  }, [files, uploading, directory, entityType, entityId, mode, multiple, onUploadSuccess, onUploadError]);

  useEffect(() => {
    if (!uploading && files.some((file) => file.status === 'pending')) {
      void handleUpload(files);
    }
  }, [files, uploading, handleUpload]);

  // 移除文件
  const removeFile = useCallback((fileId) => {
    setFiles(prevFiles => {
      const fileToRemove = prevFiles.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        fileUploader.revokePreviewUrl(fileToRemove.preview);
      }
      return prevFiles.filter(f => f.id !== fileId);
    });
  }, []);

  // 拖拽处理
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled || uploading) return;
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.length > 0) {
      handleFileSelect(droppedFiles);
    }
  }, [disabled, uploading, handleFileSelect]);

  // 点击上传区域
  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  // 文件输入变化
  const handleFileInputChange = useCallback((e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles?.length > 0) {
      handleFileSelect(selectedFiles);
    }
    // 重置input值，允许重复选择同一文件
    e.target.value = '';
  }, [handleFileSelect]);

  useEffect(() => {
    const pendingCount = files.filter((file) => file.status === 'pending').length;
    const successCount = files.filter((file) => file.status === 'success').length;
    const errorCount = files.filter((file) => file.status === 'error').length;

    onStateChange({
      totalCount: files.length,
      pendingCount,
      successCount,
      errorCount,
      uploading,
      mode,
      hasPendingUploads: uploading || pendingCount > 0,
      hasUploadErrors: errorCount > 0,
      isSubmissionBlocked: uploading || pendingCount > 0 || errorCount > 0,
    });
  }, [files, uploading, mode, onStateChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* 上传区域 */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          'cursor-pointer border-border bg-background',
          dragActive ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
          disabled && 'opacity-50 cursor-not-allowed',
          uploading && 'pointer-events-none'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 flex items-center justify-center gap-2 text-lg font-medium text-foreground">
          <span>
            {dragActive 
              ? t('upload.dropFiles') 
              : t('upload.clickOrDrag')
            }
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); setMode(m => m === 'direct' ? 'legacy' : 'direct'); }}
            className={cn('text-xs px-2 py-0.5 rounded border cursor-pointer select-none',
              mode === 'direct'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-border bg-muted text-muted-foreground')}
            title={mode === 'direct' ? '当前：直传（点击切换为旧兼容模式）' : '当前：旧模式（点击切换为直传）'}
          >{mode === 'direct' ? 'Direct' : 'Legacy'}</span>
        </p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>
            {multiple 
              ? t('upload.supportMultiple', { max: maxFiles })
              : t('upload.supportSingle')
            }
          </span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {t('upload.supportedFormats')}: {t('upload.supportedFormatsDetail')}
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileItem) => (
            <Card key={fileItem.id} className="p-3">
              <CardContent className="p-0">
                <div className="flex items-center space-x-3">
                  {/* 文件图标/预览 */}
                  <div className="flex-shrink-0">
                    {fileItem.preview ? (
                      <img
                        src={fileItem.preview}
                        alt={fileItem.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        {fileUploader.isImageFile(fileItem.file) ? (
                          <Image className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <File className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileUploader.formatFileSize(fileItem.file.size)}
                    </p>
                    
                    {/* 状态 */}
                    <div className="flex items-center space-x-2 mt-1">
                      {fileItem.status === 'pending' && (
                        <Badge variant="secondary">
                          {t('upload.pending')}
                        </Badge>
                      )}
                      {fileItem.status === 'success' && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('upload.success')}
                        </Badge>
                      )}
                      {fileItem.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {t('upload.error')}
                        </Badge>
                      )}
                    </div>

                    {/* 错误信息 */}
                    {fileItem.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {fileItem.error}
                      </p>
                    )}
                  </div>

                  {/* 移除按钮 */}
                  {fileItem.status !== 'success' && !uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(fileItem.id)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 上传进度 */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('upload.uploading')}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}

    </div>
  );
};

export default FileUpload;

