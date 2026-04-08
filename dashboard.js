// Weather API configuration
const WEATHER_API_KEY = 'dcbc2be1c63fdc0f1a8e5328afe6bf5c';

// Country, state, and city data
const COUNTRIES = [
    {
        name: "India",
        code: "IN",
        states: [
            {
                name: "Tamil Nadu",
                cities: ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirapalli"]
            },
            {
                name: "Karnataka",
                cities: ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum"]
            },
            {
                name: "Maharashtra",
                cities: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik"]
            },
            {
                name: "Uttar Pradesh",
                cities: ["Lucknow", "Kanpur", "Agra", "Varanasi", "Allahabad"]
            },
            {
                name: "Delhi",
                cities: ["New Delhi", "Delhi", "Ghaziabad", "Faridabad", "Noida"]
            }
        ]
    },
    {
        name: "United States",
        code: "US",
        states: [
            {
                name: "California",
                cities: ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Fresno"]
            },
            {
                name: "Texas",
                cities: ["Houston", "Austin", "Dallas", "San Antonio", "Fort Worth"]
            },
            {
                name: "New York",
                cities: ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse"]
            },
            {
                name: "Florida",
                cities: ["Miami", "Orlando", "Tampa", "Jacksonville", "St. Petersburg"]
            },
            {
                name: "Illinois",
                cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford"]
            }
        ]
    },
    {
        name: "United Kingdom",
        code: "GB",
        states: [
            {
                name: "England",
                cities: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"]
            },
            {
                name: "Scotland",
                cities: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness"]
            },
            {
                name: "Wales",
                cities: ["Cardiff", "Swansea", "Newport", "Bangor", "St Asaph"]
            },
            {
                name: "Northern Ireland",
                cities: ["Belfast", "Londonderry", "Armagh", "Newry", "Lisburn"]
            }
        ]
    }
];

// Smart Farming Dashboard Implementation
document.addEventListener('DOMContentLoaded', function() {
    const dashboardSection = document.getElementById('dashboard');
    
    // Show dashboard by default for testing
    dashboardSection.style.display = 'block';
    
    // Initialize soil type options
    updateSoilTypeOptions();
    
    // Initialize with test user data
    const testUser = {
        username: 'testuser',
        region: 'Punjab',
        location: {
            latitude: 31.1471,
            longitude: 75.3412
        },
        fieldConditions: {
            temperature: 25,
            waterLevel: 'medium',
            soilCondition: 'good'
        }
    };
    
    initializeSmartDashboard(testUser);
    
    // Setup location dropdowns
    populateCountryDropdown();
    setupWeatherSearch();
});

function initializeSmartDashboard(user) {
    // Initialize all components
    setupLocationBasedFeatures(user);
    setupRealTimeMonitoring();
    setupIrrigationSystem();
    setupWeatherMonitoring();
    setupCropRecommendations(user);
}

function setupLocationBasedFeatures(user) {
    // Get region-specific sensor parameters
    const regionSensors = initializeRegionSensors('Chennai');
    
    // Update location information
    const locationInfo = document.getElementById('locationInfo');
    if (locationInfo) {
        locationInfo.innerHTML = `
            <h4>Location Information</h4>
            <p><strong>Region:</strong> Chennai</p>
            <p><strong>Coordinates:</strong> 13.0827, 80.2707</p>
            <p><strong>Climate:</strong> Tropical</p>
            <p><strong>Soil Type:</strong> Alluvial</p>
        `;
    }
    
    // Initialize sensors with region-specific ranges
    initializeSensors(regionSensors);
    
    // Update crop recommendations based on region
    updateCropRecommendations('Chennai');
}

function setupRealTimeMonitoring() {
    // Update sensor data every 5 seconds
    setInterval(updateSensorData, 5000);
    updateSensorData(); // Initial update
}

