import pg from 'pg';
import 'dotenv/config';

const sources = [
  // ============================================================
  // === AMERICAS (12 sources) ===
  // ============================================================
  {
    name: 'Associated Press', slug: 'associated-press', url: 'https://apnews.com',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=source:Associated+Press&ceid=US:en&hl=en-US&gl=US', category: 'general', language: 'en' }],
    country_code: 'US', region: 'americas', language: 'en',
    funding_model: 'nonprofit', editorial_lean: 'center', factual_rating: 'very_high',
    ownership: 'AP Cooperative (nonprofit news cooperative)',
  },
  {
    name: 'NPR', slug: 'npr', url: 'https://www.npr.org',
    rss_feeds: [{ url: 'https://feeds.npr.org/1001/rss.xml', category: 'general', language: 'en' }],
    country_code: 'US', region: 'americas', language: 'en',
    funding_model: 'public', editorial_lean: 'center_left', factual_rating: 'very_high',
    ownership: 'National Public Radio (nonprofit)',
  },
  {
    name: 'The New York Times', slug: 'nyt', url: 'https://www.nytimes.com',
    rss_feeds: [{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'world', language: 'en' }],
    country_code: 'US', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'The New York Times Company',
  },
  {
    name: 'The Wall Street Journal', slug: 'wsj', url: 'https://www.wsj.com',
    rss_feeds: [{ url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', category: 'world', language: 'en' }],
    country_code: 'US', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'center_right', factual_rating: 'high',
    ownership: 'News Corp (Rupert Murdoch)',
  },
  {
    name: 'Fox News', slug: 'fox-news', url: 'https://www.foxnews.com',
    rss_feeds: [{ url: 'https://moxie.foxnews.com/google-publisher/world.xml', category: 'world', language: 'en' }],
    country_code: 'US', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'right', factual_rating: 'mixed',
    ownership: 'Fox Corporation (Rupert Murdoch)',
  },
  {
    name: 'CBC News', slug: 'cbc', url: 'https://www.cbc.ca',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=source:CBC+News&ceid=CA:en&hl=en-CA&gl=CA', category: 'general', language: 'en' }],
    country_code: 'CA', region: 'americas', language: 'en',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Canadian Broadcasting Corporation (Crown corporation)',
  },
  {
    name: 'The Globe and Mail', slug: 'globe-and-mail', url: 'https://www.theglobeandmail.com',
    rss_feeds: [{ url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/', category: 'world', language: 'en' }],
    country_code: 'CA', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Woodbridge Company (Thomson family)',
  },
  {
    name: 'Folha de S.Paulo', slug: 'folha', url: 'https://www.folha.uol.com.br',
    rss_feeds: [{ url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml', category: 'world', language: 'pt' }],
    country_code: 'BR', region: 'americas', language: 'pt',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Grupo Folha',
  },
  {
    name: 'El Universal Mexico', slug: 'el-universal-mx', url: 'https://www.eluniversal.com.mx',
    rss_feeds: [{ url: 'https://www.eluniversal.com.mx/arc/outboundfeeds/rss/', category: 'general', language: 'es' }],
    country_code: 'MX', region: 'americas', language: 'es',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'El Universal Compania Periodistica Nacional',
  },
  {
    name: 'La Nacion Argentina', slug: 'la-nacion-ar', url: 'https://www.lanacion.com.ar',
    rss_feeds: [{ url: 'https://www.lanacion.com.ar/arcio/rss/category/el-mundo/', category: 'world', language: 'es' }],
    country_code: 'AR', region: 'americas', language: 'es',
    funding_model: 'private', editorial_lean: 'center_right', factual_rating: 'high',
    ownership: 'S.A. La Nacion',
  },
  {
    name: 'El Pais', slug: 'el-pais', url: 'https://elpais.com',
    rss_feeds: [{ url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada', category: 'general', language: 'en' }],
    country_code: 'ES', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'PRISA Group',
  },
  {
    name: 'Buenos Aires Times', slug: 'ba-times', url: 'https://www.batimes.com.ar',
    rss_feeds: [{ url: 'https://www.batimes.com.ar/feed', category: 'general', language: 'en' }],
    country_code: 'AR', region: 'americas', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Buenos Aires Times (independent)',
  },

  // ============================================================
  // === EUROPE (16 sources) ===
  // ============================================================
  {
    name: 'Reuters', slug: 'reuters', url: 'https://www.reuters.com',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=source:reuters&ceid=US:en&hl=en-US&gl=US', category: 'general', language: 'en' }],
    country_code: 'GB', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'very_high',
    ownership: 'Thomson Reuters Corporation',
  },
  {
    name: 'BBC News', slug: 'bbc', url: 'https://www.bbc.com',
    rss_feeds: [
      { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', category: 'world', language: 'en' },
      { url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'general', language: 'en' },
    ],
    country_code: 'GB', region: 'europe', language: 'en',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'BBC (UK public broadcaster, license fee funded)',
  },
  {
    name: 'The Guardian', slug: 'guardian', url: 'https://www.theguardian.com',
    rss_feeds: [{ url: 'https://www.theguardian.com/world/rss', category: 'world', language: 'en' }],
    country_code: 'GB', region: 'europe', language: 'en',
    funding_model: 'nonprofit', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'Scott Trust Limited (nonprofit)',
  },
  {
    name: 'Deutsche Welle', slug: 'dw', url: 'https://www.dw.com',
    rss_feeds: [{ url: 'https://rss.dw.com/xml/rss-en-all', category: 'general', language: 'en' }],
    country_code: 'DE', region: 'europe', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'German federal government (public international broadcaster)',
  },
  {
    name: 'France 24', slug: 'france24', url: 'https://www.france24.com',
    rss_feeds: [{ url: 'https://www.france24.com/en/rss', category: 'general', language: 'en' }],
    country_code: 'FR', region: 'europe', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'France Medias Monde (French government)',
  },
  {
    name: 'EuroNews', slug: 'euronews', url: 'https://www.euronews.com',
    rss_feeds: [{ url: 'https://www.euronews.com/rss', category: 'general', language: 'en' }],
    country_code: 'FR', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Alpac Capital (Portuguese investment group)',
  },
  {
    name: 'Der Spiegel', slug: 'spiegel', url: 'https://www.spiegel.de',
    rss_feeds: [{ url: 'https://www.spiegel.de/international/index.rss', category: 'international', language: 'en' }],
    country_code: 'DE', region: 'europe', language: 'de',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'Spiegel-Verlag Rudolf Augstein GmbH & Co. KG',
  },
  {
    name: 'NOS', slug: 'nos', url: 'https://nos.nl',
    rss_feeds: [{ url: 'https://feeds.nos.nl/nosnieuwsalgemeen', category: 'general', language: 'nl' }],
    country_code: 'NL', region: 'europe', language: 'nl',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Nederlandse Omroep Stichting (Dutch public broadcaster)',
  },
  {
    name: 'The Irish Times', slug: 'irish-times', url: 'https://www.irishtimes.com',
    rss_feeds: [{ url: 'https://www.irishtimes.com/cmlink/news-1.1319192', category: 'general', language: 'en' }],
    country_code: 'IE', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'The Irish Times Trust',
  },
  {
    name: 'The Local Europe', slug: 'the-local', url: 'https://www.thelocal.com',
    rss_feeds: [
      { url: 'https://feeds.thelocal.com/rss/se', category: 'sweden', language: 'en' },
      { url: 'https://feeds.thelocal.com/rss/de', category: 'germany', language: 'en' },
      { url: 'https://feeds.thelocal.com/rss/fr', category: 'france', language: 'en' },
      { url: 'https://feeds.thelocal.com/rss/it', category: 'italy', language: 'en' },
      { url: 'https://feeds.thelocal.com/rss/es', category: 'spain', language: 'en' },
    ],
    country_code: 'SE', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'The Local Europe AB',
  },
  {
    name: 'Kyiv Independent', slug: 'kyiv-independent', url: 'https://kyivindependent.com',
    rss_feeds: [{ url: 'https://kyivindependent.com/news-archive/rss/', category: 'general', language: 'en' }],
    country_code: 'UA', region: 'europe', language: 'en',
    funding_model: 'nonprofit', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Kyiv Independent (independent nonprofit)',
  },
  {
    name: 'The Moscow Times', slug: 'moscow-times', url: 'https://www.themoscowtimes.com',
    rss_feeds: [{ url: 'https://www.themoscowtimes.com/rss/news', category: 'general', language: 'en' }],
    country_code: 'RU', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'The Moscow Times (independent, Netherlands-based)',
  },
  {
    name: 'Anadolu Agency', slug: 'anadolu', url: 'https://www.aa.com.tr/en',
    rss_feeds: [{ url: 'https://www.aa.com.tr/en/rss/default?cat=world', category: 'world', language: 'en' }],
    country_code: 'TR', region: 'europe', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center_right', factual_rating: 'mostly_factual',
    ownership: 'Republic of Turkey (state news agency)',
  },
  {
    name: 'SWI swissinfo', slug: 'swissinfo', url: 'https://www.swissinfo.ch',
    rss_feeds: [{ url: 'https://cdn.prod.swi-services.ch/rss/eng/rssxml/latest-news/rss', category: 'general', language: 'en' }],
    country_code: 'CH', region: 'europe', language: 'en',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'very_high',
    ownership: 'Swiss Broadcasting Corporation (SRG SSR, public)',
  },
  {
    name: 'RFE/RL', slug: 'rferl', url: 'https://www.rferl.org',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=source:Radio+Free+Europe&hl=en', category: 'general', language: 'en' }],
    country_code: 'CZ', region: 'europe', language: 'en',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Radio Free Europe/Radio Liberty (US government-funded, editorially independent)',
  },
  {
    name: 'ANSA', slug: 'ansa', url: 'https://www.ansa.it',
    rss_feeds: [{ url: 'https://www.ansa.it/english/news/english_nr_rss.xml', category: 'general', language: 'en' }],
    country_code: 'IT', region: 'europe', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'ANSA (Italian news cooperative)',
  },

  // ============================================================
  // === ASIA-PACIFIC (14 sources) ===
  // ============================================================
  {
    name: 'South China Morning Post', slug: 'scmp', url: 'https://www.scmp.com',
    rss_feeds: [{ url: 'https://www.scmp.com/rss/91/feed', category: 'general', language: 'en' }],
    country_code: 'HK', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Alibaba Group',
  },
  {
    name: 'NHK World', slug: 'nhk', url: 'https://www3.nhk.or.jp/nhkworld',
    rss_feeds: [{ url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', category: 'general', language: 'ja' }],
    country_code: 'JP', region: 'asia_pacific', language: 'ja',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Japan Broadcasting Corporation (public)',
  },
  {
    name: 'The Japan Times', slug: 'japan-times', url: 'https://www.japantimes.co.jp',
    rss_feeds: [{ url: 'https://www.japantimes.co.jp/feed/', category: 'general', language: 'en' }],
    country_code: 'JP', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'News2u Holdings (Japanese media company)',
  },
  {
    name: 'Nikkei Asia', slug: 'nikkei-asia', url: 'https://asia.nikkei.com',
    rss_feeds: [{ url: 'https://asia.nikkei.com/rss/feed/nar', category: 'general', language: 'en' }],
    country_code: 'JP', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Nikkei Inc.',
  },
  {
    name: 'Times of India', slug: 'toi', url: 'https://timesofindia.indiatimes.com',
    rss_feeds: [{ url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', category: 'general', language: 'en' }],
    country_code: 'IN', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center_right', factual_rating: 'mostly_factual',
    ownership: 'The Times Group (Bennett, Coleman & Co. Ltd)',
  },
  {
    name: 'The Hindu', slug: 'the-hindu', url: 'https://www.thehindu.com',
    rss_feeds: [{ url: 'https://www.thehindu.com/news/international/feeder/default.rss', category: 'world', language: 'en' }],
    country_code: 'IN', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'The Hindu Group (Kasturi & Sons Ltd)',
  },
  {
    name: 'Dawn', slug: 'dawn', url: 'https://www.dawn.com',
    rss_feeds: [{ url: 'https://www.dawn.com/feed', category: 'general', language: 'en' }],
    country_code: 'PK', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'Pakistan Herald Publications',
  },
  {
    name: 'ABC Australia', slug: 'abc-au', url: 'https://www.abc.net.au',
    rss_feeds: [{ url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', category: 'general', language: 'en' }],
    country_code: 'AU', region: 'asia_pacific', language: 'en',
    funding_model: 'public', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Australian Broadcasting Corporation (public)',
  },
  {
    name: 'CNA', slug: 'cna', url: 'https://www.channelnewsasia.com',
    rss_feeds: [{ url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', category: 'general', language: 'en' }],
    country_code: 'SG', region: 'asia_pacific', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Mediacorp (Singapore government-linked)',
  },
  {
    name: 'Yonhap News', slug: 'yonhap', url: 'https://en.yna.co.kr',
    rss_feeds: [{ url: 'https://en.yna.co.kr/RSS/news.xml', category: 'general', language: 'en' }],
    country_code: 'KR', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Yonhap News Agency (Korean news cooperative)',
  },
  {
    name: 'Bangkok Post', slug: 'bangkok-post', url: 'https://www.bangkokpost.com',
    rss_feeds: [{ url: 'https://search.bangkokpost.com/rss/data/most-recent.xml', category: 'general', language: 'en' }],
    country_code: 'TH', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Post Publishing PCL',
  },
  {
    name: 'Rappler', slug: 'rappler', url: 'https://www.rappler.com',
    rss_feeds: [{ url: 'https://www.rappler.com/feed/', category: 'general', language: 'en' }],
    country_code: 'PH', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Rappler Holdings Corporation (independent)',
  },
  {
    name: 'The Daily Star Bangladesh', slug: 'daily-star-bd', url: 'https://www.thedailystar.net',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:thedailystar.net&hl=en', category: 'general', language: 'en' }],
    country_code: 'BD', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Mediaworld Ltd',
  },
  {
    name: 'New Zealand Herald', slug: 'nz-herald', url: 'https://www.nzherald.co.nz',
    rss_feeds: [{ url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/curated/78/?outputType=xml', category: 'general', language: 'en' }],
    country_code: 'NZ', region: 'asia_pacific', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'NZME (New Zealand Media and Entertainment)',
  },

  // ============================================================
  // === MIDDLE EAST & AFRICA (14 sources) ===
  // ============================================================
  {
    name: 'Al Jazeera', slug: 'aljazeera', url: 'https://www.aljazeera.com',
    rss_feeds: [{ url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'general', language: 'en' }],
    country_code: 'QA', region: 'mideast_africa', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center_left', factual_rating: 'mostly_factual',
    ownership: 'Al Jazeera Media Network (Qatar government)',
  },
  {
    name: 'Times of Israel', slug: 'times-of-israel', url: 'https://www.timesofisrael.com',
    rss_feeds: [{ url: 'https://www.timesofisrael.com/feed/', category: 'general', language: 'en' }],
    country_code: 'IL', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Times of Israel (independent)',
  },
  {
    name: 'Haaretz', slug: 'haaretz', url: 'https://www.haaretz.com',
    rss_feeds: [{ url: 'https://www.haaretz.com/srv/all-headlines-rss', category: 'general', language: 'en' }],
    country_code: 'IL', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'Haaretz Group (Schocken family)',
  },
  {
    name: 'Middle East Eye', slug: 'middle-east-eye', url: 'https://www.middleeasteye.net',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:middleeasteye.net&hl=en', category: 'general', language: 'en' }],
    country_code: 'GB', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'mostly_factual',
    ownership: 'Middle East Eye Ltd (independent, UK-based)',
  },
  {
    name: 'Khaleej Times', slug: 'khaleej-times', url: 'https://www.khaleejtimes.com',
    rss_feeds: [
      { url: 'https://www.khaleejtimes.com/api/v1/collections/world.rss', category: 'world', language: 'en' },
      { url: 'https://www.khaleejtimes.com/api/v1/collections/top-section.rss', category: 'general', language: 'en' },
    ],
    country_code: 'AE', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Galadari Brothers (UAE media group)',
  },
  {
    name: 'Al Arabiya', slug: 'al-arabiya', url: 'https://english.alarabiya.net',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:english.alarabiya.net&hl=en', category: 'general', language: 'en' }],
    country_code: 'SA', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center_right', factual_rating: 'mostly_factual',
    ownership: 'MBC Group (Saudi-owned)',
  },
  {
    name: 'TRT World', slug: 'trt-world', url: 'https://www.trtworld.com',
    rss_feeds: [{ url: 'https://www.trtworld.com/feed/rss.xml', category: 'general', language: 'en' }],
    country_code: 'TR', region: 'mideast_africa', language: 'en',
    funding_model: 'state_funded', editorial_lean: 'center_right', factual_rating: 'mostly_factual',
    ownership: 'Turkish Radio and Television Corporation (state)',
  },
  {
    name: 'Premium Times Nigeria', slug: 'premium-times', url: 'https://www.premiumtimesng.com',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:premiumtimesng.com&hl=en', category: 'general', language: 'en' }],
    country_code: 'NG', region: 'mideast_africa', language: 'en',
    funding_model: 'nonprofit', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Premium Times Services Ltd (independent nonprofit)',
  },
  {
    name: 'The Punch Nigeria', slug: 'punch-ng', url: 'https://punchng.com',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:punchng.com&hl=en', category: 'general', language: 'en' }],
    country_code: 'NG', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Punch Nigeria Limited',
  },
  {
    name: 'News24', slug: 'news24', url: 'https://www.news24.com',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:news24.com&hl=en', category: 'general', language: 'en' }],
    country_code: 'ZA', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Naspers / Media24',
  },
  {
    name: 'Mail & Guardian', slug: 'mail-guardian', url: 'https://mg.co.za',
    rss_feeds: [{ url: 'https://mg.co.za/feed/', category: 'general', language: 'en' }],
    country_code: 'ZA', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center_left', factual_rating: 'high',
    ownership: 'M&G Media (independent)',
  },
  {
    name: 'The East African', slug: 'east-african', url: 'https://www.theeastafrican.co.ke',
    rss_feeds: [{ url: 'https://news.google.com/rss/search?q=site:theeastafrican.co.ke&hl=en', category: 'general', language: 'en' }],
    country_code: 'KE', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Nation Media Group (East African weekly)',
  },
  {
    name: 'The Standard Kenya', slug: 'standard-kenya', url: 'https://www.standardmedia.co.ke',
    rss_feeds: [
      { url: 'https://www.standardmedia.co.ke/rss/headlines.php', category: 'general', language: 'en' },
      { url: 'https://www.standardmedia.co.ke/rss/world.php', category: 'world', language: 'en' },
    ],
    country_code: 'KE', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'mostly_factual',
    ownership: 'Standard Group PLC',
  },
  {
    name: 'The Africa Report', slug: 'africa-report', url: 'https://www.theafricareport.com',
    rss_feeds: [{ url: 'https://www.theafricareport.com/feed/', category: 'general', language: 'en' }],
    country_code: 'FR', region: 'mideast_africa', language: 'en',
    funding_model: 'private', editorial_lean: 'center', factual_rating: 'high',
    ownership: 'Jeune Afrique Media Group',
  },
];

async function seedSources() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://globalpulse:globalpulse@localhost:5432/globalpulse',
  });

  await client.connect();
  console.log('Connected to database');

  let inserted = 0;
  let skipped = 0;

  for (const s of sources) {
    try {
      await client.query(
        `INSERT INTO sources (name, slug, url, rss_feeds, country_code, region, language, funding_model, editorial_lean, factual_rating, ownership, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         ON CONFLICT (name) DO UPDATE SET
           slug = EXCLUDED.slug, url = EXCLUDED.url, rss_feeds = EXCLUDED.rss_feeds,
           country_code = EXCLUDED.country_code, region = EXCLUDED.region, language = EXCLUDED.language,
           funding_model = EXCLUDED.funding_model, editorial_lean = EXCLUDED.editorial_lean,
           factual_rating = EXCLUDED.factual_rating, ownership = EXCLUDED.ownership,
           updated_at = NOW()`,
        [
          s.name, s.slug, s.url, JSON.stringify(s.rss_feeds),
          s.country_code, s.region, s.language,
          s.funding_model, s.editorial_lean, s.factual_rating, s.ownership,
        ]
      );
      inserted++;
      console.log(`  + ${s.name} (${s.region})`);
    } catch (err) {
      skipped++;
      console.error(`  ! ${s.name}: ${err.message}`);
    }
  }

  console.log(`\nSeeded ${inserted} sources, ${skipped} skipped`);
  await client.end();
}

seedSources().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
