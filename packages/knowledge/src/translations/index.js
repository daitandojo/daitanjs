// knowledge/src/translations/index.js
import { getLogger } from '@daitanjs/development';

const translationsLogger = getLogger('daitan-knowledge-translations');

translationsLogger.info(
  'Translations data module loaded. Contains static key-value translations for specific UI strings.'
);

// Review of the data structure for words:
// - The main structure is an object where keys are translation keys (e.g., "Weekdays", "MainDisclaimerUser").
// - Each translation key maps to an object where:
//   - Keys are ISO 639-1 language codes (e.g., "en", "es", "nl").
//   - Values are the translated strings for that language.
// - For "Weekdays", the value is a pipe-separated string of weekday names. This implies the consumer
//   will need to split this string.
// - For "MainDisclaimerUser" and "MainDisclaimerProvider", the values are HTML strings.
//   - Security Note: If these HTML strings were ever to include dynamic, user-supplied data,
//     they would be vulnerable to XSS. As static strings, they are safe, but this pattern
//     can be risky if extended without care.
// - "RequestNumberImages" uses a simple placeholder `{{firstname}}` and `{{number}}`. This implies
//   a simple string replacement mechanism is expected by the consumer.
//
// Structural Soundness:
// - The structure is generally sound for a key-value translation store.
// - Using language codes as keys is standard.
// - The pipe-separated list for "Weekdays" is a bit unconventional for translations; an array might be more standard.
//   However, preserving original data format for now.
// - Storing HTML directly in translation files is common but requires careful handling on the rendering side,
//   especially if any part of that HTML could become dynamic in the future.
//
// No dynamic code to refactor here.

