// Grab DOM elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const weatherBox = document.getElementById('weather-box');
const weatherDetails = document.getElementById('weather-details');
const errorBox = document.getElementById('error-box');
const recentBox = document.getElementById('recent-searches');
const metricBtn = document.getElementById('unit-metric');
const imperialBtn = document.getElementById('unit-imperial');
const locateBtn = document.getElementById('locate-btn');
const shareBtn = document.getElementById('share-btn');

const tempEl = document.getElementById('temp');
const descEl = document.getElementById('description');
const locEl = document.getElementById('location');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const feelsLikeEl = document.getElementById('feels-like');
const pressureEl = document.getElementById('pressure');
const sunriseEl = document.getElementById('sunrise');
const sunsetEl = document.getElementById('sunset');
const iconEl = document.getElementById('weather-icon');
const hourlyBox = document.getElementById('hourly');
const hourlyStrip = document.getElementById('hourly-strip');
const hourlyNoteEl = document.getElementById('hourly-note');
const forecastBox = document.getElementById('forecast');
const forecastStrip = document.getElementById('forecast-strip');
const forecastNoteEl = document.getElementById('forecast-note');
const airBox = document.getElementById('air-quality');
const airDialEl = document.getElementById('air-dial');
const airIndexEl = document.getElementById('air-index');
const airLabelEl = document.getElementById('air-label');
const airPm25El = document.getElementById('air-pm25');
const airPm10El = document.getElementById('air-pm10');
const daylightBox = document.getElementById('daylight');
const daylightCaptionEl = document.getElementById('daylight-caption');
const daylightLengthEl = document.getElementById('daylight-length');
const daylightFillEl = document.getElementById('daylight-fill');
const daylightMarkerEl = document.getElementById('daylight-marker');
const visibilityCard = document.getElementById('visibility-card');
const visibilityEl = document.getElementById('visibility');
const visibilityLabelEl = document.getElementById('visibility-label');
const readingAgeEl = document.getElementById('reading-age');
const readingAgeTextEl = document.getElementById('reading-age-text');
const refreshBtn = document.getElementById('refresh-btn');
const feelsNoteEl = document.getElementById('feels-note');
const todayRangeEl = document.getElementById('today-range');
const placesEl = document.getElementById('place-picker');
const localTimeEl = document.getElementById('local-time');
const suggestionsEl = document.getElementById('city-suggestions');

// Your active API key
const API_KEY = 'dfa121f8ce06e9d26b31b58ed5795778'; 

// Where past searches are remembered between visits. LAST_CITY_KEY is what
// earlier versions wrote; it is still read once so nobody loses their city
// when the list format arrives.
const RECENT_KEY = 'weather-app:recent-cities';
const LAST_CITY_KEY = 'weather-app:last-city';
const UNIT_KEY = 'weather-app:units';
// The city this app belongs to. Recents are a history and behave like one -
// look up a friend's city once and it takes the front of the list, and with
// it the card that opens on the next visit. A home is a decision, so it is
// stored apart from the history and outranks it.
const HOME_KEY = 'weather-app:home';
// The city is in the address bar, so a reading can be bookmarked, reloaded
// or sent to somebody. Without it every link to this app opened on whatever
// city the recipient last looked at, which is a strange way to answer "is it
// raining where you are?".
const CITY_PARAM = 'city';
// The last reading that actually arrived, kept so the card has something to
// say when the network does not.
const READING_KEY = 'weather-app:last-reading';
// Long enough for "Washington, D.C." and short enough that a hand-edited URL
// cannot push a paragraph into the search box.
const MAX_CITY_LENGTH = 80;
const MAX_RECENT = 5;
const MAX_FORECAST_DAYS = 5;
// How far ahead the hourly strip looks. The forecast endpoint answers in
// three-hour blocks, so six tiles is the next eighteen hours - the rest of
// today and into tomorrow morning, which is as far as "when should I go out"
// is ever really asking.
const MAX_FORECAST_HOURS = 6;
// Below this the forecast is really saying "no", and printing a number for
// it costs more attention than it gives back.
const RAIN_CHANCE_FLOOR = 20;
// How big a day-to-day swing in the high has to be before it is worth a
// sentence, in degrees Celsius. A degree or two either way is the forecast
// being a forecast; five is the difference between a coat and no coat.
const TURN_FLOOR_C = 5;
// How hard the wind has to blow before a day tile says so, in metres per
// second. This is a strong breeze on the Beaufort scale - about 39 km/h,
// 24 mph - where umbrellas turn inside out and cycling into it is work.
const WINDY_DAY_MS = 10.8;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SECONDS = 24 * 60 * 60;
// How often the daylight marker catches up with the clock. A minute is finer
// than the bar can show and still cheap - it is arithmetic, not a request.
const DAYLIGHT_TICK_MS = 60 * 1000;
// How old a reading is allowed to get before coming back to the tab fetches
// it again. OpenWeather updates a city roughly every ten minutes, so asking
// sooner would spend a request to be told the same numbers; leaving it much
// longer means a card that quietly describes this morning.
const STALE_AFTER_MS = 10 * 60 * 1000;
// Under this the wording stays "just now". A reading a minute old is the
// current weather by any reading of the word, and "1m ago" invites a person
// to wonder whether it still counts.
const FRESH_UNDER_MS = 2 * 60 * 1000;
// Past this a stored reading stops being weather and becomes a souvenir.
// Half a day covers opening the app on the morning commute with no signal
// and still holding last night's numbers; a reading from last week would be
// worse than the placeholder it replaced, however clearly it were labelled.
const READING_KEEPS_MS = 12 * 60 * 60 * 1000;

// OpenWeather groups conditions by the hundreds digit of `weather[0].id`
// (2xx thunder, 3xx/5xx rain, 6xx snow, 7xx haze, 800 clear, 80x cloud), and
// the icon name ends in 'd' or 'n' for daylight. Between them that is enough
// to pick a sky, which CSS then turns into a gradient.
function skyKey(condition) {
    if (!condition || typeof condition.id !== 'number') return 'default';

    const suffix = String(condition.icon).endsWith('n') ? 'night' : 'day';
    const group = Math.floor(condition.id / 100);

    if (group === 2) return 'storm';
    if (group === 3 || group === 5) return `rain-${suffix}`;
    if (group === 6) return 'snow';
    if (group === 7) return 'mist';
    if (condition.id === 800) return `clear-${suffix}`;

    return `clouds-${suffix}`;
}

// The air pollution endpoint scores air on a 1-5 scale. A bare number says
// nothing on its own, so each level carries the wording OpenWeather uses for
// it and a colour that keeps the same ordering for anyone who reads the dial
// before they read the label.
const AIR_LEVELS = [
    { label: 'Good', colour: '#5ad07a' },
    { label: 'Fair', colour: '#c9e05a' },
    { label: 'Moderate', colour: '#f2c14e' },
    { label: 'Poor', colour: '#f0805a' },
    { label: 'Very poor', colour: '#e05a7a' },
];

// Readings always come back from the API in metric and are converted here,
// so switching units redraws the card instead of costing another request.
let units = recallUnits();
let lastReading = null;
let lastForecast = null;
let lastHours = null;
let lastToday = null;
// Which way the barometer is heading, worked out once the forecast for the
// reading on screen has arrived. Null until then, and cleared with every
// new reading so one city's trend never sits under another's pressure.
let lastPressureTrend = null;
// The places the last typed name could have meant, and the name that asked.
// Kept so choosing one of them - which is a lookup by coordinates, and says
// nothing about any name - does not take the list of alternatives away with
// it.
let lastPlaces = [];
// When the reading on screen came back, and the query that produced it. The
// card itself cannot answer either: `data.dt` is when the station measured,
// not when we asked, and the name in the card has already been through the
// API once and is not always what should be sent back to it - a lookup by
// coordinates must refresh by coordinates, or "here" turns into the nearest
// city the first answer happened to be filed under.
let lastReadingAt = null;
let lastQuery = null;
// Whether the last attempt to refresh the card failed. The card stays up in
// that case, so something has to say that the numbers on it are the last
// ones that arrived rather than the ones that are true now.
let offline = false;

// Every lookup takes a ticket, and only the newest one is allowed to draw.
//
// Three requests go out per lookup and none of them are ordered: search
// London, change your mind and search Tokyo, and London's reply can easily
// land second. The card would then show London while the box said Tokyo -
// and worse, the two panels that fill themselves in afterwards are not
// awaited at all, so Tokyo's temperature could sit above London's forecast
// with nothing on screen admitting it.
let latestLookup = 0;

// Whether the answer that has just come back is still the one being waited
// for. Anything older is a question the person has already moved on from.
function isCurrent(ticket) {
    return ticket === latestLookup;
}

function recallUnits() {
    try {
        return localStorage.getItem(UNIT_KEY) === 'imperial' ? 'imperial' : 'metric';
    } catch (error) {
        return 'metric';
    }
}

function toTemperature(celsius) {
    return units === 'imperial' ? celsius * 9 / 5 + 32 : celsius;
}

function temperatureText(celsius) {
    return `${Math.round(toTemperature(celsius))}°${units === 'imperial' ? 'F' : 'C'}`;
}

// Wind direction comes back as degrees clockwise from north, and a bearing
// like 293 says nothing at a glance. The circle splits into sixteen points
// of 22.5 degrees each, so rounding the bearing to the nearest of them gives
// back the name people actually use out loud.
const COMPASS_POINTS = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

function compassText(degrees) {
    if (typeof degrees !== 'number' || Number.isNaN(degrees)) return '';

    // The modulo runs twice so a negative bearing still lands on a real point.
    const bearing = ((degrees % 360) + 360) % 360;

    return COMPASS_POINTS[Math.round(bearing / 22.5) % COMPASS_POINTS.length];
}

