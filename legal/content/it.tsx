import React from 'react';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, SITE_URL } from '../../config/appConfig';
import { A, legalDate } from '../shared';

/** Testi legali in ITALIANO. Vanno fatti rivedere da un professionista prima della pubblicazione. */

export const TermsContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Termini di Servizio</h2>
    <p><em>Ultimo aggiornamento: {legalDate('it')}</em></p>

    <h3>1. Oggetto e accettazione</h3>
    <p>
      {APP_NAME} (di seguito "l'App") è un'applicazione web gratuita per creare e organizzare appunti di studio con l'aiuto
      dei modelli di intelligenza artificiale Google Gemini. L'App è accessibile all'indirizzo {SITE_URL} ed è messa a disposizione da {OWNER_NAME}, titolare e gestore del sito (di seguito "il Gestore"), contattabile all'indirizzo <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      Utilizzando l'App dichiari di aver letto e di accettare i presenti Termini di Servizio e l'Informativa sulla Privacy.
      Se non li accetti, non puoi utilizzare l'App.
    </p>

    <h3>2. Nessun account, nessun server di contenuti</h3>
    <p>
      L'App non richiede registrazione. I tuoi appunti, le cartelle e le impostazioni sono salvati esclusivamente nel browser
      del tuo dispositivo. Il Gestore non ha accesso ai tuoi contenuti e non può recuperarli: se cancelli i dati del browser
      o cambi dispositivo, i dati locali andranno persi. Ti consigliamo di esportare regolarmente ciò che ti interessa.
    </p>

    <h3>3. La tua chiave API di Google AI Studio</h3>
    <ul>
      <li>Le funzioni AI funzionano solo con una chiave API personale, che generi tu su Google AI Studio e inserisci nell'App.</li>
      <li>La chiave resta memorizzata nel browser del tuo dispositivo e viene inviata soltanto a Google per autenticare le tue richieste.</li>
      <li>Sei l'unico responsabile della custodia della chiave. Non condividerla e non usarla su dispositivi che non controlli. Se sospetti che sia stata compromessa, eliminala subito dal tuo account Google AI Studio.</li>
      <li>Eventuali costi, limiti di utilizzo (quote) e condizioni applicate all'uso della chiave dipendono dal tuo rapporto con Google e restano a tuo carico.</li>
      <li>Per impostazione predefinita l'App usa un modello di riserva: se il modello principale è sovraccarico, ha esaurito i limiti o non è disponibile, la richiesta viene ripetuta con un secondo modello Gemini usando la tua stessa chiave. Anche queste richieste, con i relativi limiti, costi e condizioni di Google (che possono differire da quelli del modello principale), restano a tuo carico. Puoi disattivare la funzione in qualsiasi momento da Impostazioni → Modello (vedi anche il punto 3.2 dell'Informativa sulla Privacy).</li>
      <li>L'uso dei modelli Gemini è soggetto ai termini di Google, in particolare i <A href="https://ai.google.dev/gemini-api/terms">Termini del servizio API Gemini</A> e le relative norme d'uso vietato.</li>
    </ul>

    <h3>4. I tuoi contenuti</h3>
    <p>
      Resti titolare di tutti i diritti sui materiali che carichi o crei. Dichiari di avere il diritto di utilizzare tali
      materiali e di inviarli a Google per l'elaborazione (ad esempio, di non violare diritti d'autore o obblighi di riservatezza,
      come nel caso di materiale didattico riservato o documenti di terzi).
    </p>

    <h3>5. Registrazioni audio e video: consenso delle persone coinvolte (obbligo vincolante)</h3>
    <p>
      <strong>
        Prima di registrare, caricare o elaborare con l'App qualsiasi file audio, video o immagine in cui compaiano, siano
        riprese o siano riconoscibili persone (ad esempio lezioni, colloqui, riunioni, conversazioni, foto di persone),
        ti impegni a ottenere il consenso libero, informato ed esplicito di tutte le persone riprese o registrate.
      </strong>
    </p>
    <ul>
      <li>Il consenso deve riguardare la registrazione e anche l'invio dei contenuti a un fornitore terzo di intelligenza artificiale (Google) per l'elaborazione.</li>
      <li>Se la registrazione avviene in un contesto regolato (scuola, università, luogo di lavoro), devi inoltre rispettare i regolamenti dell'istituzione o dell'organizzazione e ottenere le autorizzazioni necessarie, ad esempio dal docente.</li>
      <li>Per i minori il consenso deve essere prestato da chi esercita la responsabilità genitoriale, secondo la legge applicabile.</li>
      <li>Non devi registrare né caricare conversazioni alle quali non partecipi, né contenuti che riguardano categorie particolari di dati personali (salute, opinioni, ecc.) senza una valida base giuridica.</li>
      <li>Sei l'unico responsabile della raccolta e della prova del consenso. Il Gestore non è in grado di verificarlo e non ne risponde.</li>
    </ul>
    <p>
      Utilizzando le funzioni di registrazione o di caricamento dichiari e garantisci di aver rispettato quanto sopra. In caso di
      violazione ti assumi ogni responsabilità civile, amministrativa e penale che ne derivi e ti impegni a manlevare il Gestore
      da pretese di terzi, nei limiti consentiti dalla legge.
    </p>

    <h3>6. Uso consentito</h3>
    <p>È vietato utilizzare l'App per:</p>
    <ul>
      <li>violare la legge o diritti di terzi (privacy, diritto d'autore, immagine, riservatezza);</li>
      <li>generare o diffondere contenuti illeciti, offensivi, discriminatori o dannosi;</li>
      <li>aggirare i limiti o le regole d'uso di Google, o tentare di compromettere il funzionamento dell'App;</li>
      <li>utilizzare chiavi API di cui non sei titolare o che non sei autorizzato a usare.</li>
    </ul>

    <h3>7. Contenuti generati dall'AI</h3>
    <p>
      Gli appunti, i quiz, le mappe e gli altri contenuti sono generati automaticamente da modelli di intelligenza artificiale e possono
      contenere errori, omissioni o imprecisioni. Verifica sempre le informazioni importanti sulle fonti originali. I contenuti
      non costituiscono consulenza professionale (medica, legale, finanziaria o altro) e non garantiscono alcun risultato scolastico o d'esame.
    </p>

    <h3>8. Disponibilità del servizio, esclusione di garanzie e responsabilità</h3>
    <p>
      L'App è fornita "così com'è", senza garanzie di continuità, assenza di errori o idoneità a scopi specifici. Il Gestore può
      modificare, sospendere o interrompere l'App in qualsiasi momento. Nei limiti consentiti dalla legge, il Gestore non risponde
      di danni indiretti, perdita di dati locali, costi addebitati da Google, interruzioni dei servizi di terzi o uso improprio
      dell'App. Restano ferme le disposizioni inderogabili a tutela dei consumatori e le responsabilità che la legge non permette di escludere.
    </p>

    <h3>9. Proprietà intellettuale e software open source</h3>
    <p>
      Il nome, il logo e il codice originale dell'App appartengono al Gestore, salvo diversa indicazione. L'App utilizza librerie
      open source distribuite con le rispettive licenze, elencate nella sezione "Informazioni e Dipendenze" delle Impostazioni.
    </p>

    <h3>10. Modifiche ai Termini</h3>
    <p>
      Il Gestore può aggiornare questi Termini. In caso di modifiche sostanziali ti sarà chiesto di accettare nuovamente la nuova versione
      prima di continuare a usare l'App.
    </p>

    <h3>11. Legge applicabile e foro competente</h3>
    <p>
      I presenti Termini sono regolati dalla legge italiana. Se sei un consumatore, restano applicabili le tutele inderogabili
      previste dalla legge del tuo Paese di residenza e il foro del consumatore.
    </p>

    <h3>12. Contatti</h3>
    <p>Per qualsiasi domanda puoi scrivere al Gestore, {OWNER_NAME}, all'indirizzo <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
  </article>
);

