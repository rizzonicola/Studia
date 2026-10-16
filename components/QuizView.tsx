import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QuizData } from '../types';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { useI18n } from '../i18n/I18nProvider';
import { sanitizeQuiz, safeJsonParse } from '../services/validators';
import { MAX_IMPORT_BYTES } from '../config/appConfig';
import { alertDialog } from '../utils/dialogs';

interface QuizViewProps {
  noteId: string;
  quizData: QuizData | null;
  onQuizDataChange: (data: QuizData | null) => void;
  sourceContent?: string;
}

const QuizView: React.FC<QuizViewProps> = ({ noteId, quizData, onQuizDataChange, sourceContent }) => {
  const { backgroundTasks, generateQuiz, clearTask } = useAIProcessor();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Stato globale del task (solo per spinner ed errori)
  const activeTask = backgroundTasks[`${noteId}-quiz`];
  const isGenerating = activeTask?.status === 'loading';
  const error = activeTask?.status === 'error' ? activeTask.error : null;

  const resetQuizState = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setQuizFinished(false);
  }, []);

  useEffect(() => {
    resetQuizState();
  }, [quizData, resetQuizState]);

  const handleGenerate = () => {
    if (!sourceContent || sourceContent.length < 50) {
      void alertDialog({ message: t('quiz.tooShort') });
      return;
    }
    generateQuiz(noteId, sourceContent);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      void alertDialog({ message: t('quiz.invalidFile'), tone: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = sanitizeQuiz(safeJsonParse(String(e.target?.result ?? '')));
      if (data) onQuizDataChange(data);
      else void alertDialog({ message: t('quiz.invalidFile'), tone: 'error' });
    };
    reader.onerror = () => void alertDialog({ message: t('quiz.parseError'), tone: 'error' });
    reader.readAsText(file);
  };

  const handleAnswerSelect = (option: string) => {
    if (showExplanation || !quizData) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    if (option === quizData.questions[currentQuestionIndex].correctAnswer) setScore((prev) => prev + 1);
  };

  const handleNextQuestion = () => {
    if (!quizData) return;
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizFinished(true);
    }
  };

  const handleExitQuiz = () => {
    onQuizDataChange(null);
    clearTask(noteId, 'quiz'); // pulisce eventuali stati d'errore
  };

  if (isGenerating) {
    return (
      <div role="status" className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg min-h-[400px]">
        <Loader className="w-12 h-12 text-accent-ink animate-spin motion-reduce:animate-none mb-4" aria-hidden="true" />
        <h3 className="text-xl font-semibold text-gray-800">{t('quiz.generatingTitle')}</h3>
        <p className="text-gray-600 mt-2 text-center">{t('quiz.generatingDesc')}</p>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg min-h-[400px]">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">{t('quiz.startTitle')}</h3>
        <p className="text-gray-600 mb-6 text-center max-w-md">{t('quiz.startDesc')}</p>

        {error && <p role="alert" className="text-red-700 mb-4 bg-red-50 p-3 rounded-sm">{error}</p>}

        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={handleGenerate} className="px-6 py-3 min-h-11 bg-accent text-accent-fg font-semibold rounded-lg hover:bg-accent-hover transition-colors">
            {t('quiz.generate')}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 min-h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
            {t('quiz.uploadJson')}
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json,application/json" className="hidden" tabIndex={-1} aria-hidden="true" />
      </div>
    );
  }

  if (quizFinished) {
    return (
      <div className="p-6 bg-surface rounded-lg shadow-md border border-gray-200 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('quiz.completed')}</h2>
        <p className="text-lg text-gray-600 mb-6">
          {t('quiz.scoreBefore')} <span className="font-bold text-accent-ink">{score}</span> {t('quiz.scoreOf')}{' '}
          <span className="font-bold">{quizData.questions.length}</span>
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={resetQuizState} className="px-6 py-2.5 min-h-11 bg-accent text-accent-fg font-semibold rounded-lg hover:bg-accent-hover transition-colors">
            {t('quiz.retry')}
          </button>
          <button onClick={handleExitQuiz} className="px-6 py-2.5 min-h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
            {t('quiz.delete')}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  return (
    <div className="p-6 bg-surface rounded-lg shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-gray-800">{quizData.title}</h2>
        <p className="text-sm font-semibold text-gray-600 shrink-0">
          {t('quiz.questionOf', { current: currentQuestionIndex + 1, total: quizData.questions.length })}
        </p>
      </div>
      <div className="mb-6">
        <p className="text-lg text-gray-700">{currentQuestion.questionText}</p>
      </div>
      <div role="group" aria-label={t('quiz.choose')} className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = option === currentQuestion.correctAnswer;
          const isSelected = option === selectedAnswer;

          let buttonClass = 'w-full text-left p-4 min-h-11 rounded-lg border-2 transition-colors duration-200 disabled:cursor-not-allowed';
          if (showExplanation) {
            if (isCorrect) buttonClass += ' bg-green-100 border-green-500 text-green-900';
            else if (isSelected) buttonClass += ' bg-red-100 border-red-500 text-red-900';
            else buttonClass += ' bg-gray-100 border-gray-300 text-gray-700';
          } else {
            buttonClass += ' bg-surface border-gray-300 hover:bg-gray-100 hover:border-accent-ink';
          }

          return (
            <button key={index} onClick={() => handleAnswerSelect(option)} disabled={showExplanation} className={buttonClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{option}</span>
                {showExplanation && isCorrect && (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-700 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t('quiz.correct')}</span>
                  </>
                )}
                {showExplanation && isSelected && !isCorrect && (
                  <>
                    <XCircle className="w-5 h-5 text-red-700 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t('quiz.wrong')}</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div aria-live="polite">
        {showExplanation && (
          <div className="p-4 bg-accent-soft border border-accent-ink/30 rounded-lg mb-6 animate-fade-in">
            <h4 className="font-bold text-fg mb-2">{t('quiz.explanation')}</h4>
            <p className="text-sm text-fg">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-3">
        <button onClick={handleExitQuiz} className="px-4 py-2.5 min-h-11 text-sm bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">
          {t('quiz.delete')}
        </button>
        {showExplanation ? (
          <button onClick={handleNextQuestion} className="px-6 py-2.5 min-h-11 bg-accent text-accent-fg font-semibold rounded-lg hover:bg-accent-hover transition-colors">
            {currentQuestionIndex < quizData.questions.length - 1 ? t('quiz.next') : t('quiz.finish')}
          </button>
        ) : (
          <button disabled className="px-6 py-2.5 min-h-11 bg-gray-300 text-gray-700 font-semibold rounded-lg cursor-not-allowed">
            {t('quiz.choose')}
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizView;