// The API reports wind in metres per second whatever the units asked for.
// Direction is named after where the wind blows *from*, which is the
// convention every forecast uses - a northerly comes down from the north.
function windText(metresPerSecond, degrees) {
    const speed = units === 'imperial'
        ? `${Math.round(metresPerSecond * 2.237)} mph`
        : `${Math.round(metresPerSecond * 3.6)} km/h`;

    const bearing = compassText(degrees);

    return bearing ? `${speed} ${bearing}` : speed;
}

// A steady 15 km/h and gusts of 60 are different days out: one is a breeze,
// the other takes an umbrella out of a hand and a bin across the road. The
// reading carries `wind.gust` when there are gusts at all, and the card was
// showing only the average.
//
// Named only when gusts are both strong in themselves and well above the
// steady wind. A gust of 12 on a wind of 10 is just the wind.
const GUST_FLOOR_MS = 8; // about 29 km/h, 18 mph
const GUST_RATIO = 1.5;

function gustText(wind) {
    const speed = wind?.speed;
    const gust = wind?.gust;

    if (typeof gust !== 'number' || typeof speed !== 'number') return '';
    if (gust < GUST_FLOOR_MS || gust < speed * GUST_RATIO) return '';

    return units === 'imperial'
        ? `gusts ${Math.round(gust * 2.237)} mph`
        : `gusts ${Math.round(gust * 3.6)} km/h`;
}

// The wind's name on the Beaufort scale.
//
// "22 km/h" is a number that has to be pictured before it means anything, and
// the same figure reads differently to somebody on a bike and somebody on a
// bench. "Moderate breeze" is how a forecast says it, and it already carries
// the picture: dust and loose paper lifting, small branches moving.
//
// Upper bounds in metres per second, the unit the API reports in, so the
// name does not move when the unit switch does.
const BEAUFORT = [
    { below: 0.5, name: 'Calm' },
    { below: 1.6, name: 'Light air' },
    { below: 3.4, name: 'Light breeze' },
    { below: 5.5, name: 'Gentle breeze' },
    { below: 8.0, name: 'Moderate breeze' },
    { below: 10.8, name: 'Fresh breeze' },
    { below: 13.9, name: 'Strong breeze' },
    { below: 17.2, name: 'Near gale' },
    { below: 20.8, name: 'Gale' },
    { below: 24.5, name: 'Strong gale' },
    { below: 28.5, name: 'Storm' },
    { below: 32.7, name: 'Violent storm' },
];

function beaufortName(metresPerSecond) {
    if (typeof metresPerSecond !== 'number' || Number.isNaN(metresPerSecond)) return '';

    const force = BEAUFORT.find((step) => metresPerSecond < step.below);

    return force ? force.name : 'Hurricane force';
}

// Pressure in the unit the rest of the card is in.
//
// The switch turned every temperature and speed into Fahrenheit and miles
// and left this one tile in hectopascals, which is the unit nobody in the
// US has on a barometer or hears on a forecast. There it is inches of
// mercury, and to two places, because a whole inch is roughly the gap
// between a settled high and a deep storm.
const INHG_PER_HPA = 0.02953;

function pressureText(hectopascals) {
    if (typeof hectopascals !== 'number') return units === 'imperial' ? '-- inHg' : '-- hPa';

    return units === 'imperial'
        ? `${(hectopascals * INHG_PER_HPA).toFixed(2)} inHg`
        : `${Math.round(hectopascals)} hPa`;
}

// Which way the pressure is going, and how far.
//
// A single pressure figure means little to anyone who does not read a
// barometer for a living; the direction is what forecasters have always
// read from it - falling for unsettled weather on the way, rising for it
// clearing. The forecast carries a pressure for every block, so the change
// between now and the end of the hourly strip is already in hand.
//
// Three hectopascals is where the change stops being the daily tide in the
// air and starts saying something about the weather.
const PRESSURE_TREND_HPA = 3;

// Kept as numbers rather than words so the unit switch can say it again.
function pressureTrend(current, hours) {
    if (typeof current !== 'number' || !Array.isArray(hours)) return null;

    const last = [...hours].reverse().find((hour) => typeof hour.pressure === 'number');

    if (!last) return null;

    const change = last.pressure - current;

    if (Math.abs(change) < PRESSURE_TREND_HPA) return null;

    return { change, by: last.label };
}

function pressureTrendText(trend) {
    if (!trend) return '';

    // A change, not a reading, so it is scaled from the raw difference
    // rather than from two rounded figures.
    const amount = units === 'imperial'
        ? `${(Math.abs(trend.change) * INHG_PER_HPA).toFixed(2)} inHg`
        : `${Math.round(Math.abs(trend.change))} hPa`;

    return `${trend.change > 0 ? 'rising' : 'falling'} ${amount} by ${trend.by}`;
}

// The figure, with the trend under it the way the dew point sits under the
// humidity.
function renderPressure(data) {
    pressureEl.textContent = pressureText(data.main.pressure);

    const trend = pressureTrendText(lastPressureTrend);

    if (!trend) return;

    const note = document.createElement('small');
    note.className = 'pressure-trend';
    note.textContent = trend;
    note.title = lastPressureTrend.change < 0
        ? 'Falling pressure often means unsettled weather is on the way'
        : 'Rising pressure often means the weather is settling';
    pressureEl.append(note);
}

// The dew point, worked out from the two figures the reading already has.
//
// Relative humidity is relative to the temperature, which makes it a poor
// answer to "will it be sticky": 90% on a 5° morning is crisp, 60% at 30° is
// a wet towel. The dew point is the number that actually tracks how muggy
// air feels, and it is the one forecasters quote for exactly that reason.
//
// Magnus formula, with the constants good to a few tenths of a degree across
// anything a person would stand outside in.
const MAGNUS_B = 17.62;
const MAGNUS_C = 243.12;

function dewPointCelsius(celsius, humidity) {
    if (typeof celsius !== 'number' || typeof humidity !== 'number' || humidity <= 0) return null;

    const gamma = Math.log(humidity / 100) + (MAGNUS_B * celsius) / (MAGNUS_C + celsius);

    return (MAGNUS_C * gamma) / (MAGNUS_B - gamma);
}

// How much has actually come down in the last hour.
//
// "Light rain" is a description of the sky, and it reads the same for a
// drizzle that barely darkens the pavement and a shower that has filled the
// gutters. The reading carries the amount in `rain['1h']` or `snow['1h']`
// whenever there has been any, and it was being thrown away.
//
// Below a tenth of a millimetre it is a trace, and saying "0.0 mm" would be a
// sentence whose only content is that there is nothing to say. Snow is given
// by the API as the water it would melt to, so it goes through the same units.
const TRACE_MM = 0.1;
const MM_PER_INCH = 25.4;

function fallText(data) {
    const snow = data?.snow?.['1h'];
    const rain = data?.rain?.['1h'];
    const [kind, mm] = typeof snow === 'number' && snow >= TRACE_MM
        ? ['snow', snow]
        : ['rain', rain];

    if (typeof mm !== 'number' || mm < TRACE_MM) return '';

    const amount = units === 'imperial'
        ? `${(mm / MM_PER_INCH).toFixed(2)} in`
        : `${mm.toFixed(1)} mm`;

    return `${amount} of ${kind} in the last hour`;
}

// "Scattered clouds" and "broken clouds" are terms of art that few people
// can put a number to. The share of sky covered is one, and it is only added
// when the description is about cloud, so a clear sky stays a clear sky.
function cloudText(data) {
    const cover = data?.clouds?.all;
    const sky = data?.weather?.[0]?.description ?? '';

    if (typeof cover !== 'number' || !/cloud/i.test(sky)) return '';

    return `${Math.round(cover)}% of the sky covered`;
}

// What the tab said before any city was looked up, kept so the card can put
// it back when there is nothing to report.
const BASE_TITLE = document.title;

// The temperature, in the tab.
//
// This app gets pinned and left open — the reading-age line and the refresh
// on returning to the tab both exist because that is how it is used. But a
// pinned tab is exactly the case where the card cannot be seen at all: the
// answer is two centimetres from the cursor, behind a click, under a title
// that has said "Weather-App || Real time updates" since the page loaded.
//
// Temperature first because tabs truncate, and hard, and a strip that gets
// cut to "12° Lon" has still answered the question. The city earns its place
// beside it — somebody comparing three cities has three tabs, and a row of
// identical titles is no better than none.
function renderDocumentTitle(data) {
    const temp = data?.main?.temp;
    const name = data?.name;

    if (typeof temp !== 'number' || !name) {
        resetDocumentTitle();
        return;
    }

    // Said in the title rather than shown, because a tab has no room for the
    // amber line the card uses and a stale number with nothing marking it as
    // stale is the one failure this is not allowed to have.
    const caveat = offline ? ' (offline)' : '';

    document.title = `${temperatureText(temp)} ${name}${caveat} · ${BASE_TITLE}`;
}

function resetDocumentTitle() {
    document.title = BASE_TITLE;
}

// How far it is possible to see, in metres, and the reading carries it on
// every lookup — it was simply being thrown away.
//
// Above this the card stays out of the way. OpenWeather tops the figure out
// at 10 km and most days sit at the ceiling, so a permanent "10 km" would be
// a tile that never changes and is never read. Five kilometres is where the
// Met Office starts calling it mist, and where the number starts deciding
// something: whether to drive, whether the hill at the end of the road will
// be there when you look.
const CLEAR_VISIBILITY_M = 5000;
// Under a kilometre is fog proper, and the difference between 800 m and 80 m
// is the whole story — so that range is given in metres rather than rounded
// into "0.1 km".
const FOG_M = 1000;
const METRES_PER_MILE = 1609.34;

// Named the way a forecast names it, so the tile says what is happening and
// not only how far it reaches.
function visibilityWord(metres) {
    if (metres < 200) return 'Dense fog';
    if (metres < FOG_M) return 'Fog';
    if (metres < 2000) return 'Mist';

    return 'Haze';
}

