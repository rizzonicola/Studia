import React from 'react';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, SITE_URL } from '../../config/appConfig';
import { A, legalDate } from '../shared';

/** Textes juridiques en FRANÇAIS. Ils doivent être relus par un professionnel avant publication. */

export const TermsContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Conditions d'utilisation</h2>
    <p><em>Dernière mise à jour : {legalDate('fr')}</em></p>

    <h3>1. Objet et acceptation</h3>
    <p>
      {APP_NAME} (ci-après « l'Application ») est une application web gratuite permettant de créer et d'organiser des notes d'étude avec l'aide
      des modèles d'intelligence artificielle Google Gemini. L'Application est accessible à l'adresse {SITE_URL} et est mise à disposition par {OWNER_NAME}, propriétaire et éditeur du site (ci-après « l'Éditeur »), joignable à l'adresse <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      En utilisant l'Application, vous déclarez avoir lu et accepter les présentes Conditions d'utilisation ainsi que la Politique de confidentialité.
      Si vous ne les acceptez pas, vous ne pouvez pas utiliser l'Application.
    </p>

    <h3>2. Aucun compte, aucun serveur de contenus</h3>
    <p>
      L'Application ne nécessite aucune inscription. Vos notes, vos dossiers et vos paramètres sont enregistrés exclusivement dans le navigateur
      de votre appareil. L'Éditeur n'a pas accès à vos contenus et ne peut pas les récupérer : si vous effacez les données du navigateur
      ou changez d'appareil, les données locales seront perdues. Nous vous conseillons d'exporter régulièrement ce qui vous importe.
    </p>

    <h3>3. Votre clé API Google AI Studio</h3>
    <ul>
      <li>Les fonctions d'IA ne fonctionnent qu'avec une clé API personnelle, que vous générez vous-même sur Google AI Studio et que vous saisissez dans l'Application.</li>
      <li>La clé reste enregistrée dans le navigateur de votre appareil et n'est envoyée qu'à Google pour authentifier vos requêtes.</li>
      <li>Vous êtes seul responsable de la conservation de la clé. Ne la partagez pas et ne l'utilisez pas sur des appareils que vous ne contrôlez pas. Si vous soupçonnez qu'elle a été compromise, supprimez-la immédiatement de votre compte Google AI Studio.</li>
      <li>Les éventuels coûts, limites d'utilisation (quotas) et conditions appliqués à l'usage de la clé dépendent de votre relation avec Google et restent à votre charge.</li>
      <li>Par défaut, l'Application utilise un modèle de secours : si le modèle principal est surchargé, a atteint ses limites ou est indisponible, la requête est renouvelée avec un second modèle Gemini à l'aide de votre même clé. Ces requêtes, avec les limites, coûts et conditions correspondants de Google (qui peuvent différer de ceux du modèle principal), restent elles aussi à votre charge. Vous pouvez désactiver cette fonction à tout moment dans Paramètres → Modèle (voir aussi le point 3.2 de la Politique de confidentialité).</li>
      <li>L'utilisation des modèles Gemini est soumise aux conditions de Google, en particulier les <A href="https://ai.google.dev/gemini-api/terms">Conditions d'utilisation supplémentaires de l'API Gemini</A> et les règles d'usage interdit correspondantes.</li>
    </ul>

    <h3>4. Vos contenus</h3>
    <p>
      Vous restez titulaire de tous les droits sur les documents que vous importez ou créez. Vous déclarez avoir le droit d'utiliser ces
      documents et de les envoyer à Google pour traitement (par exemple, ne pas violer de droits d'auteur ni d'obligations de confidentialité,
      comme dans le cas de supports pédagogiques confidentiels ou de documents appartenant à des tiers).
    </p>

    <h3>5. Enregistrements audio et vidéo : consentement des personnes concernées (obligation contraignante)</h3>
    <p>
      <strong>
        Avant d'enregistrer, d'importer ou de traiter avec l'Application tout fichier audio, vidéo ou image dans lequel apparaissent, sont
        filmées ou sont reconnaissables des personnes (par exemple cours, entretiens, réunions, conversations, photos de personnes),
        vous vous engagez à obtenir le consentement libre, éclairé et explicite de toutes les personnes filmées ou enregistrées.
      </strong>
    </p>
    <ul>
      <li>Le consentement doit porter sur l'enregistrement et aussi sur l'envoi des contenus à un fournisseur tiers d'intelligence artificielle (Google) à des fins de traitement.</li>
      <li>Si l'enregistrement a lieu dans un cadre réglementé (école, université, lieu de travail), vous devez en outre respecter les règlements de l'établissement ou de l'organisation et obtenir les autorisations nécessaires, par exemple auprès de l'enseignant.</li>
      <li>Pour les mineurs, le consentement doit être donné par la personne exerçant l'autorité parentale, conformément à la loi applicable.</li>
      <li>Vous ne devez pas enregistrer ni importer de conversations auxquelles vous ne participez pas, ni de contenus relatifs à des catégories particulières de données personnelles (santé, opinions, etc.) sans base juridique valable.</li>
      <li>Vous êtes seul responsable du recueil et de la preuve du consentement. L'Éditeur n'est pas en mesure de le vérifier et n'en répond pas.</li>
    </ul>
    <p>
      En utilisant les fonctions d'enregistrement ou d'importation, vous déclarez et garantissez avoir respecté ce qui précède. En cas de
      violation, vous assumez toute responsabilité civile, administrative et pénale qui en découle et vous vous engagez à garantir l'Éditeur
      contre les réclamations de tiers, dans les limites permises par la loi.
    </p>

    <h3>6. Usage autorisé</h3>
    <p>Il est interdit d'utiliser l'Application pour :</p>
    <ul>
      <li>violer la loi ou les droits de tiers (vie privée, droit d'auteur, droit à l'image, confidentialité) ;</li>
      <li>générer ou diffuser des contenus illicites, offensants, discriminatoires ou nuisibles ;</li>
      <li>contourner les limites ou les règles d'utilisation de Google, ou tenter de compromettre le fonctionnement de l'Application ;</li>
      <li>utiliser des clés API dont vous n'êtes pas titulaire ou que vous n'êtes pas autorisé à utiliser.</li>
    </ul>

    <h3>7. Contenus générés par l'IA</h3>
    <p>
      Les notes, quiz, cartes et autres contenus sont générés automatiquement par des modèles d'intelligence artificielle et peuvent
      comporter des erreurs, des omissions ou des inexactitudes. Vérifiez toujours les informations importantes auprès des sources d'origine. Les contenus
      ne constituent pas un conseil professionnel (médical, juridique, financier ou autre) et ne garantissent aucun résultat scolaire ou d'examen.
    </p>

    <h3>8. Disponibilité du service, exclusion de garanties et responsabilité</h3>
    <p>
      L'Application est fournie « en l'état », sans garantie de continuité, d'absence d'erreurs ou d'adéquation à un usage particulier. L'Éditeur peut
      modifier, suspendre ou interrompre l'Application à tout moment. Dans les limites permises par la loi, l'Éditeur ne répond pas
      des dommages indirects, de la perte de données locales, des coûts facturés par Google, des interruptions des services de tiers ou de l'usage inapproprié
      de l'Application. Les dispositions impératives de protection des consommateurs et les responsabilités que la loi ne permet pas d'exclure demeurent applicables.
    </p>

    <h3>9. Propriété intellectuelle et logiciels open source</h3>
    <p>
      Le nom, le logo et le code original de l'Application appartiennent à l'Éditeur, sauf indication contraire. L'Application utilise des bibliothèques
      open source distribuées sous leurs licences respectives, listées dans la section « Informations et dépendances » des Paramètres.
    </p>

    <h3>10. Modifications des Conditions</h3>
    <p>
      L'Éditeur peut mettre à jour les présentes Conditions. En cas de modification substantielle, il vous sera demandé d'accepter à nouveau la nouvelle version
      avant de continuer à utiliser l'Application.
    </p>

    <h3>11. Droit applicable et juridiction compétente</h3>
    <p>
      Les présentes Conditions sont régies par le droit italien. Si vous êtes un consommateur, les protections impératives
      prévues par la loi de votre pays de résidence et le for du consommateur restent applicables.
    </p>

    <h3>12. Contact</h3>
    <p>Pour toute question, vous pouvez écrire à l'Éditeur, {OWNER_NAME}, à l'adresse <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
  </article>
);

