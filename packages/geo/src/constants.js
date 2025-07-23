// geo/src/constants.js
/**
 * @file Defines constants used across the @daitanjs/geo package.
 * @module @daitanjs/geo/constants
 */

/**
 * Base URL for the Mapbox Geocoding API.
 * @constant {string}
 * @public
 */
export const MAPBOX_GEOCODING_API_URL =
  'https://api.mapbox.com/geocoding/v5/mapbox.places';

/**
 * Base URL for the OpenStreetMap Nominatim API (as an alternative or future geocoding provider).
 * @constant {string}
 * @public
 */
export const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org';

/**
 * Earth's mean radius in kilometers. Used for distance calculations.
 * @constant {number}
 * @public
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * A list of commonly supported country ISO 3166-1 alpha-2 codes.
 * This list can be used for validation or filtering in geocoding requests if needed.
 * It's not exhaustive and primarily illustrative of countries often targeted.
 * @constant {string[]}
 * @public
 */
export const SUPPORTED_COUNTRIES_ISO_A2 = [
  'AD', // Andorra
  'AE', // United Arab Emirates
  'AF', // Afghanistan
  'AG', // Antigua and Barbuda
  'AI', // Anguilla
  'AL', // Albania
  'AM', // Armenia
  'AO', // Angola
  'AQ', // Antarctica
  'AR', // Argentina
  'AS', // American Samoa
  'AT', // Austria
  'AU', // Australia
  'AW', // Aruba
  'AX', // Åland Islands
  'AZ', // Azerbaijan
  'BB', // Barbados
  'BD', // Bangladesh
  'BE', // Belgium
  'BF', // Burkina Faso
  'BG', // Bulgaria
  'BH', // Bahrain
  'BI', // Burundi
  'BJ', // Benin
  'BM', // Bermuda
  'BN', // Brunei Darussalam
  'BO', // Bolivia
  'BQ', // Bonaire, Sint Eustatius and Saba
  'BR', // Brazil
  'BS', // Bahamas
  'BT', // Bhutan
  'BW', // Botswana
  'BY', // Belarus
  'BZ', // Belize
  'CA', // Canada
  'CC', // Cocos (Keeling) Islands
  'CD', // Congo, Democratic Republic of the
  'CF', // Central African Republic
  'CG', // Congo
  'CH', // Switzerland
  'CI', // Côte d'Ivoire
  'CK', // Cook Islands
  'CL', // Chile
  'CM', // Cameroon
  'CN', // China
  'CO', // Colombia
  'CR', // Costa Rica
  'CU', // Cuba
  'CV', // Cabo Verde
  'CW', // Curaçao
  'CX', // Christmas Island
  'CY', // Cyprus
  'CZ', // Czechia
  'DE', // Germany
  'DJ', // Djibouti
  'DK', // Denmark
  'DM', // Dominica
  'DO', // Dominican Republic
  'DZ', // Algeria
  'EC', // Ecuador
  'EE', // Estonia
  'EG', // Egypt
  'EH', // Western Sahara (disputed)
  'ER', // Eritrea
  'ES', // Spain
  'ET', // Ethiopia
  'FI', // Finland
  'FJ', // Fiji
  'FK', // Falkland Islands (Malvinas)
  'FM', // Micronesia, Federated States of
  'FO', // Faroe Islands
  'FR', // France
  'GA', // Gabon
  'GB', // United Kingdom
  'GD', // Grenada
  'GE', // Georgia
  'GF', // French Guiana
  'GG', // Guernsey
  'GH', // Ghana
  'GI', // Gibraltar
  'GL', // Greenland
  'GM', // Gambia
  'GN', // Guinea
  'GP', // Guadeloupe
  'GQ', // Equatorial Guinea
  'GR', // Greece
  'GS', // South Georgia and the South Sandwich Islands
  'GT', // Guatemala
  'GU', // Guam
  'GW', // Guinea-Bissau
  'GY', // Guyana
  'HK', // Hong Kong
  'HM', // Heard Island and McDonald Islands
  'HN', // Honduras
  'HR', // Croatia
  'HT', // Haiti
  'HU', // Hungary
  'ID', // Indonesia
  'IE', // Ireland
  'IL', // Israel
  'IM', // Isle of Man
  'IN', // India
  'IO', // British Indian Ocean Territory
  'IQ', // Iraq
  'IR', // Iran
  'IS', // Iceland
  'IT', // Italy
  'JE', // Jersey
  'JM', // Jamaica
  'JO', // Jordan
  'JP', // Japan
  'KE', // Kenya
  'KG', // Kyrgyzstan
  'KH', // Cambodia
  'KI', // Kiribati
  'KM', // Comoros
  'KN', // Saint Kitts and Nevis
  'KP', // Korea, Democratic People's Republic of (North Korea)
  'KR', // Korea, Republic of (South Korea)
  'KW', // Kuwait
  'KY', // Cayman Islands
  'KZ', // Kazakhstan
  'LA', // Lao People's Democratic Republic
  'LB', // Lebanon
  'LC', // Saint Lucia
  'LI', // Liechtenstein
  'LK', // Sri Lanka
  'LR', // Liberia
  'LS', // Lesotho
  'LT', // Lithuania
  'LU', // Luxembourg
  'LV', // Latvia
  'LY', // Libya
  'MA', // Morocco
  'MC', // Monaco
  'MD', // Moldova
  'ME', // Montenegro
  'MF', // Saint Martin (French part)
  'MG', // Madagascar
  'MH', // Marshall Islands
  'MK', // North Macedonia
  'ML', // Mali
  'MM', // Myanmar
  'MN', // Mongolia
  'MO', // Macao
  'MP', // Northern Mariana Islands
  'MQ', // Martinique
  'MR', // Mauritania
  'MS', // Montserrat
  'MT', // Malta
  'MU', // Mauritius
  'MV', // Maldives
  'MW', // Malawi
  'MX', // Mexico
  'MY', // Malaysia
  'MZ', // Mozambique
  'NA', // Namibia
  'NC', // New Caledonia
  'NE', // Niger
  'NF', // Norfolk Island
  'NG', // Nigeria
  'NI', // Nicaragua
  'NL', // Netherlands
  'NO', // Norway
  'NP', // Nepal
  'NR', // Nauru
  'NU', // Niue
  'NZ', // New Zealand
  'OM', // Oman
  'PA', // Panama
  'PE', // Peru
  'PF', // French Polynesia
  'PG', // Papua New Guinea
  'PH', // Philippines
  'PK', // Pakistan
  'PL', // Poland
  'PM', // Saint Pierre and Miquelon
  'PN', // Pitcairn
  'PR', // Puerto Rico
  'PS', // Palestine, State of
  'PT', // Portugal
  'PW', // Palau
  'PY', // Paraguay
  'QA', // Qatar
  'RE', // Réunion
  'RO', // Romania
  'RS', // Serbia
  'RU', // Russian Federation
  'RW', // Rwanda
  'SA', // Saudi Arabia
  'SB', // Solomon Islands
  'SC', // Seychelles
  'SD', // Sudan
  'SE', // Sweden
  'SG', // Singapore
  'SH', // Saint Helena, Ascension and Tristan da Cunha
  'SI', // Slovenia
  'SJ', // Svalbard and Jan Mayen
  'SK', // Slovakia
  'SL', // Sierra Leone
  'SM', // San Marino
  'SN', // Senegal
  'SO', // Somalia
  'SR', // Suriname
  'SS', // South Sudan
  'ST', // Sao Tome and Principe
  'SV', // El Salvador
  'SX', // Sint Maarten (Dutch part)
  'SY', // Syrian Arab Republic
  'SZ', // Eswatini (Swaziland)
  'TC', // Turks and Caicos Islands
  'TD', // Chad
  'TF', // French Southern Territories
  'TG', // Togo
  'TH', // Thailand
  'TJ', // Tajikistan
  'TK', // Tokelau
  'TL', // Timor-Leste
  'TM', // Turkmenistan
  'TN', // Tunisia
  'TO', // Tonga
  'TR', // Turkey
  'TT', // Trinidad and Tobago
  'TV', // Tuvalu
  'TW', // Taiwan, Province of China
  'TZ', // Tanzania, United Republic of
  'UA', // Ukraine
  'UG', // Uganda
  'UM', // United States Minor Outlying Islands
  'US', // United States of America
  'UY', // Uruguay
  'UZ', // Uzbekistan
  'VA', // Holy See (Vatican City State)
  'VC', // Saint Vincent and the Grenadines
  'VE', // Venezuela
  'VG', // Virgin Islands, British
  'VI', // Virgin Islands, U.S.
  'VN', // Viet Nam
  'VU', // Vanuatu
  'WF', // Wallis and Futuna
  'WS', // Samoa
  'YE', // Yemen
  'YT', // Mayotte
  'ZA', // South Africa
  'ZM', // Zambia
  'ZW', // Zimbabwe
];