function visibilityText(metres) {
    if (units === 'imperial') {
        const miles = metres / METRES_PER_MILE;

        // Same reasoning as the metric side: below a quarter of a mile the
        // decimal stops carrying the difference, and feet do.
        return miles < 0.25
            ? `${Math.round(metres * 3.281 / 10) * 10} ft`
            : `${miles.toFixed(1)} mi`;
    }

    return metres < FOG_M
        ? `${Math.round(metres / 10) * 10} m`
        : `${(metres / 1000).toFixed(1)} km`;
}

function renderVisibility(data) {
    const metres = data?.visibility;

    if (typeof metres !== 'number' || metres >= CLEAR_VISIBILITY_M) {
        hideVisibility();
        return;
    }

    visibilityCard.hidden = false;
    visibilityEl.textContent = visibilityText(metres);
    visibilityLabelEl.textContent = visibilityWord(metres);
}

function hideVisibility() {
    visibilityCard.hidden = true;
}

// Sunrise and sunset arrive as UTC epoch seconds, and `timezone` is the
// city's offset from UTC in seconds. Adding the two and then reading the
// UTC parts back gives the clock time *there* — 6:41 AM in Tokyo stays
// 6:41 AM however far away the person reading it happens to be.
function clockText(epochSeconds, offsetSeconds = 0) {
    if (typeof epochSeconds !== 'number') return '--:--';

    const shifted = new Date((epochSeconds + offsetSeconds) * 1000);
    const hours = shifted.getUTCHours();
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
    const suffix = hours < 12 ? 'AM' : 'PM';

    return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

// What time it is where the weather is.
//
// Every reading on this card is already local to the city — sunrise, sunset,
// the hourly strip — but the one number that anchors them was missing, so a
// sunset at 4:12 PM sat there with no way to tell whether that had already
// happened. Looking up a friend's city and working out what o'clock it is
// there is arithmetic nobody should be doing in their head off a UTC offset
// they cannot see.
//
// Empty for anyone reading their own timezone, where the answer is the clock
// on their own wall and a line repeating it is noise. That is the common
// case — this app is mostly used on one city — so the line appears exactly
// when it has something to say.
function localTimeText(data) {
    const offset = data?.timezone;

    if (typeof offset !== 'number') return '';

    const now = Date.now() / 1000;
    // getTimezoneOffset counts minutes *behind* UTC, so the sign is flipped
    // to match the API, which counts seconds ahead of it.
    const here = -new Date().getTimezoneOffset() * 60;

    if (offset === here) return '';

    const gap = offset - here;
    const direction = gap > 0 ? 'ahead' : 'behind';
    // Not every offset is a whole hour — India is 5:30 off, Nepal 5:45 — so
    // the gap goes through the same words the daylight figures use.
    const distance = durationText(Math.abs(gap));

    // The part people actually want on a long hop: whether it is even the
    // same day there. Only said when it is not, because "Tuesday" against a
    // Tuesday is a word doing no work.
    const sameDay = dateKey(now, offset) === dateKey(now, here);
    const day = sameDay
        ? ''
        : `${DAY_NAMES[new Date((now + offset) * 1000).getUTCDay()]}, `;

    return `${day}${clockText(now, offset)} local · ${distance} ${direction}`;
}

function renderLocalTime(data) {
    const text = localTimeText(data);

    localTimeEl.textContent = text;
    localTimeEl.hidden = !text;
}

function hideLocalTime() {
    localTimeEl.hidden = true;
}

// A gap between two moments, said the way people say it out loud. Seconds
// are noise at this scale and a bare "218 minutes" has to be divided before
// it means anything, so anything over an hour is given in hours and minutes.
function durationText(seconds) {
    const totalMinutes = Math.max(0, Math.round(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;

    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

// Which calendar day a moment falls on depends on where you are standing.
// Shifting by the city's offset first, then reading the UTC date back, keeps
// a 11pm Tokyo reading on the Tokyo day it belongs to.
function dateKey(epochSeconds, offsetSeconds = 0) {
    return new Date((epochSeconds + offsetSeconds) * 1000).toISOString().slice(0, 10);
}

// Enough of a reading to draw the card from. Anything stored is a stranger
// by the time it comes back - written by an older build, hand-edited, or
// truncated by a browser that ran out of room - and every one of these
// fields is read without checking during a render.
function looksLikeReading(data) {
    return Boolean(
        data &&
        typeof data === 'object' &&
        data.main && typeof data.main.temp === 'number' &&
        Array.isArray(data.weather) && data.weather[0] &&
        data.wind && typeof data.wind.speed === 'number' &&
        data.sys && typeof data.name === 'string'
    );
}

// The last reading that arrived, if it is still recent enough to be worth
// putting on screen. Kept with the query that produced it, because a stored
// reading is only ever offered back for the city it actually describes.
function recallReading() {
    try {
        const stored = JSON.parse(localStorage.getItem(READING_KEY));

        if (!stored || typeof stored.query !== 'string') return null;

        const at = Number(stored.at);

        if (!Number.isFinite(at) || Date.now() - at > READING_KEEPS_MS) return null;
        if (!looksLikeReading(stored.data)) return null;

        return { query: stored.query, at, data: stored.data };
    } catch (error) {
        return null;
    }
}

function saveReading(query, data, at) {
    try {
        localStorage.setItem(READING_KEY, JSON.stringify({ query, at, data }));
    } catch (error) {
        /* storage unavailable - the card still works, it just starts empty */
    }
}

// localStorage throws in private windows and when site data is blocked, so
// every read and write has to survive on its own.
function recallCities() {
    try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY));

        if (Array.isArray(stored)) {
            return stored.filter((city) => typeof city === 'string').slice(0, MAX_RECENT);
        }

        const legacy = localStorage.getItem(LAST_CITY_KEY);

        return legacy ? [legacy] : [];
    } catch (error) {
        return [];
    }
}

// The city named in the query string, if there is one worth reading. A
// malformed or empty value falls through to the usual opening city rather
// than being reported as an error - a bad link should still show weather.
function cityFromUrl() {
    try {
        const asked = new URLSearchParams(window.location.search).get(CITY_PARAM);
        const city = (asked || '').trim();

        return city && city.length <= MAX_CITY_LENGTH ? city : null;
    } catch (error) {
        return null;
    }
}

// Writes the city that is actually on screen into the address bar - the name
// the API resolved, not the spelling that was typed, so a link says Zürich
// however it was searched for.
//
// replaceState rather than pushState: the search box is one place being used
// over and over, not a sequence of pages. Pressing Back should leave the app,
// not walk back through six cities somebody was comparing.
function rememberCityInUrl(city) {
    try {
        const url = new URL(window.location.href);

        url.searchParams.set(CITY_PARAM, city);
        window.history.replaceState(null, '', url.toString());

        shareBtn.hidden = false;
    } catch (error) {
        /* history unavailable - the app still works, the link just will not */
    }
}

// The clipboard can be refused outright: an insecure context, a denied
// permission, an older browser. The address bar holds the link either way,
// so that case says so rather than reporting a failure.
async function copyCityLink() {
    const link = window.location.href;

    try {
        await navigator.clipboard.writeText(link);

        shareBtn.classList.add('is-copied');
        setTimeout(() => shareBtn.classList.remove('is-copied'), 1600);
    } catch (error) {
        window.prompt('Copy this link:', link);
    }
}

function recallHome() {
    try {
        const stored = localStorage.getItem(HOME_KEY);

        return typeof stored === 'string' && stored.trim() ? stored : null;
    } catch (error) {
        return null;
    }
}

// Pinning a city, or unpinning the one already pinned - the same button
// does both, because a pin is a single fact and there is only ever one.
function toggleHome(city) {
    const next = recallHome()?.toLowerCase() === city.toLowerCase() ? null : city;

    try {
        if (next) localStorage.setItem(HOME_KEY, next);
        else localStorage.removeItem(HOME_KEY);
    } catch (error) {
        /* storage unavailable - the pin holds for this visit and no longer */
    }

    renderRecent(recallCities());
}

function rememberCity(city) {
    // Newest first, no duplicates - searching "paris" again should move
    // Paris to the front rather than add a second chip.
    const recent = [
        city,
        ...recallCities().filter((name) => name.toLowerCase() !== city.toLowerCase()),
    ].slice(0, MAX_RECENT);

    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch (error) {
        /* storage unavailable - the app still works, it just forgets */
    }

    renderRecent(recent);
}

// Drops one city from the list and redraws. A city typed by mistake, or one
// nobody needs any more, otherwise sits there until four more searches push
// it off the end.
function forgetCity(city) {
    const remaining = recallCities().filter(
        (name) => name.toLowerCase() !== city.toLowerCase()
    );

    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(remaining));

        // Removing a city removes it entirely. A pin pointing at a chip that
        // is no longer there would quietly bring it back on the next visit.
        if (recallHome()?.toLowerCase() === city.toLowerCase()) {
            localStorage.removeItem(HOME_KEY);
        }
    } catch (error) {
        /* storage unavailable - the chip still goes for this visit */
    }

    renderRecent(remaining);
}

