// Curated facts + verified, currently-public YouTube videos per country.
// Add more countries/videos here as the MERIDIAN storefront list grows.

const COUNTRY_INFO = {
  'United States': {
    facts: [
      'Currency is the US Dollar (USD). Most Mexieon listings are already priced in USD for this storefront.',
      'No customs duties apply on USMCA-qualifying goods shipped from the Mexico hub.',
      'Standard delivery from the hub typically takes 3-7 business days.',
      'English is the primary language; Spanish is widely spoken in many regions.'
    ],
    video: { id: 'bNTUuAfWe00', title: 'Introducing the USA — Lonely Planet' }
  },
  'Mexico (Hub)': {
    facts: [
      'Currency is the Mexican Peso (MXN), though many Mexieon sellers also list in USD.',
      'This is the Mexieon trade hub — goods routed here qualify for treaty pricing before re-export.',
      'Spanish is the primary language.',
      'Local pickup and bonded-warehouse consolidation are available for wholesale orders.'
    ],
    video: { id: 'N4I4HsowHD8', title: 'Introducing Mexico — Lonely Planet' }
  },
  'Canada': {
    facts: [
      'Currency is the Canadian Dollar (CAD).',
      'USMCA-qualifying goods cross duty-free; non-qualifying goods may incur standard import duties.',
      'English and French are both official languages.',
      'Delivery from the hub typically takes 5-10 business days depending on province.'
    ],
    video: { id: 'Ubcwss75oFA', title: 'Introducing Canada — Lonely Planet' }
  },
  'Trinidad & Tobago': {
    facts: [
      'Currency is the Trinidad and Tobago Dollar (TTD).',
      'Trinidad & Tobago is not currently a USMCA party, so standard import duties and VAT may apply at customs.',
      'English is the official language; Trinidadian Creole is widely spoken.',
      'Mexieon ships here via bilateral and Caribbean trade routes rather than USMCA.'
    ],
    video: { id: 'HJ3bSwSuZ8M', title: 'Why Trinidad Deserves More Attention — travel vlog' }
  },
  'Spain': {
    facts: [
      'Currency is the Euro (EUR).',
      'Goods route through the EU-Mexico trade agreement (TLCUEM) framework.',
      'Spanish is the official language.',
      'EU import VAT may apply on top of the listed price depending on item category.'
    ],
    video: { id: 'n2ZvJd8aDRU', title: 'Introducing Spain — Lonely Planet' }
  },
  'Japan': {
    facts: [
      'Currency is the Japanese Yen (JPY).',
      'Goods route through CPTPP (Comprehensive and Progressive Agreement for Trans-Pacific Partnership) terms.',
      'Japanese is the official language.',
      'Delivery times from the hub run longer on average (10-18 business days) due to distance.'
    ],
    video: { id: 'hqn6eI0VckM', title: 'Introducing Japan — Lonely Planet' }
  },
  'Chile': {
    facts: [
      'Currency is the Chilean Peso (CLP).',
      'Goods route through Pacific Alliance preferential trade terms.',
      'Spanish is the official language.',
      'Chile has one of the more straightforward customs processes among Mexieon\'s Pacific Alliance partners.'
    ],
    video: { id: 'pZ6gH5km_YA', title: 'A visit to Valparaíso, Chile — Lonely Planet' }
  },
  'Jamaica': {
    facts: [
      'Currency is the Jamaican Dollar (JMD).',
      'Jamaica is not currently a USMCA party, so standard CARICOM/import duties and GCT (General Consumption Tax) may apply at customs.',
      'English is the official language; Jamaican Patois is widely spoken.',
      'Mexieon ships here via Caribbean and bilateral trade routes rather than USMCA.'
    ],
    video: { id: '_HPpuozyvAw', title: 'Introducing Jamaica — Lonely Planet' }
  },
  'China': {
    facts: [
      'Currency is the Chinese Yuan / Renminbi (CNY).',
      'Goods route through bilateral and regional trade frameworks rather than USMCA; import duties and VAT typically apply.',
      'Mandarin Chinese is the official language.',
      'Delivery times from the hub run longer on average (12-20 business days) due to distance and customs clearance.'
    ],
    video: { id: 'hI46Wvjgo_0', title: 'Introducing China — Lonely Planet' }
  },
  'India': {
    facts: [
      'Currency is the Indian Rupee (INR).',
      'Goods route through bilateral trade terms; import duties and GST typically apply at customs.',
      'Hindi and English are both widely used; India has 22 officially recognized languages.',
      'Delivery times from the hub run longer on average (12-20 business days) due to distance.'
    ],
    video: { id: 'cKm6CWej3rQ', title: 'Introducing India — Lonely Planet' }
  },
  'Thailand': {
    facts: [
      'Currency is the Thai Baht (THB).',
      'Goods route through CPTPP-adjacent and bilateral Asia-Pacific trade terms.',
      'Thai is the official language.',
      'Delivery times from the hub run 10-18 business days depending on customs clearance.'
    ],
    video: { id: 'y7ivzf8anKU', title: 'Introducing Thailand — Lonely Planet' }
  },
  'South Korea': {
    facts: [
      'Currency is the South Korean Won (KRW).',
      'Goods route through CPTPP-adjacent Asia-Pacific trade terms.',
      'Korean is the official language.',
      'Delivery times from the hub run 10-18 business days due to distance.'
    ],
    video: { id: 'KBCuJ_2wWPU', title: 'Introducing South Korea — Lonely Planet' }
  },
  'Vietnam': {
    facts: [
      'Currency is the Vietnamese Dong (VND).',
      'Goods route through CPTPP-adjacent Asia-Pacific trade terms.',
      'Vietnamese is the official language.',
      'Delivery times from the hub run 10-18 business days depending on customs clearance.'
    ],
    video: { id: 'rZztMpGC42s', title: 'Introducing Vietnam — Lonely Planet' }
  },
  'Kenya': {
    facts: [
      'Currency is the Kenyan Shilling (KES).',
      'Goods route through bilateral African trade agreements; import duties and VAT typically apply.',
      'English and Swahili are both official languages.',
      'Delivery times from the hub run 14-21 business days depending on customs clearance.'
    ],
    video: { id: 'BJNdmbDdL7Q', title: 'Introducing Kenya — Lonely Planet' }
  },
  'South Africa': {
    facts: [
      'Currency is the South African Rand (ZAR).',
      'Goods route through bilateral African trade agreements; import duties and VAT typically apply.',
      'South Africa has 11 official languages, including English, Zulu, and Afrikaans.',
      'Delivery times from the hub run 14-21 business days depending on customs clearance.'
    ],
    video: { id: 'JIYSRwJeQIw', title: 'Introducing Cape Town & the Garden Route — Lonely Planet' }
  },
  'Egypt': {
    facts: [
      'Currency is the Egyptian Pound (EGP).',
      'Goods route through bilateral trade agreements; import duties and VAT typically apply.',
      'Arabic is the official language.',
      'Delivery times from the hub run 14-21 business days depending on customs clearance.'
    ],
    video: { id: 'VsCqEu6CIKg', title: 'Introducing Egypt — Lonely Planet' }
  },
  'Morocco': {
    facts: [
      'Currency is the Moroccan Dirham (MAD).',
      'Goods route through agreements adjacent to the EU-Mexico framework given Morocco\'s EU trade ties; import duties typically apply.',
      'Arabic and Amazigh (Berber) are official languages; French is widely used in business.',
      'Delivery times from the hub run 12-18 business days depending on customs clearance.'
    ],
    video: { id: 'nUHtdhGN0Dc', title: 'Introducing Morocco — Lonely Planet' }
  },
  'Nigeria': {
    facts: [
      'Currency is the Nigerian Naira (NGN).',
      'Goods route through bilateral African trade agreements; import duties and VAT typically apply.',
      'English is the official language; Hausa, Yoruba, and Igbo are widely spoken.',
      'Delivery times from the hub run 14-21 business days depending on customs clearance.'
    ],
    video: { id: 'zJI1CeZ4Kb8', title: 'Lagos in 3 Days — Nigeria Travel Vlog' }
  }
};

// Very small keyword router so the concierge gives a relevant fact first,
// without needing a paid LLM call. If ANTHROPIC_API_KEY is configured later,
// this can be swapped for a real model call in routes-concierge.js.
function answerQuestion(country, question) {
  const info = COUNTRY_INFO[country];
  if (!info) return null;

  const q = (question || '').toLowerCase();
  const topicMap = [
    { keys: ['currency', 'money', 'cost', 'price', 'pay'], index: 0 },
    { keys: ['duty', 'duties', 'tariff', 'tax', 'customs', 'import'], index: 1 },
    { keys: ['language', 'speak', 'spanish', 'english'], index: 2 },
    { keys: ['ship', 'delivery', 'arrive', 'long', 'fast', 'when'], index: 3 }
  ];

  let matched = null;
  for (const topic of topicMap) {
    if (topic.keys.some((k) => q.includes(k))) {
      matched = info.facts[topic.index];
      break;
    }
  }

  const answer = matched
    ? matched
    : `Here's a quick overview of shopping in ${country}: ` + info.facts.join(' ');

  return { answer, video: info.video };
}

module.exports = { COUNTRY_INFO, answerQuestion };
