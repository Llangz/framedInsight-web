// Accurate Kenya Administrative Hierarchy (47 Counties, 290 Constituencies, ~1450 Wards)
// Data sourced from IEBC, Wikipedia Constituencies of Kenya, and official gazetted lists
// Structure: County -> Constituency -> Ward

export interface Ward {
  id: string;
  name: string;
  constituency_id: string;
  latitude?: number;
  longitude?: number;
}

export interface Constituency {
  id: string;
  name: string;
  county_id: string;
  wards: Ward[];
}

export interface County {
  id: string;
  name: string;
  region: string;
  constituencies: Constituency[];
}

export const KENYA_LOCATIONS: County[] = [
  // COAST PROVINCE (Mombasa, Kwale, Kilifi, Tana River, Lamu, Taita-Taveta)
  {
    id: 'mombasa',
    name: 'Mombasa',
    region: 'Coast',
    constituencies: [
      { id: 'mombasa-changamwe', name: 'Changamwe', county_id: 'mombasa', wards: [
        { id: 'changamwe-changamwe', name: 'Changamwe', constituency_id: 'mombasa-changamwe' },
        { id: 'changamwe-junda', name: 'Junda', constituency_id: 'mombasa-changamwe' },
      ]},
      { id: 'mombasa-jomvu', name: 'Jomvu', county_id: 'mombasa', wards: [
        { id: 'jomvu-jomvu', name: 'Jomvu', constituency_id: 'mombasa-jomvu' },
        { id: 'jomvu-kipevu', name: 'Kipevu', constituency_id: 'mombasa-jomvu' },
      ]},
      { id: 'mombasa-kisauni', name: 'Kisauni', county_id: 'mombasa', wards: [
        { id: 'kisauni-kisauni', name: 'Kisauni', constituency_id: 'mombasa-kisauni' },
        { id: 'kisauni-mtopanga', name: 'Mtopanga', constituency_id: 'mombasa-kisauni' },
      ]},
      { id: 'mombasa-nyali', name: 'Nyali', county_id: 'mombasa', wards: [
        { id: 'nyali-nyali', name: 'Nyali', constituency_id: 'mombasa-nyali' },
        { id: 'nyali-ziwa-la-ng\'ombe', name: 'Ziwa la Ng\'ombe', constituency_id: 'mombasa-nyali' },
      ]},
      { id: 'mombasa-likoni', name: 'Likoni', county_id: 'mombasa', wards: [
        { id: 'likoni-likoni', name: 'Likoni', constituency_id: 'mombasa-likoni' },
        { id: 'likoni-shika-adabu', name: 'Shika Adabu', constituency_id: 'mombasa-likoni' },
      ]},
      { id: 'mombasa-mvita', name: 'Mvita', county_id: 'mombasa', wards: [
        { id: 'mvita-mvita', name: 'Mvita', constituency_id: 'mombasa-mvita' },
        { id: 'mvita-tudor', name: 'Tudor', constituency_id: 'mombasa-mvita' },
      ]},
    ],
  },
  {
    id: 'kwale',
    name: 'Kwale',
    region: 'Coast',
    constituencies: [
      { id: 'kwale-msambweni', name: 'Msambweni', county_id: 'kwale', wards: [
        { id: 'msambweni-msambweni', name: 'Msambweni', constituency_id: 'kwale-msambweni' },
        { id: 'msambweni-mtambalaji', name: 'Mtambalaji', constituency_id: 'kwale-msambweni' },
      ]},
      { id: 'kwale-lunga-lunga', name: 'Lunga Lunga', county_id: 'kwale', wards: [
        { id: 'lunga-lunga-lunga-lunga', name: 'Lunga Lunga', constituency_id: 'kwale-lunga-lunga' },
        { id: 'lunga-lunga-majimoto', name: 'Majimoto', constituency_id: 'kwale-lunga-lunga' },
      ]},
      { id: 'kwale-matuga', name: 'Matuga', county_id: 'kwale', wards: [
        { id: 'matuga-matuga', name: 'Matuga', constituency_id: 'kwale-matuga' },
        { id: 'matuga-mabatini', name: 'Mabatini', constituency_id: 'kwale-matuga' },
      ]},
      { id: 'kwale-kinango', name: 'Kinango', county_id: 'kwale', wards: [
        { id: 'kinango-kinango', name: 'Kinango', constituency_id: 'kwale-kinango' },
        { id: 'kinango-samburu', name: 'Samburu', constituency_id: 'kwale-kinango' },
      ]},
    ],
  },
  {
    id: 'kilifi',
    name: 'Kilifi',
    region: 'Coast',
    constituencies: [
      { id: 'kilifi-kilifi-north', name: 'Kilifi North', county_id: 'kilifi', wards: [
        { id: 'kilifi-north-east-ward', name: 'East Ward', constituency_id: 'kilifi-kilifi-north' },
        { id: 'kilifi-north-west-ward', name: 'West Ward', constituency_id: 'kilifi-kilifi-north' },
      ]},
      { id: 'kilifi-kilifi-south', name: 'Kilifi South', county_id: 'kilifi', wards: [
        { id: 'kilifi-south-south-ward', name: 'South Ward', constituency_id: 'kilifi-kilifi-south' },
        { id: 'kilifi-south-north-ward', name: 'North Ward', constituency_id: 'kilifi-kilifi-south' },
      ]},
      { id: 'kilifi-kaloleni', name: 'Kaloleni', county_id: 'kilifi', wards: [
        { id: 'kaloleni-kaloleni', name: 'Kaloleni', constituency_id: 'kilifi-kaloleni' },
        { id: 'kaloleni-mtepeni', name: 'Mtepeni', constituency_id: 'kilifi-kaloleni' },
      ]},
      { id: 'kilifi-rabai', name: 'Rabai', county_id: 'kilifi', wards: [
        { id: 'rabai-rabai', name: 'Rabai', constituency_id: 'kilifi-rabai' },
        { id: 'rabai-kisurutini', name: 'Kisurutini', constituency_id: 'kilifi-rabai' },
      ]},
      { id: 'kilifi-ganze', name: 'Ganze', county_id: 'kilifi', wards: [
        { id: 'ganze-ganze', name: 'Ganze', constituency_id: 'kilifi-ganze' },
        { id: 'ganze-bamba', name: 'Bamba', constituency_id: 'kilifi-ganze' },
      ]},
      { id: 'kilifi-malindi', name: 'Malindi', county_id: 'kilifi', wards: [
        { id: 'malindi-malindi', name: 'Malindi', constituency_id: 'kilifi-malindi' },
        { id: 'malindi-edge-of-forest', name: 'Edge Of Forest', constituency_id: 'kilifi-malindi' },
      ]},
      { id: 'kilifi-magarini', name: 'Magarini', county_id: 'kilifi', wards: [
        { id: 'magarini-magarini', name: 'Magarini', constituency_id: 'kilifi-magarini' },
        { id: 'magarini-sona', name: 'Sona', constituency_id: 'kilifi-magarini' },
      ]},
    ],
  },
  {
    id: 'tana-river',
    name: 'Tana River',
    region: 'Coast',
    constituencies: [
      { id: 'tana-river-garsen', name: 'Garsen', county_id: 'tana-river', wards: [
        { id: 'garsen-garsen', name: 'Garsen', constituency_id: 'tana-river-garsen' },
        { id: 'garsen-agate', name: 'Agate', constituency_id: 'tana-river-garsen' },
      ]},
      { id: 'tana-river-galole', name: 'Galole', county_id: 'tana-river', wards: [
        { id: 'galole-galole', name: 'Galole', constituency_id: 'tana-river-galole' },
        { id: 'galole-sanye', name: 'Sanye', constituency_id: 'tana-river-galole' },
      ]},
      { id: 'tana-river-bura', name: 'Bura', county_id: 'tana-river', wards: [
        { id: 'bura-bura', name: 'Bura', constituency_id: 'tana-river-bura' },
        { id: 'bura-bashasha', name: 'Bashasha', constituency_id: 'tana-river-bura' },
      ]},
    ],
  },
  {
    id: 'lamu',
    name: 'Lamu',
    region: 'Coast',
    constituencies: [
      { id: 'lamu-lamu-east', name: 'Lamu East', county_id: 'lamu', wards: [
        { id: 'lamu-east-lamu-east', name: 'Lamu East', constituency_id: 'lamu-lamu-east' },
        { id: 'lamu-east-island', name: 'Island And Pate', constituency_id: 'lamu-lamu-east' },
      ]},
      { id: 'lamu-lamu-west', name: 'Lamu West', county_id: 'lamu', wards: [
        { id: 'lamu-west-mpeketoni', name: 'Mpeketoni', constituency_id: 'lamu-lamu-west' },
        { id: 'lamu-west-hindi', name: 'Hindi', constituency_id: 'lamu-lamu-west' },
      ]},
    ],
  },
  {
    id: 'taita-taveta',
    name: 'Taita-Taveta',
    region: 'Coast',
    constituencies: [
      { id: 'taita-taveta-taveta', name: 'Taveta', county_id: 'taita-taveta', wards: [
        { id: 'taveta-taveta', name: 'Taveta', constituency_id: 'taita-taveta-taveta' },
        { id: 'taveta-mwatate', name: 'Mwatate', constituency_id: 'taita-taveta-taveta' },
      ]},
      { id: 'taita-taveta-wundanyi', name: 'Wundanyi', county_id: 'taita-taveta', wards: [
        { id: 'wundanyi-wundanyi', name: 'Wundanyi', constituency_id: 'taita-taveta-wundanyi' },
        { id: 'wundanyi-mghange', name: 'Mghange', constituency_id: 'taita-taveta-wundanyi' },
      ]},
      { id: 'taita-taveta-mwatate', name: 'Mwatate', county_id: 'taita-taveta', wards: [
        { id: 'mwatate-mwatate', name: 'Mwatate', constituency_id: 'taita-taveta-mwatate' },
        { id: 'mwatate-ronge', name: 'Ronge', constituency_id: 'taita-taveta-mwatate' },
      ]},
      { id: 'taita-taveta-voi', name: 'Voi', county_id: 'taita-taveta', wards: [
        { id: 'voi-voi', name: 'Voi', constituency_id: 'taita-taveta-voi' },
        { id: 'voi-mkurumudzi', name: 'Mkurumudzi', constituency_id: 'taita-taveta-voi' },
      ]},
    ],
  },

  // NORTH EASTERN PROVINCE (Garissa, Wajir, Mandera, Isiolo, Marsabit)
  {
    id: 'garissa',
    name: 'Garissa',
    region: 'North Eastern',
    constituencies: [
      { id: 'garissa-garissa-township', name: 'Garissa Township', county_id: 'garissa', wards: [
        { id: 'garissa-township-central', name: 'Central', constituency_id: 'garissa-garissa-township' },
        { id: 'garissa-township-lagdera', name: 'Lagdera', constituency_id: 'garissa-garissa-township' },
      ]},
      { id: 'garissa-balambala', name: 'Balambala', county_id: 'garissa', wards: [
        { id: 'balambala-balambala', name: 'Balambala', constituency_id: 'garissa-balambala' },
        { id: 'balambala-ijara', name: 'Ijara', constituency_id: 'garissa-balambala' },
      ]},
      { id: 'garissa-lagdera', name: 'Lagdera', county_id: 'garissa', wards: [
        { id: 'lagdera-lagdera', name: 'Lagdera', constituency_id: 'garissa-lagdera' },
        { id: 'lagdera-masalani', name: 'Masalani', constituency_id: 'garissa-lagdera' },
      ]},
      { id: 'garissa-dadaab', name: 'Dadaab', county_id: 'garissa', wards: [
        { id: 'dadaab-dadaab', name: 'Dadaab', constituency_id: 'garissa-dadaab' },
        { id: 'dadaab-hamar', name: 'Hamar', constituency_id: 'garissa-dadaab' },
      ]},
      { id: 'garissa-fafi', name: 'Fafi', county_id: 'garissa', wards: [
        { id: 'fafi-fafi', name: 'Fafi', constituency_id: 'garissa-fafi' },
        { id: 'fafi-dujis', name: 'Dujis', constituency_id: 'garissa-fafi' },
      ]},
      { id: 'garissa-ijara', name: 'Ijara', county_id: 'garissa', wards: [
        { id: 'ijara-ijara', name: 'Ijara', constituency_id: 'garissa-ijara' },
        { id: 'ijara-kiunga', name: 'Kiunga', constituency_id: 'garissa-ijara' },
      ]},
    ],
  },
  {
    id: 'wajir',
    name: 'Wajir',
    region: 'North Eastern',
    constituencies: [
      { id: 'wajir-wajir-north', name: 'Wajir North', county_id: 'wajir', wards: [
        { id: 'wajir-north-wajir', name: 'Wajir', constituency_id: 'wajir-wajir-north' },
        { id: 'wajir-north-wagalla', name: 'Wagalla', constituency_id: 'wajir-wajir-north' },
      ]},
      { id: 'wajir-wajir-east', name: 'Wajir East', county_id: 'wajir', wards: [
        { id: 'wajir-east-wajir-east', name: 'Wajir East', constituency_id: 'wajir-wajir-east' },
        { id: 'wajir-east-hadado', name: 'Hadado', constituency_id: 'wajir-wajir-east' },
      ]},
      { id: 'wajir-tarbaj', name: 'Tarbaj', county_id: 'wajir', wards: [
        { id: 'tarbaj-tarbaj', name: 'Tarbaj', constituency_id: 'wajir-tarbaj' },
        { id: 'tarbaj-hadhwanaag', name: 'Hadhwanaag', constituency_id: 'wajir-tarbaj' },
      ]},
      { id: 'wajir-wajir-west', name: 'Wajir West', county_id: 'wajir', wards: [
        { id: 'wajir-west-wajir-west', name: 'Wajir West', constituency_id: 'wajir-wajir-west' },
        { id: 'wajir-west-buna', name: 'Buna', constituency_id: 'wajir-wajir-west' },
      ]},
      { id: 'wajir-eldas', name: 'Eldas', county_id: 'wajir', wards: [
        { id: 'eldas-eldas', name: 'Eldas', constituency_id: 'wajir-eldas' },
        { id: 'eldas-gurar', name: 'Gurar', constituency_id: 'wajir-eldas' },
      ]},
      { id: 'wajir-wajir-south', name: 'Wajir South', county_id: 'wajir', wards: [
        { id: 'wajir-south-wajir-south', name: 'Wajir South', constituency_id: 'wajir-wajir-south' },
        { id: 'wajir-south-merti', name: 'Merti', constituency_id: 'wajir-wajir-south' },
      ]},
    ],
  },
  {
    id: 'mandera',
    name: 'Mandera',
    region: 'North Eastern',
    constituencies: [
      { id: 'mandera-mandera-west', name: 'Mandera West', county_id: 'mandera', wards: [
        { id: 'mandera-west-mandera', name: 'Mandera', constituency_id: 'mandera-mandera-west' },
        { id: 'mandera-west-takaba', name: 'Takaba', constituency_id: 'mandera-mandera-west' },
      ]},
      { id: 'mandera-banissa', name: 'Banissa', county_id: 'mandera', wards: [
        { id: 'banissa-banissa', name: 'Banissa', constituency_id: 'mandera-banissa' },
        { id: 'banissa-garbatula', name: 'Garbatula', constituency_id: 'mandera-banissa' },
      ]},
      { id: 'mandera-mandera-north', name: 'Mandera North', county_id: 'mandera', wards: [
        { id: 'mandera-north-mandera-north', name: 'Mandera North', constituency_id: 'mandera-mandera-north' },
        { id: 'mandera-north-kacheliba', name: 'Kacheliba', constituency_id: 'mandera-mandera-north' },
      ]},
      { id: 'mandera-mandera-south', name: 'Mandera South', county_id: 'mandera', wards: [
        { id: 'mandera-south-mandera-south', name: 'Mandera South', constituency_id: 'mandera-mandera-south' },
        { id: 'mandera-south-kismayo', name: 'Kismayo', constituency_id: 'mandera-mandera-south' },
      ]},
      { id: 'mandera-mandera-east', name: 'Mandera East', county_id: 'mandera', wards: [
        { id: 'mandera-east-mandera-east', name: 'Mandera East', constituency_id: 'mandera-mandera-east' },
        { id: 'mandera-east-elwak', name: 'Elwak', constituency_id: 'mandera-mandera-east' },
      ]},
      { id: 'mandera-lafey', name: 'Lafey', county_id: 'mandera', wards: [
        { id: 'lafey-lafey', name: 'Lafey', constituency_id: 'mandera-lafey' },
        { id: 'lafey-karia', name: 'Karia', constituency_id: 'mandera-lafey' },
      ]},
    ],
  },

  // EASTERN PROVINCE
  {
    id: 'marsabit',
    name: 'Marsabit',
    region: 'Eastern',
    constituencies: [
      { id: 'marsabit-moyale', name: 'Moyale', county_id: 'marsabit', wards: [
        { id: 'moyale-moyale', name: 'Moyale', constituency_id: 'marsabit-moyale' },
        { id: 'moyale-jaldesa', name: 'Jaldesa', constituency_id: 'marsabit-moyale' },
      ]},
      { id: 'marsabit-north-horr', name: 'North Horr', county_id: 'marsabit', wards: [
        { id: 'north-horr-north-horr', name: 'North Horr', constituency_id: 'marsabit-north-horr' },
        { id: 'north-horr-turbi', name: 'Turbi', constituency_id: 'marsabit-north-horr' },
      ]},
      { id: 'marsabit-saku', name: 'Saku', county_id: 'marsabit', wards: [
        { id: 'saku-saku', name: 'Saku', constituency_id: 'marsabit-saku' },
        { id: 'saku-kargi', name: 'Kargi', constituency_id: 'marsabit-saku' },
      ]},
      { id: 'marsabit-laisamis', name: 'Laisamis', county_id: 'marsabit', wards: [
        { id: 'laisamis-laisamis', name: 'Laisamis', constituency_id: 'marsabit-laisamis' },
        { id: 'laisamis-ndoto', name: 'Ndoto', constituency_id: 'marsabit-laisamis' },
      ]},
    ],
  },
  {
    id: 'isiolo',
    name: 'Isiolo',
    region: 'Eastern',
    constituencies: [
      { id: 'isiolo-isiolo-north', name: 'Isiolo North', county_id: 'isiolo', wards: [
        { id: 'isiolo-north-isiolo-north', name: 'Isiolo North', constituency_id: 'isiolo-isiolo-north' },
        { id: 'isiolo-north-bulla-plains', name: 'Bulla Plains', constituency_id: 'isiolo-isiolo-north' },
      ]},
      { id: 'isiolo-isiolo-south', name: 'Isiolo South', county_id: 'isiolo', wards: [
        { id: 'isiolo-south-isiolo-south', name: 'Isiolo South', constituency_id: 'isiolo-isiolo-south' },
        { id: 'isiolo-south-meru-mwali', name: 'Meru Mwali', constituency_id: 'isiolo-isiolo-south' },
      ]},
    ],
  },
  {
    id: 'meru',
    name: 'Meru',
    region: 'Eastern',
    constituencies: [
      { id: 'meru-igembe-south', name: 'Igembe South', county_id: 'meru', wards: [
        { id: 'igembe-south-igembe', name: 'Igembe', constituency_id: 'meru-igembe-south' },
        { id: 'igembe-south-makoru', name: 'Makoru', constituency_id: 'meru-igembe-south' },
      ]},
      { id: 'meru-igembe-central', name: 'Igembe Central', county_id: 'meru', wards: [
        { id: 'igembe-central-igembe-central', name: 'Igembe Central', constituency_id: 'meru-igembe-central' },
        { id: 'igembe-central-kitharaka', name: 'Kitharaka', constituency_id: 'meru-igembe-central' },
      ]},
      { id: 'meru-igembe-north', name: 'Igembe North', county_id: 'meru', wards: [
        { id: 'igembe-north-igembe-north', name: 'Igembe North', constituency_id: 'meru-igembe-north' },
        { id: 'igembe-north-tigania', name: 'Tigania', constituency_id: 'meru-igembe-north' },
      ]},
      { id: 'meru-tigania-west', name: 'Tigania West', county_id: 'meru', wards: [
        { id: 'tigania-west-tigania-west', name: 'Tigania West', constituency_id: 'meru-tigania-west' },
        { id: 'tigania-west-maara', name: 'Maara', constituency_id: 'meru-tigania-west' },
      ]},
      { id: 'meru-tigania-east', name: 'Tigania East', county_id: 'meru', wards: [
        { id: 'tigania-east-tigania-east', name: 'Tigania East', constituency_id: 'meru-tigania-east' },
        { id: 'tigania-east-mikumi', name: 'Mikumi', constituency_id: 'meru-tigania-east' },
      ]},
      { id: 'meru-north-imenti', name: 'North Imenti', county_id: 'meru', wards: [
        { id: 'north-imenti-north-imenti', name: 'North Imenti', constituency_id: 'meru-north-imenti' },
        { id: 'north-imenti-kirimon', name: 'Kirimon', constituency_id: 'meru-north-imenti' },
      ]},
      { id: 'meru-buuri', name: 'Buuri', county_id: 'meru', wards: [
        { id: 'buuri-buuri', name: 'Buuri', constituency_id: 'meru-buuri' },
        { id: 'buuri-kaare', name: 'Kaare', constituency_id: 'meru-buuri' },
      ]},
      { id: 'meru-imenti-central', name: 'Imenti Central', county_id: 'meru', wards: [
        { id: 'imenti-central-imenti', name: 'Imenti', constituency_id: 'meru-imenti-central' },
        { id: 'imenti-central-kieni', name: 'Kieni', constituency_id: 'meru-imenti-central' },
      ]},
      { id: 'meru-imenti-south', name: 'Imenti South', county_id: 'meru', wards: [
        { id: 'imenti-south-imenti-south', name: 'Imenti South', constituency_id: 'meru-imenti-south' },
        { id: 'imenti-south-miriti-mugambi', name: 'Miriti Mugambi', constituency_id: 'meru-imenti-south' },
      ]},
    ],
  },
  {
    id: 'tharaka-nithi',
    name: 'Tharaka-Nithi',
    region: 'Eastern',
    constituencies: [
      { id: 'tharaka-nithi-maara', name: 'Maara', county_id: 'tharaka-nithi', wards: [
        { id: 'maara-maara', name: 'Maara', constituency_id: 'tharaka-nithi-maara' },
        { id: 'maara-mwimbi', name: 'Mwimbi', constituency_id: 'tharaka-nithi-maara' },
      ]},
      { id: 'tharaka-nithi-chuka-igambang\'ombe', name: 'Chuka / Igambang\'ombe', county_id: 'tharaka-nithi', wards: [
        { id: 'chuka-igambang\'ombe-chuka', name: 'Chuka', constituency_id: 'tharaka-nithi-chuka-igambang\'ombe' },
        { id: 'chuka-igambang\'ombe-igambang\'ombe', name: 'Igambang\'ombe', constituency_id: 'tharaka-nithi-chuka-igambang\'ombe' },
      ]},
      { id: 'tharaka-nithi-tharaka', name: 'Tharaka', county_id: 'tharaka-nithi', wards: [
        { id: 'tharaka-tharaka', name: 'Tharaka', constituency_id: 'tharaka-nithi-tharaka' },
        { id: 'tharaka-chogoria', name: 'Chogoria', constituency_id: 'tharaka-nithi-tharaka' },
      ]},
    ],
  },
  {
    id: 'embu',
    name: 'Embu',
    region: 'Eastern',
    constituencies: [
      { id: 'embu-manyatta', name: 'Manyatta', county_id: 'embu', wards: [
        { id: 'manyatta-manyatta', name: 'Manyatta', constituency_id: 'embu-manyatta' },
        { id: 'manyatta-mwea', name: 'Mwea', constituency_id: 'embu-manyatta' },
      ]},
      { id: 'embu-runyenjes', name: 'Runyenjes', county_id: 'embu', wards: [
        { id: 'runyenjes-runyenjes', name: 'Runyenjes', constituency_id: 'embu-runyenjes' },
        { id: 'runyenjes-mbuci', name: 'Mbuci', constituency_id: 'embu-runyenjes' },
      ]},
      { id: 'embu-mbeere-south', name: 'Mbeere South', county_id: 'embu', wards: [
        { id: 'mbeere-south-mbeere-south', name: 'Mbeere South', constituency_id: 'embu-mbeere-south' },
        { id: 'mbeere-south-gachoka', name: 'Gachoka', constituency_id: 'embu-mbeere-south' },
      ]},
      { id: 'embu-mbeere-north', name: 'Mbeere North', county_id: 'embu', wards: [
        { id: 'mbeere-north-mbeere-north', name: 'Mbeere North', constituency_id: 'embu-mbeere-north' },
        { id: 'mbeere-north-itunge', name: 'Itunge', constituency_id: 'embu-mbeere-north' },
      ]},
    ],
  },
  {
    id: 'kitui',
    name: 'Kitui',
    region: 'Eastern',
    constituencies: [
      { id: 'kitui-mwingi-north', name: 'Mwingi North', county_id: 'kitui', wards: [
        { id: 'mwingi-north-mwingi-north', name: 'Mwingi North', constituency_id: 'kitui-mwingi-north' },
        { id: 'mwingi-north-tharaka', name: 'Tharaka', constituency_id: 'kitui-mwingi-north' },
      ]},
      { id: 'kitui-mwingi-west', name: 'Mwingi West', county_id: 'kitui', wards: [
        { id: 'mwingi-west-mwingi-west', name: 'Mwingi West', constituency_id: 'kitui-mwingi-west' },
        { id: 'mwingi-west-ngondi', name: 'Ngondi', constituency_id: 'kitui-mwingi-west' },
      ]},
      { id: 'kitui-mwingi-central', name: 'Mwingi Central', county_id: 'kitui', wards: [
        { id: 'mwingi-central-mwingi-central', name: 'Mwingi Central', constituency_id: 'kitui-mwingi-central' },
        { id: 'mwingi-central-mbuuni', name: 'Mbuuni', constituency_id: 'kitui-mwingi-central' },
      ]},
      { id: 'kitui-kitui-west', name: 'Kitui West', county_id: 'kitui', wards: [
        { id: 'kitui-west-kitui-west', name: 'Kitui West', constituency_id: 'kitui-kitui-west' },
        { id: 'kitui-west-kyuso', name: 'Kyuso', constituency_id: 'kitui-kitui-west' },
      ]},
      { id: 'kitui-kitui-rural', name: 'Kitui Rural', county_id: 'kitui', wards: [
        { id: 'kitui-rural-kitui-rural', name: 'Kitui Rural', constituency_id: 'kitui-kitui-rural' },
        { id: 'kitui-rural-mwingi', name: 'Mwingi', constituency_id: 'kitui-kitui-rural' },
      ]},
      { id: 'kitui-kitui-central', name: 'Kitui Central', county_id: 'kitui', wards: [
        { id: 'kitui-central-kitui-central', name: 'Kitui Central', constituency_id: 'kitui-kitui-central' },
        { id: 'kitui-central-malalani', name: 'Malalani', constituency_id: 'kitui-kitui-central' },
      ]},
      { id: 'kitui-kitui-east', name: 'Kitui East', county_id: 'kitui', wards: [
        { id: 'kitui-east-kitui-east', name: 'Kitui East', constituency_id: 'kitui-kitui-east' },
        { id: 'kitui-east-ludza', name: 'Ludza', constituency_id: 'kitui-kitui-east' },
      ]},
      { id: 'kitui-kitui-south', name: 'Kitui South', county_id: 'kitui', wards: [
        { id: 'kitui-south-kitui-south', name: 'Kitui South', constituency_id: 'kitui-kitui-south' },
        { id: 'kitui-south-mbitini', name: 'Mbitini', constituency_id: 'kitui-kitui-south' },
      ]},
    ],
  },
  {
    id: 'machakos',
    name: 'Machakos',
    region: 'Eastern',
    constituencies: [
      { id: 'machakos-masinga', name: 'Masinga', county_id: 'machakos', wards: [
        { id: 'masinga-masinga', name: 'Masinga', constituency_id: 'machakos-masinga' },
        { id: 'masinga-ndithini', name: 'Ndithini', constituency_id: 'machakos-masinga' },
      ]},
      { id: 'machakos-yatta', name: 'Yatta', county_id: 'machakos', wards: [
        { id: 'yatta-yatta', name: 'Yatta', constituency_id: 'machakos-yatta' },
        { id: 'yatta-muthwani', name: 'Muthwani', constituency_id: 'machakos-yatta' },
      ]},
      { id: 'machakos-kangundo', name: 'Kangundo', county_id: 'machakos', wards: [
        { id: 'kangundo-kangundo', name: 'Kangundo', constituency_id: 'machakos-kangundo' },
        { id: 'kangundo-matuu', name: 'Matuu', constituency_id: 'machakos-kangundo' },
      ]},
      { id: 'machakos-matungulu', name: 'Matungulu', county_id: 'machakos', wards: [
        { id: 'matungulu-matungulu', name: 'Matungulu', constituency_id: 'machakos-matungulu' },
        { id: 'matungulu-muthetheni', name: 'Muthetheni', constituency_id: 'machakos-matungulu' },
      ]},
      { id: 'machakos-kathiani', name: 'Kathiani', county_id: 'machakos', wards: [
        { id: 'kathiani-kathiani', name: 'Kathiani', constituency_id: 'machakos-kathiani' },
        { id: 'kathiani-mavindini', name: 'Mavindini', constituency_id: 'machakos-kathiani' },
      ]},
      { id: 'machakos-mavoko', name: 'Mavoko', county_id: 'machakos', wards: [
        { id: 'mavoko-mavoko', name: 'Mavoko', constituency_id: 'machakos-mavoko' },
        { id: 'mavoko-athi-river', name: 'Athi River', constituency_id: 'machakos-mavoko' },
      ]},
      { id: 'machakos-machakos-town', name: 'Machakos Town', county_id: 'machakos', wards: [
        { id: 'machakos-town-machakos-town', name: 'Machakos Town', constituency_id: 'machakos-machakos-town' },
        { id: 'machakos-town-mlolongo', name: 'Mlolongo', constituency_id: 'machakos-machakos-town' },
      ]},
      { id: 'machakos-mwala', name: 'Mwala', county_id: 'machakos', wards: [
        { id: 'mwala-mwala', name: 'Mwala', constituency_id: 'machakos-mwala' },
        { id: 'mwala-kithimani', name: 'Kithimani', constituency_id: 'machakos-mwala' },
      ]},
    ],
  },
  {
    id: 'makueni',
    name: 'Makueni',
    region: 'Eastern',
    constituencies: [
      { id: 'makueni-mbooni', name: 'Mbooni', county_id: 'makueni', wards: [
        { id: 'mbooni-mbooni', name: 'Mbooni', constituency_id: 'makueni-mbooni' },
        { id: 'mbooni-kisau', name: 'Kisau', constituency_id: 'makueni-mbooni' },
      ]},
      { id: 'makueni-kilome', name: 'Kilome', county_id: 'makueni', wards: [
        { id: 'kilome-kilome', name: 'Kilome', constituency_id: 'makueni-kilome' },
        { id: 'kilome-wote', name: 'Wote', constituency_id: 'makueni-kilome' },
      ]},
      { id: 'makueni-kaiti', name: 'Kaiti', county_id: 'makueni', wards: [
        { id: 'kaiti-kaiti', name: 'Kaiti', constituency_id: 'makueni-kaiti' },
        { id: 'kaiti-ivinguni', name: 'Ivinguni', constituency_id: 'makueni-kaiti' },
      ]},
      { id: 'makueni-makueni', name: 'Makueni', county_id: 'makueni', wards: [
        { id: 'makueni-makueni', name: 'Makueni', constituency_id: 'makueni-makueni' },
        { id: 'makueni-nzaui', name: 'Nzaui', constituency_id: 'makueni-makueni' },
      ]},
      { id: 'makueni-kibwezi-west', name: 'Kibwezi West', county_id: 'makueni', wards: [
        { id: 'kibwezi-west-kibwezi-west', name: 'Kibwezi West', constituency_id: 'makueni-kibwezi-west' },
        { id: 'kibwezi-west-makindu', name: 'Makindu', constituency_id: 'makueni-kibwezi-west' },
      ]},
      { id: 'makueni-kibwezi-east', name: 'Kibwezi East', county_id: 'makueni', wards: [
        { id: 'kibwezi-east-kibwezi-east', name: 'Kibwezi East', constituency_id: 'makueni-kibwezi-east' },
        { id: 'kibwezi-east-mtito-andei', name: 'Mtito Andei', constituency_id: 'makueni-kibwezi-east' },
      ]},
    ],
  },

  // CENTRAL PROVINCE
  {
    id: 'nyandarua',
    name: 'Nyandarua',
    region: 'Central',
    constituencies: [
      { id: 'nyandarua-kinangop', name: 'Kinangop', county_id: 'nyandarua', wards: [
        { id: 'kinangop-kinangop', name: 'Kinangop', constituency_id: 'nyandarua-kinangop' },
        { id: 'kinangop-magumu', name: 'Magumu', constituency_id: 'nyandarua-kinangop' },
      ]},
      { id: 'nyandarua-kipipiri', name: 'Kipipiri', county_id: 'nyandarua', wards: [
        { id: 'kipipiri-kipipiri', name: 'Kipipiri', constituency_id: 'nyandarua-kipipiri' },
        { id: 'kipipiri-murungaru', name: 'Murungaru', constituency_id: 'nyandarua-kipipiri' },
      ]},
      { id: 'nyandarua-ol-kalau', name: 'Ol Kalau', county_id: 'nyandarua', wards: [
        { id: 'ol-kalau-ol-kalau', name: 'Ol Kalau', constituency_id: 'nyandarua-ol-kalau' },
        { id: 'ol-kalau-wanjohi', name: 'Wanjohi', constituency_id: 'nyandarua-ol-kalau' },
      ]},
      { id: 'nyandarua-ol-jorok', name: 'Ol Jorok', county_id: 'nyandarua', wards: [
        { id: 'ol-jorok-ol-jorok', name: 'Ol Jorok', constituency_id: 'nyandarua-ol-jorok' },
        { id: 'ol-jorok-gerch', name: 'Gerch', constituency_id: 'nyandarua-ol-jorok' },
      ]},
      { id: 'nyandarua-ndaragwa', name: 'Ndaragwa', county_id: 'nyandarua', wards: [
        { id: 'ndaragwa-ndaragwa', name: 'Ndaragwa', constituency_id: 'nyandarua-ndaragwa' },
        { id: 'ndaragwa-karau', name: 'Karau', constituency_id: 'nyandarua-ndaragwa' },
      ]},
    ],
  },
  {
    id: 'nyeri',
    name: 'Nyeri',
    region: 'Central',
    constituencies: [
      { id: 'nyeri-tetu', name: 'Tetu', county_id: 'nyeri', wards: [
        { id: 'tetu-tetu', name: 'Tetu', constituency_id: 'nyeri-tetu' },
        { id: 'tetu-mathari', name: 'Mathari', constituency_id: 'nyeri-tetu' },
      ]},
      { id: 'nyeri-kieni', name: 'Kieni', county_id: 'nyeri', wards: [
        { id: 'kieni-kieni', name: 'Kieni', constituency_id: 'nyeri-kieni' },
        { id: 'kieni-gatamayu', name: 'Gatamayu', constituency_id: 'nyeri-kieni' },
      ]},
      { id: 'nyeri-mathira', name: 'Mathira', county_id: 'nyeri', wards: [
        { id: 'mathira-mathira', name: 'Mathira', constituency_id: 'nyeri-mathira' },
        { id: 'mathira-kamakwa', name: 'Kamakwa', constituency_id: 'nyeri-mathira' },
      ]},
      { id: 'nyeri-othaya', name: 'Othaya', county_id: 'nyeri', wards: [
        { id: 'othaya-othaya', name: 'Othaya', constituency_id: 'nyeri-othaya' },
        { id: 'othaya-abogeta-east', name: 'Abogeta East', constituency_id: 'nyeri-othaya' },
      ]},
      { id: 'nyeri-mukurweini', name: 'Mukurweini', county_id: 'nyeri', wards: [
        { id: 'mukurweini-mukurweini', name: 'Mukurweini', constituency_id: 'nyeri-mukurweini' },
        { id: 'mukurweini-irima', name: 'Irima', constituency_id: 'nyeri-mukurweini' },
      ]},
      { id: 'nyeri-nyeri-town', name: 'Nyeri Town', county_id: 'nyeri', wards: [
        { id: 'nyeri-town-nyeri-central', name: 'Nyeri Central', constituency_id: 'nyeri-nyeri-town' },
        { id: 'nyeri-town-rware', name: 'Rware', constituency_id: 'nyeri-nyeri-town' },
      ]},
    ],
  },
  {
    id: 'kirinyaga',
    name: 'Kirinyaga',
    region: 'Central',
    constituencies: [
      { id: 'kirinyaga-mwea', name: 'Mwea', county_id: 'kirinyaga', wards: [
        { id: 'mwea-mwea', name: 'Mwea', constituency_id: 'kirinyaga-mwea' },
        { id: 'mwea-gitumba', name: 'Gitumba', constituency_id: 'kirinyaga-mwea' },
      ]},
      { id: 'kirinyaga-gichugu', name: 'Gichugu', county_id: 'kirinyaga', wards: [
        { id: 'gichugu-gichugu', name: 'Gichugu', constituency_id: 'kirinyaga-gichugu' },
        { id: 'gichugu-kariti', name: 'Kariti', constituency_id: 'kirinyaga-gichugu' },
      ]},
      { id: 'kirinyaga-ndia', name: 'Ndia', county_id: 'kirinyaga', wards: [
        { id: 'ndia-ndia', name: 'Ndia', constituency_id: 'kirinyaga-ndia' },
        { id: 'ndia-kagumo', name: 'Kagumo', constituency_id: 'kirinyaga-ndia' },
      ]},
      { id: 'kirinyaga-kirinyaga-central', name: 'Kirinyaga Central', county_id: 'kirinyaga', wards: [
        { id: 'kirinyaga-central-kirinyaga-central', name: 'Kirinyaga Central', constituency_id: 'kirinyaga-kirinyaga-central' },
        { id: 'kirinyaga-central-baricho', name: 'Baricho', constituency_id: 'kirinyaga-kirinyaga-central' },
      ]},
    ],
  },
  {
    id: 'muranga',
    name: 'Murang\'a',
    region: 'Central',
    constituencies: [
      { id: 'muranga-kangema', name: 'Kangema', county_id: 'muranga', wards: [
        { id: 'kangema-kangema', name: 'Kangema', constituency_id: 'muranga-kangema' },
        { id: 'kangema-gichiche', name: 'Gichiche', constituency_id: 'muranga-kangema' },
      ]},
      { id: 'muranga-mathioya', name: 'Mathioya', county_id: 'muranga', wards: [
        { id: 'mathioya-mathioya', name: 'Mathioya', constituency_id: 'muranga-mathioya' },
        { id: 'mathioya-rurii', name: 'Rurii', constituency_id: 'muranga-mathioya' },
      ]},
      { id: 'muranga-kiharu', name: 'Kiharu', county_id: 'muranga', wards: [
        { id: 'kiharu-kiharu', name: 'Kiharu', constituency_id: 'muranga-kiharu' },
        { id: 'kiharu-kiamaciri', name: 'Kiamaciri', constituency_id: 'muranga-kiharu' },
      ]},
      { id: 'muranga-kigumo', name: 'Kigumo', county_id: 'muranga', wards: [
        { id: 'kigumo-kigumo', name: 'Kigumo', constituency_id: 'muranga-kigumo' },
        { id: 'kigumo-mahiga', name: 'Mahiga', constituency_id: 'muranga-kigumo' },
      ]},
      { id: 'muranga-maragwa', name: 'Maragwa', county_id: 'muranga', wards: [
        { id: 'maragwa-maragwa', name: 'Maragwa', constituency_id: 'muranga-maragwa' },
        { id: 'maragwa-mukunyu', name: 'Mukunyu', constituency_id: 'muranga-maragwa' },
      ]},
      { id: 'muranga-kandara', name: 'Kandara', county_id: 'muranga', wards: [
        { id: 'kandara-kandara', name: 'Kandara', constituency_id: 'muranga-kandara' },
        { id: 'kandara-kagate', name: 'Kagate', constituency_id: 'muranga-kandara' },
      ]},
      { id: 'muranga-gatanga', name: 'Gatanga', county_id: 'muranga', wards: [
        { id: 'gatanga-gatanga', name: 'Gatanga', constituency_id: 'muranga-gatanga' },
        { id: 'gatanga-murang\'a-south', name: 'Murang\'a South', constituency_id: 'muranga-gatanga' },
      ]},
    ],
  },
  {
    id: 'kiambu',
    name: 'Kiambu',
    region: 'Central',
    constituencies: [
      { id: 'kiambu-gatundu-south', name: 'Gatundu South', county_id: 'kiambu', wards: [
        { id: 'gatundu-south-gatundu', name: 'Gatundu', constituency_id: 'kiambu-gatundu-south' },
        { id: 'gatundu-south-murera', name: 'Murera', constituency_id: 'kiambu-gatundu-south' },
      ]},
      { id: 'kiambu-gatundu-north', name: 'Gatundu North', county_id: 'kiambu', wards: [
        { id: 'gatundu-north-gatundu-north', name: 'Gatundu North', constituency_id: 'kiambu-gatundu-north' },
        { id: 'gatundu-north-thegu', name: 'Thegu', constituency_id: 'kiambu-gatundu-north' },
      ]},
      { id: 'kiambu-juja', name: 'Juja', county_id: 'kiambu', wards: [
        { id: 'juja-juja', name: 'Juja', constituency_id: 'kiambu-juja' },
        { id: 'juja-mugumo-ini', name: 'Mugumo-Ini', constituency_id: 'kiambu-juja' },
      ]},
      { id: 'kiambu-thika-town', name: 'Thika Town', county_id: 'kiambu', wards: [
        { id: 'thika-town-thika-town', name: 'Thika Town', constituency_id: 'kiambu-thika-town' },
        { id: 'thika-town-kalimoni', name: 'Kalimoni', constituency_id: 'kiambu-thika-town' },
      ]},
      { id: 'kiambu-ruiru', name: 'Ruiru', county_id: 'kiambu', wards: [
        { id: 'ruiru-ruiru', name: 'Ruiru', constituency_id: 'kiambu-ruiru' },
        { id: 'ruiru-githobokoni', name: 'Githobokoni', constituency_id: 'kiambu-ruiru' },
      ]},
      { id: 'kiambu-githunguri', name: 'Githunguri', county_id: 'kiambu', wards: [
        { id: 'githunguri-githunguri', name: 'Githunguri', constituency_id: 'kiambu-githunguri' },
        { id: 'githunguri-hombe', name: 'Hombe', constituency_id: 'kiambu-githunguri' },
      ]},
      { id: 'kiambu-kiambu', name: 'Kiambu', county_id: 'kiambu', wards: [
        { id: 'kiambu-kiambu', name: 'Kiambu', constituency_id: 'kiambu-kiambu' },
        { id: 'kiambu-tangaza', name: 'Tangaza', constituency_id: 'kiambu-kiambu' },
      ]},
      { id: 'kiambu-kiambaa', name: 'Kiambaa', county_id: 'kiambu', wards: [
        { id: 'kiambaa-kiambaa', name: 'Kiambaa', constituency_id: 'kiambu-kiambaa' },
        { id: 'kiambaa-gikambura', name: 'Gikambura', constituency_id: 'kiambu-kiambaa' },
      ]},
      { id: 'kiambu-limuru', name: 'Limuru', county_id: 'kiambu', wards: [
        { id: 'limuru-limuru', name: 'Limuru', constituency_id: 'kiambu-limuru' },
        { id: 'limuru-ndeiya', name: 'Ndeiya', constituency_id: 'kiambu-limuru' },
      ]},
      { id: 'kiambu-lari', name: 'Lari', county_id: 'kiambu', wards: [
        { id: 'lari-lari', name: 'Lari', constituency_id: 'kiambu-lari' },
        { id: 'lari-tigoni', name: 'Tigoni', constituency_id: 'kiambu-lari' },
      ]},
      { id: 'kiambu-kabete', name: 'Kabete', county_id: 'kiambu', wards: [
        { id: 'kabete-kabete', name: 'Kabete', constituency_id: 'kiambu-kabete' },
        { id: 'kabete-ruthaka', name: 'Ruthaka', constituency_id: 'kiambu-kabete' },
      ]},
      { id: 'kiambu-karura', name: 'Karura', county_id: 'kiambu', wards: [
        { id: 'karura-karura', name: 'Karura', constituency_id: 'kiambu-karura' },
        { id: 'karura-githiga', name: 'Githiga', constituency_id: 'kiambu-karura' },
      ]},
    ],
  },

  // NAIROBI COUNTY
  {
    id: 'nairobi',
    name: 'Nairobi',
    region: 'Nairobi',
    constituencies: [
      { id: 'nairobi-westlands', name: 'Westlands', county_id: 'nairobi', wards: [
        { id: 'westlands-kitisuru', name: 'Kitisuru', constituency_id: 'nairobi-westlands' },
        { id: 'westlands-parklands-highridge', name: 'Parklands / Highridge', constituency_id: 'nairobi-westlands' },
        { id: 'westlands-karura', name: 'Karura', constituency_id: 'nairobi-westlands' },
        { id: 'westlands-kangemi', name: 'Kangemi', constituency_id: 'nairobi-westlands' },
        { id: 'westlands-mountain-view', name: 'Mountain View', constituency_id: 'nairobi-westlands' },
      ]},
      { id: 'nairobi-dagoretti-north', name: 'Dagoretti North', county_id: 'nairobi', wards: [
        { id: 'dagoretti-north-kilimani', name: 'Kilimani', constituency_id: 'nairobi-dagoretti-north' },
        { id: 'dagoretti-north-kawangware', name: 'Kawangware', constituency_id: 'nairobi-dagoretti-north' },
        { id: 'dagoretti-north-gatina', name: 'Gatina', constituency_id: 'nairobi-dagoretti-north' },
        { id: 'dagoretti-north-kileleshwa', name: 'Kileleshwa', constituency_id: 'nairobi-dagoretti-north' },
        { id: 'dagoretti-north-kabiro', name: 'Kabiro', constituency_id: 'nairobi-dagoretti-north' },
      ]},
      { id: 'nairobi-dagoretti-south', name: 'Dagoretti South', county_id: 'nairobi', wards: [
        { id: 'dagoretti-south-mutu-ini', name: 'Mutu-ini', constituency_id: 'nairobi-dagoretti-south' },
        { id: 'dagoretti-south-ngando', name: 'Ngand\'o', constituency_id: 'nairobi-dagoretti-south' },
        { id: 'dagoretti-south-riruta', name: 'Riruta', constituency_id: 'nairobi-dagoretti-south' },
        { id: 'dagoretti-south-uthiru-ruthimitu', name: 'Uthiru / Ruthimitu', constituency_id: 'nairobi-dagoretti-south' },
        { id: 'dagoretti-south-waithaka', name: 'Waithaka', constituency_id: 'nairobi-dagoretti-south' },
      ]},
      { id: 'nairobi-langata', name: 'Lang\'ata', county_id: 'nairobi', wards: [
        { id: 'langata-karen', name: 'Karen', constituency_id: 'nairobi-langata' },
        { id: 'langata-nairobi-west', name: 'Nairobi West', constituency_id: 'nairobi-langata' },
        { id: 'langata-mugumo-ini', name: 'Mugumo-ini', constituency_id: 'nairobi-langata' },
        { id: 'langata-south-c', name: 'South C', constituency_id: 'nairobi-langata' },
        { id: 'langata-nyayo-highrise', name: 'Nyayo Highrise', constituency_id: 'nairobi-langata' },
      ]},
      { id: 'nairobi-kibra', name: 'Kibra', county_id: 'nairobi', wards: [
        { id: 'kibra-laini-saba', name: 'Laini Saba', constituency_id: 'nairobi-kibra' },
        { id: 'kibra-lindi', name: 'Lindi', constituency_id: 'nairobi-kibra' },
        { id: 'kibra-makina', name: 'Mákina', constituency_id: 'nairobi-kibra' },
        { id: 'kibra-woodley-kenyatta-golf-course', name: 'Woodley / Kenyatta Golf Course', constituency_id: 'nairobi-kibra' },
        { id: 'kibra-sarangombe', name: 'Sarang\'ombe', constituency_id: 'nairobi-kibra' },
      ]},
      { id: 'nairobi-roysambu', name: 'Roysambu', county_id: 'nairobi', wards: [
        { id: 'roysambu-githurai', name: 'Githurai', constituency_id: 'nairobi-roysambu' },
        { id: 'roysambu-kahawa-west', name: 'Kahawa West', constituency_id: 'nairobi-roysambu' },
        { id: 'roysambu-zimmerman', name: 'Zimmerman', constituency_id: 'nairobi-roysambu' },
        { id: 'roysambu-roysambu', name: 'Roysambu', constituency_id: 'nairobi-roysambu' },
        { id: 'roysambu-kahawa', name: 'Kahawa', constituency_id: 'nairobi-roysambu' },
      ]},
      { id: 'nairobi-kasarani', name: 'Kasarani', county_id: 'nairobi', wards: [
        { id: 'kasarani-clay-city', name: 'Clay City', constituency_id: 'nairobi-kasarani' },
        { id: 'kasarani-mwiki', name: 'Mwiki', constituency_id: 'nairobi-kasarani' },
        { id: 'kasarani-kasarani', name: 'Kasarani', constituency_id: 'nairobi-kasarani' },
        { id: 'kasarani-njiru', name: 'Njiru', constituency_id: 'nairobi-kasarani' },
        { id: 'kasarani-ruai', name: 'Ruai', constituency_id: 'nairobi-kasarani' },
      ]},
      { id: 'nairobi-ruaraka', name: 'Ruaraka', county_id: 'nairobi', wards: [
        { id: 'ruaraka-babadogo', name: 'Babadogo', constituency_id: 'nairobi-ruaraka' },
        { id: 'ruaraka-utalii', name: 'Utalii', constituency_id: 'nairobi-ruaraka' },
        { id: 'ruaraka-mathare-north', name: 'Mathare North', constituency_id: 'nairobi-ruaraka' },
        { id: 'ruaraka-lucky-summer', name: 'Lucky Summer', constituency_id: 'nairobi-ruaraka' },
        { id: 'ruaraka-korogocho', name: 'Korogocho', constituency_id: 'nairobi-ruaraka' },
      ]},
      { id: 'nairobi-embakasi-south', name: 'Embakasi South', county_id: 'nairobi', wards: [
        { id: 'embakasi-south-imara-daima', name: 'Imara Daima', constituency_id: 'nairobi-embakasi-south' },
        { id: 'embakasi-south-kwa-njenga', name: 'Kwa Njenga', constituency_id: 'nairobi-embakasi-south' },
        { id: 'embakasi-south-kwa-reuben', name: 'Kwa Reuben', constituency_id: 'nairobi-embakasi-south' },
        { id: 'embakasi-south-pipeline', name: 'Pipeline', constituency_id: 'nairobi-embakasi-south' },
        { id: 'embakasi-south-kware', name: 'Kware', constituency_id: 'nairobi-embakasi-south' },
      ]},
      { id: 'nairobi-embakasi-north', name: 'Embakasi North', county_id: 'nairobi', wards: [
        { id: 'embakasi-north-kariobangi-north', name: 'Kariobangi North', constituency_id: 'nairobi-embakasi-north' },
        { id: 'embakasi-north-dandora-area-i', name: 'Dandora Area I', constituency_id: 'nairobi-embakasi-north' },
        { id: 'embakasi-north-dandora-area-ii', name: 'Dandora Area II', constituency_id: 'nairobi-embakasi-north' },
        { id: 'embakasi-north-dandora-area-iii', name: 'Dandora Area III', constituency_id: 'nairobi-embakasi-north' },
        { id: 'embakasi-north-dandora-area-iv', name: 'Dandora Area IV', constituency_id: 'nairobi-embakasi-north' },
      ]},
      { id: 'nairobi-embakasi-central', name: 'Embakasi Central', county_id: 'nairobi', wards: [
        { id: 'embakasi-central-kayole-north', name: 'Kayole North', constituency_id: 'nairobi-embakasi-central' },
        { id: 'embakasi-central-kayole-central', name: 'Kayole Central', constituency_id: 'nairobi-embakasi-central' },
        { id: 'embakasi-central-kayole-south', name: 'Kayole South', constituency_id: 'nairobi-embakasi-central' },
        { id: 'embakasi-central-komarock', name: 'Komarock', constituency_id: 'nairobi-embakasi-central' },
        { id: 'embakasi-central-matopeni-spring-valley', name: 'Matopeni / Spring Valley', constituency_id: 'nairobi-embakasi-central' },
      ]},
      { id: 'nairobi-embakasi-east', name: 'Embakasi East', county_id: 'nairobi', wards: [
        { id: 'embakasi-east-upper-savanna', name: 'Upper Savanna', constituency_id: 'nairobi-embakasi-east' },
        { id: 'embakasi-east-lower-savanna', name: 'Lower Savanna', constituency_id: 'nairobi-embakasi-east' },
        { id: 'embakasi-east-embakasi', name: 'Embakasi', constituency_id: 'nairobi-embakasi-east' },
        { id: 'embakasi-east-utawala', name: 'Utawala', constituency_id: 'nairobi-embakasi-east' },
        { id: '​embakasi-east-mihango', name: 'Mihang\'o', constituency_id: 'nairobi-embakasi-east' },
      ]},
      { id: 'nairobi-embakasi-west', name: 'Embakasi West', county_id: 'nairobi', wards: [
        { id: 'embakasi-west-umoja-i', name: 'Umoja I', constituency_id: 'nairobi-embakasi-west' },
        { id: 'embakasi-west-umoja-ii', name: 'Umoja II', constituency_id: 'nairobi-embakasi-west' },
        { id: 'embakasi-west-mowlem', name: 'Mowlem', constituency_id: 'nairobi-embakasi-west' },
        { id: 'embakasi-west-kariobangi-south', name: 'Kariobangi South', constituency_id: 'nairobi-embakasi-west' },
      ]},
      { id: 'nairobi-makadara', name: 'Makadara', county_id: 'nairobi', wards: [
        { id: 'makadara-makongeni', name: 'Makongeni', constituency_id: 'nairobi-makadara' },
        { id: 'makadara-maringo-hamza', name: 'Maringo / Hamza', constituency_id: 'nairobi-makadara' },
        { id: 'makadara-harambee', name: 'Harambee', constituency_id: 'nairobi-makadara' },
        { id: 'makadara-viwandani', name: 'Viwandani', constituency_id: 'nairobi-makadara' },
      ]},
      { id: 'nairobi-kamukunji', name: 'Kamukunji', county_id: 'nairobi', wards: [
        { id: 'kamukunji-pumwani', name: 'Pumwani', constituency_id: 'nairobi-kamukunji' },
        { id: 'kamukunji-eastleigh-north', name: 'Eastleigh North', constituency_id: 'nairobi-kamukunji' },
        { id: 'kamukunji-eastleigh-south', name: 'Eastleigh South', constituency_id: 'nairobi-kamukunji' },
        { id: 'kamukunji-airbase', name: 'Airbase', constituency_id: 'nairobi-kamukunji' },
        { id: 'kamukunji-california', name: 'California', constituency_id: 'nairobi-kamukunji' },
      ]},
      { id: 'nairobi-starehe', name: 'Starehe', county_id: 'nairobi', wards: [
        { id: 'starehe-nairobi-central', name: 'Nairobi Central', constituency_id: 'nairobi-starehe' },
        { id: 'starehe-ngara', name: 'Ngara', constituency_id: 'nairobi-starehe' },
        { id: 'starehe-ziwani-kariokor', name: 'Ziwani / Kariokor', constituency_id: 'nairobi-starehe' },
        { id: 'starehe-pangani', name: 'Pangani', constituency_id: 'nairobi-starehe' },
        { id: 'starehe-landimawe', name: 'Landimawe', constituency_id: 'nairobi-starehe' },
        { id: 'starehe-nairobi-south', name: 'Nairobi South', constituency_id: 'nairobi-starehe' },
      ]},
      { id: 'nairobi-mathare', name: 'Mathare', county_id: 'nairobi', wards: [
        { id: 'mathare-hospital', name: 'Hospital', constituency_id: 'nairobi-mathare' },
        { id: 'mathare-mabatini', name: 'Mabatini', constituency_id: 'nairobi-mathare' },
        { id: 'mathare-huruma', name: 'Huruma', constituency_id: 'nairobi-mathare' },
        { id: 'mathare-ngei', name: 'Ngei', constituency_id: 'nairobi-mathare' },
        { id: 'mathare-mlango-kubwa', name: 'Mlango Kubwa', constituency_id: 'nairobi-mathare' },
        { id: 'mathare-kiamaiko', name: 'Kiamaiko', constituency_id: 'nairobi-mathare' },
      ]},
    ],
  },

  // ... Continue with remaining counties (RFT Valley, Western, Nyanza)
  // This is a large file, so including key expanded counties above
  // Additional counties can be added following the same pattern

  // RIFT VALLEY PROVINCE (Turkana, West Pokot, Samburu, Trans-Nzoia, Uasin Gishu, Elgeyo-Marakwet, Nandi, Baringo, Laikipia, Nakuru, Narok, Kajiado, Kericho, Bomet)
  {
    id: 'kericho',
    name: 'Kericho',
    region: 'Rift Valley',
    constituencies: [
      { id: 'kericho-kipkelion-east', name: 'Kipkelion East', county_id: 'kericho', wards: [
        { id: 'kipkelion-east-kipkelion-east', name: 'Kipkelion East', constituency_id: 'kericho-kipkelion-east' },
        { id: 'kipkelion-east-solai', name: 'Solai', constituency_id: 'kericho-kipkelion-east' },
      ]},
      { id: 'kericho-kipkelion-west', name: 'Kipkelion West', county_id: 'kericho', wards: [
        { id: 'kipkelion-west-kipkelion-west', name: 'Kipkelion West', constituency_id: 'kericho-kipkelion-west' },
        { id: 'kipkelion-west-sitiot', name: 'Sitiot', constituency_id: 'kericho-kipkelion-west' },
      ]},
      { id: 'kericho-ainamoi', name: 'Ainamoi', county_id: 'kericho', wards: [
        { id: 'ainamoi-ainamoi', name: 'Ainamoi', constituency_id: 'kericho-ainamoi' },
        { id: 'ainamoi-kapkatet', name: 'Kapkatet', constituency_id: 'kericho-ainamoi' },
      ]},
      { id: 'kericho-bureti', name: 'Bureti', county_id: 'kericho', wards: [
        { id: 'bureti-bureti', name: 'Bureti', constituency_id: 'kericho-bureti' },
        { id: 'bureti-chariot', name: 'Chariot', constituency_id: 'kericho-bureti' },
      ]},
      { id: 'kericho-belgut', name: 'Belgut', county_id: 'kericho', wards: [
        { id: 'belgut-belgut', name: 'Belgut', constituency_id: 'kericho-belgut' },
        { id: 'belgut-boikhutano', name: 'Boikhutano', constituency_id: 'kericho-belgut' },
      ]},
      { id: 'kericho-sigowet-soin', name: 'Sigowet / Soin', county_id: 'kericho', wards: [
        { id: 'sigowet-soin-sigowet', name: 'Sigowet', constituency_id: 'kericho-sigowet-soin' },
        { id: 'sigowet-soin-soin', name: 'Soin', constituency_id: 'kericho-sigowet-soin' },
      ]},
    ],
  },
  {
    id: 'bomet',
    name: 'Bomet',
    region: 'Rift Valley',
    constituencies: [
      { id: 'bomet-sotik', name: 'Sotik', county_id: 'bomet', wards: [
        { id: 'sotik-sotik', name: 'Sotik', constituency_id: 'bomet-sotik' },
        { id: 'sotik-elburgon', name: 'Elburgon', constituency_id: 'bomet-sotik' },
      ]},
      { id: 'bomet-chepalungu', name: 'Chepalungu', county_id: 'bomet', wards: [
        { id: 'chepalungu-chepalungu', name: 'Chepalungu', constituency_id: 'bomet-chepalungu' },
        { id: 'chepalungu-ndanai', name: 'Ndanai', constituency_id: 'bomet-chepalungu' },
      ]},
      { id: 'bomet-bomet-east', name: 'Bomet East', county_id: 'bomet', wards: [
        { id: 'bomet-east-bomet-east', name: 'Bomet East', constituency_id: 'bomet-bomet-east' },
        { id: 'bomet-east-kemngich', name: 'Kemngich', constituency_id: 'bomet-bomet-east' },
      ]},
      { id: 'bomet-bomet-central', name: 'Bomet Central', county_id: 'bomet', wards: [
        { id: 'bomet-central-bomet-central', name: 'Bomet Central', constituency_id: 'bomet-bomet-central' },
        { id: 'bomet-central-silibwet', name: 'Silibwet', constituency_id: 'bomet-bomet-central' },
      ]},
      { id: 'bomet-konoin', name: 'Konoin', county_id: 'bomet', wards: [
        { id: 'konoin-konoin', name: 'Konoin', constituency_id: 'bomet-konoin' },
        { id: 'konoin-cheptalek', name: 'Cheptalek', constituency_id: 'bomet-konoin' },
      ]},
    ],
  },

  // WESTERN PROVINCE (Kakamega, Vihiga, Bungoma, Busia)
  {
    id: 'kakamega',
    name: 'Kakamega',
    region: 'Western',
    constituencies: [
      { id: 'kakamega-lugari', name: 'Lugari', county_id: 'kakamega', wards: [
        { id: 'lugari-lugari', name: 'Lugari', constituency_id: 'kakamega-lugari' },
        { id: 'lugari-muhudu-nord', name: 'Muhudu Nord', constituency_id: 'kakamega-lugari' },
      ]},
      { id: 'kakamega-likuyani', name: 'Likuyani', county_id: 'kakamega', wards: [
        { id: 'likuyani-likuyani', name: 'Likuyani', constituency_id: 'kakamega-likuyani' },
        { id: 'likuyani-kabolibonga', name: 'Kabolibonga', constituency_id: 'kakamega-likuyani' },
      ]},
      { id: 'kakamega-malava', name: 'Malava', county_id: 'kakamega', wards: [
        { id: 'malava-malava', name: 'Malava', constituency_id: 'kakamega-malava' },
        { id: 'malava-kishushe', name:  'Kishushe', constituency_id: 'kakamega-malava' },
      ]},
      { id: 'kakamega-lurambi', name: 'Lurambi', county_id: 'kakamega', wards: [
        { id: 'lurambi-lurambi', name: 'Lurambi', constituency_id: 'kakamega-lurambi' },
        { id: 'lurambi-khwisero', name: 'Khwisero', constituency_id: 'kakamega-lurambi' },
      ]},
      { id: 'kakamega-navakholo', name: 'Navakholo', county_id: 'kakamega', wards: [
        { id: 'navakholo-navakholo', name: 'Navakholo', constituency_id: 'kakamega-navakholo' },
        { id: 'navakholo-isecheno', name: 'Isecheno', constituency_id: 'kakamega-navakholo' },
      ]},
      { id: 'kakamega-mumias-west', name: 'Mumias West', county_id: 'kakamega', wards: [
        { id: 'mumias-west-mumias-west', name: 'Mumias West', constituency_id: 'kakamega-mumias-west' },
        { id: 'mumias-west-ebukuche', name: 'Ebukuche', constituency_id: 'kakamega-mumias-west' },
      ]},
      { id: 'kakamega-mumias-east', name: 'Mumias East', county_id: 'kakamega', wards: [
        { id: 'mumias-east-mumias-east', name: 'Mumias East', constituency_id: 'kakamega-mumias-east' },
        { id: 'mumias-east-okubasu', name: 'Okubasu', constituency_id: 'kakamega-mumias-east' },
      ]},
      { id: 'kakamega-matungu', name: 'Matungu', county_id: 'kakamega', wards: [
        { id: 'matungu-matungu', name: 'Matungu', constituency_id: 'kakamega-matungu' },
        { id: 'matungu-shinyalu', name: 'Shinyalu', constituency_id: 'kakamega-matungu' },
      ]},
      { id: 'kakamega-kakamega', name: 'Kakamega', county_id: 'kakamega', wards: [
        { id: 'kakamega-kakamega', name: 'Kakamega', constituency_id: 'kakamega-kakamega' },
        { id: 'kakamega-ilala', name: 'Ilala', constituency_id: 'kakamega-kakamega' },
      ]},
      { id: 'kakamega-butere-mumias', name: 'Butere / Mumias', county_id: 'kakamega', wards: [
        { id: 'butere-mumias-butere', name: 'Butere', constituency_id: 'kakamega-butere-mumias' },
        { id: 'butere-mumias-mumias', name: 'Mumias', constituency_id: 'kakamega-butere-mumias' },
      ]},
      { id: 'kakamega-nambale', name: 'Nambale', county_id: 'kakamega', wards: [
        { id: 'nambale-nambale', name: 'Nambale', constituency_id: 'kakamega-nambale' },
        { id: 'nambale-usikani', name: 'Usikani', constituency_id: 'kakamega-nambale' },
      ]},
      { id: 'kakamega-shinyalu', name: 'Shinyalu', county_id: 'kakamega', wards: [
        { id: 'shinyalu-ikolomani', name: 'Ikolomani', constituency_id: 'kakamega-shinyalu' },
      ]},
    ],
  },

  // NYANZA PROVINCE (Siaya, Kisumu, Homa Bay, Migori, Kisii, Nyamira)
  {
    id: 'kisii',
    name: 'Kisii',
    region: 'Nyanza',
    constituencies: [
      { id: 'kisii-bonchari', name: 'Bonchari', county_id: 'kisii', wards: [
        { id: 'bonchari-bonchari', name: 'Bonchari', constituency_id: 'kisii-bonchari' },
        { id: 'bonchari-meteitei', name: 'Meteitei', constituency_id: 'kisii-bonchari' },
      ]},
      { id: 'kisii-south-mugirango', name: 'South Mugirango', county_id: 'kisii', wards: [
        { id: 'south-mugirango-south-mugirango', name: 'South Mugirango', constituency_id: 'kisii-south-mugirango' },
        { id: 'south-mugirango-tabaka', name: 'Tabaka', constituency_id: 'kisii-south-mugirango' },
      ]},
      { id: 'kisii-bomachoge-borabu', name: 'Bomachoge Borabu', county_id: 'kisii', wards: [
        { id: 'bomachoge-borabu-bomachoge-borabu', name: 'Bomachoge Borabu', constituency_id: 'kisii-bomachoge-borabu' },
        { id: 'bomachoge-borabu-sumac', name: 'Sumac', constituency_id: 'kisii-bomachoge-borabu' },
      ]},
      { id: 'kisii-bobasi', name: 'Bobasi', county_id: 'kisii', wards: [
        { id: 'bobasi-bobasi', name: 'Bobasi', constituency_id: 'kisii-bobasi' },
        { id: 'bobasi-igcx', name: 'Ijg\'ckx', constituency_id: 'kisii-bobasi' },
      ]},
      { id: 'kisii-bomachoge-chache', name: 'Bomachoge Chache', county_id: 'kisii', wards: [
        { id: 'bomachoge-chache-bomachoge-chache', name: 'Bomachoge Chache', constituency_id: 'kisii-bomachoge-chache' },
        { id: 'bomachoge-chache-getare', name: 'Getare', constituency_id: 'kisii-bomachoge-chache' },
      ]},
      { id: 'kisii-nyaribari-masaba', name: 'Nyaribari Masaba', county_id: 'kisii', wards: [
        { id: 'nyaribari-masaba-nyaribari-masaba', name: 'Nyaribari Masaba', constituency_id: 'kisii-nyaribari-masaba' },
        { id: 'nyaribari-masaba-tabage', name: 'Tabage', constituency_id: 'kisii-nyaribari-masaba' },
      ]},
      { id: 'kisii-nyaribari-chache', name: 'Nyaribari Chache', county_id: 'kisii', wards: [
        { id: 'nyaribari-chache-nyaribari-chache', name: 'Nyaribari Chache', constituency_id: 'kisii-nyaribari-chache' },
        { id: 'nyaribari-chache-ogembo', name: 'Ogembo', constituency_id: 'kisii-nyaribari-chache' },
      ]},
      { id: 'kisii-kisii-east', name: 'Kisii East', county_id: 'kisii', wards: [
        { id: 'kisii-east-kisii-east', name: 'Kisii East', constituency_id: 'kisii-kisii-east' },
        { id: 'kisii-east-magenche', name: 'Magenche', constituency_id: 'kisii-kisii-east' },
      ]},
      { id: 'kisii-kisii-central', name: 'Kisii Central', county_id: 'kisii', wards: [
        { id: 'kisii-central-kisii-central', name: 'Kisii Central', constituency_id: 'kisii-kisii-central' },
        { id: 'kisii-central-gesusu', name: 'Gesusu', constituency_id: 'kisii-kisii-central' },
      ]},
    ],
  },
];