// Draws one chip per remembered city. The chip searches it again; the cross
// on its right drops it. They are two buttons rather than one so the cross
// can be reached by keyboard and named for a screen reader, and so a stray
// click on it never fires the search underneath.
function renderRecent(cities) {
    const home = recallHome();

    recentBox.innerHTML = '';
    recentBox.hidden = cities.length === 0;

    // The same list, offered as the box is typed into. The browser's own
    // form history is switched off on the input so the two do not disagree
    // about a city that was removed from the chips.
    suggestionsEl.innerHTML = '';
    cities.forEach((city) => {
        const option = document.createElement('option');
        option.value = city;
        suggestionsEl.appendChild(option);
    });

    // The pinned city leads, whatever the history says. It is the one chip
    // whose position is a decision rather than a side effect of the last
    // thing typed.
    const ordered = home
        ? [
            ...cities.filter((name) => name.toLowerCase() === home.toLowerCase()),
            ...cities.filter((name) => name.toLowerCase() !== home.toLowerCase()),
        ]
        : cities;

    ordered.forEach((city) => {
        const pinned = home?.toLowerCase() === city.toLowerCase();
        const chip = document.createElement('span');
        chip.className = pinned ? 'recent-chip is-home' : 'recent-chip';

        const search = document.createElement('button');
        search.type = 'button';
        search.className = 'recent-chip-name';
        search.textContent = city;
        if (pinned) search.title = 'Press H to come back here';
        search.addEventListener('click', () => {
            cityInput.value = city;
            checkWeather(city);
        });

        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'recent-chip-pin';
        pin.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
        pin.title = pinned ? `Unpin ${city}` : `Open on ${city} next time`;
        pin.setAttribute('aria-pressed', String(pinned));
        pin.setAttribute(
            'aria-label',
            pinned ? `Unpin ${city} as your home city` : `Pin ${city} as your home city`
        );
        pin.addEventListener('click', () => toggleHome(city));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'recent-chip-remove';
        remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        remove.title = `Remove ${city}`;
        remove.setAttribute('aria-label', `Remove ${city} from recent searches`);
        remove.addEventListener('click', () => forgetCity(city));

        chip.append(search, pin, remove);
        recentBox.appendChild(chip);
    });
}

// Toggles the search button between its idle icon and a spinner
function setLoading(isLoading) {
    searchBtn.disabled = isLoading;
    searchBtn.classList.toggle('loading', isLoading);
    searchBtn.innerHTML = isLoading
        ? '<i class="fa-solid fa-spinner"></i>'
        : '<i class="fa-solid fa-magnifying-glass"></i>';
}

// Renders a message in the error box and hides any stale weather results
function showError(html) {
    hidePlaces();
    hideForecast();
    hideAirQuality();
    hideDaylight();
    hideLocalTime();
    hideVisibility();
    resetDocumentTitle();

    // Nothing is being shown, so nothing should be claimed about the sky —
    // and there is no reading here worth sending anybody a link to, or
    // dating.
    shareBtn.hidden = true;
    readingAgeEl.hidden = true;
    feelsNoteEl.hidden = true;
    document.body.dataset.sky = 'default';
    weatherBox.style.display = 'none';
    weatherDetails.style.display = 'none';
    errorBox.style.display = 'block';
    errorBox.innerHTML = html;
}

// Text going into the error box's HTML. The box is written with innerHTML so
// its messages can carry a line break, which means anything the person typed
// has to be made harmless before it joins them.
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// "City not found" on its own leaves somebody rereading what they typed to
// work out what went wrong. Repeating the name back shows the typo - "Lodnon"
// - without them having to look up at the box.
function notFoundMessage(query) {
    const params = new URLSearchParams(query);
    const name = params.get('q');
    const zip = params.get('zip');

    if (zip) {
        return `<p>Couldn't find postcode "${escapeHtml(zip.split(',')[0])}".<br><small>Check it, or add the country: 10115, DE.</small></p>`;
    }

    if (!name) return "<p>Oops! City not found. Try again.</p>";

    return `<p>Couldn't find "${escapeHtml(name)}".<br><small>Check the spelling, or add the country: Paris, FR.</small></p>`;
}

// Draws the day as a track from sunrise to sunset with now marked on it.
// The grid above already gives both times; what it cannot say is how much of
// the day is left, which is the thing anyone actually plans around. Nothing
// here is fetched - every figure comes out of the reading already on screen.
function renderDaylight(data) {
    const sunrise = data.sys?.sunrise;
    const sunset = data.sys?.sunset;
    const length = sunset - sunrise;

    // Inside the polar circles the sun can stay up, or down, for weeks, and
    // the two timestamps stop bracketing a day at all. There is no honest bar
    // to draw for that, so the panel steps aside rather than invent one.
    if (typeof sunrise !== 'number' || typeof sunset !== 'number' || length <= 0) {
        hideDaylight();
        return;
    }

    // The clock, not `data.dt` - a reading a few minutes old should still put
    // the marker where the sun is now.
    const now = Date.now() / 1000;
    const progress = Math.min(Math.max((now - sunrise) / length, 0), 1);
    const offset = `${progress * 100}%`;

    daylightBox.hidden = false;
    daylightLengthEl.textContent = `${durationText(length)} of daylight`;

    // Halfway between sunrise and sunset is when the sun stands highest -
    // the hour shadows are shortest and sunburn comes quickest. Rarely
    // twelve on the clock, so it is worth saying in the city's own time.
    daylightBox.title = `Sun highest at ${clockText((sunrise + sunset) / 2, data.timezone)}`;
    daylightFillEl.style.setProperty('--daylight-progress', offset);
    daylightMarkerEl.style.setProperty('--daylight-progress', offset);

    if (now < sunrise) {
        daylightBox.dataset.phase = 'night';
        daylightCaptionEl.textContent = `Sunrise in ${durationText(sunrise - now)}`;
    } else if (now > sunset) {
        daylightBox.dataset.phase = 'night';
        // Today's sunset has gone, so the next sunrise is tomorrow's - and
        // this response only carries today's. A day on from it is out by a
        // couple of minutes at most, which the wording already rounds away.
        daylightCaptionEl.textContent = `Sunrise in ${durationText(sunrise + DAY_SECONDS - now)}`;
    } else {
        daylightBox.dataset.phase = 'day';
        daylightCaptionEl.textContent = `${durationText(sunset - now)} of daylight left`;
    }
}

function hideDaylight() {
    daylightBox.hidden = true;
}

// How old the reading on screen is, in words. Redrawn on the same minute
// timer as the daylight marker, so a card left open counts its own age up
// instead of freezing at whatever it said when it arrived.
function renderReadingAge() {
    if (!lastReadingAt) {
        readingAgeEl.hidden = true;
        return;
    }

    const age = Date.now() - lastReadingAt;

    readingAgeEl.hidden = false;

    // With the network gone the line stops being a footnote and becomes the
    // most important thing on the card: the temperature above it is the last
    // one that arrived, not the one outside.
    readingAgeTextEl.textContent = offline
        ? `Offline · last updated ${durationText(age / 1000)} ago`
        : age < FRESH_UNDER_MS
            ? 'Updated just now'
            : `Updated ${durationText(age / 1000)} ago`;

    // Past the age the app refreshes itself at, the line stops being a
    // timestamp and starts being a caveat - it only gets this old when a
    // refresh was tried and did not land, or nobody has been back to the tab.
    readingAgeEl.classList.toggle('is-stale', offline || age >= STALE_AFTER_MS);
}

// "Feels like" is a second temperature with no explanation attached. Beside
// the real one it reads as a contradiction: 8° and feels like 3°, so which
// is it? OpenWeather derives it from wind chill in the cold and from humidity
// in the heat, so the reading already holds the reason - it just was not
// being said.
//
// Two degrees Celsius is roughly where the difference starts to decide
// between a jacket and no jacket. Below that the second number is noise.
const FEELS_GAP_C = 2;
// About 15 km/h: a breeze that is felt on the face rather than seen in trees.
const WINDY_MS = 4;
const HUMID_PERCENT = 60;

function feelsNote(data) {
    const actual = data?.main?.temp;
    const feels = data?.main?.feels_like;

    if (typeof actual !== 'number' || typeof feels !== 'number') return '';

    const gap = feels - actual;

    if (Math.abs(gap) < FEELS_GAP_C) return '';

    // A gap is a difference, not a temperature, so it scales without the
    // +32 the thermometer reading gets.
    const degrees = Math.round(Math.abs(gap) * (units === 'imperial' ? 9 / 5 : 1));
    const colder = gap < 0;
    const direction = colder ? 'colder' : 'warmer';

    let reason = '';

    if (colder && data.wind?.speed >= WINDY_MS) reason = ' because of the wind';
    if (!colder && data.main.humidity >= HUMID_PERCENT) reason = ' because of the humidity';

    return `Feels ${degrees}° ${direction} than it is${reason}`;
}

// Paints one reading into the card using whichever units are selected.
function renderWeather(data) {
    errorBox.style.display = 'none';
    weatherBox.style.display = 'block';
    weatherDetails.style.display = 'grid';

    tempEl.innerHTML = temperatureText(data.main.temp);
    descEl.innerHTML = data.weather[0].description;

    // Under the description it qualifies, the way the dew point sits under
    // the humidity.
    const fall = fallText(data);

    if (fall) {
        const note = document.createElement('small');
        note.className = 'fall-note';
        note.textContent = fall;
        descEl.append(note);
    }

    const cloud = cloudText(data);

    if (cloud) {
        const note = document.createElement('small');
        note.className = 'fall-note';
        note.textContent = cloud;
        descEl.append(note);
    }
    locEl.innerHTML = `${data.name}, ${data.sys.country}`;
    humidityEl.textContent = `${data.main.humidity}%`;

    // Under the percentage, the way gusts sit under the wind: the figure
    // that says what the one above it means.
    const dew = dewPointCelsius(data.main.temp, data.main.humidity);

    if (dew !== null) {
        const note = document.createElement('small');
        note.className = 'dew-point';
        note.textContent = `dew point ${temperatureText(dew)}`;
        note.title = 'The temperature the air would have to cool to for dew to form';
        humidityEl.append(note);
    }
    windEl.textContent = windText(data.wind.speed, data.wind.deg);

    // "WSW" has to be turned into a direction in the head; an arrow is
    // already one. It points where the wind is going - the way a flag or a
    // weather map shows it - so it is the bearing turned half a circle.
    if (typeof data.wind.deg === 'number') {
        const arrow = document.createElement('i');
        arrow.className = 'fa-solid fa-arrow-up wind-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.style.transform = `rotate(${(data.wind.deg + 180) % 360}deg)`;
        windEl.append(arrow);
    }

    // Under the speed and above any gusts: what the steady wind is like
    // comes before what it occasionally does.
    const force = beaufortName(data.wind.speed);

    if (force) {
        const note = document.createElement('small');
        note.className = 'wind-name';
        note.textContent = force;
        windEl.append(note);
    }

    const gusts = gustText(data.wind);

    if (gusts) {
        const note = document.createElement('small');
        note.className = 'wind-gust';
        note.textContent = gusts;
        windEl.append(note);
    }
    feelsLikeEl.innerHTML = temperatureText(data.main.feels_like);

    const note = feelsNote(data);
    feelsNoteEl.textContent = note;
    feelsNoteEl.hidden = !note;
    renderPressure(data);
    sunriseEl.innerHTML = clockText(data.sys.sunrise, data.timezone);
    sunsetEl.innerHTML = clockText(data.sys.sunset, data.timezone);

    iconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    // The hour and day tiles already name their icons; the big one said
    // "Weather-Icon" whatever the sky was doing, which is what a screen
    // reader announced and what a broken image left behind.
    iconEl.alt = data.weather[0].description;
    iconEl.title = data.weather[0].description;

    renderDocumentTitle(data);
    renderVisibility(data);
    renderDaylight(data);
    renderLocalTime(data);
    renderReadingAge();

    document.body.dataset.sky = skyKey(data.weather[0]);
}

