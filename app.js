// Grab DOM elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const weatherBox = document.getElementById('weather-box');
const weatherDetails = document.getElementById('weather-details');
const errorBox = document.getElementById('error-box');
const recentBox = document.getElementById('recent-searches');

const tempEl = document.getElementById('temp');
const descEl = document.getElementById('description');
const locEl = document.getElementById('location');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const feelsLikeEl = document.getElementById('feels-like');
const pressureEl = document.getElementById('pressure');
const iconEl = document.getElementById('weather-icon');

// Your active API key
const API_KEY = 'dfa121f8ce06e9d26b31b58ed5795778'; 

// Where past searches are remembered between visits. LAST_CITY_KEY is what
// earlier versions wrote; it is still read once so nobody loses their city
// when the list format arrives.
const RECENT_KEY = 'weather-app:recent-cities';
const LAST_CITY_KEY = 'weather-app:last-city';
const MAX_RECENT = 5;

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
    weatherBox.style.display = 'none';
    weatherDetails.style.display = 'none';
    errorBox.style.display = 'block';
    errorBox.innerHTML = html;
}

async function checkWeather(city) {
    const query = city.trim();
    if (!query) return;

    // Names like "New York" or "Washington, D.C." need escaping before they
    // can be dropped into the query string.
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&appid=${API_KEY}`;

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

        // If successful, hide error and reveal data layouts
        errorBox.style.display = 'none';
        weatherBox.style.display = 'block';
        weatherDetails.style.display = 'grid';

        // Update values safely in UI
        tempEl.innerHTML = `${Math.round(data.main.temp)}°C`;
        descEl.innerHTML = data.weather[0].description;
        locEl.innerHTML = `${data.name}, ${data.sys.country}`;
        humidityEl.innerHTML = `${data.main.humidity}%`;
        windEl.innerHTML = `${Math.round(data.wind.speed * 3.6)} km/h`;
        feelsLikeEl.innerHTML = `${Math.round(data.main.feels_like)}°C`;
        pressureEl.innerHTML = `${data.main.pressure} hPa`;

        const iconCode = data.weather[0].icon;
        iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        // Only a city the API actually resolved is worth restoring next time
        rememberCity(data.name);

    } catch (error) {
        console.error("Error fetching weather data: ", error);
        showError("<p>Couldn't reach the weather service.<br><small>Check your connection and try again.</small></p>");
    } finally {
        setLoading(false);
    }
}

// Event Listeners
searchBtn.addEventListener('click', () => {
    checkWeather(cityInput.value);
});

cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        checkWeather(cityInput.value);
    }
});

// Bring back the last city that was looked up so a return visit opens on
// something useful instead of the empty placeholder card.
const recentCities = recallCities();
renderRecent(recentCities);

if (recentCities.length > 0) {
    cityInput.value = recentCities[0];
    checkWeather(recentCities[0]);
}