function updateSensorData() {
    // Simulate sensor data (in a real application, this would come from actual sensors)
    const sensorData = {
        temperature: (Math.random() * 10 + 20).toFixed(1), // 20-30°C
        soilMoisture: (Math.random() * 30 + 50).toFixed(1), // 50-80%
        humidity: (Math.random() * 20 + 60).toFixed(1), // 60-80%
        light: (Math.random() * 1000 + 1000).toFixed(1), // 1000-2000 lux
        soilPh: (Math.random() * 2 + 6).toFixed(1) // 6-8 pH
    };

    // Update UI with sensor data
    document.getElementById('temperatureValue').textContent = `${sensorData.temperature}°C`;
    document.getElementById('soilMoistureValue').textContent = `${sensorData.soilMoisture}%`;
    document.getElementById('humidityValue').textContent = `${sensorData.humidity}%`;
    if(document.getElementById('lightValue')) document.getElementById('lightValue').textContent = `${sensorData.light} lux`;
    if(document.getElementById('soilPhValue')) document.getElementById('soilPhValue').textContent = sensorData.soilPh;

    // Update recommendations based on sensor data
    updateCropRecommendations(sensorData);
}

function updateMoistureIndicator(value) {
    const moistureBar = document.getElementById('soilMoistureBar');
    if (!moistureBar) return; // Return early if element doesn't exist
    
    moistureBar.style.width = `${value}%`;
    moistureBar.className = `progress-bar ${getMoistureClass(value)}`;
}

function getMoistureClass(value) {
    if (value < 30) return 'bg-danger';
    if (value < 60) return 'bg-warning';
    return 'bg-success';
}

function setupIrrigationSystem() {
    const modeSelect = document.getElementById('irrigationMode');
    const timerSettings = document.getElementById('timerSettings');
    const startButton = document.getElementById('startIrrigation');
    const stopButton = document.getElementById('stopIrrigation');
    const scheduleList = document.getElementById('irrigationSchedule');

    if (!modeSelect || !timerSettings || !startButton || !stopButton || !scheduleList) {
        console.error('Required irrigation elements not found');
        return;
    }

    // Mode selection handler
    modeSelect.addEventListener('change', function() {
        const mode = this.value;
        timerSettings.style.display = mode === 'timer' ? 'block' : 'none';
        if (mode === 'automatic') {
            startAutomaticIrrigation();
        }
    });

    // Manual control handlers
    startButton.addEventListener('click', () => {
        startManualIrrigation();
        startButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
    });

    stopButton.addEventListener('click', () => {
        stopIrrigation();
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
    });

    // Timer settings handler
    const addScheduleButton = document.getElementById('addSchedule');
    if (addScheduleButton) {
        addScheduleButton.addEventListener('click', () => {
            const time = document.getElementById('irrigationTime').value;
            const duration = document.getElementById('irrigationDuration').value;
            if (time && duration) {
                addIrrigationSchedule(time, duration);
                updateScheduleList(scheduleList);
            }
        });
    }
}

const INDIAN_CITIES = {
    'Delhi': { lat: 28.6139, lon: 77.2090 },
    'Mumbai': { lat: 19.0760, lon: 72.8777 },
    'Bangalore': { lat: 12.9716, lon: 77.5946 },
    'Chennai': { lat: 13.0827, lon: 80.2707 },
    'Kolkata': { lat: 22.5726, lon: 88.3639 }
};

// Function to fetch weather data from OpenWeatherMap API
function fetchWeatherData(city) {
    const apiKey = WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;

    console.log('Fetching weather data from URL:', url); // Debugging log

    fetch(url)
        .then(response => {
            console.log('Response status:', response.status); // Debugging log
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Weather data received:', data); // Debugging log
            updateWeatherUI(data);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            const weatherSection = document.getElementById('weatherForecast');
            if (weatherSection) {
                weatherSection.innerHTML = '<p>Unable to fetch weather data. Please try again later.</p>';
            }
        });
}