function renderUnitSwitch() {
    const metric = units === 'metric';

    metricBtn.classList.toggle('is-active', metric);
    imperialBtn.classList.toggle('is-active', !metric);
    metricBtn.setAttribute('aria-pressed', String(metric));
    imperialBtn.setAttribute('aria-pressed', String(!metric));
}

// The forecast endpoint answers with a reading every three hours, which is
// far more than a five-day glance needs. Entries are bucketed by the day
// they fall on *in the city*, and each bucket keeps its own high, low and
// the icon nearest midday — the one that describes the day people will live
// through rather than whatever was happening at 3am.
function summariseForecast(data) {
    const offset = typeof data.city?.timezone === 'number' ? data.city.timezone : 0;
    const todayKey = dateKey(Date.now() / 1000, offset);
    const days = new Map();

    data.list.forEach((entry) => {
        const key = dateKey(entry.dt, offset);

        // Today is already the card above; the strip is about what comes next.
        if (key === todayKey) return;

        const shifted = new Date((entry.dt + offset) * 1000);
        const day = days.get(key) || {
            label: DAY_NAMES[shifted.getUTCDay()],
            // "Tue" is enough to scan by, not enough to plan by: the date is
            // what goes in a diary. Read in the city's calendar, like the label.
            date: shifted.toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
            }),
            min: entry.main.temp_min,
            max: entry.main.temp_max,
            icon: entry.weather[0].icon,
            description: entry.weather[0].description,
            hoursFromNoon: Infinity,
            rainChance: 0,
            snow: false,
            storm: false,
            maxWind: 0,
        };

        day.min = Math.min(day.min, entry.main.temp_min);
        day.max = Math.max(day.max, entry.main.temp_max);

        // `pop` is the chance of rain in that one three-hour block. Keeping
        // the highest of the day answers the question people are really
        // asking - whether to take a coat at all - where an average across
        // eight blocks would quietly bury a downpour at teatime.
        //
        // Whatever falls in that wettest block is what the day's chance is
        // a chance of - the hourly strip already tells snow from rain, and
        // the day strip was calling a snowy Thursday a rainy one. A 2xx block
        // is thunder, and a stormy Friday should not read as a wet one.
        if (typeof entry.pop === 'number' && entry.pop > day.rainChance) {
            day.rainChance = entry.pop;
            day.snow = Math.floor(entry.weather[0].id / 100) === 6;
            day.storm = Math.floor(entry.weather[0].id / 100) === 2;
        }

        // The strongest steady wind of the day, for the same reason as the
        // rain: one blustery afternoon is what the day gets remembered for.
        if (typeof entry.wind?.speed === 'number') {
            day.maxWind = Math.max(day.maxWind, entry.wind.speed);
        }

        const hoursFromNoon = Math.abs(shifted.getUTCHours() - 12);

        if (hoursFromNoon < day.hoursFromNoon) {
            day.hoursFromNoon = hoursFromNoon;
            day.icon = entry.weather[0].icon;
            day.description = entry.weather[0].description;
        }

        days.set(key, day);
    });

    return [...days.values()].slice(0, MAX_FORECAST_DAYS);
}

// The next few three-hour blocks, taken from the same response the day strip
// is built from. A five-day outlook answers "what is this week like"; it
// cannot answer "can I walk to the shops before it starts", which is the
// question a weather app is usually opened for.
//
// Blocks already behind us are dropped. The endpoint returns the window it
// has, and the first entry can easily have been and gone by the time anyone
// reads it.
function summariseHours(data) {
    const offset = typeof data.city?.timezone === 'number' ? data.city.timezone : 0;
    const now = Date.now() / 1000;

    return data.list
        .filter((entry) => entry.dt > now)
        .slice(0, MAX_FORECAST_HOURS)
        .map((entry) => ({
            at: entry.dt,
            // Labelled in the city's own clock, like every other time on the
            // card. A block that reads 3 PM should be three in the afternoon
            // where the weather is, not where the browser is.
            label: clockText(entry.dt, offset),
            icon: entry.weather[0].icon,
            description: entry.weather[0].description,
            temp: entry.main.temp,
            pressure: entry.main.pressure,
            rainChance: typeof entry.pop === 'number' ? entry.pop : 0,
            // `pop` is the chance of anything falling, and the condition
            // code says what. A 6xx block is snow, and telling somebody to
            // expect rain is the wrong advice about shoes.
            snow: Math.floor(entry.weather[0].id / 100) === 6,
            // A 2xx block is thunder. "Rain likely from 4 PM" sends somebody
            // out with an umbrella; a storm is the one forecast that should
            // keep them off the golf course and out from under trees.
            storm: Math.floor(entry.weather[0].id / 100) === 2,
        }));
}

// What is falling in a block, as the noun the sentences above the tiles use.
function fallWord(hour) {
    if (hour.storm) return 'thunderstorms';
    return hour.snow ? 'snow' : 'rain';
}

// The one sentence worth putting above the tiles: when the rain arrives, or
// that it does not. Reading it off the tiles means comparing six percentages
// against a threshold, which is work the app can do instead.
function rainNote(hours) {
    const soaking = hours.find((hour) => Math.round(hour.rainChance * 100) >= RAIN_CHANCE_FLOOR);

    if (!soaking) return 'Nothing wet expected in the next few hours';

    const chance = Math.round(soaking.rainChance * 100);
    const kind = fallWord(soaking);
    const word = kind.charAt(0).toUpperCase() + kind.slice(1);

    // The first block is not a forecast of something coming, it is now -
    // and somebody already standing in it wants to know when it ends, not
    // that it has started. The first dry block after it is the answer; if
    // there is none in the strip, saying so beats leaving them to count.
    if (soaking === hours[0]) {
        const dry = hours.find((hour) => Math.round(hour.rainChance * 100) < RAIN_CHANCE_FLOOR);
        const until = dry ? `, drier from ${dry.label}` : ', with no dry spell in the next few hours';

        return `${word} around now — ${chance}% chance${until}`;
    }

    return `${word} likely from ${soaking.label} — ${chance}% chance`;
}

function renderHours(hours) {
    hourlyStrip.innerHTML = '';
    hourlyBox.hidden = hours.length === 0;

    if (hours.length === 0) return;

    hourlyNoteEl.textContent = rainNote(hours);

    // When the next few hours peak - the block to time the walk for. Only
    // a single clear warmest; a flat afternoon has no peak to point at.
    const temps = hours.map((hour) => Math.round(hour.temp));
    const top = Math.max(...temps);
    const warmest = hours.length > 1 && temps.filter((temp) => temp === top).length === 1
        ? temps.indexOf(top)
        : -1;
    // And the chilliest, for the same reason in reverse: the block to be
    // back indoors by, or to take a jacket for.
    const bottom = Math.min(...temps);
    const coldest = hours.length > 1 && bottom !== top && temps.filter((temp) => temp === bottom).length === 1
        ? temps.indexOf(bottom)
        : -1;

    hours.forEach((hour, index) => {
        const tile = document.createElement('div');
        tile.className = 'hour-tile';

        if (index === warmest) {
            tile.classList.add('hour-tile--warmest');
            tile.title = 'Warmest of the next few hours';
        }

        if (index === coldest) {
            tile.classList.add('hour-tile--coldest');
            tile.title = 'Coldest of the next few hours';
        }

        const label = document.createElement('p');
        label.className = 'hour-label';
        label.textContent = hour.label;

        const icon = document.createElement('img');
        icon.className = 'hour-icon';
        icon.src = `https://openweathermap.org/img/wn/${hour.icon}.png`;
        icon.alt = hour.description;
        icon.title = hour.description;

        const temp = document.createElement('p');
        temp.className = 'hour-temp';
        temp.innerHTML = temperatureText(hour.temp);

        tile.append(label, icon, temp);

        // Same rule as the day strip: a dry block should not carry a number
        // that has to be read before it can be dismissed.
        const chance = Math.round(hour.rainChance * 100);

        if (chance >= RAIN_CHANCE_FLOOR) {
            const rain = document.createElement('p');
            rain.className = 'forecast-rain';
            rain.textContent = `${chance}%`;
            rain.title = `${chance}% chance of ${fallWord(hour)}`;
            tile.appendChild(rain);
        }

        hourlyStrip.appendChild(tile);
    });
}

function hideHours() {
    lastHours = null;
    lastPressureTrend = null;
    hourlyStrip.innerHTML = '';
    hourlyBox.hidden = true;
}