export const words = {
  Weekdays: {
    en: 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday',
    es: 'Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo',
    nl: 'Maandag|Dinsdag|Woensdag|Donderdag|Vrijdag|Zaterdag|Zondag',
    de: 'Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag',
    it: 'lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica',
    pt: 'Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo',
    fr: 'Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche',
    da: 'mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag',
    tr: 'Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar',
    no: 'mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag',
    se: 'Måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag',
    id: 'Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu',
  },
  Dayparts: {
    en: 'Morning|Afternoon|Evening',
    es: 'Mañana|Tarde|Noche',
    nl: 'Morgen|Middag|Avond',
    de: 'Morgen|Mittag|Abend',
    it: 'Morgen|Nachmittag|Abend',
    pt: 'Mattina|Pomeriggio|Sera',
    fr: 'Manhã|Tarde|Noite',
    da: 'Morgen|Eftermiddag|Aften',
    tr: 'Sabah|Öğleden Sonra|Akşam',
    no: 'Morgen|Ettermiddag|Kveld',
    se: 'Morgon|Eftermiddag|Kväll',
    id: 'Pagi|Siang|Malam',
  },
  MainDisclaimerUser: {
    en: "<div class='terms'><i>Using the Haelpers app or website, you confirm that you are agreeing with our <a href='/application/privacy' target='_blank'>Privacy Policy</a>, and the <a href='/application/terms' target='_blank'>Terms & Conditions</a> of the Haelpers platform. We recommend that you visit the links. In particular, remember that Haelpers only introduces and has no liability regarding the services provided. As a user of the platform it is important that you verify that the suggested professionals are sufficiently qualified, have the right permits and certificates, insurance and that their price is reasonable.</i></div>",
    es: "<div class='terms'><i>Al utilizar los servicios de Haelpers, confirmas que estás de acuerdo con nuestra <a href='/application/privacy' target='_blank'>política de privacidad</a>, y las <a href='/application/terms' target='_blank'>condiciones de uso</a> de la plataforma Haelpers. Te recomendamos que visites los enlaces. En particular recuerda que Haelpers sólamente introduce y no es responsable con respeto a los servicios producidos o cualquier prejuicio que pueda resultar. Como usuario es importante verificar que los profesionales estén cualificados, que tengan los certificados y seguros adecuados y que el precio sea razonable.</i></div>",
    nl: "<div class='terms'><i>Wanneer je van Haelpers gebruik maakt, bevestig je het eens te zijn met de  <a href='/application/privacy' target='_blank'>privacy policy</a>, en de <a href='/application/terms' target='_blank'>gebruiksvoorwaarden</a> van Haelpers. We raden je aan deze links te bezoeken. We attenderen je er in het bijzonder op dat Haelpers uitsluitend introduceert en geen verantwoordelijkheid heeft met betrekking tot de diensten; de professionals zijn onafhankelijk - ze hebben geen andere band met Haelpers dan dat ze zich hebben aangemeld. Bij het overwegen is het belangrijk dat je checkt of de dienstverleners geschikt zijn voor de rol, met de juiste papieren en verzekeringen, en dat hun prijs redelijk is.</i></div>",
    de: "<div class='terms'><i>Durch die Nutzung der Haelpers-App oder -Website bestätigen Sie, dass Sie unserer <a href='/application/privacy' target='_blank'>Datenschutzerklärung</a> und der <a href='/application/ zustimmen. Terms' target='_blank'>Allgemeine Geschäftsbedingungen</a> der Haelpers-Plattform. Wir empfehlen Ihnen, die Links zu besuchen. Denken Sie insbesondere daran, dass Haelpers nur die bereitgestellten Dienste vorstellt und keine Haftung dafür übernimmt. Als Nutzer der Plattform ist es wichtig, dass Sie überprüfen, ob die vorgeschlagenen Fachkräfte ausreichend qualifiziert sind, über die richtigen Genehmigungen und Zertifikate, Versicherungen und einen angemessenen Preis verfügen.</i></div>",
    it: "<div class='terms'><i>Utilizzando l'app o il sito Web Haelpers, confermi di essere d'accordo con la nostra <a href='/application/privacy' target='_blank'>Informativa sulla privacy</a> e l'<a href='/application/ termini' target='_blank'>Termini e condizioni</a> della piattaforma Haelpers. Ti consigliamo di visitare i link. In particolare, ricorda che Haelpers si limita a introdurre e non ha alcuna responsabilità in merito ai servizi forniti. Come utente della piattaforma è importante verificare che i professionisti suggeriti siano sufficientemente qualificati, abbiano i permessi e certificati giusti, l'assicurazione e che il loro prezzo sia ragionevole.</i></div>",
    pt: "<div class='terms'><i>Usando o aplicativo ou site Haelpers, você confirma que concorda com nossa <a href='/application/privacy' target='_blank'> Política de Privacidade </a> e com a <a href = '/ application / termos 'target =' _ blank '> Termos e Condições </a> da plataforma Haelpers. Recomendamos que você visite os links. Em particular, lembre-se de que a Haelpers apenas apresenta e não tem qualquer responsabilidade em relação aos serviços prestados. Como utilizador da plataforma é importante que verifique se os profissionais sugeridos são suficientemente qualificados, têm as licenças e certificados adequados, seguros e se o seu preço é razoável.</i></div>",
    fr: "<div class='terms'><i>En utilisant l'application ou le site Web Haelpers, vous confirmez que vous acceptez notre <a href='/application/privacy' target='_blank'>Politique de confidentialité</a> et la <a href='/application/ Terms' target='_blank'>Conditions générales</a> de la plate-forme Haelpers. Nous vous recommandons de visiter les liens. En particulier, rappelez-vous que Haelpers présente uniquement et n'a aucune responsabilité concernant les services fournis. En tant qu'utilisateur de la plateforme, il est important que vous vérifiiez que les professionnels proposés sont suffisamment qualifiés, disposent des bons permis et certificats, des assurances et que leur prix est raisonnable.</i></div>",
    da: "<div class='terms'><i>Ved at bruge Haelpers-appen eller webstedet bekræfter du, at du accepterer vores <a href='/application/privacy' target='_blank'>privatlivspolitik</a> og <a href='/application/ terms' target='_blank'>Vilkår og betingelser</a> for Haelpers-platformen. Vi anbefaler, at du besøger linkene. Husk især, at Haelpers kun introducerer og ikke har noget ansvar for de leverede tjenester. Som bruger af platformen er det vigtigt, at du verificerer, at de foreslåede fagfolk er tilstrækkeligt kvalificerede, har de rigtige tilladelser og certifikater, forsikring og at deres pris er rimelig.</i></div>",
    tr: "<div class='terms'><i>Haelpers uygulamasını veya web sitesini kullanarak, <a href='/application/privacy' target='_blank'>Gizlilik Politikamızı</a> ve <a href='/application/'ı kabul ettiğinizi onaylarsınız. Haelpers platformunun terimler' target='_blank'>Şartlar ve Koşulları</a>. Linkleri ziyaret etmenizi tavsiye ederiz. Özellikle, Haelpers'ın sunulan hizmetleri yalnızca tanıttığını ve bunlarla ilgili hiçbir sorumluluğu olmadığını unutmayın. Platformun bir kullanıcısı olarak, önerilen profesyonellerin yeterince kalifiye olduğunu, doğru izinlere ve sertifikalara, sigortaya sahip olduğunu ve fiyatlarının makul olduğunu doğrulamanız önemlidir.</i></div>",
    no: "<div class='terms'><i>Ved å bruke Haelpers-appen eller nettstedet bekrefter du at du godtar <a href='/application/privacy' target='_blank'>personvernreglene</a> og <a href='/application/ terms' target='_blank'>Vilkår og betingelser</a> for Haelpers-plattformen. Vi anbefaler at du besøker lenkene. Husk spesielt at Haelpers kun introduserer og har ikke noe ansvar for tjenestene som tilbys. Som bruker av plattformen er det viktig at du bekrefter at de foreslåtte fagpersonene er tilstrekkelig kvalifiserte, har de riktige tillatelsene og sertifikatene, forsikring og at prisen er rimelig.</i></div>",
    se: "<div class='terms'><i>Genom att använda Haelpers-appen eller webbplatsen bekräftar du att du godkänner vår <a href='/application/privacy' target='_blank'>sekretesspolicy</a> och <a href='/application/ terms' target='_blank'>Villkor och villkor</a> för Haelpers-plattformen. Vi rekommenderar att du besöker länkarna. Kom särskilt ihåg att Haelpers endast introducerar och inte har något ansvar för de tjänster som tillhandahålls. Som användare av plattformen är det viktigt att du verifierar att de föreslagna proffsen är tillräckligt kvalificerade, har rätt tillstånd och certifikat, försäkringar och att deras pris är rimligt.</i></div>",
    id: "<div class='terms'><i>gan menggunakan aplikasi atau situs web Haelpers, Anda mengonfirmasi bahwa Anda setuju dengan <a href='/application/privacy' target='_blank'>Kebijakan Privasi</a> kami, dan <a href='/application/ terms' target='_blank'>Syarat & Ketentuan</a> platform Haelpers. Kami menyarankan Anda mengunjungi tautan. Secara khusus, ingatlah bahwa Haelpers hanya memperkenalkan dan tidak bertanggung jawab atas layanan yang diberikan. Sebagai pengguna platform, penting bagi Anda untuk memverifikasi bahwa profesional yang disarankan cukup memenuhi syarat, memiliki izin dan sertifikat yang tepat, asuransi, dan bahwa harganya masuk akal.</i></div>",
  },
  MainDisclaimerProvider: {
    en: "<div class='terms'><i>By offering your services on the Haelpers app or website, you agree to abide by our <a href='/application/privacy' target='_blank'>Privacy Policy</a> and <a href='/application/terms' target='_blank'>Terms & Conditions</a>. Please review these documents carefully. Note that as a service provider on Haelpers, you are responsible for ensuring that your services comply with local regulations, hold necessary permits and insurances, and meet quality standards.</i></div>",
    es: "<div class='terms'><i>Al ofrecer tus servicios en la aplicación o sitio web de Haelpers, aceptas cumplir con nuestra <a href='/application/privacy' target='_blank'>política de privacidad</a> y las <a href='/application/terms' target='_blank'>condiciones de uso</a>. Por favor, revisa estos documentos cuidadosamente. Ten en cuenta que como proveedor de servicios en Haelpers, eres responsable de asegurar que tus servicios cumplan con las regulaciones locales, posean los permisos y seguros necesarios y cumplan con los estándares de calidad.</i></div>",
    nl: "<div class='terms'><i>Door je diensten aan te bieden op de Haelpers-app of website, ga je akkoord met onze <a href='/application/privacy' target='_blank'>privacy policy</a> en <a href='/application/terms' target='_blank'>gebruiksvoorwaarden</a>. Gelieve deze documenten zorgvuldig te bekijken. Let op dat je als dienstverlener op Haelpers verantwoordelijk bent voor het naleven van de lokale regelgeving, het hebben van de nodige vergunningen en verzekeringen en het voldoen aan kwaliteitsnormen.</i></div>",
    de: "<div class='terms'><i>Indem Sie Ihre Dienste auf der Haelpers-App oder Website anbieten, erklären Sie sich mit unserer <a href='/application/privacy' target='_blank'>Datenschutzerklärung</a> und den <a href='/application/terms' target='_blank'>Allgemeinen Geschäftsbedingungen</a> einverstanden. Bitte überprüfen Sie diese Dokumente sorgfältig. Beachten Sie, dass Sie als Dienstleister auf Haelpers dafür verantwortlich sind, dass Ihre Dienste den lokalen Vorschriften entsprechen, die notwendigen Genehmigungen und Versicherungen besitzen und Qualitätsstandards erfüllen.</i></div>",
    it: "<div class='terms'><i>Offrendo i tuoi servizi sull'app o sul sito web di Haelpers, accetti di rispettare la nostra <a href='/application/privacy' target='_blank'>Informativa sulla privacy</a> e i <a href='/application/terms' target='_blank'>Termini e condizioni</a>. Si prega di rivedere attentamente questi documenti. Nota che come fornitore di servizi su Haelpers, sei responsabile di assicurare che i tuoi servizi siano conformi alle normative locali, possiedano i necessari permessi e assicurazioni e soddisfino gli standard di qualità.</i></div>",
    pt: "<div class='terms'><i>Ao oferecer seus serviços no aplicativo ou site da Haelpers, você concorda em cumprir nossa <a href='/application/privacy' target='_blank'>Política de Privacidade</a> e os <a href='/application/terms' target='_blank'>Termos e Condições</a>. Por favor, revise cuidadosamente estes documentos. Note que, como um provedor de serviços na Haelpers, você é responsável por garantir que seus serviços estejam em conformidade com as regulamentações locais, possuam as permissões e seguros necessários e atendam aos padrões de qualidade.</i></div>",
    fr: "<div class='terms'><i>En proposant vos services sur l'application ou le site web de Haelpers, vous acceptez de respecter notre <a href='/application/privacy' target='_blank'>Politique de Confidentialité</a> et les <a href='/application/terms' target='_blank'>Termes et Conditions</a>. Veuillez examiner attentivement ces documents. Notez qu'en tant que prestataire de services sur Haelpers, vous êtes responsable de vous assurer que vos services sont conformes aux réglementations locales, possèdent les permis et assurances nécessaires et répondent aux normes de qualité.</i></div>",
    da: "<div class='terms'><i>Ved at tilbyde dine tjenester på Haelpers-appen eller websiden, accepterer du at overholde vores <a href='/application/privacy' target='_blank'>Privatlivspolitik</a> og <a href='/application/terms' target='_blank'>Vilkår og Betingelser</a>. Gennemgå venligst disse dokumenter omhyggeligt. Bemærk, at som tjenesteudbyder på Haelpers er du ansvarlig for at sikre, at dine tjenester overholder lokale regler, har de nødvendige tilladelser og forsikringer og opfylder kvalitetsstandarderne.</i></div>",
    tr: "<div class='terms'><i>Haelpers uygulamasında veya web sitesinde hizmetlerinizi sunarak, <a href='/application/privacy' target='_blank'>Gizlilik Politikamızı</a> ve <a href='/application/terms' target='_blank'>Şartlar ve Koşullar</a> kabul etmiş olursunuz. Lütfen bu belgeleri dikkatlice inceleyin. Haelpers'da bir hizmet sağlayıcı olarak, hizmetlerinizin yerel düzenlemelere uygun olduğundan, gerekli izinlere ve sigortalara sahip olduğundan ve kalite standartlarını karşıladığından emin olmanız gerektiğini unutmayın.</i></div>",
    no: "<div class='terms'><i>Ved å tilby tjenestene dine på Haelpers-appen eller nettsiden, godtar du å overholde vår <a href='/application/privacy' target='_blank'>Personvernreglene</a> og <a href='/application/terms' target='_blank'>Vilkår og Betingelser</a>. Vennligst gjennomgå disse dokumentene nøye. Merk at som en tjenesteleverandør på Haelpers, er du ansvarlig for å sikre at dine tjenester overholder lokale forskrifter, har nødvendige tillatelser og forsikringer, og møter kvalitetsstandarder.</i></div>",
    se: "<div class='terms'><i>Genom att erbjuda dina tjänster på Haelpers-appen eller webbplatsen godkänner du att följa vår <a href='/application/privacy' target='_blank'>Integritetspolicy</a> och <a href='/application/terms' target='_blank'>Användarvillkor</a>. Vänligen granska dessa dokument noggrant. Observera att som tjänsteleverantör på Haelpers är du ansvarig för att dina tjänster överensstämmer med lokala regelverk, innehar nödvändiga tillstånd och försäkringar, samt uppfyller kvalitetsstandarder.</i></div>",
    id: "<div class='terms'><i>Dengan menawarkan layanan Anda di aplikasi atau situs web Haelpers, Anda setuju untuk mematuhi <a href='/application/privacy' target='_blank'>Kebijakan Privasi</a> kami dan <a href='/application/terms' target='_blank'>Syarat & Ketentuan</a>. Silakan tinjau dokumen ini dengan hati-hati. Perhatikan bahwa sebagai penyedia layanan di Haelpers, Anda bertanggung jawab untuk memastikan bahwa layanan Anda mematuhi peraturan lokal, memiliki izin dan asuransi yang diperlukan, serta memenuhi standar kualitas.</i></div>",
  },
  RequestNumberImages: {
    en: '{{firstname}} did provide {{number}} images',
    es: '{{firstname}} proporcionó {{number}} imágenes',
    nl: '{{firstname}} heeft {{number}} afbeeldingen verstrekt',
    de: '{{firstname}} hat {{number}} Bilder bereitgestellt',
    it: '{{firstname}} ha fornito {{number}} immagini',
    pt: '{{firstname}} forneceu {{number}} imagens',
    fr: '{{firstname}} a fourni {{number}} images',
    da: '{{firstname}} har leveret {{number}} billeder',
    tr: '{{firstname}}, {{number}} resim sağladı',
    no: '{{firstname}} har gitt {{number}} bilder',
    se: '{{firstname}} har tillhandahållit {{number}} bilder',
    id: '{{firstname}} menyediakan {{number}} gambar',
  },
};
