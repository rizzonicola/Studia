/**
 * Contenuti delle pagine informative statiche. Solo dati: nessuna logica (il codice HTML è in seo/render.ts).
 *
 * Collegamenti dentro i testi: {chiave|testo} → pagina interna (se non esiste in quella lingua resta testo semplice),
 * {app|testo} → l'app (/), {/percorso|testo} → URL interno, {https://...|testo} → link esterno.
 * Scrivi per chi cerca una risposta: affermazioni verificate sul comportamento reale dell'app, nessuna promessa generica.
 * Dopo ogni modifica sostanziale aggiorna `modified`: finisce in <lastmod> della sitemap e nei dati strutturati.
 */
import type { PageKey, SeoLang } from '../config/seoRoutes';

export interface Section { h: string; p?: string[]; ol?: string[]; ul?: string[] }
export interface Faq { q: string; a: string }
export interface PageContent {
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** Etichetta nelle briciole di pane (guide). */
  crumb?: string;
  sections: Section[];
  faq: Faq[];
  published: string;
  modified: string;
}

export interface LangUi {
  htmlLang: string;
  ogLocale: string;
  nativeName: string;
  openApp: string;
  skip: string;
  guides: string;
  otherGuides: string;
  faqTitle: string;
  languages: string;
  terms: string;
  privacy: string;
  contact: string;
  managedBy: string;
  /** Crediti: «Progetto di <autore>» e «Codice distribuito con licenza <licenza>». */
  madeBy: string;
  licensedUnder: string;
  disclaimer: string;
  imageAlt: string;
  ctaTitle: string;
  ctaText: string;
  crumbNav: string;
  features: string[];
}

export const UI: Record<SeoLang, LangUi> = {
  it: {
    htmlLang: 'it',
    ogLocale: 'it_IT',
    nativeName: 'Italiano',
    openApp: 'Apri StudIA',
    skip: 'Vai al contenuto',
    guides: 'Guide',
    otherGuides: 'Altre guide',
    faqTitle: 'Domande frequenti',
    languages: 'Lingua',
    terms: 'Termini di Servizio',
    privacy: 'Privacy Policy',
    contact: 'Contatti',
    managedBy: 'Sito gestito da',
    madeBy: 'Progetto di',
    licensedUnder: 'Codice distribuito con licenza',
    disclaimer: 'Google e Gemini sono marchi di Google LLC; StudIA non è affiliata a Google.',
    imageAlt: 'StudIA – appunti, quiz e mappe concettuali con Google Gemini',
    ctaTitle: 'Prova StudIA',
    ctaText: 'Nessun account: accetti i Termini, incolli la tua chiave API e inizi a creare appunti, quiz e mappe.',
    crumbNav: 'Percorso di navigazione',
    features: ['Appunti da PDF, foto, audio e video', 'Quiz con spiegazioni', 'Mappe concettuali', 'Nessun account, chiave API personale'],
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    nativeName: 'English',
    openApp: 'Open StudIA',
    skip: 'Skip to content',
    guides: 'Guides',
    otherGuides: 'More guides',
    faqTitle: 'Frequently asked questions',
    languages: 'Language',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact',
    managedBy: 'Site run by',
    madeBy: 'A project by',
    licensedUnder: 'Code released under the',
    disclaimer: 'Google and Gemini are trademarks of Google LLC; StudIA is not affiliated with Google.',
    imageAlt: 'StudIA – notes, quizzes and concept maps with Google Gemini',
    ctaTitle: 'Try StudIA',
    ctaText: 'No account: accept the Terms, paste your own API key and start creating notes, quizzes and maps.',
    crumbNav: 'Breadcrumb',
    features: ['Notes from PDFs, photos, audio and video', 'Quizzes with explanations', 'Concept maps', 'No account, personal API key'],
  },
  fr: {
    htmlLang: 'fr',
    ogLocale: 'fr_FR',
    nativeName: 'Français',
    openApp: 'Ouvrir StudIA',
    skip: 'Aller au contenu',
    guides: 'Guides',
    otherGuides: "D'autres guides",
    faqTitle: 'Questions fréquentes',
    languages: 'Langue',
    terms: "Conditions d'utilisation",
    privacy: 'Politique de confidentialité',
    contact: 'Contact',
    managedBy: 'Site géré par',
    madeBy: 'Un projet de',
    licensedUnder: 'Code distribué sous la licence',
    disclaimer: "Google et Gemini sont des marques de Google LLC ; StudIA n'est pas affiliée à Google.",
    imageAlt: 'StudIA – notes, quiz et cartes conceptuelles avec Google Gemini',
    ctaTitle: 'Essayer StudIA',
    ctaText: "Sans compte : vous acceptez les Conditions, collez votre propre clé API et créez vos notes, quiz et cartes.",
    crumbNav: "Fil d'Ariane",
    features: ['Notes à partir de PDF, photos, audio et vidéo', 'Quiz avec explications', 'Cartes conceptuelles', 'Sans compte, clé API personnelle'],
  },
};