// How warm and how cold it still gets today.
//
// The day strip deliberately starts at tomorrow, and the current reading is
// a single moment, so nothing on the card answers "is this as cold as it
// gets" — the question behind taking a coat out at four in the afternoon.
//
// Only blocks still ahead of us count, and the reading on screen is folded
// in as the temperature right now. A high the morning already delivered
// would read as a promise the rest of the day cannot keep.
function summariseToday(data, currentCelsius) {
    const offset = typeof data.city?.timezone === 'number' ? data.city.timezone : 0;
    const now = Date.now() / 1000;
    const todayKey = dateKey(now, offset);

    const ahead = data.list.filter(
        (entry) => entry.dt > now && dateKey(entry.dt, offset) === todayKey
    );

    // Late in the evening there is no rest of today left to describe.
    if (ahead.length === 0) return null;

    const temps = ahead.flatMap((entry) => [entry.main.temp_min, entry.main.temp_max]);

    if (typeof currentCelsius === 'number') temps.push(currentCelsius);

    return { min: Math.min(...temps), max: Math.max(...temps) };
}

const FREEZING_C = 0;

function renderTodayRange(range) {
    todayRangeEl.hidden = !range;

    if (!range) return;

    todayRangeEl.innerHTML = '';

    // A high and a low that round to the same number is not a range, it is
    // the same figure printed twice with two arrows pointing at it.
    const high = temperatureText(range.max);
    const low = temperatureText(range.min);

    if (high === low) {
        const steady = document.createElement('span');
        steady.title = 'Expected for the rest of today';
        steady.textContent = `Steady around ${high} today`;
        todayRangeEl.appendChild(steady);
    }

    const parts = high === low ? [] : [
        { icon: 'fa-arrow-up', text: high, title: 'Highest expected for the rest of today' },
        { icon: 'fa-arrow-down', text: low, title: 'Lowest expected for the rest of today' },
    ];

    // A low of 1° and a low of -1° look alike as numbers and are different
    // mornings: one is cold, the other is ice on the windscreen and on the
    // path. Said only when the freeze is still to come - if it is already
    // below zero, the big number above says so.
    const now = lastReading?.main?.temp;

    if (range.min <= FREEZING_C && typeof now === 'number' && now > FREEZING_C) {
        parts.push({
            icon: 'fa-snowflake',
            text: 'Freezing later',
            title: 'Expected to drop below freezing before the day is out',
        });
    }

    parts.forEach((part) => {
        const span = document.createElement('span');
        span.title = part.title;

        const arrow = document.createElement('i');
        arrow.className = `fa-solid ${part.icon}`;
        arrow.setAttribute('aria-hidden', 'true');

        span.append(arrow, document.createTextNode(part.text));
        todayRangeEl.appendChild(span);
    });
}

function hideTodayRange() {
    lastToday = null;
    todayRangeEl.hidden = true;
    todayRangeEl.textContent = '';
}

// The one sentence worth putting above the day tiles: where the week turns.
// Five highs in a row is a table, and working out which pair of them differ
// enough to matter is the reading nobody does — so the strip says it.
//
// The biggest single step is named rather than the trend across the week.
// Somebody deciding what to wear on Thursday is served by "Thursday is the
// cold one", not by an average that describes no day in particular.
function turnNote(days) {
    if (days.length < 2) return '';

    let turn = null;

    for (let i = 1; i < days.length; i += 1) {
        const gap = days[i].max - days[i - 1].max;

        if (!turn || Math.abs(gap) > Math.abs(turn.gap)) {
            turn = { gap, day: days[i], before: days[i - 1] };
        }
    }

    if (!turn || Math.abs(turn.gap) < TURN_FLOOR_C) return '';

    // The gap is a difference, not a temperature, so it is scaled rather than
    // run through the converter — a five degree rise is nine Fahrenheit, not
    // forty-one.
    const degrees = Math.round(Math.abs(turn.gap) * (units === 'imperial' ? 9 / 5 : 1));
    const warmer = turn.gap > 0;

    return `Turning ${warmer ? 'warmer' : 'colder'} on ${turn.day.label} — ${degrees}° ${
        warmer ? 'up' : 'down'
    } on ${turn.before.label}`;
}

// Draws one tile per upcoming day. Temperatures go through the same
// converter as the main card, so the unit switch moves the strip with it.
function renderForecast(days) {
    forecastStrip.innerHTML = '';
    forecastBox.hidden = days.length === 0;

    // Empty rather than a dash when the week is flat: there is no news, and a
    // placeholder would be something to read before it can be dismissed.
    forecastNoteEl.textContent = turnNote(days);

    // The day to plan the outdoor thing for. Picked by the high, and only
    // when one day actually stands out - a tie, or a single day, has no
    // warmest worth pointing at.
    const highs = days.map((day) => Math.round(day.max));
    const top = Math.max(...highs);
    const warmest = days.length > 1 && highs.filter((high) => high === top).length === 1
        ? highs.indexOf(top)
        : -1;

    // Its opposite, read off the lows: the night to bring the plants in or
    // leave the car under cover. Same rule - only a single clear coldest.
    const lows = days.map((day) => Math.round(day.min));
    const bottom = Math.min(...lows);
    const coldest = days.length > 1 && lows.filter((low) => low === bottom).length === 1
        ? lows.indexOf(bottom)
        : -1;

    days.forEach((day, index) => {
        const tile = document.createElement('div');
        tile.className = 'forecast-day';
        tile.title = day.date;

        if (index === warmest) {
            tile.classList.add('forecast-day--warmest');
            tile.title = `${day.date} · warmest of the ${days.length} days`;
        }

        if (index === coldest) {
            tile.classList.add('forecast-day--coldest');
            tile.title = `${tile.title} · coldest night of the ${days.length} days`;
        }

        const label = document.createElement('p');
        label.className = 'forecast-label';
        label.textContent = day.label;

        const icon = document.createElement('img');
        icon.className = 'forecast-icon';
        icon.src = `https://openweathermap.org/img/wn/${day.icon}.png`;
        icon.alt = day.description;
        icon.title = day.description;

        const high = document.createElement('span');
        high.className = 'forecast-high';
        high.textContent = temperatureText(day.max);

        const low = document.createElement('span');
        low.className = 'forecast-low';
        low.textContent = temperatureText(day.min);

        const range = document.createElement('p');
        range.className = 'forecast-range';
        range.append(high, low);
        // How far the day moves between its low and its high - the figure
        // that decides whether one layer will do or the morning needs two.
        // Worked out from the rounded readings so it matches what is shown.
        const swing = Math.round(toTemperature(day.max)) - Math.round(toTemperature(day.min));
        range.title = `${swing}° between the low and the high`;

        tile.append(label, icon, range);

        // A dry day should not carry a "0%" that has to be read before it can
        // be dismissed; the line is only drawn once rain is worth mentioning.
        const chance = Math.round(day.rainChance * 100);

        if (chance >= RAIN_CHANCE_FLOOR) {
            const rain = document.createElement('p');
            rain.className = 'forecast-rain';
            rain.textContent = `${chance}%`;
            rain.title = `${chance}% chance of ${fallWord(day)}`;
            tile.appendChild(rain);
        }

        // A dry, mild Wednesday with a gale blowing is not the easy day its
        // icon and temperatures promise. Only drawn once the wind is strong
        // enough to change plans, so a calm week stays uncluttered.
        if (day.maxWind >= WINDY_DAY_MS) {
            const wind = document.createElement('p');
            wind.className = 'forecast-wind';
            wind.textContent = windText(day.maxWind);
            wind.title = `${beaufortName(day.maxWind)} at its strongest`;
            tile.appendChild(wind);
        }

        forecastStrip.appendChild(tile);
    });
}

function hideForecast() {
    lastForecast = null;
    forecastStrip.innerHTML = '';
    forecastNoteEl.textContent = '';
    forecastBox.hidden = true;
    // Both strips are drawn from the same response, so a forecast that could
    // not be read leaves neither of them standing with stale numbers on it.
    hideHours();
    hideTodayRange();
}

// A second request for a nice-to-have: if it fails the card above it is
// still correct, so the strip simply stays out of the way rather than
// turning a working lookup into an error.
async function loadForecast(query, ticket) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?${query}&units=metric&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // A forecast for the city before last has nothing to say about the
        // card it would be drawn under.
        if (!isCurrent(ticket)) return;

        if (String(data.cod) !== '200' || !Array.isArray(data.list)) {
            hideForecast();
            return;
        }

        lastForecast = summariseForecast(data);
        renderForecast(lastForecast);

        lastHours = summariseHours(data);
        renderHours(lastHours);

        if (lastReading) {
            lastPressureTrend = pressureTrend(lastReading.main.pressure, lastHours);
            renderPressure(lastReading);
        }

        lastToday = summariseToday(data, lastReading?.main?.temp);
        renderTodayRange(lastToday);
    } catch (error) {
        console.error('Error fetching forecast data: ', error);

        // Only the current lookup may clear the strips. An abandoned request
        // failing is not a reason to take down panels that belong to the
        // reading now on screen.
        if (isCurrent(ticket)) hideForecast();
    }
}

// How near two sets of coordinates have to be to be the same place, in
// degrees. The geocoder and the weather endpoint file a city under slightly
// different points - Cambridge comes back twice from the geocoder alone,
// a mile apart - so the match has to be loose enough to survive that and
// tight enough not to confuse two towns in the same county.
const SAME_PLACE_DEGREES = 0.4;

function samePlace(place, coord) {
    if (typeof coord?.lat !== 'number' || typeof coord?.lon !== 'number') return false;

    return (
        Math.abs(place.lat - coord.lat) < SAME_PLACE_DEGREES &&
        Math.abs(place.lon - coord.lon) < SAME_PLACE_DEGREES
    );
}

