export const ALL_EMOJIS = [
    '💡', '📚', '🔬', '🎨', '🌍', '🤔', '⚙️', '📈', '📜', '🧠',
    '✨', '🎉', '🚀', '📌', '💼', '💬', '❤️', '✅', '⏳', '💻'
];

export const COLORS = [
    { bg: 'bg-red-100', border: 'border-red-400' },
    { bg: 'bg-orange-100', border: 'border-orange-400' },
    { bg: 'bg-amber-100', border: 'border-amber-400' },
    { bg: 'bg-yellow-100', border: 'border-yellow-400' },
    { bg: 'bg-lime-100', border: 'border-lime-400' },
    { bg: 'bg-green-100', border: 'border-green-400' },
    { bg: 'bg-emerald-100', border: 'border-emerald-400' },
    { bg: 'bg-teal-100', border: 'border-teal-400' },
    { bg: 'bg-cyan-100', border: 'border-cyan-400' },
    { bg: 'bg-sky-100', border: 'border-sky-400' },
    { bg: 'bg-blue-100', border: 'border-blue-400' },
    { bg: 'bg-indigo-100', border: 'border-indigo-400' },
    { bg: 'bg-violet-100', border: 'border-violet-400' },
    { bg: 'bg-purple-100', border: 'border-purple-400' },
    { bg: 'bg-fuchsia-100', border: 'border-fuchsia-400' },
    { bg: 'bg-pink-100', border: 'border-pink-400' },
    { bg: 'bg-rose-100', border: 'border-rose-400' }
];

export const SWATCHES = [
    'bg-red-300', 'bg-orange-300', 'bg-amber-300', 'bg-yellow-300', 'bg-lime-300',
    'bg-green-300', 'bg-emerald-300', 'bg-teal-300', 'bg-cyan-300', 'bg-sky-300',
    'bg-blue-300', 'bg-indigo-300', 'bg-violet-300', 'bg-purple-300', 'bg-fuchsia-300',
    'bg-pink-300', 'bg-rose-300'
];

export const ALL_PASTEL_COLORS = COLORS.map(c => c.bg);
export const ALL_BORDER_COLORS = COLORS.map(c => c.border);

export const BG_TO_SWATCH_MAP: { [key: string]: string } = Object.fromEntries(
    ALL_PASTEL_COLORS.map((color, index) => [color, SWATCHES[index]])
);

export const COLOR_MAP: { [key: string]: string } = Object.fromEntries(
  COLORS.map(c => [c.bg, c.border])
);

export const generateUniqueId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

export const getRandomEmoji = (): string => {
  return ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)];
};

export const getRandomColor = (): string => {
  return ALL_PASTEL_COLORS[Math.floor(Math.random() * ALL_PASTEL_COLORS.length)];
};