// Function to update weather UI
function updateWeatherUI(weatherData) {
    if (!weatherData || !weatherData.list || weatherData.list.length === 0) {
        console.error('No weather data to display');
        return;
    }

    const weatherContainer = document.getElementById('weatherForecast');
    if (!weatherContainer) {
        console.error('Weather container not found');
        return;
    }

    // Get the first forecast item (current weather)
    const currentWeather = weatherData.list[0];
    const cityName = weatherData.city.name;
    const countryCode = weatherData.city.country;

    // Create current weather HTML
    let weatherHTML = `
        <div class="col-md-12 mb-4">
            <div class="weather-card current-weather">
                <h3>Current Weather: ${cityName}, ${countryCode}</h3>
                <div class="d-flex align-items-center justify-content-around">
                    <div class="weather-icon">
                        <img src="http://openweathermap.org/img/wn/${currentWeather.weather[0].icon}@2x.png" alt="${currentWeather.weather[0].description}">
                    </div>
                    <div class="weather-details">
                        <h4>${currentWeather.main.temp}°C</h4>
                        <p><strong>Feels like:</strong> ${currentWeather.main.feels_like}°C</p>
                        <p><strong>Humidity:</strong> ${currentWeather.main.humidity}%</p>
                        <p><strong>Wind:</strong> ${currentWeather.wind.speed} m/s</p>
                        <p><strong>Condition:</strong> ${currentWeather.weather[0].description}</p>
                        <p>${new Date(currentWeather.dt * 1000).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add 5-day forecast section
    weatherHTML += `
        <div class="col-md-12">
            <h4 class="mb-3">5-Day Forecast</h4>
            <div class="row">
    `;

    // Get forecasts for the next 5 days (excluding today)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison
    
    // Group forecasts by day
    const forecastsByDay = {};
    
    // Process all forecasts
    weatherData.list.forEach(forecast => {
        const forecastDate = new Date(forecast.dt * 1000);
        forecastDate.setHours(0, 0, 0, 0); // Set to beginning of day for comparison
        
        // Skip forecasts for today
        if (forecastDate.getTime() === today.getTime()) {
            return;
        }
        
        // Format date as a string for grouping
        const dateKey = forecastDate.toISOString().split('T')[0];
        
        // Take the forecast closest to noon for each day (typically most representative)
        if (!forecastsByDay[dateKey] || 
            Math.abs(new Date(forecast.dt * 1000).getHours() - 12) < 
            Math.abs(new Date(forecastsByDay[dateKey].dt * 1000).getHours() - 12)) {
            forecastsByDay[dateKey] = forecast;
        }
    });
    
    // Sort dates and take only the next 5
    const nextFiveDays = Object.keys(forecastsByDay)
        .sort()
        .slice(0, 5);
    
    // Create forecast cards for each of the next 5 days
    nextFiveDays.forEach(dateKey => {
        const forecast = forecastsByDay[dateKey];
        const forecastDate = new Date(dateKey);
        
        weatherHTML += `
            <div class="col">
                <div class="weather-card forecast-card">
                    <div class="text-center">
                        <p><strong>${forecastDate.toLocaleDateString('en-US', { weekday: 'long' })}</strong></p>
                        <p class="small">${forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <div class="weather-icon">
                            <img src="http://openweathermap.org/img/wn/${forecast.weather[0].icon}.png" alt="${forecast.weather[0].description}">
                        </div>
                        <h5>${forecast.main.temp}°C</h5>
                        <p>${forecast.weather[0].description}</p>
                    </div>
                </div>
            </div>
        `;
    });

    weatherHTML += `
            </div>
        </div>
    `;

    weatherContainer.innerHTML = weatherHTML;
}

// Function to handle weather search
function setupWeatherSearch() {
    const searchButton = document.getElementById('searchWeather');
    const cropSuggestionsButton = null; // removed
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const citySelect = document.getElementById('citySelect');
            const countrySelect = document.getElementById('countrySelect');
            const stateSelect = document.getElementById('stateSelect');
            
            if (citySelect && citySelect.value) {
                const city = citySelect.value;
                fetchWeatherData(city);
            } else {
                alert('Please select a city first');
            }
        });
    }
    

}

// Function to update crop recommendations based on location
function updateLocationBasedCropRecommendations(countryCode, state, city) {
    const recommendations = getLocationBasedCropRecommendations(countryCode, state, city);
    const cropsList = document.getElementById('recommendedCrops');
    
    if (cropsList && recommendations.length > 0) {
        cropsList.innerHTML = recommendations.map(crop => `
            <div class="col-md-6 mb-3">
                <div class="crop-card">
                    <h5>${crop.name}</h5>
                    <p><strong>Season:</strong> ${crop.season}</p>
                    <p><strong>Water Requirement:</strong> ${crop.waterRequirement}</p>
                    <p><strong>Soil Type:</strong> ${crop.soilType}</p>
                    <p><strong>Yield Potential:</strong> ${crop.yieldPotential}</p>
                </div>
            </div>
        `).join('');
    } else {
        cropsList.innerHTML = '<p>No crop recommendations available for this location.</p>';
    }
}

// Function to get crop recommendations based on location
function getLocationBasedCropRecommendations(countryCode, state, city) {
    // Define crop recommendations based on location
    const locationCrops = {
        // India
        'IN': {
            'Tamil Nadu': {
                'Chennai': [
                    { name: 'Rice', season: 'Kharif', waterRequirement: 'High', soilType: 'Alluvial', yieldPotential: 'High' },
                    { name: 'Sugarcane', season: 'Year-round', waterRequirement: 'High', soilType: 'Alluvial', yieldPotential: 'High' },
                    { name: 'Groundnut', season: 'Kharif', waterRequirement: 'Medium', soilType: 'Red Soil', yieldPotential: 'Medium' }
                ],
                'Coimbatore': [
                    { name: 'Cotton', season: 'Kharif', waterRequirement: 'Medium', soilType: 'Black Soil', yieldPotential: 'High' },
                    { name: 'Maize', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Red Soil', yieldPotential: 'High' },
                    { name: 'Turmeric', season: 'Kharif', waterRequirement: 'Medium', soilType: 'Red Soil', yieldPotential: 'High' }
                ],
                'default': [
                    { name: 'Rice', season: 'Kharif', waterRequirement: 'High', soilType: 'Alluvial', yieldPotential: 'High' },
                    { name: 'Sugarcane', season: 'Year-round', waterRequirement: 'High', soilType: 'Alluvial', yieldPotential: 'High' }
                ]
            },
            'Karnataka': {
                'Bangalore': [
                    { name: 'Ragi', season: 'Kharif', waterRequirement: 'Low', soilType: 'Red Soil', yieldPotential: 'Medium' },
                    { name: 'Pulses', season: 'Rabi', waterRequirement: 'Low', soilType: 'Red Soil', yieldPotential: 'Medium' },
                    { name: 'Vegetables', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Red Soil', yieldPotential: 'High' }
                ],
                'default': [
                    { name: 'Rice', season: 'Kharif', waterRequirement: 'High', soilType: 'Red Soil', yieldPotential: 'Medium' },
                    { name: 'Millets', season: 'Kharif', waterRequirement: 'Low', soilType: 'Red Soil', yieldPotential: 'Medium' }
                ]
            },
            'Maharashtra': {
                'Mumbai': [
                    { name: 'Rice', season: 'Kharif', waterRequirement: 'High', soilType: 'Coastal Alluvial', yieldPotential: 'Medium' },
                    { name: 'Kokum', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Laterite', yieldPotential: 'Medium' }
                ],
                'Pune': [
                    { name: 'Jowar', season: 'Kharif', waterRequirement: 'Low', soilType: 'Black Soil', yieldPotential: 'Medium' },
                    { name: 'Sugarcane', season: 'Year-round', waterRequirement: 'High', soilType: 'Black Soil', yieldPotential: 'High' },
                    { name: 'Onion', season: 'Rabi', waterRequirement: 'Medium', soilType: 'Black Soil', yieldPotential: 'High' }
                ],
                'default': [
                    { name: 'Cotton', season: 'Kharif', waterRequirement: 'Medium', soilType: 'Black Soil', yieldPotential: 'Medium' },
                    { name: 'Soybean', season: 'Kharif', waterRequirement: 'Medium', soilType: 'Black Soil', yieldPotential: 'Medium' }
                ]
            },
            'default': [
                { name: 'Rice', season: 'Kharif', waterRequirement: 'High', soilType: 'Alluvial', yieldPotential: 'High' },
                { name: 'Wheat', season: 'Rabi', waterRequirement: 'Medium', soilType: 'Alluvial', yieldPotential: 'High' },
                { name: 'Pulses', season: 'Year-round', waterRequirement: 'Low', soilType: 'Various', yieldPotential: 'Medium' }
            ]
        },
        // United States
        'US': {
            'California': {
                'Los Angeles': [
                    { name: 'Citrus', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Sandy Loam', yieldPotential: 'High' },
                    { name: 'Avocado', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' }
                ],
                'San Francisco': [
                    { name: 'Wine Grapes', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' },
                    { name: 'Leafy Greens', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' }
                ],
                'default': [
                    { name: 'Almonds', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' },
                    { name: 'Grapes', season: 'Year-round', waterRequirement: 'Medium', soilType: 'Various', yieldPotential: 'High' }
                ]
            },
            'default': [
                { name: 'Corn', season: 'Summer', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' },
                { name: 'Soybean', season: 'Summer', waterRequirement: 'Medium', soilType: 'Loamy', yieldPotential: 'High' },
                { name: 'Wheat', season: 'Winter', waterRequirement: 'Medium', soilType: 'Various', yieldPotential: 'High' }
            ]
        },
        // Default recommendations
        'default': [
            { name: 'Rice', season: 'Warm Season', waterRequirement: 'High', soilType: 'Clay or Loam', yieldPotential: 'High' },
            { name: 'Wheat', season: 'Cool Season', waterRequirement: 'Medium', soilType: 'Loam or Clay', yieldPotential: 'High' },
            { name: 'Corn', season: 'Warm Season', waterRequirement: 'Medium', soilType: 'Loam', yieldPotential: 'High' }
        ]
    };

    // Get country-specific crops
    const countryCrops = locationCrops[countryCode] || locationCrops['default'];
    
    // Get state-specific crops
    const stateCrops = countryCrops[state] || countryCrops['default'];
    
    // Get city-specific crops
    const cityCrops = stateCrops[city] || stateCrops['default'];
    
    return cityCrops;
}

// Initialize weather monitoring
function setupWeatherMonitoring() {
    // Set up search button handler
    const searchButton = document.getElementById('searchWeather');
    if (searchButton) {
        // Event listener is added in setupWeatherSearch() function
        console.log('Weather monitoring initialized');
    }
}

function setupCropRecommendations(user) {
    const recommendations = getCropRecommendations(user.region);
    const cropsList = document.getElementById('recommendedCrops');
    
    if (cropsList && recommendations.length > 0) {
        cropsList.innerHTML = recommendations.map(crop => `
            <div class="col-md-6 mb-3">
                <div class="crop-card">
                    <h5>${crop.name}</h5>
                    <p><strong>Season:</strong> ${crop.season}</p>
                    <p><strong>Water Requirement:</strong> ${crop.waterRequirement}</p>
                    <p><strong>Soil Type:</strong> ${crop.soilType}</p>
                    <p><strong>Yield Potential:</strong> ${crop.yieldPotential}</p>
                </div>
            </div>
        `).join('');
    } else {
        cropsList.innerHTML = '<p>No crop recommendations available for this region.</p>';
    }
}

// Helper functions
function getRandomValue(min, max) {
    return Math.random() * (max - min) + min;
}

function getRegionSpecificInfo(region) {
    const regionData = {
        'Punjab': {
            climate: 'Semi-arid',
            soilType: 'Alluvial',
            waterAvailability: 'High',
            mainCrops: ['Wheat', 'Rice', 'Cotton'],
            coordinates: '31.1471, 75.3412'
        },
        'Rajasthan': {
            climate: 'Arid',
            soilType: 'Sandy',
            waterAvailability: 'Low',
            mainCrops: ['Bajra', 'Guar', 'Cotton'],
            coordinates: '25.1976, 75.8015'
        },
        'Maharashtra': {
            climate: 'Tropical',
            soilType: 'Black',
            waterAvailability: 'Medium',
            mainCrops: ['Sugarcane', 'Cotton', 'Soybean'],
            coordinates: '19.7515, 75.7139'
        },
        'Sindh': {
            climate: 'Semi-arid',
            soilType: 'Alluvial',
            waterAvailability: 'High',
            mainCrops: ['Wheat', 'Rice', 'Cotton'],
            coordinates: '25.0000, 69.0000'
        },
        'Khyber Pakhtunkhwa': {
            climate: 'Arid',
            soilType: 'Sandy',
            waterAvailability: 'Low',
            mainCrops: ['Bajra', 'Guar', 'Cotton'],
            coordinates: '34.0000, 72.0000'
        },
        'Balochistan': {
            climate: 'Arid',
            soilType: 'Sandy',
            waterAvailability: 'Low',
            mainCrops: ['Bajra', 'Guar', 'Cotton'],
            coordinates: '26.6475, 67.7700'
        }
    };
    return regionData[region] || regionData['Punjab'];
}

function getCropRecommendations(region) {
    // Define crop recommendations based on region
    const recommendations = {
        'Chennai': [
            {
                name: 'Rice',
                season: 'Kharif',
                waterRequirement: 'High',
                soilType: 'Alluvial',
                yieldPotential: 'High'
            },
            {
                name: 'Sugarcane',
                season: 'Year-round',
                waterRequirement: 'High',
                soilType: 'Alluvial',
                yieldPotential: 'High'
            },
            {
                name: 'Cotton',
                season: 'Kharif',
                waterRequirement: 'Medium',
                soilType: 'Alluvial',
                yieldPotential: 'Medium'
            },
            {
                name: 'Groundnut',
                season: 'Kharif',
                waterRequirement: 'Low',
                soilType: 'Alluvial',
                yieldPotential: 'Medium'
            },
            {
                name: 'Pulses',
                season: 'Rabi',
                waterRequirement: 'Low',
                soilType: 'Alluvial',
                yieldPotential: 'Medium'
            }
        ]
    };

    return recommendations[region] || recommendations['Chennai'];
}

// Alert functions
function checkSensorAlerts(sensors) {
    const alerts = [];
    
    if (sensors.temperature > 35) {
        alerts.push('High temperature alert! Consider increasing irrigation.');
    }
    if (sensors.soilMoisture < 30) {
        alerts.push('Low soil moisture! Irrigation recommended.');
    }
    if (sensors.humidity > 80) {
        alerts.push('High humidity! Watch for fungal diseases.');
    }

    displayAlerts(alerts);
}

function checkWeatherAlerts(weatherData) {
    const alerts = [];
    
    if (weatherData.precipitation > 50) {
        alerts.push('Heavy rain expected! Adjust irrigation schedule.');
    }
    if (weatherData.temperature > 35) {
        alerts.push('Heat wave warning! Increase irrigation frequency.');
    }
    if (weatherData.windSpeed > 20) {
        alerts.push('Strong winds expected! Secure crops and equipment.');
    }

    displayAlerts(alerts);
}

function displayAlerts(alerts) {
    const alertContainer = document.getElementById('alerts');
    if (alerts.length > 0) {
        alertContainer.innerHTML = alerts.map(alert => `
            <div class="alert alert-warning">
                ${alert}
            </div>
        `).join('');
        alertContainer.style.display = 'block';
    } else {
        alertContainer.style.display = 'none';
    }
}

// Irrigation control functions
function startAutomaticIrrigation() {
    console.log('Starting automatic irrigation');
    // In a real application, this would control actual irrigation hardware
    updateWaterUsage();
}

function startManualIrrigation() {
    console.log('Starting manual irrigation');
    updateWaterUsage();
}

function stopIrrigation() {
    console.log('Stopping irrigation');
}

function addIrrigationSchedule(time, duration) {
    const user = getCurrentUser();
    if (user) {
        if (!user.irrigationSettings.schedules) {
            user.irrigationSettings.schedules = [];
        }
        user.irrigationSettings.schedules.push({ time, duration });
        localStorage.setItem(user.username, JSON.stringify(user));
    }
}

function updateIrrigationSchedule(weatherData) {
    const user = getCurrentUser();
    if (user && user.irrigationSettings.schedules) {
        // Adjust schedules based on weather
        if (weatherData.precipitation > 30) {
            // Reduce irrigation duration if rain is expected
            user.irrigationSettings.schedules.forEach(schedule => {
                schedule.duration = Math.max(5, schedule.duration * 0.5);
            });
        }
        localStorage.setItem(user.username, JSON.stringify(user));
        updateScheduleList(document.getElementById('irrigationSchedule'));
    }
}

function updateScheduleList(container) {
    const user = getCurrentUser();
    if (user && user.irrigationSettings.schedules) {
        container.innerHTML = `
            <h6>Scheduled Irrigation:</h6>
            <ul class="list-group">
                ${user.irrigationSettings.schedules.map(schedule => `
                    <li class="list-group-item">
                        Time: ${schedule.time}, Duration: ${schedule.duration} minutes
                    </li>
                `).join('')}
            </ul>
        `;
    }
}

function updateWaterUsage() {
    const user = getCurrentUser();
    if (user) {
        user.irrigationSettings.waterUsage += 10; // Simulate 10 liters per irrigation cycle
        localStorage.setItem(user.username, JSON.stringify(user));
        document.getElementById('waterUsage').textContent = user.irrigationSettings.waterUsage;
    }
}

// Initialize region-specific sensors
function initializeRegionSensors(region) {
    const regionSensors = {
        'Punjab': {
            temperature: { min: 15, max: 40 },
            humidity: { min: 30, max: 80 },
            soilMoisture: { min: 20, max: 80 },
            lightIntensity: { min: 2000, max: 10000 },
            soilPh: { min: 6.0, max: 7.5 }
        },
        'Sindh': {
            temperature: { min: 20, max: 45 },
            humidity: { min: 40, max: 90 },
            soilMoisture: { min: 25, max: 85 },
            lightIntensity: { min: 2500, max: 12000 },
            soilPh: { min: 6.5, max: 8.0 }
        },
        'Khyber Pakhtunkhwa': {
            temperature: { min: 10, max: 35 },
            humidity: { min: 35, max: 85 },
            soilMoisture: { min: 15, max: 75 },
            lightIntensity: { min: 1500, max: 9000 },
            soilPh: { min: 5.5, max: 7.0 }
        },
        'Balochistan': {
            temperature: { min: 12, max: 38 },
            humidity: { min: 25, max: 70 },
            soilMoisture: { min: 10, max: 60 },
            lightIntensity: { min: 3000, max: 15000 },
            soilPh: { min: 6.0, max: 7.8 }
        }
    };

    return regionSensors[region] || regionSensors['Punjab']; // Default to Punjab if region not found
}

// Function to update soil type options based on crop selection
function updateSoilTypeOptions() {
    const cropSelect = document.getElementById('cropType');
    const soilTypeSelect = document.getElementById('soilType');
    
    if (!cropSelect || !soilTypeSelect) return;
    
    const selectedCrop = cropSelect.value;
    const soilTypes = ['clay', 'sandy', 'loamy'];
    
    soilTypeSelect.innerHTML = '<option value="">Select Soil Type</option>';
    soilTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        soilTypeSelect.appendChild(option);
    });
}

// Function to update crop recommendations based on sensor data
function updateCropRecommendations(sensorData) {
    const recommendations = getCropRecommendations(sensorData);
    const cropsList = document.getElementById('recommendedCrops');
    
    if (cropsList && recommendations.length > 0) {
        cropsList.innerHTML = recommendations.map(crop => `
            <div class="col-md-6 mb-3">
                <div class="crop-card">
                    <h5>${crop.name}</h5>
                    <p><strong>Season:</strong> ${crop.season}</p>
                    <p><strong>Water Requirement:</strong> ${crop.waterRequirement}</p>
                    <p><strong>Soil Type:</strong> ${crop.soilType}</p>
                    <p><strong>Yield Potential:</strong> ${crop.yieldPotential}</p>
                </div>
            </div>
        `).join('');
    } else {
        cropsList.innerHTML = '<p>No crop recommendations available for this region.</p>';
    }
}

// Function to get crop recommendations based on sensor data
function getCropRecommendations(sensorData) {
    // Define crop recommendations based on sensor data
    const recommendations = [
        {
            name: 'Wheat',
            season: 'Rabi',
            waterRequirement: 'Medium',
            soilType: 'Alluvial',
            yieldPotential: 'High'
        },
        {
            name: 'Rice',
            season: 'Kharif',
            waterRequirement: 'High',
            soilType: 'Alluvial',
            yieldPotential: 'High'
        },
        {
            name: 'Cotton',
            season: 'Kharif',
            waterRequirement: 'Medium',
            soilType: 'Alluvial',
            yieldPotential: 'Medium'
        }
    ];

    return recommendations;
}

function initializeSensors(regionSensors) {
    console.log('Initializing sensors with region-specific parameters:', regionSensors);
    // Add your sensor initialization logic here
}

// Function to populate country dropdown
function populateCountryDropdown() {
    const countrySelect = document.getElementById('countrySelect');
    if (!countrySelect) return;
    
    COUNTRIES.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
    });
    
    // Add event listener for country selection
    countrySelect.addEventListener('change', function() {
        populateStateDropdown(this.value);
        // Reset city dropdown when country changes
        const citySelect = document.getElementById('citySelect');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">First select a state</option>';
            citySelect.disabled = true;
        }
    });
}

// Function to populate state dropdown based on selected country
function populateStateDropdown(countryCode) {
    const stateSelect = document.getElementById('stateSelect');
    if (!stateSelect) return;
    
    // Clear existing options
    stateSelect.innerHTML = '<option value="">Select a state</option>';
    
    if (!countryCode) {
        stateSelect.disabled = true;
        return;
    }
    
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country && country.states) {
        country.states.forEach((state, index) => {
            const option = document.createElement('option');
            option.value = index; // Use index as value
            option.textContent = state.name;
            stateSelect.appendChild(option);
        });
        stateSelect.disabled = false;
        
        // Add event listener for state selection
        stateSelect.addEventListener('change', function() {
            const selectedCountry = document.getElementById('countrySelect').value;
            populateCityDropdown(selectedCountry, this.value);
        });
    }
}

// Function to populate city dropdown based on selected state
function populateCityDropdown(countryCode, stateIndex) {
    const citySelect = document.getElementById('citySelect');
    if (!citySelect) return;
    
    // Clear existing options
    citySelect.innerHTML = '<option value="">Select a city</option>';
    
    if (!countryCode || stateIndex === '') {
        citySelect.disabled = true;
        return;
    }
    
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country && country.states[stateIndex]) {
        const cities = country.states[stateIndex].cities;
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
        citySelect.disabled = false;
    }
} 