const D = '2026-10-04';
/** Ultima modifica del testo della guida «chiave API» (modello di riserva attivo di default): finisce in <lastmod> della sitemap e nei dati strutturati. */
const D_API_KEY = '2026-10-11';
/** Ultima modifica del testo della home (ancore dei link alla guida chiave, S13): finisce in <lastmod> della sitemap per "/" e per /it/, /en/, /fr/. */
const D_HOME = '2026-10-15';

export const PAGES: { [L in SeoLang]: Partial<Record<PageKey, PageContent>> } = {
  // ───────────────────────────── ITALIANO ─────────────────────────────
  it: {
    home: {
      title: "StudIA – Appunti, quiz e mappe concettuali con l'AI",
      description: 'Trasforma PDF, foto e lezioni registrate in appunti, quiz e mappe concettuali con Google Gemini. Niente account: usi la tua chiave API. Appunti salvati nel browser.',
      h1: "Appunti, quiz e mappe concettuali creati dall'intelligenza artificiale",
      lead: 'StudIA trasforma i tuoi materiali di studio in appunti ordinati, quiz con spiegazioni e mappe concettuali, usando i modelli Gemini di Google. Non serve un account: colleghi la tua chiave API personale e inizi a studiare.',
      sections: [
        {
          h: 'Cosa puoi fare con StudIA',
          ul: [
            '{notes|Appunti da PDF, foto, audio e video}: carichi il materiale, scatti la foto di una pagina o registri la lezione dal microfono e ottieni una nota in Markdown, con supporto alle formule matematiche.',
            '{quiz|Quiz dai tuoi appunti}: domande con risposte da scegliere, spiegazione di ogni risposta e punteggio finale.',
            '{maps|Mappe concettuali}: i concetti chiave e i collegamenti tra loro, visualizzati come rete interattiva.',
            'Organizzazione e controllo: cartelle con trascinamento, prompt personalizzabili, esportazione in .md, .html o ZIP.',
          ],
        },
        {
          h: 'Come funziona',
          ol: [
            'Ottieni una chiave API gratuita da Google AI Studio: la {apiKey|guida alla chiave API Gemini gratuita} richiede pochi minuti.',
            'Apri {app|StudIA}, accetta Termini e Privacy e incolla la chiave. Resta nel browser di questo dispositivo.',
            'Carica un file, scatta la foto di una pagina o registra la lezione.',
            'Genera gli appunti, poi crea quiz e mappa concettuale per ripassare.',
          ],
        },
        {
          h: 'Formati supportati',
          p: ['PDF, TXT, HTML, Markdown, CSV e RTF; immagini PNG, JPG, WEBP, GIF e HEIC; audio WAV, MP3, AAC, FLAC, OGG, AIFF e OPUS; video MP4, MOV, WEBM e altri formati supportati da Gemini. I file Word e PowerPoint non si caricano direttamente: salvali prima in PDF.'],
        },
        {
          h: 'Privacy e costi, senza sorprese',
          p: [
            'StudIA non ha account né un server che conserva i tuoi contenuti: appunti, cartelle e impostazioni restano nel tuo browser. La chiave API viene inviata soltanto a Google.',
            "Quando usi le funzioni AI, i contenuti che scegli di elaborare partono direttamente dal tuo browser verso le API di Google Gemini. Con il servizio gratuito Google può usarli per migliorare i propri prodotti: controlla i termini di Google prima di caricare materiale riservato o che riprende altre persone. Dettagli nell'{/privacy|Informativa Privacy}.",
            "L'uso di StudIA è gratuito. Limiti di utilizzo ed eventuali costi della chiave API dipendono dal tuo rapporto con Google.",
          ],
        },
      ],
      faq: [
        { q: 'StudIA è gratuita?', a: "L'uso di StudIA è gratuito. Per le funzioni AI serve una chiave API personale di Google AI Studio: limiti, quote ed eventuali costi sono stabiliti da Google e dipendono dal tuo account." },
        { q: 'Serve registrarsi?', a: 'No. Non esiste un account StudIA: la prima volta accetti Termini e Privacy e incolli la tua chiave API; appunti e impostazioni restano nel browser.' },
        { q: 'Dove finiscono i miei appunti e i miei file?', a: "Gli appunti restano nel browser del tuo dispositivo. I testi e i file che elabori con l'AI vengono inviati dal tuo browser a Google Gemini con la tua chiave; per i file caricati l'app ne richiede la cancellazione dai server di Google quando l'elaborazione riesce. Tutti i dettagli sono nell'{/privacy|Informativa Privacy}." },
        { q: 'Funziona su smartphone e offline?', a: 'Sì: è una web app installabile (PWA) che funziona dal browser su smartphone, tablet e computer. Gli appunti già salvati si consultano anche senza connessione; per generare contenuti nuovi serve la rete.' },
        { q: 'In quali lingue funziona?', a: "Italiano, inglese e francese. L'interfaccia segue la lingua del dispositivo e puoi scegliere se i contenuti generati usino la lingua del documento o quella dell'app." },
      ],
      published: D,
      modified: D_HOME,
    },
    apiKey: {
      title: 'Chiave API Gemini gratis: come ottenerla passo passo',
      description: 'Come creare gratis una chiave API Gemini su Google AI Studio e usarla in StudIA: passaggi, sicurezza della chiave, limiti del piano gratuito e problemi comuni.',
      h1: 'Come ottenere una chiave API Gemini gratis (Google AI Studio)',
      lead: "Per usare le funzioni AI di StudIA ti serve una chiave API personale di Google. Si crea in pochi minuti da Google AI Studio con il tuo account Google e resta sotto il tuo controllo.",
      crumb: 'Chiave API Gemini gratis',
      sections: [
        {
          h: 'I passaggi',
          ol: [
            'Apri {https://aistudio.google.com/api-keys|Google AI Studio} e accedi con il tuo account Google.',
            'Clicca su «Create API key» (Crea chiave API). Se richiesto, scegli o crea un progetto.',
            'Copia la chiave generata.',
            'Apri {app|StudIA}, accetta Termini e Privacy e incolla la chiave nel campo dedicato.',
            'Puoi cambiarla o eliminarla in qualsiasi momento da Impostazioni.',
          ],
        },
        {
          h: 'Come proteggere la chiave',
          ul: [
            'Trattala come una password: non condividerla e non pubblicarla online né in repository di codice.',
            'In StudIA la chiave resta nel browser del tuo dispositivo e viene inviata solo a Google. Su un computer condiviso disattiva «Ricorda la chiave su questo dispositivo»: resterà memorizzata solo per la scheda aperta.',
            "Se sospetti che sia stata compromessa, eliminala da Google AI Studio e creane una nuova.",
          ],
        },
        {
          h: 'Limiti e costi',
          p: [
            "Il piano gratuito della Gemini API ha limiti di richieste e di utilizzo che Google stabilisce e può cambiare nel tempo: li trovi in AI Studio. Con il servizio gratuito Google può inoltre usare i contenuti inviati per migliorare i propri prodotti, quindi evita di elaborare materiale riservato.",
            "Se il modello principale raggiunge i limiti, StudIA riprova subito con un modello di riserva (attivo di default, con la stessa chiave API); se anche questo non risponde, la generazione si interrompe con un errore: attendi e riprova più tardi. Dalle Impostazioni di StudIA puoi scegliere il modello, cambiare quello di riserva o disattivarlo.",
          ],
        },
      ],
      faq: [
        { q: 'La chiave API Gemini è davvero gratuita?', a: "Google offre un piano gratuito per la Gemini API, con limiti d'uso. Condizioni e limiti sono di Google e possono cambiare: controllali in Google AI Studio." },
        { q: 'Posso usare la stessa chiave su più dispositivi?', a: 'Sì, puoi incollarla su ogni dispositivo che usi. Ricorda però che ogni dispositivo in cui la inserisci è un posto in più in cui la chiave è salvata.' },
        { q: 'Cosa faccio se la chiave non viene accettata?', a: "Controlla di aver copiato la chiave intera, senza spazi. Se il problema continua, creane una nuova in AI Studio. Se l'errore compare durante la generazione, potrebbe trattarsi del limite di richieste: attendi e riprova." },
      ],
      published: D,
      modified: D_API_KEY,
    },
    notes: {
      title: "Appunti con l'AI da PDF, foto e registrazioni audio",
      description: "Come trasformare PDF, foto di pagine, lezioni registrate e video in appunti ordinati con l'intelligenza artificiale di Gemini: formati, passaggi e consigli.",
      h1: "Come creare appunti con l'AI da PDF, foto e lezioni registrate",
      lead: "Con StudIA un documento, la foto di una pagina o la registrazione di una lezione diventano appunti in Markdown, ordinati e pronti da studiare. Serve solo {apiKey|una chiave API gratuita di Google AI Studio}.",
      crumb: "Appunti con l'AI",
      sections: [
        {
          h: 'Da un file: PDF, testo, audio e video',
          p: [
            'Nella sezione Carica trascini (o scegli) uno o più file e premi «Genera Appunti con StudIA». Sono supportati PDF, TXT, HTML, Markdown, CSV e RTF, immagini, audio (MP3, WAV, AAC, FLAC, OGG, AIFF, OPUS) e video (MP4, MOV, WEBM e altri formati Gemini). Ogni file può pesare fino a 500 MB.',
            'I file Word e PowerPoint non sono supportati direttamente: esportali prima in PDF.',
          ],
        },
        {
          h: 'Da una foto della pagina',
          p: ['Nella sezione Fotocamera scatti la pagina del libro o del quaderno (oppure scegli una foto dalla galleria) e premi «Converti in Pagina»: il testo diventa una nota digitale modificabile. Per risultati migliori fotografa con buona luce e senza ombre sulla pagina.'],
        },
        {
          h: 'Da una lezione registrata',
          p: ["Dalla sezione Carica puoi registrare l'audio direttamente dal microfono, con pausa e ripresa, e trasformarlo in appunti. Avvicina il dispositivo a chi parla e riduci i rumori di fondo. Prima di registrare altre persone devi avere il loro consenso informato, anche all'invio dei contenuti a Google."],
        },
        {
          h: 'Dopo gli appunti',
          p: ["Gli appunti si modificano, si riordinano in cartelle e si scaricano in .md o .html (intere cartelle in ZIP). Da ogni appunto puoi generare un {quiz|quiz} e una {maps|mappa concettuale} per ripassare."],
        },
      ],
      faq: [
        { q: 'Posso caricare file Word o PowerPoint?', a: 'Non direttamente. Salva il documento in PDF e caricalo: è un formato supportato.' },
        { q: 'In che lingua scrive gli appunti?', a: "Per impostazione predefinita nella stessa lingua del documento; dalle Impostazioni puoi scegliere di usare la lingua dell'app. I prompt sono personalizzabili." },
        { q: 'I miei file vengono salvati online?', a: "Vengono inviati a Google Gemini con la tua chiave per essere elaborati; l'app ne richiede la cancellazione dai server di Google quando l'elaborazione riesce. Gli appunti generati restano nel tuo browser. Dettagli nell'{/privacy|Informativa Privacy}." },
      ],
      published: D,
      modified: D,
    },
    quiz: {
      title: "Quiz dai tuoi appunti con l'AI: come generarli",
      description: "Genera quiz con spiegazioni a partire da appunti e PDF usando l'AI: come funziona in StudIA, quanto testo serve e come usarli per ripassare.",
      h1: "Come generare un quiz dai tuoi appunti con l'intelligenza artificiale",
      lead: 'Un quiz è il modo più rapido per capire cosa hai davvero memorizzato. In StudIA lo generi con un clic da qualsiasi appunto e lo svolgi subito, con la spiegazione di ogni risposta.',
      crumb: 'Quiz con AI',
      sections: [
        {
          h: 'Come si crea',
          ol: [
            'Apri un appunto, oppure creane uno {notes|da PDF, foto o audio}.',
            'Vai alla scheda Quiz e premi «Genera con StudIA».',
            'Attendi la generazione: puoi cambiare pagina, il risultato viene salvato in automatico.',
            'Rispondi alle domande: dopo ogni risposta vedi se è corretta e leggi la spiegazione. Alla fine compare il punteggio.',
          ],
        },
        {
          h: 'Consigli per quiz migliori',
          ul: [
            "L'appunto deve avere abbastanza contenuto: se è troppo breve StudIA non genera il quiz.",
            'Per la generazione vengono usati al massimo circa 30.000 caratteri di testo: per materiali molto lunghi dividi il contenuto in appunti per argomento.',
            'Puoi personalizzare le istruzioni (prompt) per chiedere, ad esempio, un altro stile o livello di difficoltà delle domande.',
          ],
        },
        {
          h: 'Importare ed esportare i quiz',
          p: ["Un quiz è un file JSON: puoi caricarne uno già pronto («Carica JSON») e modificarlo dall'editor dell'appunto. Il formato viene controllato prima del salvataggio, così un errore non rovina il quiz."],
        },
      ],
      faq: [
        { q: 'Le risposte del quiz sono sempre corrette?', a: 'Il quiz è generato da un modello di intelligenza artificiale e può contenere errori: confronta le risposte con le tue fonti, soprattutto per esami e materie tecniche.' },
        { q: 'Posso usare quiz e appunti offline?', a: 'Una volta generati, appunti e quiz sono salvati nel browser e si consultano anche senza connessione. Per generarne di nuovi serve la rete.' },
        { q: 'Serve un account?', a: 'No, serve solo la tua {apiKey|chiave API Gemini}.' },
      ],
      published: D,
      modified: D,
    },
    maps: {
      title: "Mappe concettuali con l'AI: crea la mappa dai tuoi appunti",
      description: "Genera mappe concettuali dai tuoi appunti con l'intelligenza artificiale: concetti chiave e collegamenti in una mappa interattiva. Guida a StudIA.",
      h1: "Come creare una mappa concettuale dai tuoi appunti con l'AI",
      lead: "Una mappa concettuale mostra i concetti chiave di un argomento e come si collegano. StudIA la costruisce a partire dai tuoi appunti e la visualizza come rete interattiva.",
      crumb: 'Mappe concettuali con AI',
      sections: [
        {
          h: 'Come si crea',
          ol: [
            "Apri l'appunto da cui partire, oppure creane uno {notes|da PDF, foto o audio}.",
            'Vai alla scheda Mappa e avvia la generazione.',
            'Esplora la mappa per vedere come si collegano i concetti. Il risultato viene salvato in automatico insieme all\'appunto.',
          ],
        },
        {
          h: 'Quando conviene usarla',
          p: ["È utile per capire la struttura di un capitolo, collegare argomenti diversi e ripassare prima di un'interrogazione o di un esame. Abbinala al {quiz|quiz} per verificare ciò che hai capito."],
        },
        {
          h: 'Limiti da conoscere',
          ul: [
            "Come per i quiz, per la generazione vengono usati al massimo circa 30.000 caratteri di testo, e un appunto troppo breve non produce una mappa.",
            'La mappa è generata da un modello AI: può omettere concetti o proporre collegamenti discutibili, quindi controllala con le tue fonti.',
            "Le mappe sono file JSON: puoi caricarne una già pronta («Carica Mappa») e modificarla dall'editor dell'appunto.",
          ],
        },
      ],
      faq: [
        { q: 'Posso modificare la mappa?', a: "Sì. La mappa è salvata come JSON e si modifica dall'editor dell'appunto; il formato viene controllato prima di salvare." },
        { q: 'La mappa funziona su smartphone?', a: 'Sì, StudIA è una web app adatta anche ai dispositivi mobili. La libreria della mappa viene scaricata solo quando ne apri una.' },
      ],
      published: D,
      modified: D,
    },
  },

  // ───────────────────────────── ENGLISH ─────────────────────────────
  en: {
    home: {
      title: 'StudIA – AI notes, quizzes and concept maps with Gemini',
      description: 'Turn PDFs, photos and lecture recordings into notes, quizzes and concept maps with Google Gemini. No account: bring your own API key. Notes stay in your browser.',
      h1: 'Notes, quizzes and concept maps created by AI',
      lead: 'StudIA turns your study material into clear notes, quizzes with explanations and concept maps, using Google’s Gemini models. No account needed: connect your own API key and start studying.',
      sections: [
        {
          h: 'What you can do with StudIA',
          ul: [
            'Notes from PDFs, photos, audio and video: upload material, photograph a page or record a lecture with your microphone and get a Markdown note with math formula support.',
            'Quizzes from your notes: questions with answers to choose from, an explanation for each answer and a final score.',
            'Concept maps: the key concepts and how they connect, shown as an interactive network.',
            'Organization and control: folders with drag and drop, customizable prompts, export to .md, .html or ZIP.',
          ],
        },
        {
          h: 'How it works',
          ol: [
            'Get a free API key from Google AI Studio: the {apiKey|guide to getting a free Gemini API key} takes a few minutes.',
            'Open {app|StudIA}, accept the Terms and Privacy Policy and paste the key. It stays in this device’s browser.',
            'Upload a file, photograph a page or record a lecture.',
            'Generate your notes, then create a quiz and a concept map to review.',
          ],
        },
        {
          h: 'Supported formats',
          p: ['PDF, TXT, HTML, Markdown, CSV and RTF; images in PNG, JPG, WEBP, GIF and HEIC; audio in WAV, MP3, AAC, FLAC, OGG, AIFF and OPUS; video in MP4, MOV, WEBM and other formats supported by Gemini. Word and PowerPoint files can’t be uploaded directly: save them as PDF first.'],
        },
        {
          h: 'Privacy and costs, no surprises',
          p: [
            'StudIA has no accounts and no server that stores your content: notes, folders and settings stay in your browser. Your API key is only sent to Google.',
            'When you use the AI features, the content you choose to process goes straight from your browser to the Google Gemini API. On Google’s free service, Google may use it to improve its products: check Google’s terms before uploading confidential material or material showing other people. Details in the {/privacy|Privacy Policy}.',
            'Using StudIA is free. Usage limits and any costs of the API key depend on your relationship with Google.',
          ],
        },
      ],
      faq: [
        { q: 'Is StudIA free?', a: 'Using StudIA is free. The AI features need a personal Google AI Studio API key; limits, quotas and any costs are set by Google and depend on your account.' },
        { q: 'Do I need to sign up?', a: 'No. There is no StudIA account: the first time you accept the Terms and Privacy Policy and paste your API key; notes and settings stay in your browser.' },
        { q: 'Where do my notes and files go?', a: 'Notes stay in your device’s browser. Texts and files you process with AI are sent from your browser to Google Gemini with your key; for uploaded files the app asks Google to delete them once processing succeeds. Full details are in the {/privacy|Privacy Policy}.' },
        { q: 'Does it work on phones and offline?', a: 'Yes: it is an installable web app (PWA) that runs in the browser on phones, tablets and computers. Notes you have already saved can be read without a connection; generating new content needs the network.' },
      ],
      published: D,
      modified: D_HOME,
    },
    apiKey: {
      title: 'Free Gemini API Key: How to Get One, Step by Step',
      description: 'How to create a free Gemini API key in Google AI Studio and use it in StudIA: steps, keeping the key safe, free-tier limits and common problems.',
      h1: 'How to get a free Gemini API key (Google AI Studio)',
      lead: 'To use StudIA’s AI features you need a personal Google API key. You create it in a few minutes in Google AI Studio with your Google account, and it stays under your control.',
      crumb: 'Free Gemini API key',
      sections: [
        {
          h: 'Steps',
          ol: [
            'Open {https://aistudio.google.com/api-keys|Google AI Studio} and sign in with your Google account.',
            'Click “Create API key”. If asked, choose or create a project.',
            'Copy the generated key.',
            'Open {app|StudIA}, accept the Terms and Privacy Policy and paste the key into the field.',
            'You can change or delete it at any time in Settings.',
          ],
        },
        {
          h: 'Keeping your key safe',
          ul: [
            'Treat it like a password: don’t share it or publish it online or in code repositories.',
            'In StudIA the key stays in your device’s browser and is only sent to Google. On a shared computer, turn off “Remember the key on this device”: it will then be kept only for the open tab.',
            'If you suspect it has been compromised, delete it in Google AI Studio and create a new one.',
          ],
        },
        {
          h: 'Limits and costs',
          p: [
            'The Gemini API free tier has request and usage limits that Google sets and may change over time: you can find them in AI Studio. On the free service Google may also use submitted content to improve its products, so avoid processing confidential material.',
            'If the main model hits its limits, StudIA immediately retries with a fallback model (on by default, same API key); if that one fails too, generation stops with an error: wait and try again later. In StudIA’s Settings you can choose the model, change the fallback model or turn it off.',
          ],
        },
      ],
      faq: [
        { q: 'Is the Gemini API key really free?', a: 'Google offers a free tier for the Gemini API, with usage limits. Terms and limits are Google’s and may change: check them in Google AI Studio.' },
        { q: 'Can I use the same key on several devices?', a: 'Yes, you can paste it on every device you use. Keep in mind that each device where you enter it is one more place where the key is stored.' },
        { q: 'What if my key isn’t accepted?', a: 'Check that you copied the whole key, with no spaces. If the problem continues, create a new one in AI Studio. If the error appears during generation, it may be the request limit: wait and try again.' },
      ],
      published: D,
      modified: D_API_KEY,
    },
  },

  // ───────────────────────────── FRANÇAIS ─────────────────────────────
  fr: {
    home: {
      title: "StudIA – Notes, quiz et cartes conceptuelles avec l'IA",
      description: "Transformez PDF, photos et cours enregistrés en notes, quiz et cartes conceptuelles avec Google Gemini. Sans compte : votre clé API. Notes dans le navigateur.",
      h1: "Notes, quiz et cartes conceptuelles créés par l'intelligence artificielle",
      lead: "StudIA transforme vos supports de cours en notes claires, quiz avec explications et cartes conceptuelles, grâce aux modèles Gemini de Google. Aucun compte : vous connectez votre clé API personnelle et vous révisez.",
      sections: [
        {
          h: 'Ce que vous pouvez faire avec StudIA',
          ul: [
            "Notes à partir de PDF, photos, audio et vidéo : importez vos documents, photographiez une page ou enregistrez un cours avec le micro, et obtenez une note Markdown compatible avec les formules mathématiques.",
            'Quiz à partir de vos notes : des questions avec des réponses à choisir, une explication pour chaque réponse et un score final.',
            "Cartes conceptuelles : les notions clés et leurs liens, affichés sous forme de réseau interactif.",
            "Organisation et contrôle : dossiers avec glisser-déposer, prompts personnalisables, export en .md, .html ou ZIP.",
          ],
        },
        {
          h: 'Comment ça marche',
          ol: [
            "Obtenez une clé API gratuite sur Google AI Studio : le {apiKey|guide pour obtenir une clé API Gemini gratuite} prend quelques minutes.",
            "Ouvrez {app|StudIA}, acceptez les Conditions et la politique de confidentialité, puis collez la clé. Elle reste dans le navigateur de cet appareil.",
            'Importez un fichier, photographiez une page ou enregistrez un cours.',
            'Générez vos notes, puis créez un quiz et une carte conceptuelle pour réviser.',
          ],
        },
        {
          h: 'Formats pris en charge',
          p: ["PDF, TXT, HTML, Markdown, CSV et RTF ; images PNG, JPG, WEBP, GIF et HEIC ; audio WAV, MP3, AAC, FLAC, OGG, AIFF et OPUS ; vidéo MP4, MOV, WEBM et autres formats pris en charge par Gemini. Les fichiers Word et PowerPoint ne s'importent pas directement : enregistrez-les d'abord en PDF."],
        },
        {
          h: 'Confidentialité et coûts, sans surprise',
          p: [
            "StudIA n'a ni compte ni serveur qui conserve vos contenus : notes, dossiers et réglages restent dans votre navigateur. Votre clé API n'est envoyée qu'à Google.",
            "Quand vous utilisez les fonctions d'IA, les contenus que vous choisissez de traiter partent directement de votre navigateur vers l'API Google Gemini. Avec le service gratuit, Google peut les utiliser pour améliorer ses produits : consultez les conditions de Google avant d'importer du matériel confidentiel ou montrant d'autres personnes. Détails dans la {/privacy|politique de confidentialité}.",
            "L'utilisation de StudIA est gratuite. Les limites d'usage et les éventuels coûts de la clé API dépendent de votre relation avec Google.",
          ],
        },
      ],
      faq: [
        { q: 'StudIA est-elle gratuite ?', a: "L'utilisation de StudIA est gratuite. Les fonctions d'IA nécessitent une clé API personnelle Google AI Studio ; les limites, quotas et éventuels coûts sont fixés par Google et dépendent de votre compte." },
        { q: "Faut-il s'inscrire ?", a: "Non. Il n'existe pas de compte StudIA : la première fois, vous acceptez les Conditions et la politique de confidentialité et vous collez votre clé API ; notes et réglages restent dans le navigateur." },
        { q: 'Où vont mes notes et mes fichiers ?', a: "Les notes restent dans le navigateur de votre appareil. Les textes et fichiers traités avec l'IA sont envoyés depuis votre navigateur à Google Gemini avec votre clé ; pour les fichiers importés, l'application demande à Google de les supprimer quand le traitement réussit. Tous les détails sont dans la {/privacy|politique de confidentialité}." },
        { q: 'Cela fonctionne-t-il sur mobile et hors ligne ?', a: "Oui : c'est une application web installable (PWA) qui fonctionne dans le navigateur sur mobile, tablette et ordinateur. Les notes déjà enregistrées se consultent sans connexion ; pour générer du nouveau contenu, il faut le réseau." },
      ],
      published: D,
      modified: D_HOME,
    },
    apiKey: {
      title: "Clé API Gemini gratuite : comment l'obtenir pas à pas",
      description: "Créer une clé API Gemini gratuite dans Google AI Studio et l'utiliser dans StudIA : étapes, sécurité de la clé, limites de l'offre gratuite, problèmes courants.",
      h1: 'Comment obtenir une clé API Gemini gratuite (Google AI Studio)',
      lead: "Pour utiliser les fonctions d'IA de StudIA, il vous faut une clé API Google personnelle. Vous la créez en quelques minutes dans Google AI Studio avec votre compte Google, et elle reste sous votre contrôle.",
      crumb: 'Clé API Gemini gratuite',
      sections: [
        {
          h: 'Les étapes',
          ol: [
            'Ouvrez {https://aistudio.google.com/api-keys|Google AI Studio} et connectez-vous avec votre compte Google.',
            'Cliquez sur « Create API key » (Créer une clé API). Si on vous le demande, choisissez ou créez un projet.',
            'Copiez la clé générée.',
            'Ouvrez {app|StudIA}, acceptez les Conditions et la politique de confidentialité, puis collez la clé dans le champ prévu.',
            'Vous pouvez la modifier ou la supprimer à tout moment dans les Réglages.',
          ],
        },
        {
          h: 'Protéger votre clé',
          ul: [
            'Traitez-la comme un mot de passe : ne la partagez pas et ne la publiez ni en ligne ni dans un dépôt de code.',
            "Dans StudIA, la clé reste dans le navigateur de votre appareil et n'est envoyée qu'à Google. Sur un ordinateur partagé, désactivez « Mémoriser la clé sur cet appareil » : elle ne sera conservée que pour l'onglet ouvert.",
            "Si vous pensez qu'elle a été compromise, supprimez-la dans Google AI Studio et créez-en une nouvelle.",
          ],
        },
        {
          h: 'Limites et coûts',
          p: [
            "L'offre gratuite de l'API Gemini comporte des limites de requêtes et d'usage que Google fixe et peut modifier : vous les trouverez dans AI Studio. Avec le service gratuit, Google peut aussi utiliser les contenus envoyés pour améliorer ses produits ; évitez donc de traiter du matériel confidentiel.",
            "Si le modèle principal atteint ses limites, StudIA réessaie aussitôt avec un modèle de secours (activé par défaut, même clé API) ; si celui-ci échoue aussi, la génération s'arrête avec une erreur : patientez et réessayez plus tard. Dans les Paramètres de StudIA, vous pouvez choisir le modèle, changer celui de secours ou le désactiver.",
          ],
        },
      ],
      faq: [
        { q: "La clé API Gemini est-elle vraiment gratuite ?", a: "Google propose une offre gratuite pour l'API Gemini, avec des limites d'usage. Les conditions et limites sont celles de Google et peuvent changer : vérifiez-les dans Google AI Studio." },
        { q: 'Puis-je utiliser la même clé sur plusieurs appareils ?', a: "Oui, vous pouvez la coller sur chaque appareil que vous utilisez. Gardez toutefois à l'esprit que chaque appareil où vous l'entrez est un endroit de plus où la clé est enregistrée." },
        { q: "Que faire si ma clé n'est pas acceptée ?", a: "Vérifiez que vous avez copié toute la clé, sans espaces. Si le problème persiste, créez-en une nouvelle dans AI Studio. Si l'erreur apparaît pendant la génération, il peut s'agir de la limite de requêtes : patientez et réessayez." },
      ],
      published: D,
      modified: D_API_KEY,
    },
  },
};
