// eslint-disable-next-line
export default {
  EmailHeader: `
    <body>
      <div class="container">
        <div class="image-container">
          <img src="https://res.cloudinary.com/haelpers-react/image/upload/v1701477696/workers_xisbhy.jpg" alt="Welcome to Haelpers!">
        </div>
  `,
  Head: `
  <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #333;
          background-color: #f4f4f4;
          line-height: 1.6;
        }
        .container {
          width: 90%;
          max-width: 1000px;
          margin: 20px 10px;
          background: #eef;
          padding: 20px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        p, h1, h2, h3, h4, h5, h6 {
          margin-bottom: 15px;
        }
        .callout {
          font-size: 17px;
          font-weight: bold;
          margin: 0 0 20px 0;
          background: rgba(0, 0, 0, 0.05);
          padding: 10px 0 10px 10px;
          border-bottom: 3px solid lightgray;
          border-top: 3px solid lightgray;
        }
        .terms {
          font-size: 12px;
          padding-top: "30px";
          border-top: 3px solid lightgray;
        }
        .btn {
          display: inline-block;
          background: #007bff;
          color: #fff;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          transition: background 0.3s ease;
        }
        .btn:hover {
            background: #0056b3;
        }
        .image-container {
          position: relative;
          width: 100%;  
          max-width: 600px;
          height: 100px;
          overflow: hidden;
          margin-bottom: 40px;
        }
        .image-container img {
          position: absolute;
          width: 400px;
          height: auto;
          top: 0;
          left: 0;
          transition: opacity 0.5s ease;
        }
        .image-container img:hover {
          opacity: 0.7;
        }
        .answers {
          margin: 0;
          background: rgba(0, 0, 0, 0.05);
          padding: 10px 0 10px 10px;
          border-bottom: 3px solid lightgray;
          border-top: 3px solid lightgray;
        }
        li {
          line-height: 1.5;
          margin: 0;
        }
        .footer {
          font-size: 0.8em;
          text-align: center;
          margin-top: 10px;
        }
        .footer a {
          color: #007bff;
        }
      </style>
    </head>
  `,

  TopImage: `
  <body>
    <div class="container">
      <div class="image-container">
        <img src="https://res.cloudinary.com/haelpers-react/image/upload/v1701477696/workers_xisbhy.jpg" alt="Welcome to Haelpers!">
      </div>
  `,

  Closure: {
    en: `
      Following the link you also can change your 
      settings, the services you offer or unsubscribe.<br><br>
      With any question or doubt, contact us on 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> and we will be most 
      happy to help you.<br><br>
      Good luck!<br><br>
      <i>Your team at Haelpers</i>
      <br><br>
    `,

    es: `
      Siguiendo el enlace también puede cambiar sus 
      configuraciones, los servicios que ofrece o darse de baja.<br><br>
      Para cualquier pregunta o duda, contáctenos en 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> y estaremos encantados 
      de ayudarle.<br><br>
      ¡Buena suerte!<br><br>
      <i>Su equipo en Haelpers</i>
      <br><br>
    `,

    nl: `
      Via de link kunt u ook uw instellingen wijzigen, 
      de diensten die u aanbiedt of uitschrijven.<br><br>
      Voor elke vraag of twijfel, neem contact met ons op via 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> en we helpen u graag verder.<br><br>
      Veel succes!<br><br>
      <i>Uw team bij Haelpers</i>
      <br><br>
    `,

    de: `
      Über den Link können Sie auch Ihre Einstellungen ändern, 
      die von Ihnen angebotenen Dienste ändern oder sich abmelden.<br><br>
      Bei Fragen oder Zweifeln kontaktieren Sie uns unter 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> und wir helfen Ihnen gerne weiter.<br><br>
      Viel Glück!<br><br>
      <i>Ihr Haelpers-Team</i>
      <br><br>
    `,

    it: `
      Seguendo il link potete anche modificare le vostre 
      impostazioni, i servizi che offrite o disiscrivervi.<br><br>
      Per qualsiasi domanda o dubbio, contattateci su 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> e saremo lieti di aiutarvi.<br><br>
      Buona fortuna!<br><br>
      <i>Il vostro team di Haelpers</i>
      <br><br>
    `,

    pt: `
      Seguindo o link, você também pode alterar suas 
      configurações, os serviços que oferece ou se desinscrever.<br><br>
      Com qualquer dúvida ou pergunta, entre em contato conosco em 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> e teremos o maior prazer em ajudá-lo.<br><br>
      Boa sorte!<br><br>
      <i>Seu time na Haelpers</i>
      <br><br>
    `,

    fr: `
      En suivant le lien, vous pouvez également changer vos 
      paramètres, les services que vous proposez ou vous désabonner.<br><br>
      Pour toute question ou doute, contactez-nous à 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> et nous serons heureux de vous aider.<br><br>
      Bonne chance!<br><br>
      <i>Votre équipe chez Haelpers</i>
      <br><br>
    `,

    da: `
      Ved at følge linket kan du også ændre dine 
      indstillinger, de tjenester du tilbyder eller afmelde dig.<br><br>
      Har du spørgsmål eller tvivl, kontakt os på 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> og vi vil være meget 
      glade for at hjælpe dig.<br><br>
      Held og lykke!<br><br>
      <i>Dit team hos Haelpers</i>
      <br><br>
    `,

    tr: `
      Bağlantıyı takip ederek ayarlarınızı değiştirebilir, 
      sunduğunuz hizmetleri değiştirebilir veya aboneliğinizi iptal edebilirsiniz.<br><br>
      Herhangi bir soru veya şüphe durumunda, 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> adresinden bize ulaşın ve size yardımcı olmaktan 
      mutluluk duyarız.<br><br>
      İyi şanslar!<br><br>
      <i>Haelpers'deki ekibiniz</i>
      <br><br>
    `,

    no: `
      Ved å følge lenken kan du også endre dine 
      innstillinger, tjenestene du tilbyr eller melde deg av.<br><br>
      Med ethvert spørsmål eller tvil, kontakt oss på 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> og vi vil være svært 
      glade for å hjelpe deg.<br><br>
      Lykke til!<br><br>
      <i>Ditt team hos Haelpers</i>
      <br><br>
    `,

    se: `
      Genom att följa länken kan du även ändra dina 
      inställningar, de tjänster du erbjuder eller avsluta prenumerationen.<br><br>
      Vid frågor eller tvivel, kontakta oss på 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> och vi hjälper dig gärna.<br><br>
      Lycka till!<br><br>
      <i>Ditt team på Haelpers</i>
      <br><br>
    `,

    id: `
      Mengikuti tautan ini, Anda juga dapat mengubah 
      pengaturan Anda, layanan yang Anda tawarkan, atau berhenti berlangganan.<br><br>
      Untuk setiap pertanyaan atau keraguan, hubungi kami di 
      <a href="mailto:team@haelpers.com">team@haelpers.com</a> dan kami akan sangat 
      senang membantu Anda.<br><br>
      Semoga berhasil!<br><br>
      <i>Tim Anda di Haelpers</i>
      <br><br>
    `,
  },

  Unsubscribe: {
    en: `<br>Click <a href='{{unsubscribelink}}'>Unsubscribe</a>
          to unsubscribe from any further communication.`,
    es: `<br>Haz clic en <a href='{{unsubscribelink}}'>Darse de baja</a>
          para darte de baja de cualquier comunicación.`,
    nl: `<br>Klik <a href='{{unsubscribelink}}'>Afmelden</a>
          om je af te melden van verdere communicatie.`,
    de: `<br>Klicken Sie auf <a href='{{unsubscribelink}}'>Abmelden</a>, um sich von weiteren Kommunikationen abzumelden.`,
    it: `<br>Clicca su <a href='{{unsubscribelink}}'>Annulla l'iscrizione</a>
          per annullare l'iscrizione a qualsiasi ulteriore comunicazione.`,
    pt: `<br>Clique em <a href='{{unsubscribelink}}'>Cancelar inscrição</a>
          para cancelar a inscrição de qualquer comunicação futura.`,
    fr: `<br>Cliquez sur <a href='{{unsubscribelink}}'>Se désabonner</a>
          pour vous désabonner de toute communication ultérieure.`,
    da: `<br>Klik på <a href='{{unsubscribelink}}'>Afmeld</a>
          for at afmelde dig yderligere kommunikation.`,
    tr: `<br>Daha fazla iletişimden çıkmak için <a href='{{unsubscribelink}}'>Aboneliği iptal et</a>
          tıklayın.`,
    no: `<br>Klikk <a href='{{unsubscribelink}}'>Avslutt abonnementet</a>
          for å avslutte abonnementet på videre kommunikasjon.`,
    se: `<br>Klicka på <a href='{{unsubscribelink}}'>Avsluta prenumeration</a>
          för att avsluta prenumerationen på ytterligare kommunikation.`,
    id: `<br>Klik <a href='{{unsubscribelink}}'>Berhenti Berlangganan</a>
          untuk berhenti berlangganan dari setiap komunikasi selanjutnya.`,
  },

  Footer: `
          <div class="footer">
          </div>
        </div>
      </body>
    </html>
  `,
};
