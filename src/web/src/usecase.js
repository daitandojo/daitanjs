import {
  downloadArticle,
  downloadWebsite,
  extractClasses,
  parseHTML,
  textAndLinksByClass,
} from './scraping.js';

const websites = [
  'https://borsen.dk/nyheder/baeredygtig/tidligere-maersk-profil-henter-375-mio-kr-til-hjertebarn?b_source=seneste-nyt&b_medium=row_1&b_campaign=list_4',
  'https://politiken.dk/danmark/oekonomi/art10012737/Japanske-aktier-g%C3%B8r-halvt-comeback-efter-historisk-fald',
  'https://finans.dk/erhverv/ECE17333828/ol-og-em-obstruerer-danmarks-luksussalg-til-rige-turister/',
  'https://www.berlingske.dk/business/ganni-vinder-kopisag-mod-konkurrent-om-design-af-ballerinasko',
]

const elementArray = [
  [
    { elementName: "headlines", selector: 'h1.tiempos-headline' },
    { elementName: "subheadings", selector: 'strong.subheading' },
    { elementName: "captions", selector: 'figcaption.gta' },
    { elementName: "contents", selector: '.article-content > *' }
  ],
  [
    { elementName: "headlines", selector: '.article__title' },
    { elementName: "subheadings", selector: '.summary__p' },
    { elementName: "captions", selector: 'figcaption.media__caption' },
    { elementName: "contents", selector: '.article__body > *' }
  ],
  [
    { elementName: "headlines", selector: '.c-article-top-info__title' },
    { elementName: "subheadings", selector: '.c-article-top-info__description' },
    { elementName: "captions", selector: 'figcaption.c-article-top-image__caption' },
    { elementName: "contents", selector: '.c-article-text-container > * > *' }
  ],
  [
    { elementName: "headlines", selector: '.article-header__title' },
    { elementName: "subheadings", selector: '.article-header__intro' },
    { elementName: "captions", selector: '.image-caption__short-caption-inner' },
    { elementName: "contents", selector: '.article-body' }
  ],
]

const main = async () => {
  websites.forEach(async (w, index) => {
    if (index === 3) {
      const ans = await downloadArticle(w, elementArray[index])
      console.log(ans)  
    }
  })
}

main();
