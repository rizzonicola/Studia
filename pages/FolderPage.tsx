
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotesStore } from '../hooks/useNotesStore';
import ItemsGrid from './ItemsGrid';
import CreateNewButton from '../components/CreateNewButton';
import { ArrowLeft, Download, Loader } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { downloadFolderAsZip } from '../utils/exportUtils';

const FolderPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const { notes, folders, getFolderById } = useNotesStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const { t } = useI18n();

  const folder = folderId ? getFolderById(folderId) : undefined;
  const notesInFolder = notes.filter(note => note.folderId === folderId);
  const foldersInFolder = folders.filter(folder => folder.parentId === folderId);

  const handleDownload = async () => {
      if (!folder || isDownloading) return;
      setIsDownloading(true);
      try {
        // jszip viene scaricato da exportUtils solo al primo export
        await downloadFolderAsZip(folder.id, notes, folders);
      } finally {
        setIsDownloading(false);
      }
  };

  if (!folder) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold">{t('folder.notFound')}</h2>
        <Link to="/" className="text-accent-ink hover:underline mt-4 inline-block">{t('folder.backNotes')}</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
         <div>
            <Link to={folder.parentId ? `/folder/${folder.parentId}`: "/"} className="flex items-center min-h-11 text-sm text-gray-700 hover:text-gray-900 mb-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <span className="text-4xl mr-4">{folder.emoji}</span>
                {folder.name}
            </h1>
         </div>
         <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center px-4 py-2.5 min-h-11 disabled:opacity-60 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm whitespace-nowrap"
         >
            {isDownloading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isDownloading ? t('folder.zipCreating') : t('folder.download')}
         </button>
      </div>
      <ItemsGrid notes={notesInFolder} folders={foldersInFolder} showBackToHomeDropZones />
      <CreateNewButton parentId={folderId} />
    </div>
  );
};

export default FolderPage;
