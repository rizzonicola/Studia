import React, { useMemo } from 'react';
import { useNotesStore } from '../hooks/useNotesStore';
import ItemsGrid from './ItemsGrid';
import CreateNewButton from '../components/CreateNewButton';

const NotesPage: React.FC = () => {
  const { notes, folders } = useNotesStore();

  const rootNotes = useMemo(() => notes.filter((note) => note.folderId === null), [notes]);
  const rootFolders = useMemo(() => folders.filter((folder) => folder.parentId === null), [folders]);

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-8">
      <ItemsGrid notes={rootNotes} folders={rootFolders} />
      <CreateNewButton />
    </div>
  );
};

export default NotesPage;