// "Cambridge, Massachusetts, US". The region is what tells two of them
// apart, and it is missing often enough - small countries, city states -
// that it cannot simply be assumed.
function placeLabel(place) {
    return [place.name, place.state, place.country].filter(Boolean).join(', ');
}

// Draws the row, marking whichever entry the card is currently showing.
//
// Redrawn after every reading rather than only when the list arrives,
// because the answer to "which one is this" changes each time one of them is
// chosen, and the list itself does not.
function renderPlaces() {
    placesEl.innerHTML = '';
    placesEl.hidden = lastPlaces.length < 2;

    if (lastPlaces.length < 2) return;

    const label = document.createElement('p');
    label.className = 'place-picker-label';
    label.textContent = `More than one place is called ${lastPlaces[0].name}:`;
    placesEl.appendChild(label);

    lastPlaces.forEach((place) => {
        const current = samePlace(place, lastReading?.coord);
        const chip = document.createElement('button');

        chip.type = 'button';
        chip.className = current ? 'place-chip is-current' : 'place-chip';
        chip.textContent = placeLabel(place);
        chip.disabled = current;
        chip.title = current ? 'Showing this one' : `Show the weather in ${placeLabel(place)}`;

        // By coordinates, because the name is the thing that was ambiguous.
        // Asking for "Cambridge" again would land back on whichever one the
        // API prefers, which is the answer this row exists to get past.
        chip.addEventListener('click', () => {
            loadWeather(`lat=${place.lat}&lon=${place.lon}`, { keepPlaces: true });
        });

        placesEl.appendChild(chip);
    });
}

function hidePlaces() {
    lastPlaces = [];
    placesEl.innerHTML = '';
    placesEl.hidden = true;
}

// Which places answer to the name that was typed.
//
// A search for Cambridge has always returned exactly one Cambridge, with no
// hint that there were three - so somebody in Massachusetts reading 8° and
// drizzle had no way to tell they were being shown England. The card named
// the country it settled on, which says what happened but offers no way to
// change it.
//
// Another nice-to-have alongside the forecast: if it fails, the reading
// above it is still the reading, and the row simply does not appear.
async function loadPlaces(query, ticket) {
    const name = new URLSearchParams(query).get('q');

    // A lookup by coordinates has no name to be ambiguous about — and any
    // row still on screen belongs to a name nobody is looking at any more.
    if (!name) {
        hidePlaces();
        return;
    }

    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=5&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!isCurrent(ticket)) return;

        if (!Array.isArray(data)) {
            hidePlaces();
            return;
        }

        // The geocoder lists the same town more than once - two points a
        // mile apart, both "Cambridge, England, GB" - and a row offering the
        // same place twice is worse than no row at all.
        const seen = new Set();
        const places = [];

        for (const place of data) {
            if (!place || typeof place.lat !== 'number' || typeof place.lon !== 'number') continue;

            const key = placeLabel(place).toLowerCase();

            if (seen.has(key)) continue;

            seen.add(key);
            places.push({
                name: String(place.name || name),
                state: typeof place.state === 'string' ? place.state : '',
                country: typeof place.country === 'string' ? place.country : '',
                lat: place.lat,
                lon: place.lon,
            });
        }

        // One answer is not a choice, and saying so would turn every
        // unambiguous search into a row of one chip.
        lastPlaces = places.length > 1 ? places : [];
        renderPlaces();
    } catch (error) {
        console.error('Error fetching places: ', error);

        if (isCurrent(ticket)) hidePlaces();
    }
}

// Particle readings are absolute (ug/m3) and do not move with the unit
// switch, so unlike the strip above this panel is drawn once per lookup and
// then left alone.
function renderAirQuality(index, components) {
    const level = AIR_LEVELS[index - 1];

    if (!level) {
        hideAirQuality();
        return;
    }

    airBox.hidden = false;
    airDialEl.style.setProperty('--air-colour', level.colour);
    airDialEl.style.setProperty('--air-fill', `${(index / AIR_LEVELS.length) * 100}%`);
    airIndexEl.textContent = index;
    airLabelEl.textContent = level.label;
    airPm25El.textContent = `${Math.round(components.pm2_5)}`;
    airPm10El.textContent = `${Math.round(components.pm10)}`;
}

function hideAirQuality() {
    airBox.hidden = true;
}

// Air quality is keyed by coordinates rather than by name, and the weather
// response already carries them - so this costs no extra lookup to resolve
// the city. Like the forecast it is an extra: a failure here leaves the
// reading above it untouched rather than blanking the card.
async function loadAirQuality(coord, ticket) {
    if (typeof coord?.lat !== 'number' || typeof coord?.lon !== 'number') {
        hideAirQuality();
        return;
    }

    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${coord.lat}&lon=${coord.lon}&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!isCurrent(ticket)) return;

        const reading = Array.isArray(data.list) ? data.list[0] : null;

        if (!reading?.main || !reading.components) {
            hideAirQuality();
            return;
        }

        renderAirQuality(reading.main.aqi, reading.components);
    } catch (error) {
        console.error('Error fetching air quality data: ', error);

        if (isCurrent(ticket)) hideAirQuality();
    }
}

// Asks for the same city again, now.
//
// The card already refreshes itself when the tab comes back to after ten
// minutes, and when the connection returns — both of which handle the cases
// the app can see coming. Neither covers the one where somebody is looking
// at the card, has reason to think the weather has turned, and simply wants
// to know. Reloading the page was the only answer, and on a flaky
// connection that trades a dated reading for an empty one.
function refreshNow() {
    if (!lastQuery) return;

    loadWeather(lastQuery);
}

// Redraws whatever the card is currently showing — a real reading, or the
// placeholder, which should not advertise units the switch says are off.
function refreshReadout() {
    if (lastForecast) {
        renderForecast(lastForecast);
    }

    if (lastHours) {
        renderHours(lastHours);
    }

    if (lastToday) {
        renderTodayRange(lastToday);
    }

    if (lastReading) {
        renderWeather(lastReading);
        return;
    }

    const symbol = units === 'imperial' ? 'F' : 'C';

    tempEl.innerHTML = `--°${symbol}`;
    feelsLikeEl.innerHTML = `--°${symbol}`;
    windEl.innerHTML = units === 'imperial' ? '-- mph' : '-- km/h';
    pressureEl.textContent = pressureText(null);
}

function setUnits(next) {
    if (next === units) return;

    units = next;

    try {
        localStorage.setItem(UNIT_KEY, units);
    } catch (error) {
        /* storage unavailable - the choice just will not survive a reload */
    }

    renderUnitSwitch();
    refreshReadout();
}

// Both the search box and the locate button end up here; only the query
// half of the URL differs, so the response handling lives in one place.
//
// `keepPlaces` is set by the one caller that is still asking about the same
// name: picking an alternative from the row of them. Every other lookup by
// coordinates - the locate button - is a different question, and the row of
// Cambridges has nothing to say about where you are standing.
async function loadWeather(query, { keepPlaces = false } = {}) {
    const url = `https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&appid=${API_KEY}`;
    const ticket = ++latestLookup;

    setLoading(true);

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Someone searched again while this was in the air. Their answer is
        // the one that matters now, and it may already be on screen.
        if (!isCurrent(ticket)) return;

        // SAFETY CHECK: If response is not successful (anything other than 200)
        if (data.cod !== 200 && data.cod !== "200") {
            // Customize error text based on what went wrong
            if (data.cod === 401 || data.cod === "401") {
                showError("<p>API Key Activation Pending.<br><small>New keys take 1-2 hours to activate. Please try again later!</small></p>");
            } else if (data.cod === 429 || data.cod === "429") {
                // The key is shared by everyone using the app, and the free
                // plan caps calls per minute. The city is fine; the answer is
                // to wait, not to go checking the spelling.
                showError("<p>Too many lookups right now.<br><small>Wait a minute and try again.</small></p>");
            } else {
                showError(notFoundMessage(query));
            }
            return;
        }

        lastReading = data;
        lastReadingAt = Date.now();
        // Worked out again when this reading's forecast arrives.
        lastPressureTrend = null;
        offline = false;
        // Kept as asked, not as answered, so a refresh repeats the same
        // question - see the note by the declaration.
        lastQuery = query;
        // Stored under the query rather than the resolved name, so the
        // reading is only ever offered back for the lookup that produced it.
        saveReading(query, data, lastReadingAt);
        renderWeather(data);

        // Only a city the API actually resolved is worth restoring next time
        rememberCity(data.name);
        rememberCityInUrl(data.name);

        // Deliberately not awaited: these fill themselves in a moment later
        // rather than holding the reading everyone came for.
        // Carrying the ticket, so a panel that arrives after the next search
        // knows to stay quiet rather than drawing another city's numbers
        // under this one's temperature.
        loadForecast(query, ticket);
        loadAirQuality(data.coord, ticket);

        // Redrawn either way: a kept row still has to move its mark onto
        // whichever place is now on screen.
        if (keepPlaces) renderPlaces();
        else loadPlaces(query, ticket);

    } catch (error) {
        console.error("Error fetching weather data: ", error);

        if (isCurrent(ticket)) {
            // A failed refresh of the city already on screen is not a reason
            // to take the city off the screen. Yesterday evening's numbers
            // for the right place, clearly dated, beat an error message
            // where the weather used to be - and the reading is still the
            // answer to "roughly what is it like there".
            //
            // Only for the same lookup, though. Someone who searched Tokyo
            // and got nothing must not be shown London under a caveat: that
            // is not a stale answer, it is the wrong one.
            if (lastReading && lastQuery === query) {
                offline = true;
                renderReadingAge();
                // The tab is carrying this temperature too, and it has just
                // stopped being current. Whatever caveat the card takes on,
                // the title takes with it.
                renderDocumentTitle(lastReading);
            } else {
                showError("<p>Couldn't reach the weather service.<br><small>Check your connection and try again.</small></p>");
            }
        }
    } finally {
        // The spinner belongs to the lookup still running. Switching it off
        // from an abandoned one leaves the button idle over a search that
        // has not answered yet.
        if (isCurrent(ticket)) setLoading(false);
    }
}

