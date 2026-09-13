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
const readingAgeEl = document.getElementById('reading-age');
const feelsNoteEl = document.getElementById('feels-note');

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
// When the reading on screen came back, and the query that produced it. The
// card itself cannot answer either: `data.dt` is when the station measured,
// not when we asked, and the name in the card has already been through the
// API once and is not always what should be sent back to it - a lookup by
// coordinates must refresh by coordinates, or "here" turns into the nearest
// city the first answer happened to be filed under.
let lastReadingAt = null;
let lastQuery = null;

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
    hideForecast();
    hideAirQuality();
    hideDaylight();

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
    readingAgeEl.textContent = age < FRESH_UNDER_MS
        ? 'Updated just now'
        : `Updated ${durationText(age / 1000)} ago`;

    // Past the age the app refreshes itself at, the line stops being a
    // timestamp and starts being a caveat - it only gets this old when a
    // refresh was tried and did not land, or nobody has been back to the tab.
    readingAgeEl.classList.toggle('is-stale', age >= STALE_AFTER_MS);
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
    locEl.innerHTML = `${data.name}, ${data.sys.country}`;
    humidityEl.innerHTML = `${data.main.humidity}%`;
    windEl.textContent = windText(data.wind.speed, data.wind.deg);

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
    pressureEl.innerHTML = `${data.main.pressure} hPa`;
    sunriseEl.innerHTML = clockText(data.sys.sunrise, data.timezone);
    sunsetEl.innerHTML = clockText(data.sys.sunset, data.timezone);

    iconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

    renderDaylight(data);
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
            min: entry.main.temp_min,
            max: entry.main.temp_max,
            icon: entry.weather[0].icon,
            description: entry.weather[0].description,
            hoursFromNoon: Infinity,
            rainChance: 0,
        };

        day.min = Math.min(day.min, entry.main.temp_min);
        day.max = Math.max(day.max, entry.main.temp_max);

        // `pop` is the chance of rain in that one three-hour block. Keeping
        // the highest of the day answers the question people are really
        // asking - whether to take a coat at all - where an average across
        // eight blocks would quietly bury a downpour at teatime.
        if (typeof entry.pop === 'number') {
            day.rainChance = Math.max(day.rainChance, entry.pop);
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
            rainChance: typeof entry.pop === 'number' ? entry.pop : 0,
        }));
}

// The one sentence worth putting above the tiles: when the rain arrives, or
// that it does not. Reading it off the tiles means comparing six percentages
// against a threshold, which is work the app can do instead.
function rainNote(hours) {
    const soaking = hours.find((hour) => Math.round(hour.rainChance * 100) >= RAIN_CHANCE_FLOOR);

    if (!soaking) return 'Nothing wet expected in the next few hours';

    const chance = Math.round(soaking.rainChance * 100);

    // The first block is not a forecast of something coming, it is now.
    if (soaking === hours[0]) {
        return `Rain around now — ${chance}% chance`;
    }

    return `Rain likely from ${soaking.label} — ${chance}% chance`;
}

function renderHours(hours) {
    hourlyStrip.innerHTML = '';
    hourlyBox.hidden = hours.length === 0;

    if (hours.length === 0) return;

    hourlyNoteEl.textContent = rainNote(hours);

    hours.forEach((hour) => {
        const tile = document.createElement('div');
        tile.className = 'hour-tile';

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
            rain.title = `${chance}% chance of rain`;
            tile.appendChild(rain);
        }

        hourlyStrip.appendChild(tile);
    });
}

function hideHours() {
    lastHours = null;
    hourlyStrip.innerHTML = '';
    hourlyBox.hidden = true;
}

// Draws one tile per upcoming day. Temperatures go through the same
// converter as the main card, so the unit switch moves the strip with it.
function renderForecast(days) {
    forecastStrip.innerHTML = '';
    forecastBox.hidden = days.length === 0;

    days.forEach((day) => {
        const tile = document.createElement('div');
        tile.className = 'forecast-day';

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

        tile.append(label, icon, range);

        // A dry day should not carry a "0%" that has to be read before it can
        // be dismissed; the line is only drawn once rain is worth mentioning.
        const chance = Math.round(day.rainChance * 100);

        if (chance >= RAIN_CHANCE_FLOOR) {
            const rain = document.createElement('p');
            rain.className = 'forecast-rain';
            rain.textContent = `${chance}%`;
            rain.title = `${chance}% chance of rain`;
            tile.appendChild(rain);
        }

        forecastStrip.appendChild(tile);
    });
}

function hideForecast() {
    lastForecast = null;
    forecastStrip.innerHTML = '';
    forecastBox.hidden = true;
    // Both strips are drawn from the same response, so a forecast that could
    // not be read leaves neither of them standing with stale numbers on it.
    hideHours();
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
    } catch (error) {
        console.error('Error fetching forecast data: ', error);

        // Only the current lookup may clear the strips. An abandoned request
        // failing is not a reason to take down panels that belong to the
        // reading now on screen.
        if (isCurrent(ticket)) hideForecast();
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

// Redraws whatever the card is currently showing — a real reading, or the
// placeholder, which should not advertise units the switch says are off.
function refreshReadout() {
    if (lastForecast) {
        renderForecast(lastForecast);
    }

    if (lastHours) {
        renderHours(lastHours);
    }

    if (lastReading) {
        renderWeather(lastReading);
        return;
    }

    const symbol = units === 'imperial' ? 'F' : 'C';

    tempEl.innerHTML = `--°${symbol}`;
    feelsLikeEl.innerHTML = `--°${symbol}`;
    windEl.innerHTML = units === 'imperial' ? '-- mph' : '-- km/h';
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
async function loadWeather(query) {
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
            } else {
                showError("<p>Oops! City not found. Try again.</p>");
            }
            return;
        }

        lastReading = data;
        lastReadingAt = Date.now();
        // Kept as asked, not as answered, so a refresh repeats the same
        // question - see the note by the declaration.
        lastQuery = query;
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

    } catch (error) {
        console.error("Error fetching weather data: ", error);

        if (isCurrent(ticket)) {
            showError("<p>Couldn't reach the weather service.<br><small>Check your connection and try again.</small></p>");
        }
    } finally {
        // The spinner belongs to the lookup still running. Switching it off
        // from an abandoned one leaves the button idle over a search that
        // has not answered yet.
        if (isCurrent(ticket)) setLoading(false);
    }
}

function checkWeather(city) {
    const query = city.trim();
    if (!query) return;

    // Names like "New York" or "Washington, D.C." need escaping before they
    // can be dropped into the query string.
    return loadWeather(`q=${encodeURIComponent(query)}`);
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
shareBtn.addEventListener('click', copyCityLink);

metricBtn.addEventListener('click', () => setUnits('metric'));
imperialBtn.addEventListener('click', () => setUnits('imperial'));

cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        checkWeather(cityInput.value);
    }
});

// A marker drawn at noon is wrong by the afternoon, and a tab left open all
// day is the normal way this app gets used. Redrawing on a timer keeps it
// true without another lookup.
setInterval(() => {
    if (lastReading) {
        renderDaylight(lastReading);
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
    checkWeather(openingCity);
}