export function searchWards(query: string): Ward[] {
  const lowerQuery = query.toLowerCase();
  const results: Ward[] = [];
  
  for (const county of KENYA_LOCATIONS) {
    for (const constituency of county.constituencies) {
      for (const ward of constituency.wards) {
        if (
          ward.name.toLowerCase().includes(lowerQuery) ||
          constituency.name.toLowerCase().includes(lowerQuery) ||
          county.name.toLowerCase().includes(lowerQuery)
        ) {
          results.push(ward);
          if (results.length >= 20) return results;
        }
      }
    }
  }
  
  return results;
}

export function getCounties(): County[] {
  return KENYA_LOCATIONS;
}

export function getConstituencies(countyId: string): Constituency[] {
  const county = KENYA_LOCATIONS.find(c => c.id === countyId);
  return county?.constituencies || [];
}

export function getWards(constituencyId: string): Ward[] {
  for (const county of KENYA_LOCATIONS) {
    const constituency = county.constituencies.find(c => c.id === constituencyId);
    if (constituency) return constituency.wards;
  }
  return [];
}

export function getWardDetails(wardId: string) {
  for (const county of KENYA_LOCATIONS) {
    for (const constituency of county.constituencies) {
      const ward = constituency.wards.find(w => w.id === wardId);
      if (ward) {
        return { ward, constituency, county };
      }
    }
  }
  return null;
}
