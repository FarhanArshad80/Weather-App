// Grab DOM elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const weatherBox = document.getElementById('weather-box');
const weatherDetails = document.getElementById('weather-details');
const errorBox = document.getElementById('error-box');

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

// Where the most recent successful search is remembered between visits
const LAST_CITY_KEY = 'weather-app:last-city';

// localStorage throws in private windows and when site data is blocked, so
// every read and write has to survive on its own.
function rememberCity(city) {
    try {
        localStorage.setItem(LAST_CITY_KEY, city);
    } catch (error) {
        /* storage unavailable - the app still works, it just forgets */
    }
}

function recallCity() {
    try {
        return localStorage.getItem(LAST_CITY_KEY);
    } catch (error) {
        return null;
    }
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
const lastCity = recallCity();
if (lastCity) {
    cityInput.value = lastCity;
    checkWeather(lastCity);
}