export const PrivacyContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Informativa sulla Privacy</h2>
    <p><em>Ultimo aggiornamento: {legalDate('it')}</em></p>
    <p>
      Informativa resa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") e della normativa italiana applicabile
      sulla protezione dei dati personali.
    </p>

    <h3>1. Titolare del trattamento</h3>
    <p>{OWNER_NAME} — contatto: {CONTACT_EMAIL}. Sito: {SITE_URL}.</p>

    <h3>2. In sintesi</h3>
    <ul>
      <li>Non esistono account: non raccogliamo nome, email o password.</li>
      <li>Appunti, cartelle, impostazioni e chiave API rimangono nel <strong>tuo browser</strong>; non li riceviamo.</li>
      <li>Quando usi le funzioni AI, i contenuti che scegli di elaborare vengono inviati <strong>direttamente dal tuo browser a Google</strong> con la tua chiave API.</li>
      <li>Il sito è ospitato su Cloudflare Pages.</li>
    </ul>

    <h3>3. Dati trattati e finalità</h3>

    <h4>3.1 Dati salvati sul tuo dispositivo</h4>
    <p>
      Nel browser (localStorage e IndexedDB) vengono salvati: appunti, cartelle, quiz e mappe generati, preferenze di aspetto (modalità chiaro/scuro, colori, caratteri, temi personalizzati salvati) e di visualizzazione,
      modello scelto, modello di riserva e relativa attivazione o disattivazione, prompt personalizzati, la tua chiave API di Google AI Studio (salvo che tu scelga di non ricordarla: vedi punto 8) e la registrazione dell'accettazione di Termini e
      Informativa. Questi dati sono usati solo per far funzionare l'App sul tuo dispositivo e non vengono trasmessi al Gestore.
      Puoi eliminarli in qualsiasi momento dalle Impostazioni o cancellando i dati del sito nel browser.
    </p>

    <h4>3.2 Contenuti inviati a Google Gemini</h4>
    <p>
      Quando generi appunti, quiz, mappe o converti una foto, il testo, i file, le registrazioni audio e le immagini che selezioni
      sono inviati alle API di Google (Gemini API) usando la tua chiave. Per i file caricati, l'App richiede la cancellazione dai server Google
      al termine di un'elaborazione riuscita. Se l'elaborazione fallisce (ad esempio per limiti di richieste di Google), per evitare di ricaricare i file a ogni nuovo tentativo l'App ne conserva
      in memoria il riferimento e lascia il file su Google; lo cancella quando lo rimuovi dall'elenco o lo svuoti, quando cambi la chiave API, dopo 30 minuti di inattività o alla chiusura della scheda (in quest'ultimo caso la richiesta di cancellazione è
      effettuata "al meglio" e potrebbe non andare a buon fine). In ogni caso i file della File API scadono automaticamente dopo un periodo limitato stabilito da Google (attualmente 48 ore). Il riferimento in memoria non viene salvato sul dispositivo.
      Google tratta questi dati secondo i propri termini: a seconda che tu usi un servizio gratuito o a pagamento, Google può conservare
      i contenuti e, nel servizio gratuito, utilizzarli per migliorare i propri prodotti. Consulta i <A href="https://ai.google.dev/gemini-api/terms">Termini della Gemini API</A> e
      l'<A href="https://policies.google.com/privacy">Informativa sulla privacy di Google</A>. Il Gestore non ha accesso a questi contenuti.
      <strong> Non caricare dati personali di terzi, dati sensibili o registrazioni di persone senza aver rispettato i Termini di Servizio (in particolare l'art. 5).</strong>
    </p>
    <p>
      <strong>Modello di riserva (attivo di default).</strong> Salvo che tu lo disattivi da Impostazioni → Modello, quando il modello principale è sovraccarico, ha esaurito i limiti o non è disponibile,
      gli stessi contenuti (testo, file già caricati, immagini) vengono inviati a Google con la tua stessa chiave API ma a un secondo modello Gemini: quello predefinito dell'App, che puoi sostituire con un altro a tua scelta.
      Si applicano gli stessi termini di Google; a seconda del modello e del piano (gratuito o a pagamento) i limiti e le condizioni possono differire. Il Gestore non riceve alcun contenuto.
      Se disattivi la funzione, i contenuti vengono inviati soltanto al modello principale; la tua scelta è salvata solo sul tuo dispositivo.
    </p>

    <h4>3.3 Hosting su Cloudflare Pages</h4>
    <p>
      L'App è distribuita tramite Cloudflare Pages (Cloudflare, Inc.). Nell'erogazione delle pagine Cloudflare tratta dati tecnici di navigazione
      (ad esempio indirizzo IP, user agent, data e ora della richiesta, pagina richiesta) per garantire il funzionamento, la sicurezza e la
      protezione da abusi, secondo la propria <A href="https://www.cloudflare.com/privacypolicy/">informativa</A>. Il Gestore può consultare statistiche
      aggregate e anonime di traffico messe a disposizione dalla piattaforma.
    </p>

    <h3>4. Basi giuridiche</h3>
    <ul>
      <li>Fornitura del servizio richiesto e gestione delle preferenze locali: esecuzione di un contratto o di misure precontrattuali (art. 6.1.b GDPR).</li>
      <li>Sicurezza, prevenzione abusi e funzionamento tecnico dell'hosting: legittimo interesse (art. 6.1.f GDPR).</li>
      <li>Invio a Google dei contenuti che scegli di elaborare: esecuzione del servizio richiesto; per i dati di terzi contenuti nei file, vedi l'obbligo di consenso all'art. 5 dei Termini.</li>
    </ul>

    <h3>5. Cookie e tecnologie simili</h3>
    <p>
      L'App usa esclusivamente strumenti tecnici propri (localStorage, sessionStorage, IndexedDB, cache del service worker) necessari al funzionamento e al salvataggio delle tue preferenze
      e dei tuoi appunti; non richiedono consenso.
    </p>

    <h3>6. Destinatari e trasferimenti verso Paesi extra-UE</h3>
    <p>
      I dati possono essere trattati da Google LLC/Google Ireland Limited e da Cloudflare, Inc., in qualità di fornitori autonomi o responsabili. Tali soggetti
      possono trattare dati anche negli Stati Uniti o in altri Paesi extra-UE, sulla base di decisioni di adeguatezza (EU-US Data Privacy Framework),
      clausole contrattuali standard o altre garanzie previste dal GDPR.
    </p>

    <h3>7. Conservazione</h3>
    <p>
      I dati locali restano sul tuo dispositivo finché non li elimini. Per proteggere i tuoi appunti da cancellazioni automatiche, l'App può chiedere al browser di rendere persistente l'archiviazione dei dati del sito (il browser potrebbe mostrarti una richiesta di conferma). Il Gestore non conserva i tuoi contenuti. I file caricati su Google per la generazione degli appunti restano sui server di Google, al massimo, per il tempo indicato al punto 3.2. I tempi di conservazione presso Google e Cloudflare
      sono definiti dalle rispettive informative.
    </p>

    <h3>8. Sicurezza della chiave API</h3>
    <p>
      La chiave è salvata in chiaro nel localStorage del browser e non viene mai inviata al Gestore. Chiunque abbia accesso al tuo dispositivo o al tuo profilo del browser potrebbe leggerla.
      Su un computer condiviso o pubblico puoi disattivare «Ricorda la chiave su questo dispositivo» (alla prima configurazione o dalle Impostazioni): la chiave resta allora solo nella
      memoria di sessione della scheda (sessionStorage), non viene scritta in modo permanente e scompare alla chiusura della scheda. Se usi l'App su un computer condiviso o pubblico,
      ti consigliamo comunque di eliminare la chiave al termine dalle Impostazioni. Consigliamo di limitare la chiave dalla console Google e di impostare quote adeguate.
    </p>

    <h3>9. I tuoi diritti</h3>
    <p>
      Nei limiti previsti dal GDPR puoi chiedere l'accesso, la rettifica, la cancellazione, la limitazione, l'opposizione e la portabilità dei dati (artt. 15-22) e revocare il
      consenso in qualsiasi momento. Poiché il Gestore non detiene i tuoi contenuti, per i dati trattati da Google o Cloudflare puoi esercitare i diritti direttamente presso tali soggetti.
      Puoi contattare il Gestore a {CONTACT_EMAIL} e, se ritieni che il trattamento violi la normativa, proporre reclamo all'Autorità Garante per la protezione dei dati personali
      (<A href="https://www.garanteprivacy.it">www.garanteprivacy.it</A>) o all'autorità del tuo Paese.
    </p>

    <h3>10. Minori</h3>
    <p>
      L'App non è destinata a minori di 14 anni senza il consenso e la supervisione di chi esercita la responsabilità genitoriale. Se sei minorenne, usa l'App solo con
      l'autorizzazione dei tuoi genitori o tutori, in particolare per la creazione di una chiave API Google (per cui Google richiede un account con l'età minima prevista).
    </p>

    <h3>11. Modifiche all'informativa</h3>
    <p>
      Questa informativa può essere aggiornata. In caso di modifiche sostanziali ti sarà chiesto di prenderne nuovamente visione prima di continuare a usare l'App.
    </p>
  </article>
);
