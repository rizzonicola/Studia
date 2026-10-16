
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, FileText, X, Sparkles, Trash2, FileAudio, Download, AlertTriangle } from 'lucide-react';
import RecorderCard from '../components/RecorderCard';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { UPLOAD_ACCEPT, filterSupportedFiles } from '../utils/fileTypes';
import { useI18n } from '../i18n/I18nProvider';
import { MAX_UPLOAD_BYTES } from '../config/appConfig';
import { confirmDialog } from '../utils/dialogs';

interface FileListItemProps {
  file: File;
  onRemove: () => void;
}

// Componente helper per gestire il singolo file in lista (Object URL lifecycle)
const FileListItem: React.FC<FileListItemProps> = ({ file, onRemove }) => {
  const { t, formatNumber } = useI18n();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    // Crea un URL temporaneo per il file (per audio src o download href)
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    // Pulizia della memoria quando il componente viene smontato
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const isAudio = file.type.startsWith('audio/') || 
                  /\.(mp3|wav|ogg|flac|aac|aiff|opus)$/i.test(file.name);

  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 transition-all hover:shadow-xs">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-3 overflow-hidden min-w-0">
          {isAudio ? (
            <FileAudio className="w-5 h-5 text-accent-ink shrink-0" aria-hidden="true" />
          ) : (
            <FileText className="w-5 h-5 text-gray-500 shrink-0" aria-hidden="true" />
          )}
          <div className="flex flex-col min-w-0">
             <span className="text-sm font-medium text-gray-700 truncate block" title={file.name}>{file.name}</span>
             <span className="text-xs text-gray-600">{formatNumber(file.size / 1024 / 1024, { maximumFractionDigits: 2 })} MB</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 shrink-0 ml-2">
           {objectUrl && (
            <a
              href={objectUrl}
              download={file.name}
              className="p-3 text-gray-600 hover:text-accent-ink hover:bg-accent-soft rounded-md transition-colors"
              title={t('upload.downloadFile')}
              aria-label={t('upload.downloadFile')}
            >
              <Download size={16} />
            </a>
          )}
          <button
            onClick={onRemove}
            className="p-3 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            title={t('upload.removeFile')}
            aria-label={t('upload.removeFile')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      {isAudio && objectUrl && (
        <div className="mt-2 w-full">
            <audio controls src={objectUrl} className="w-full h-8 block" style={{ minWidth: '200px' }} />
        </div>
      )}
    </div>
  );
};

const UploadPage: React.FC = () => {
  const { 
    uploadedFiles, 
    setUploadedFiles, 
    processUploads, 
    isProcessing,
    cancelProcessing,
  } = useAIProcessor();
  const { t, formatNumber } = useI18n();

  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Aggiunge solo i file in formati supportati da Gemini e avvisa per gli altri
  const addFiles = (incoming: File[]) => {
    const { accepted, error } = filterSupportedFiles(incoming);
    // Limite di dimensione per singolo file (evita di saturare memoria e connessione)
    const tooBig = accepted.find((f) => f.size > MAX_UPLOAD_BYTES);
    const withinLimit = accepted.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    setFileError(
      tooBig
        ? t('upload.fileTooBig', {
            name: tooBig.name,
            size: formatNumber(tooBig.size / 1024 / 1024, { maximumFractionDigits: 0 }),
            max: formatNumber(MAX_UPLOAD_BYTES / 1024 / 1024, { maximumFractionDigits: 0 }),
          })
        : error
    );
    if (withinLimit.length > 0) setUploadedFiles(prev => [...prev, ...withinLimit]);
  };

  const handleGenerate = async () => {
        await processUploads();
  };
  
  const handleClearAll = async () => {
      const confirmed = await confirmDialog({
        title: t('upload.clearTitle'),
        message: t('upload.clearConfirm', { count: uploadedFiles.length }),
        confirmLabel: t('common.remove'),
        tone: 'danger',
      });
      if (!confirmed) return;
      setFileError(null);
      setUploadedFiles([]);
  };

  return (
    <div className="pt-8 md:pt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>{t('upload.consentTitle')}</strong> {t('upload.consentBody')}{' '}
        <Link to="/terms" className="underline font-medium">{t('footer.terms')}</Link> {t('upload.consentAnd')}{' '}
        <Link to="/privacy" className="underline font-medium">{t('footer.privacy')}</Link>.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <RecorderCard onRecorded={(file) => setUploadedFiles((prev) => [...prev, file])} onError={setFileError} />

        <div className="bg-surface p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col space-y-4 min-h-[350px]">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-gray-800">{t('upload.materialTitle')}</h2>
             {uploadedFiles.length > 0 && (
                 <button onClick={handleClearAll} className="text-xs text-red-700 hover:text-red-800 flex items-center px-2 py-3">
                     <Trash2 size={12} className="mr-1" aria-hidden="true" /> {t('upload.clear')}
                 </button>
             )}
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
            className={`relative block w-full grow border-2 border-dashed rounded-lg p-6 text-center transition-colors flex flex-col justify-center ${isDragging ? 'border-accent-ink bg-accent-soft' : 'border-gray-300'}`}
          >
            <input type="file" multiple accept={UPLOAD_ACCEPT} onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }} aria-label={t('upload.dropAria')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-500 mb-2" aria-hidden="true" />
            <p className="font-medium text-gray-900">{t('upload.drop')}</p>
            <p className="mt-1 text-xs text-gray-600 px-2">{t('upload.dropHint')}</p>
          </div>

          {fileError && (
            <div role="alert" className="flex items-start rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
              <p className="grow">{fileError}</p>
              <button onClick={() => setFileError(null)} className="ml-2 shrink-0 p-2 -m-2 text-red-600 hover:text-red-800" aria-label={t('upload.dismiss')}><X size={16} /></button>
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto border-t pt-4 pr-1">
              {uploadedFiles.map((file, i) => (
                <FileListItem 
                    key={`${file.name}-${i}`} 
                    file={file} 
                    onRemove={async () => {
                      const confirmed = await confirmDialog({
                        title: t('upload.removeTitle'),
                        message: t('upload.removeConfirm', { name: file.name }),
                        confirmLabel: t('common.remove'),
                        tone: 'danger',
                      });
                      if (confirmed) setUploadedFiles(prev => prev.filter((f) => f !== file)); // per identità del file, non per posizione: la lista può cambiare mentre il dialogo è aperto
                    }} 
                />
              ))}
            </div>
          )}
           {isProcessing && (
              <button onClick={cancelProcessing} className="w-full border border-gray-300 text-gray-800 py-2.5 min-h-11 rounded-lg font-medium hover:bg-gray-50">
                {t('common.cancel')}
              </button>
           )}
           <button 
                onClick={handleGenerate}
                disabled={uploadedFiles.length === 0 || isProcessing}
                className="w-full bg-accent text-accent-fg py-3 rounded-lg font-semibold hover:bg-accent-hover transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center mt-auto"
            >
                {isProcessing ? (
                    <>
                       {t('upload.wait')}
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                        {t('upload.generate')}
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
