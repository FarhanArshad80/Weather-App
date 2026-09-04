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
const forecastBox = document.getElementById('forecast');
const forecastStrip = document.getElementById('forecast-strip');

// Your active API key
const API_KEY = 'dfa121f8ce06e9d26b31b58ed5795778'; 

// Where past searches are remembered between visits. LAST_CITY_KEY is what
// earlier versions wrote; it is still read once so nobody loses their city
// when the list format arrives.
const RECENT_KEY = 'weather-app:recent-cities';
const LAST_CITY_KEY = 'weather-app:last-city';
const UNIT_KEY = 'weather-app:units';
const MAX_RECENT = 5;
const MAX_FORECAST_DAYS = 5;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Readings always come back from the API in metric and are converted here,
// so switching units redraws the card instead of costing another request.
let units = recallUnits();
let lastReading = null;
let lastForecast = null;

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

// The API reports wind in metres per second whatever the units asked for.
function windText(metresPerSecond) {
    return units === 'imperial'
        ? `${Math.round(metresPerSecond * 2.237)} mph`
        : `${Math.round(metresPerSecond * 3.6)} km/h`;
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

// Draws one chip per remembered city; clicking a chip searches it again.
function renderRecent(cities) {
    recentBox.innerHTML = '';
    recentBox.hidden = cities.length === 0;

    cities.forEach((city) => {
        const chip = document.createElement('button');

        chip.type = 'button';
        chip.className = 'recent-chip';
        chip.textContent = city;
        chip.addEventListener('click', () => {
            cityInput.value = city;
            checkWeather(city);
        });

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
    weatherBox.style.display = 'none';
    weatherDetails.style.display = 'none';
    errorBox.style.display = 'block';
    errorBox.innerHTML = html;
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
    windEl.innerHTML = windText(data.wind.speed);
    feelsLikeEl.innerHTML = temperatureText(data.main.feels_like);
    pressureEl.innerHTML = `${data.main.pressure} hPa`;
    sunriseEl.innerHTML = clockText(data.sys.sunrise, data.timezone);
    sunsetEl.innerHTML = clockText(data.sys.sunset, data.timezone);

    iconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
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
        };

        day.min = Math.min(day.min, entry.main.temp_min);
        day.max = Math.max(day.max, entry.main.temp_max);

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
        forecastStrip.appendChild(tile);
    });
}

function hideForecast() {
    lastForecast = null;
    forecastStrip.innerHTML = '';
    forecastBox.hidden = true;
}

// A second request for a nice-to-have: if it fails the card above it is
// still correct, so the strip simply stays out of the way rather than
// turning a working lookup into an error.
async function loadForecast(query) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?${query}&units=metric&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (String(data.cod) !== '200' || !Array.isArray(data.list)) {
            hideForecast();
            return;
        }

        lastForecast = summariseForecast(data);
        renderForecast(lastForecast);
    } catch (error) {
        console.error('Error fetching forecast data: ', error);
        hideForecast();
    }
}

// Redraws whatever the card is currently showing — a real reading, or the
// placeholder, which should not advertise units the switch says are off.
function refreshReadout() {
    if (lastForecast) {
        renderForecast(lastForecast);
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

    setLoading(true);

    try {
        const response = await fetch(url);
        const data = await response.json();

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
        renderWeather(data);

        // Only a city the API actually resolved is worth restoring next time
        rememberCity(data.name);

        // Deliberately not awaited: the strip fills itself in a moment later
        // rather than holding the reading everyone came for.
        loadForecast(query);

    } catch (error) {
        console.error("Error fetching weather data: ", error);
        showError("<p>Couldn't reach the weather service.<br><small>Check your connection and try again.</small></p>");
    } finally {
        setLoading(false);
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

metricBtn.addEventListener('click', () => setUnits('metric'));
imperialBtn.addEventListener('click', () => setUnits('imperial'));

cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        checkWeather(cityInput.value);
    }
});

// Bring back the last city that was looked up so a return visit opens on
// something useful instead of the empty placeholder card.
renderUnitSwitch();
refreshReadout();

const recentCities = recallCities();
renderRecent(recentCities);

if (recentCities.length > 0) {
    cityInput.value = recentCities[0];
    checkWeather(recentCities[0]);
}
