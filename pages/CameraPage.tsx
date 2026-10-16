import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Zap, Upload, RefreshCcw, CameraOff, Loader } from 'lucide-react';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { IMAGE_ACCEPT, imageFormatsText, isSupportedImage } from '../utils/fileTypes';
import { compressImageToDataUrl } from '../utils/imageUtils';
import { useI18n } from '../i18n/I18nProvider';

const CameraPage: React.FC = () => {
  const { capturedImage, setCapturedImage, processImage, isProcessing, cancelProcessing } = useAIProcessor();
  const { t } = useI18n();

  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(false); // lettura/compressione locale del file
  const [localError, setLocalError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleTakePhotoClick = () => cameraInputRef.current?.click();
  const handleUploadClick = () => galleryInputRef.current?.click();

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    // Reset subito: permette di scegliere di nuovo lo stesso file
    input.value = '';

    setCapturedImage(null);
    setLocalError(null);

    if (!isSupportedImage(file)) {
      setLocalError(t('camera.unsupported', { name: file.name, formats: imageFormatsText() }));
      return;
    }

    setIsLoadingLocal(true);
    try {
      // Ridimensiona (max 2000 px) e comprime in JPEG prima di salvare/inviare: meno memoria, meno banda, meno token
      setCapturedImage(await compressImageToDataUrl(file));
    } catch {
      setLocalError(t('camera.cannotRead'));
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handleReset = () => {
      setCapturedImage(null);
      setLocalError(null);
      setIsLoadingLocal(false);
  }

  const handleConvert = async () => {
    await processImage();
  };

  return (
    <div className="pt-8 md:pt-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('camera.title')}</h1>
      <p className="text-lg text-gray-600 mb-6">{t('camera.subtitle')}</p>
      
      <div className="w-full bg-black rounded-lg aspect-4/3 flex items-center justify-center mb-6 overflow-hidden shadow-lg relative">
        {!capturedImage && !isLoadingLocal && !localError && <Camera className="h-24 w-24 text-gray-500" aria-hidden="true" />}
        
        {/* Loading States (Local processing OR Global AI processing) */}
        {(isLoadingLocal || isProcessing) && (
            <div className="flex flex-col items-center absolute inset-0 bg-black/80 justify-center z-10 text-white">
                <Loader className="h-16 w-16 animate-spin motion-reduce:animate-none mb-4" aria-hidden="true" />
                <p role="status">{isProcessing ? t('camera.processing') : t('camera.optimizing')}</p>
            </div>
        )}
        
        {localError && <div role="alert" className="p-4 text-center text-red-400"><CameraOff className="h-16 w-16 mx-auto mb-4" aria-hidden="true" /><p>{localError}</p></div>}
        
        {capturedImage && <img src={capturedImage} alt={t('camera.previewAlt')} className="w-full h-full object-contain" />}
        
      </div>

      <p className="text-xs text-gray-600 mb-4 max-w-md">
        {t('camera.notice')}{' '}
        <Link to="/terms" className="underline">{t('footer.terms')}</Link>).
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {!capturedImage && !isLoadingLocal && !isProcessing && (
          <>
            <button onClick={handleTakePhotoClick} className="btn-primary">
              <Camera className="w-5 h-5 mr-2" />
              {t('camera.take')}
            </button>
            <button onClick={handleUploadClick} className="btn-secondary">
              <Upload className="w-5 h-5 mr-2" />
              {t('camera.gallery')}
            </button>
            {/* Hidden file inputs */}
            <input type="file" ref={cameraInputRef} onChange={handleFileSelected} accept={IMAGE_ACCEPT} capture="environment" className="hidden" />
            <input type="file" ref={galleryInputRef} onChange={handleFileSelected} accept={IMAGE_ACCEPT} className="hidden" />
          </>
        )}
        
        {capturedImage && !isLoadingLocal && !isProcessing && (
          <>
            <button onClick={handleReset} className="btn-secondary">
                <RefreshCcw className="w-5 h-5 mr-2" />
                {t('camera.retake')}
            </button>
            <button onClick={handleConvert} className="btn-primary">
              <Zap className="w-5 h-5 mr-2" />
              {t('camera.convert')}
            </button>
          </>
        )}
        
        {isProcessing && (
          <>
            <p className="text-sm text-gray-600 motion-safe:animate-pulse">{t('camera.background')}</p>
            <button onClick={cancelProcessing} className="btn-secondary">{t('common.cancel')}</button>
          </>
        )}
      </div>

    </div>
  );
};

export default CameraPage;