// Pressing search on an empty box used to do nothing at all, which reads as
// a button that is broken. A shake and the cursor put back in the box says
// what is missing without a sentence of error text for a blank field.
function nudgeEmptySearch() {
    const box = cityInput.closest('.search-box');

    box.classList.remove('is-empty');
    // Reading a layout property restarts the animation when the button is
    // pressed twice in a row.
    void box.offsetWidth;
    box.classList.add('is-empty');
    cityInput.focus();
}

function checkWeather(city) {
    const query = city.trim();
    if (!query) {
        nudgeEmptySearch();
        return;
    }

    const coords = coordinatesIn(query);

    if (coords) return loadWeather(`lat=${coords.lat}&lon=${coords.lon}`);

    const zip = postcodeIn(query);

    if (zip) return loadWeather(`zip=${encodeURIComponent(zip)}`);

    // Names like "New York" or "Washington, D.C." need escaping before they
    // can be dropped into the query string.
    return loadWeather(`q=${encodeURIComponent(query)}`);
}

// A postcode, which is how plenty of people think of where they live - and
// in the US often the only way to tell apart the dozens of Springfields. The
// API looks these up with `zip=`, not `q=`; sent as a name they failed.
//
// Five bare digits are taken as a US ZIP, which is what the API assumes too.
// Anything else needs a country code after a comma ("10115, DE") and at
// least one digit, so "Paris, FR" is still searched as a city.
const US_ZIP = /^\d{5}$/;
const POSTCODE = /^([A-Za-z0-9][A-Za-z0-9 -]{1,9}),\s*([A-Za-z]{2})$/;

function postcodeIn(text) {
    if (US_ZIP.test(text)) return `${text},us`;

    const match = POSTCODE.exec(text);

    if (!match || !/\d/.test(match[1])) return null;

    return `${match[1].trim()},${match[2].toLowerCase()}`;
}

// "51.5074, -0.1278" typed or pasted into the box - the form a map app hands
// over when you copy a dropped pin. Sent as a name it came back "not found";
// it is a more exact answer than any city name, so it is looked up as one.
const COORDINATES = /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;

function coordinatesIn(text) {
    const match = COORDINATES.exec(text);

    if (!match) return null;

    const lat = Number(match[1]);
    const lon = Number(match[2]);

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

    return { lat, lon };
}

// Asking the browser where we are saves typing a city that the API may well
// spell differently anyway — it answers with whatever name it files those
// coordinates under, and that name is what gets remembered.
function locateMe() {
    if (!navigator.geolocation) {
        showError("<p>This browser can't share your location.<br><small>Type a city name instead.</small></p>");
        return;
    }

    locateBtn.disabled = true;
    locateBtn.classList.add('locating');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            locateBtn.disabled = false;
            locateBtn.classList.remove('locating');
            // Without keepPlaces, so a row of Cambridges left over from a
            // typed search does not sit under the reading for wherever the
            // browser says you actually are.
            loadWeather(`lat=${latitude}&lon=${longitude}`);
        },
        (error) => {
            locateBtn.disabled = false;
            locateBtn.classList.remove('locating');

            // A refused prompt is a choice, not a fault — say what to do next
            // rather than reporting it as a failure.
            showError(
                error.code === error.PERMISSION_DENIED
                    ? "<p>Location access is off.<br><small>Allow it in your browser, or search for a city.</small></p>"
                    : "<p>Couldn't pin down your location.<br><small>Try searching for a city instead.</small></p>"
            );
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
}

// Event Listeners
searchBtn.addEventListener('click', () => {
    checkWeather(cityInput.value);
});

locateBtn.addEventListener('click', locateMe);
refreshBtn.addEventListener('click', refreshNow);
shareBtn.addEventListener('click', copyCityLink);

metricBtn.addEventListener('click', () => setUnits('metric'));
imperialBtn.addEventListener('click', () => setUnits('imperial'));

// Press "/" to get to the search box from anywhere on the page.
//
// This app is one text field and a lot of readings, and the field is the
// only thing on it anybody types into — but reaching it still meant taking a
// hand off the keyboard. The slash is the shortcut every search box on the
// web already answers to, so it needs no explaining.
//
// Ignored while something is already being typed into, or the key would land
// in the box as a character instead of taking you to it. Modifier
// combinations are left alone too: they belong to the browser.
function isTyping() {
    const typing = document.activeElement;

    return Boolean(
        typing && (typing.tagName === 'INPUT' || typing.tagName === 'TEXTAREA' || typing.isContentEditable)
    );
}

document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping()) return;

    event.preventDefault();
    cityInput.focus();
    // Selected rather than cleared: the box holds the city on screen, and
    // somebody reaching for search usually wants a different one, but not
    // always. Typing replaces it, and an arrow key keeps it.
    cityInput.select();
});

// Press "u" to swap °C and °F.
//
// Comparing a reading against a friend's "it's 70 out!" means flipping the
// switch, reading, and flipping it back - three trips to a small pill at the
// top of the card. The key does it from wherever the eye already is. Same
// guards as the slash: never while typing, never with a modifier held.
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'u' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping()) return;

    setUnits(units === 'imperial' ? 'metric' : 'imperial');
});

// Press "r" for a newer reading of the city on screen.
//
// The refresh button sits at the end of the small "updated" line, the least
// reachable spot on the card - and checking again is something people do
// repeatedly while watching a storm come in. Same guards as the other keys,
// and ignored while a lookup is still in flight so holding the key down does
// not send a request per keystroke.
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'r' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping() || searchBtn.disabled) return;

    refreshNow();
});

// Press "l" for the weather where you are.
//
// The crosshairs sit at the far end of the search box, and "what is it like
// here" is the question most visits open with. Same guards as the other
// keys, and ignored while the browser is still working out the position or
// a lookup is in flight, so a second press does not stack another prompt.
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'l' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping() || locateBtn.disabled || searchBtn.disabled) return;

    locateMe();
});

// Press "h" to go back to the pinned home city.
//
// Looking up somewhere else - where a friend lives, where the weekend is -
// leaves the card on that city, and getting home again meant finding its
// chip and clicking it. A pin already says which city is home, so one key
// can take you there. Same guards as the other keys; with nothing pinned
// there is no home to go to and the key does nothing.
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'h' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping() || searchBtn.disabled) return;

    const home = recallHome();

    if (!home) return;

    cityInput.value = home;
    checkWeather(home);
});

// Press "s" to copy a link to the city on screen.
//
// Sending someone the weather where they are going meant reaching up to the
// small link icon beside the name. Same guards as the other keys; while the
// icon is hidden there is no city in the address bar yet, so there is
// nothing worth copying and the key does nothing.
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 's' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping() || shareBtn.hidden) return;

    copyCityLink();
});

cityInput.closest('.search-box').addEventListener('animationend', (event) => {
    event.currentTarget.classList.remove('is-empty');
});

// With reduced motion there is no animation to end, so the outline goes as
// soon as something is typed instead.
cityInput.addEventListener('input', () => {
    cityInput.closest('.search-box').classList.remove('is-empty');
});

cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        checkWeather(cityInput.value);
    }

    // The way back out, for anyone who arrived by keyboard and changed
    // their mind. Half a new name left in the box afterwards read as though
    // it were the city on the card, so the name on the card goes back in.
    if (event.key === 'Escape') {
        if (lastReading?.name) cityInput.value = lastReading.name;
        cityInput.blur();
    }
});

// A marker drawn at noon is wrong by the afternoon, and a tab left open all
// day is the normal way this app gets used. Redrawing on a timer keeps it
// true without another lookup.
setInterval(() => {
    if (lastReading) {
        renderDaylight(lastReading);
        // A clock that froze at the minute the card arrived would be worse
        // than no clock: it looks live and is not.
        renderLocalTime(lastReading);
        renderReadingAge();
    }
}, DAYLIGHT_TICK_MS);

// The other half of that problem: the marker can be redrawn from arithmetic,
// but the temperature cannot. A tab left open since this morning is showing
// this morning's weather, and coming back to it is exactly the moment
// somebody reads the number again - so that is the moment to check it is
// still true. Only then, too: refreshing on a timer would spend requests all
// day redrawing a card nobody is looking at.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!lastQuery || !lastReadingAt) return;
    if (Date.now() - lastReadingAt < STALE_AFTER_MS) return;

    loadWeather(lastQuery);
});

// Bring back the last city that was looked up so a return visit opens on
// something useful instead of the empty placeholder card.
renderUnitSwitch();
refreshReadout();

const recentCities = recallCities();
renderRecent(recentCities);

// A link naming a city outranks both: somebody following one asked for that
// city specifically, and answering with the recipient's own home town would
// be answering a different question. Below that, a pinned city is what this
// app is for, and the most recent search is only where it happened to be
// left.
const openingCity = cityFromUrl() || recallHome() || recentCities[0];

if (openingCity) {
    cityInput.value = openingCity;

    // Paint the last reading for this city before asking the network for a
    // new one. On a good connection it is replaced a moment later and nobody
    // notices; on a bad one it is the difference between opening the app to
    // the weather and opening it to a row of dashes.
    const cached = recallReading();
    const openingQuery = `q=${encodeURIComponent(openingCity.trim())}`;

    if (cached && cached.query === openingQuery) {
        lastReading = cached.data;
        lastReadingAt = cached.at;
        lastQuery = cached.query;
        // Dated rather than announced as offline. Nothing has failed yet -
        // the request this is standing in for has not even been sent.
        renderWeather(cached.data);
    }

    checkWeather(openingCity);
}

// The connection coming back is the moment the card can stop apologising,
// and it is a moment nobody should have to notice and act on themselves.
window.addEventListener('online', () => {
    if (offline && lastQuery) loadWeather(lastQuery);
});
