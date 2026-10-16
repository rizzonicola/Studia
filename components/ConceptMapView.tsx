

import React, { useMemo, useRef } from 'react';
import Graph from 'react-graph-vis';
import { MapData } from '../types';
import { Loader } from 'lucide-react';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { useI18n } from '../i18n/I18nProvider';
import { sanitizeMap, safeJsonParse } from '../services/validators';
import { MAX_IMPORT_BYTES } from '../config/appConfig';
import { useTheme } from '../hooks/useTheme';
import type { Palette } from '../utils/themeEngine';
import { alertDialog } from '../utils/dialogs';

/**
 * Opzioni di vis-network. Il canvas non legge le classi CSS: i colori arrivano dalla palette del tema (esadecimali),
 * quindi le opzioni vengono ricalcolate (e memorizzate) quando cambia il tema.
 * I nodi restano "biglietti" chiari con testo scuro: i colori pastello scelti dall'AI restano leggibili anche sul tema scuro.
 */
const buildGraphOptions = (p: Palette) => ({
  layout: { hierarchical: false },
  edges: {
    color: p.isDark ? p.muted : '#34495e',
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    // L'etichetta ha un contorno dello stesso colore dello sfondo della mappa: resta leggibile sopra le linee
    font: { size: 11, align: 'middle', color: p.isDark ? p.fg : '#4b5563', strokeWidth: 3, strokeColor: p.bg },
    smooth: { type: 'cubicBezier' },
  },
  nodes: {
    shape: 'box',
    borderWidth: 1,
    shapeProperties: { borderRadius: 4 },
    font: { size: 14, color: '#34495e' },
    color: {
      background: p.isDark ? '#e5e7eb' : '#ffffff',
      border: p.isDark ? '#9ca3af' : '#2c3e50',
      highlight: { background: p.isDark ? '#ffffff' : '#ecf0f1', border: p.isDark ? '#d1d5db' : '#2c3e50' },
    },
  },
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 120, springConstant: 0.08, avoidOverlap: 0.8 },
    // Dopo la stabilizzazione la fisica si ferma: niente animazione continua (meno CPU/batteria)
    stabilization: { iterations: 150 },
  },
  interaction: { dragNodes: true, dragView: true, zoomView: true, tooltipDelay: 200 },
  height: '100%',
});

interface ConceptMapViewProps {
    noteId: string;
    mapData: MapData | null;
    onMapDataChange: (data: MapData | null) => void;
    sourceContent?: string;
    isFullscreen?: boolean;
}

const ConceptMapView: React.FC<ConceptMapViewProps> = ({ noteId, mapData, onMapDataChange, sourceContent, isFullscreen = false }) => {
    const { backgroundTasks, generateMap, clearTask } = useAIProcessor();
    const { t } = useI18n();
    const { palette } = useTheme();
    const graphOptions = useMemo(() => buildGraphOptions(palette), [palette]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check Global Task State (Solo per mostrare lo spinner di caricamento)
    const taskKey = `${noteId}-map`;
    const activeTask = backgroundTasks[taskKey];
    const isGenerating = activeTask?.status === 'loading';
    const error = activeTask?.status === 'error' ? activeTask.error : null;

    const handleGenerate = async () => {
        if (!sourceContent || sourceContent.length < 50) {
            void alertDialog({ message: t('map.tooShort') });
            return;
        }

        generateMap(noteId, sourceContent);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (file.size > MAX_IMPORT_BYTES) {
            void alertDialog({ message: t('map.invalidFile'), tone: 'error' });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = sanitizeMap(safeJsonParse(String(e.target?.result ?? '')));
            if (data) onMapDataChange(data);
            else void alertDialog({ message: t('map.invalidFile'), tone: 'error' });
        };
        reader.onerror = () => void alertDialog({ message: t('quiz.parseError'), tone: 'error' });
        reader.readAsText(file);
    };

    const handleExitMap = () => {
        onMapDataChange(null);
        clearTask(noteId, 'map');
    };

    if (isGenerating) {
        return (
            <div role="status" className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg min-h-[400px]">
                <Loader className="w-12 h-12 text-accent-ink animate-spin motion-reduce:animate-none mb-4" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-gray-800">{t('map.generatingTitle')}</h3>
                <p className="text-gray-600 mt-2 text-center">{t('quiz.generatingDesc')}</p>
            </div>
        );
    }

    if (!mapData) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg min-h-[400px]">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">{t('map.startTitle')}</h3>
                <p className="text-gray-600 mb-6 text-center max-w-md">{t('map.startDesc')}</p>
                
                {error && <p role="alert" className="text-red-700 mb-4 bg-red-50 p-3 rounded-sm">{error}</p>}

                <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={handleGenerate} className="px-6 py-3 min-h-11 bg-accent text-accent-fg font-semibold rounded-lg hover:bg-accent-hover transition-colors">
                        {t('quiz.generate')}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 min-h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                        {t('map.upload')}
                    </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json,application/json" className="hidden" tabIndex={-1} aria-hidden="true" />
            </div>
        );
    }

    return (
        <div className={`p-6 bg-surface rounded-lg shadow-md border border-gray-200 ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{mapData.title}</h2>
                <button onClick={handleExitMap} className="px-4 py-2.5 min-h-11 text-sm bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                    {t('map.delete')}
                </button>
            </div>
            <div 
                className={`border border-gray-200 rounded-lg bg-gray-50 ${isFullscreen ? 'grow' : ''}`} 
                style={{ height: isFullscreen ? 'calc(100dvh - 200px)' : '500px' }}
                role="img"
                aria-label={`${t('map.aria')}: ${mapData.title}`}
            >
                <Graph
                    key={mapData.title}
                    graph={mapData.graph}
                    options={graphOptions}
                />
            </div>
        </div>
    );
};

export default ConceptMapView;