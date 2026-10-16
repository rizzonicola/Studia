
export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export interface MapNode {
  id: number | string;
  label: string;
  color?: string;
  mass?: number;
}

export interface MapEdge {
  from: number | string;
  to: number | string;
  label?: string;
}

export interface MapData {
  title: string;
  graph: {
    nodes: MapNode[];
    edges: MapEdge[];
  };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  contentType?: 'markdown' | 'html';
  emoji: string;
  color: string;
  folderId: string | null;
  createdAt: string;
  order?: number;
  // Nuovi campi per la persistenza specifica per appunto
  quizData?: QuizData | null;
  mapData?: MapData | null;
}

export interface Folder {
  id:string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
  parentId: string | null;
  order?: number;
}

export interface AppData {
  notes: Note[];
  folders: Folder[];
}