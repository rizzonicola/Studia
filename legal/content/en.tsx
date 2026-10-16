import React from 'react';
import { APP_NAME, CONTACT_EMAIL, OWNER_NAME, SITE_URL } from '../../config/appConfig';
import { A, legalDate } from '../shared';

/** Legal texts in ENGLISH. Have them reviewed by a professional before publication. */

export const TermsContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Terms of Service</h2>
    <p><em>Last updated: {legalDate('en')}</em></p>

    <h3>1. Purpose and acceptance</h3>
    <p>
      {APP_NAME} (hereinafter "the App") is a free web application for creating and organizing study notes with the help of Google Gemini
      artificial intelligence models. The App is available at {SITE_URL} and is provided by {OWNER_NAME}, owner and operator of the website (hereinafter "the Operator"), who can be reached at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      By using the App you declare that you have read and accept these Terms of Service and the Privacy Policy.
      If you do not accept them, you may not use the App.
    </p>

    <h3>2. No account, no content server</h3>
    <p>
      The App does not require registration. Your notes, folders and settings are stored exclusively in the browser of your device.
      The Operator has no access to your content and cannot recover it: if you clear your browser data or change device,
      the local data will be lost. We recommend that you regularly export whatever matters to you.
    </p>

    <h3>3. Your Google AI Studio API key</h3>
    <ul>
      <li>The AI features work only with a personal API key, which you generate yourself on Google AI Studio and enter in the App.</li>
      <li>The key stays stored in your device's browser and is sent only to Google to authenticate your requests.</li>
      <li>You alone are responsible for keeping the key safe. Do not share it and do not use it on devices you do not control. If you suspect it has been compromised, delete it immediately from your Google AI Studio account.</li>
      <li>Any costs, usage limits (quotas) and conditions applied to the use of the key depend on your relationship with Google and remain your responsibility.</li>
      <li>By default the App uses a fallback model: if the main model is overloaded, has hit its limits or is unavailable, the request is repeated with a second Gemini model using the same key. These requests too, with Google's related limits, costs and conditions (which may differ from those of the main model), remain your responsibility. You can turn the feature off at any time in Settings → Model (see also point 3.2 of the Privacy Policy).</li>
      <li>Use of the Gemini models is subject to Google's terms, in particular the <A href="https://ai.google.dev/gemini-api/terms">Gemini API Additional Terms of Service</A> and the related prohibited use policy.</li>
    </ul>

    <h3>4. Your content</h3>
    <p>
      You retain all rights to the materials you upload or create. You declare that you have the right to use such
      materials and to send them to Google for processing (for example, that you do not infringe copyright or confidentiality obligations,
      as in the case of confidential teaching material or third-party documents).
    </p>

    <h3>5. Audio and video recordings: consent of the people involved (binding obligation)</h3>
    <p>
      <strong>
        Before recording, uploading or processing with the App any audio, video or image file in which people appear, are
        filmed or are recognizable (for example lectures, interviews, meetings, conversations, photos of people),
        you undertake to obtain the free, informed and explicit consent of all the people filmed or recorded.
      </strong>
    </p>
    <ul>
      <li>The consent must cover the recording and also the sending of the content to a third-party artificial intelligence provider (Google) for processing.</li>
      <li>If the recording takes place in a regulated context (school, university, workplace), you must also comply with the rules of the institution or organization and obtain the necessary authorizations, for example from the teacher.</li>
      <li>For minors, consent must be given by the person holding parental responsibility, according to applicable law.</li>
      <li>You must not record or upload conversations in which you do not take part, nor content concerning special categories of personal data (health, opinions, etc.) without a valid legal basis.</li>
      <li>You alone are responsible for collecting and proving consent. The Operator is unable to verify it and accepts no liability for it.</li>
    </ul>
    <p>
      By using the recording or upload features you declare and warrant that you have complied with the above. In case of
      breach you assume all civil, administrative and criminal liability arising from it and undertake to indemnify the Operator
      against third-party claims, to the extent permitted by law.
    </p>

    <h3>6. Permitted use</h3>
    <p>You may not use the App to:</p>
    <ul>
      <li>violate the law or the rights of third parties (privacy, copyright, image rights, confidentiality);</li>
      <li>generate or distribute unlawful, offensive, discriminatory or harmful content;</li>
      <li>circumvent Google's limits or usage rules, or attempt to compromise the operation of the App;</li>
      <li>use API keys that you do not own or are not authorized to use.</li>
    </ul>

    <h3>7. AI-generated content</h3>
    <p>
      Notes, quizzes, maps and other content are automatically generated by artificial intelligence models and may
      contain errors, omissions or inaccuracies. Always check important information against the original sources. The content
      does not constitute professional advice (medical, legal, financial or other) and does not guarantee any school or exam result.
    </p>

    <h3>8. Availability of the service, disclaimer of warranties and liability</h3>
    <p>
      The App is provided "as is", without warranties of continuity, absence of errors or fitness for specific purposes. The Operator may
      modify, suspend or discontinue the App at any time. To the extent permitted by law, the Operator is not liable
      for indirect damages, loss of local data, costs charged by Google, interruptions of third-party services or improper use
      of the App. Mandatory consumer protection provisions and liabilities that the law does not allow to be excluded remain unaffected.
    </p>

    <h3>9. Intellectual property and open source software</h3>
    <p>
      The name, the logo and the original code of the App belong to the Operator, unless otherwise indicated. The App uses open source
      libraries distributed under their respective licenses, listed in the "About and Dependencies" section of the Settings.
    </p>

    <h3>10. Changes to the Terms</h3>
    <p>
      The Operator may update these Terms. In case of material changes you will be asked to accept the new version again
      before continuing to use the App.
    </p>

    <h3>11. Governing law and jurisdiction</h3>
    <p>
      These Terms are governed by Italian law. If you are a consumer, the mandatory protections
      provided by the law of your country of residence and the consumer's forum remain applicable.
    </p>

    <h3>12. Contact</h3>
    <p>For any question you can write to the Operator, {OWNER_NAME}, at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
  </article>
);

