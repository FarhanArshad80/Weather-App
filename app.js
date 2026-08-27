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

// Toggles the search button between its idle icon and a spinner
function setLoading(isLoading) {
    searchBtn.disabled = isLoading;
    searchBtn.classList.toggle('loading', isLoading);
    searchBtn.innerHTML = isLoading
        ? '<i class="fa-solid fa-spinner"></i>'
        : '<i class="fa-solid fa-magnifying-glass"></i>';
}

async function checkWeather(city) {
    if (!city.trim()) return;

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`;

    setLoading(true);

    try {
        const response = await fetch(url);
        const data = await response.json();

        // SAFETY CHECK: If response is not successful (anything other than 200)
        if (data.cod !== 200 && data.cod !== "200") {
            weatherBox.style.display = 'none';
            weatherDetails.style.display = 'none';
            errorBox.style.display = 'block';
            
            // Customize error text based on what went wrong
            if (data.cod === 401 || data.cod === "401") {
                errorBox.innerHTML = "<p>API Key Activation Pending.<br><small>New keys take 1-2 hours to activate. Please try again later!</small></p>";
            } else {
                errorBox.innerHTML = "<p>Oops! City not found. Try again.</p>";
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

    } catch (error) {
        console.error("Error fetching weather data: ", error);
        alert("Network error or server down. Please try again.");
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