export const PrivacyContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Politique de confidentialité</h2>
    <p><em>Dernière mise à jour : {legalDate('fr')}</em></p>
    <p>
      Information fournie conformément aux articles 13 et 14 du Règlement (UE) 2016/679 (« RGPD ») et à la législation italienne applicable
      en matière de protection des données personnelles.
    </p>

    <h3>1. Responsable du traitement</h3>
    <p>{OWNER_NAME} — contact : {CONTACT_EMAIL}. Site : {SITE_URL}.</p>

    <h3>2. En résumé</h3>
    <ul>
      <li>Il n'existe pas de comptes : nous ne collectons ni nom, ni e-mail, ni mot de passe.</li>
      <li>Les notes, dossiers, paramètres et la clé API restent dans <strong>votre navigateur</strong> ; nous ne les recevons pas.</li>
      <li>Lorsque vous utilisez les fonctions d'IA, les contenus que vous choisissez de traiter sont envoyés <strong>directement de votre navigateur à Google</strong> avec votre clé API.</li>
      <li>Le site est hébergé sur Cloudflare Pages.</li>
    </ul>

    <h3>3. Données traitées et finalités</h3>

    <h4>3.1 Données enregistrées sur votre appareil</h4>
    <p>
      Le navigateur (localStorage et IndexedDB) enregistre : les notes, dossiers, quiz et cartes générés, les préférences d'apparence (mode clair/sombre, couleurs, polices, thèmes personnalisés enregistrés), d'affichage et de langue,
      le modèle choisi, le modèle de secours et son activation ou désactivation, les prompts personnalisés, votre clé API Google AI Studio (sauf si vous choisissez de ne pas la mémoriser : voir le point 8) et la trace de l'acceptation des Conditions et de la
      Politique de confidentialité. Ces données servent uniquement à faire fonctionner l'Application sur votre appareil et ne sont pas transmises à l'Éditeur.
      Vous pouvez les supprimer à tout moment depuis les Paramètres ou en effaçant les données du site dans le navigateur.
    </p>

    <h4>3.2 Contenus envoyés à Google Gemini</h4>
    <p>
      Lorsque vous générez des notes, des quiz, des cartes ou convertissez une photo, le texte, les fichiers, les enregistrements audio et les images que vous sélectionnez
      sont envoyés aux API de Google (API Gemini) à l'aide de votre clé. Pour les fichiers importés, l'Application demande leur suppression des serveurs de Google
      à la fin d'un traitement réussi. Si le traitement échoue (par exemple à cause des limites de requêtes de Google), pour éviter de renvoyer les fichiers à chaque nouvel essai, l'Application en conserve
      une référence en mémoire et laisse le fichier chez Google ; elle le supprime lorsque vous le retirez de la liste ou videz la liste, lorsque vous changez de clé API, après 30 minutes d'inactivité ou à la fermeture de l'onglet (dans ce dernier cas, la demande de suppression
      est faite au mieux et peut échouer). Dans tous les cas, les fichiers de la File API expirent automatiquement après une durée limitée fixée par Google (actuellement 48 heures). La référence en mémoire n'est pas enregistrée sur votre appareil.
      Google traite ces données selon ses propres conditions : selon que vous utilisez un service gratuit ou payant, Google peut conserver
      les contenus et, dans le service gratuit, les utiliser pour améliorer ses produits. Consultez les <A href="https://ai.google.dev/gemini-api/terms">Conditions de l'API Gemini</A> et
      la <A href="https://policies.google.com/privacy">Politique de confidentialité de Google</A>. L'Éditeur n'a pas accès à ces contenus.
      <strong> N'importez pas de données personnelles de tiers, de données sensibles ni d'enregistrements de personnes sans avoir respecté les Conditions d'utilisation (en particulier l'article 5).</strong>
    </p>
    <p>
      <strong>Modèle de secours (activé par défaut).</strong> Sauf si vous le désactivez dans Paramètres → Modèle, lorsque le modèle principal est surchargé, a atteint ses limites ou est indisponible,
      le même contenu (texte, fichiers déjà envoyés, images) est transmis à Google avec votre même clé API mais à un second modèle Gemini : celui par défaut de l'Application, que vous pouvez remplacer par un autre de votre choix.
      Les mêmes conditions de Google s'appliquent ; selon le modèle et l'offre (gratuite ou payante), les limites et conditions peuvent différer. L'Éditeur ne reçoit aucun contenu.
      Si vous désactivez la fonction, les contenus ne sont envoyés qu'au modèle principal ; votre choix est enregistré uniquement sur votre appareil.
    </p>

    <h4>3.3 Hébergement sur Cloudflare Pages</h4>
    <p>
      L'Application est distribuée via Cloudflare Pages (Cloudflare, Inc.). Lors de la diffusion des pages, Cloudflare traite des données techniques de navigation
      (par exemple adresse IP, user agent, date et heure de la requête, page demandée) afin d'assurer le fonctionnement, la sécurité et la
      protection contre les abus, conformément à sa propre <A href="https://www.cloudflare.com/privacypolicy/">politique de confidentialité</A>. L'Éditeur peut consulter des statistiques
      agrégées et anonymes de trafic mises à disposition par la plateforme.
    </p>

    <h3>4. Bases juridiques</h3>
    <ul>
      <li>Fourniture du service demandé et gestion des préférences locales : exécution d'un contrat ou de mesures précontractuelles (art. 6.1.b RGPD).</li>
      <li>Sécurité, prévention des abus et fonctionnement technique de l'hébergement : intérêt légitime (art. 6.1.f RGPD).</li>
      <li>Envoi à Google des contenus que vous choisissez de traiter : exécution du service demandé ; pour les données de tiers contenues dans les fichiers, voir l'obligation de consentement de l'article 5 des Conditions.</li>
    </ul>

    <h3>5. Cookies et technologies similaires</h3>
    <p>
      L'Application utilise exclusivement ses propres outils techniques (localStorage, sessionStorage, IndexedDB, cache du service worker) nécessaires au fonctionnement et à l'enregistrement de vos préférences
      et de vos notes ; ils ne nécessitent pas de consentement.
    </p>

    <h3>6. Destinataires et transferts hors UE</h3>
    <p>
      Les données peuvent être traitées par Google LLC/Google Ireland Limited et par Cloudflare, Inc., en qualité de responsables de traitement autonomes ou de sous-traitants. Ces entités
      peuvent traiter des données également aux États-Unis ou dans d'autres pays hors UE, sur la base de décisions d'adéquation (EU-US Data Privacy Framework),
      de clauses contractuelles types ou d'autres garanties prévues par le RGPD.
    </p>

    <h3>7. Conservation</h3>
    <p>
      Les données locales restent sur votre appareil tant que vous ne les supprimez pas. Pour protéger vos notes contre une suppression automatique, l'Application peut demander au navigateur de rendre persistant le stockage des données du site (le navigateur peut vous afficher une demande de confirmation). L'Éditeur ne conserve pas vos contenus. Les fichiers envoyés à Google pour générer des notes restent sur les serveurs de Google au plus pendant la durée décrite au point 3.2. Les durées de conservation chez Google et Cloudflare
      sont définies par leurs politiques respectives.
    </p>

    <h3>8. Sécurité de la clé API</h3>
    <p>
      La clé est enregistrée en clair dans le localStorage du navigateur et n'est jamais envoyée à l'Éditeur. Toute personne ayant accès à votre appareil ou à votre profil de navigateur pourrait la lire.
      Sur un ordinateur partagé ou public, vous pouvez désactiver « Mémoriser la clé sur cet appareil » (lors de la première configuration ou dans les Paramètres) : la clé n'est alors conservée que
      dans la mémoire de session de l'onglet (sessionStorage), n'est pas écrite de façon permanente et disparaît à la fermeture de l'onglet. Si vous utilisez l'Application sur un ordinateur partagé ou
      public, nous vous conseillons malgré tout de supprimer la clé à la fin depuis les Paramètres. Nous conseillons de restreindre la clé depuis la console Google et de définir des quotas adaptés.
    </p>

    <h3>9. Vos droits</h3>
    <p>
      Dans les limites prévues par le RGPD, vous pouvez demander l'accès, la rectification, l'effacement, la limitation, l'opposition et la portabilité des données (art. 15 à 22) et retirer votre
      consentement à tout moment. L'Éditeur ne détenant pas vos contenus, pour les données traitées par Google ou Cloudflare vous pouvez exercer vos droits directement auprès de ces entités.
      Vous pouvez contacter l'Éditeur à {CONTACT_EMAIL} et, si vous estimez que le traitement enfreint la réglementation, introduire une réclamation auprès de l'autorité italienne de protection des données
      (<A href="https://www.garanteprivacy.it">www.garanteprivacy.it</A>) ou auprès de l'autorité de votre pays (en France, la <A href="https://www.cnil.fr">CNIL</A>).
    </p>

    <h3>10. Mineurs</h3>
    <p>
      L'Application n'est pas destinée aux enfants de moins de 14 ans sans le consentement et la supervision de la personne exerçant l'autorité parentale. Si vous êtes mineur, n'utilisez l'Application qu'avec
      l'autorisation de vos parents ou tuteurs, en particulier pour la création d'une clé API Google (pour laquelle Google exige un compte respectant l'âge minimal prévu).
    </p>

    <h3>11. Modifications de l'information</h3>
    <p>
      Cette information peut être mise à jour. En cas de modification substantielle, il vous sera demandé d'en prendre à nouveau connaissance avant de continuer à utiliser l'Application.
    </p>
  </article>
);