export const PrivacyContent: React.FC = () => (
  <article className="prose prose-sm max-w-none prose-headings:mt-6 prose-headings:mb-2">
    <h2>Privacy Policy</h2>
    <p><em>Last updated: {legalDate('en')}</em></p>
    <p>
      Notice provided pursuant to Articles 13 and 14 of Regulation (EU) 2016/679 ("GDPR") and the applicable Italian legislation
      on the protection of personal data.
    </p>

    <h3>1. Data controller</h3>
    <p>{OWNER_NAME} — contact: {CONTACT_EMAIL}. Website: {SITE_URL}.</p>

    <h3>2. In short</h3>
    <ul>
      <li>There are no accounts: we do not collect name, email or password.</li>
      <li>Notes, folders, settings and API key stay in <strong>your browser</strong>; we do not receive them.</li>
      <li>When you use the AI features, the content you choose to process is sent <strong>directly from your browser to Google</strong> with your API key.</li>
      <li>The site is hosted on Cloudflare Pages.</li>
    </ul>

    <h3>3. Data processed and purposes</h3>

    <h4>3.1 Data stored on your device</h4>
    <p>
      The browser (localStorage and IndexedDB) stores: notes, folders, generated quizzes and maps, appearance (light/dark mode, colours, fonts, saved custom themes), display and language preferences,
      the chosen model, the fallback model and whether you have turned it on or off, custom prompts, your Google AI Studio API key (unless you choose not to remember it: see point 8) and the record of your acceptance of the Terms and
      Privacy Policy. This data is used only to make the App work on your device and is not transmitted to the Operator.
      You can delete it at any time from the Settings or by clearing the site data in your browser.
    </p>

    <h4>3.2 Content sent to Google Gemini</h4>
    <p>
      When you generate notes, quizzes, maps or convert a photo, the text, files, audio recordings and images you select
      are sent to Google's APIs (Gemini API) using your key. For uploaded files, the App requests deletion from Google's servers
      once processing has succeeded. If processing fails (for example because of Google's request limits), to avoid re-uploading the files on every new attempt the App keeps
      a reference to them in memory and leaves the file on Google; it deletes it when you remove it from the list or clear the list, when you change the API key, after 30 minutes of inactivity or when the tab is closed (in the last case the deletion request is
      made on a best-effort basis and may not succeed). In any case, files in the File API expire automatically after a limited period set by Google (currently 48 hours). The in-memory reference is not saved on your device.
      Google processes this data according to its own terms: depending on whether you use a free or a paid service, Google may retain
      the content and, in the free service, use it to improve its products. See the <A href="https://ai.google.dev/gemini-api/terms">Gemini API Terms</A> and
      the <A href="https://policies.google.com/privacy">Google Privacy Policy</A>. The Operator has no access to this content.
      <strong> Do not upload third-party personal data, sensitive data or recordings of people without having complied with the Terms of Service (in particular article 5).</strong>
    </p>
    <p>
      <strong>Fallback model (on by default).</strong> Unless you turn it off in Settings → Model, when the main model is overloaded, has hit its limits or is unavailable,
      the same content (text, files already uploaded, images) is sent to Google with your same API key but to a second Gemini model: the App's default one, which you can replace with another of your choice.
      Google's same terms apply; depending on the model and the plan (free or paid), limits and conditions may differ. The Operator receives no content.
      If you turn the feature off, content is sent only to the main model; your choice is stored only on your device.
    </p>

    <h4>3.3 Hosting on Cloudflare Pages</h4>
    <p>
      The App is delivered through Cloudflare Pages (Cloudflare, Inc.). When serving pages Cloudflare processes technical browsing data
      (for example IP address, user agent, date and time of the request, requested page) to ensure operation, security and
      protection against abuse, according to its own <A href="https://www.cloudflare.com/privacypolicy/">privacy policy</A>. The Operator may view aggregated,
      anonymous traffic statistics made available by the platform.
    </p>

    <h3>4. Legal bases</h3>
    <ul>
      <li>Provision of the requested service and management of local preferences: performance of a contract or pre-contractual measures (Art. 6.1.b GDPR).</li>
      <li>Security, abuse prevention and technical operation of the hosting: legitimate interest (Art. 6.1.f GDPR).</li>
      <li>Sending to Google the content you choose to process: performance of the requested service; for third-party data contained in the files, see the consent obligation in article 5 of the Terms.</li>
    </ul>

    <h3>5. Cookies and similar technologies</h3>
    <p>
      The App uses only its own technical tools (localStorage, sessionStorage, IndexedDB, service worker cache) needed for operation and for saving your preferences
      and notes; they do not require consent.
    </p>

    <h3>6. Recipients and transfers to non-EU countries</h3>
    <p>
      Data may be processed by Google LLC/Google Ireland Limited and by Cloudflare, Inc., as independent controllers or processors. These parties
      may also process data in the United States or other non-EU countries, on the basis of adequacy decisions (EU-US Data Privacy Framework),
      standard contractual clauses or other safeguards provided for by the GDPR.
    </p>

    <h3>7. Retention</h3>
    <p>
      Local data stays on your device until you delete it. To protect your notes from automatic deletion, the App may ask the browser to make the site's storage persistent (the browser may show you a confirmation request). The Operator does not retain your content. Files uploaded to Google to generate notes remain on Google's servers for no longer than the time described in section 3.2. Retention periods at Google and Cloudflare
      are set out in their respective policies.
    </p>

    <h3>8. API key security</h3>
    <p>
      The key is stored in plain text in the browser's localStorage and is never sent to the Operator. Anyone with access to your device or browser profile could read it.
      On a shared or public computer you can turn off “Remember the key on this device” (on first setup or in the Settings): the key is then kept only in the tab's session
      memory (sessionStorage), is not written permanently and disappears when you close the tab. If you use the App on a shared or public computer, we still recommend deleting
      the key from the Settings when you finish. We recommend restricting the key from the Google console and setting appropriate quotas.
    </p>

    <h3>9. Your rights</h3>
    <p>
      Within the limits set by the GDPR you may request access, rectification, erasure, restriction, objection and portability of data (Arts. 15-22) and withdraw
      consent at any time. Since the Operator does not hold your content, for data processed by Google or Cloudflare you can exercise your rights directly with them.
      You can contact the Operator at {CONTACT_EMAIL} and, if you believe the processing violates the law, lodge a complaint with the Italian Data Protection Authority
      (<A href="https://www.garanteprivacy.it">www.garanteprivacy.it</A>) or with the authority of your country.
    </p>

    <h3>10. Minors</h3>
    <p>
      The App is not intended for children under 14 without the consent and supervision of the person holding parental responsibility. If you are a minor, use the App only with
      the authorization of your parents or guardians, in particular for creating a Google API key (for which Google requires an account meeting the minimum age).
    </p>

    <h3>11. Changes to this notice</h3>
    <p>
      This notice may be updated. In case of material changes you will be asked to review it again before continuing to use the App.
    </p>
  </article>
);
