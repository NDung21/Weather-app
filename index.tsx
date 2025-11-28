/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- Interfaces ---

interface WeatherDetails {
  uvIndex: string;
  sunrise: string;
  sunset: string;
  windSpeed: number;
  windDirection: number; // Degrees
  humidity: string;
  feelsLike: string;
  visibility: string;
  pressure: number;
  precipitation: string;
  dewPoint?: string;
}

interface HourlyItem {
  time: string; // ISO String
  temp: number;
  code: number;
  isDay: number;
}

interface WeatherData {
  current: {
    temp: number;
    conditionCode: number;
    high: number;
    low: number;
    city: string;
    description: string;
    details: WeatherDetails;
    isDay: number;
    time: Date;
  };
  hourly: HourlyItem[]; // Raw full list
  daily: Array<{ 
    day: string; 
    date: string; // YYYY-MM-DD
    min: number; 
    max: number; 
    code: number; 
    details: WeatherDetails;
  }>;
  advice: string;
}

// --- Helpers ---

// Custom SVG Weather Icons to match iOS Flat Style
const WeatherIcon = ({ code, isDay = 1, className }: { code: number, isDay?: number, className?: string }) => {
  const size = "100%";
  const color = "#fff";
  
  // Mapping logic
  // 0: Clear
  // 1,2,3: Cloudy/Partly
  // 45, 48: Fog
  // 51-67, 80-82: Rain
  // 71-77: Snow
  // 95-99: Thunder

  let type = 'sun';
  if (code === 0) type = isDay ? 'sun' : 'moon';
  else if (code === 1 || code === 2) type = isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
  else if (code === 3) type = 'cloud';
  else if (code === 45 || code === 48) type = 'fog';
  else if (code >= 51 && code <= 67) type = 'rain';
  else if (code >= 80 && code <= 82) type = 'heavy-rain';
  else if (code >= 71 && code <= 77) type = 'snow';
  else if (code >= 95) type = 'thunder';

  // SVG Paths
  const icons: any = {
    'sun': (
      <svg viewBox="0 0 64 64" className={className} fill={color}>
        <circle cx="32" cy="32" r="14" />
        <g stroke={color} strokeWidth="4" strokeLinecap="round">
          <line x1="32" y1="4" x2="32" y2="10" />
          <line x1="32" y1="54" x2="32" y2="60" />
          <line x1="60" y1="32" x2="54" y2="32" />
          <line x1="10" y1="32" x2="4" y2="32" />
          <line x1="51.8" y1="12.2" x2="47.6" y2="16.4" />
          <line x1="16.4" y1="47.6" x2="12.2" y2="51.8" />
          <line x1="51.8" y1="51.8" x2="47.6" y2="47.6" />
          <line x1="16.4" y1="16.4" x2="12.2" y2="12.2" />
        </g>
      </svg>
    ),
    'moon': (
      <svg viewBox="0 0 64 64" className={className} fill={color}>
        <path d="M46,40.5c0-10.5-8.5-19-19-19c-1.6,0-3.2,0.2-4.7,0.6C26.1,12.7,33.5,6,42.5,6C53.3,6,62,14.7,62,25.5 c0,9-6.7,16.4-16.1,20.2C46.2,44.2,46,42.6,46,40.5z" />
      </svg>
    ),
    'cloud': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
         <path d="M46,20c-7.2,0-13.3,4.4-15.8,10.7C28.7,30.2,27.4,30,26,30c-6.6,0-12,5.4-12,12s5.4,12,12,12h20c7.7,0,14-6.3,14-14 S53.7,20,46,20z" />
       </svg>
    ),
    'partly-cloudy-day': (
      <svg viewBox="0 0 64 64" className={className} fill={color}>
        <g transform="translate(-8, -4) scale(0.7)">
           <circle cx="32" cy="32" r="14" />
            <g stroke={color} strokeWidth="4" strokeLinecap="round">
              <line x1="32" y1="4" x2="32" y2="10" />
              <line x1="32" y1="54" x2="32" y2="60" />
              <line x1="60" y1="32" x2="54" y2="32" />
              <line x1="10" y1="32" x2="4" y2="32" />
              <line x1="51.8" y1="12.2" x2="47.6" y2="16.4" />
              <line x1="16.4" y1="47.6" x2="12.2" y2="51.8" />
              <line x1="51.8" y1="51.8" x2="47.6" y2="47.6" />
              <line x1="16.4" y1="16.4" x2="12.2" y2="12.2" />
            </g>
        </g>
        <path d="M46,28c-5.4,0-10.1,3-12.2,7.4C32.8,35.1,31.9,35,31,35c-4.4,0-8,3.6-8,8s3.6,8,8,8h15c5.5,0,10-4.5,10-10S51.5,28,46,28z" />
      </svg>
    ),
    'partly-cloudy-night': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
          <path d="M41.5,14c-1.1,0-2.1,0.2-3.2,0.5c1.8-4.2,5.9-7.1,10.7-7.1c6.4,0,11.5,5.1,11.5,11.5c0,4.8-2.9,8.9-7.1,10.7 C53.2,19.9,47.9,14,41.5,14z" opacity="0.8"/>
          <path d="M46,28c-5.4,0-10.1,3-12.2,7.4C32.8,35.1,31.9,35,31,35c-4.4,0-8,3.6-8,8s3.6,8,8,8h15c5.5,0,10-4.5,10-10S51.5,28,46,28z" />
       </svg>
    ),
    'rain': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
         <path d="M46,20c-7.2,0-13.3,4.4-15.8,10.7C28.7,30.2,27.4,30,26,30c-6.6,0-12,5.4-12,12s5.4,12,12,12h20c7.7,0,14-6.3,14-14 S53.7,20,46,20z" />
         <g stroke={color} strokeWidth="3" strokeLinecap="round">
            <line x1="28" y1="56" x2="26" y2="62" />
            <line x1="36" y1="56" x2="34" y2="62" />
            <line x1="44" y1="56" x2="42" y2="62" />
         </g>
       </svg>
    ),
    'heavy-rain': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
          <path d="M46,20c-7.2,0-13.3,4.4-15.8,10.7C28.7,30.2,27.4,30,26,30c-6.6,0-12,5.4-12,12s5.4,12,12,12h20c7.7,0,14-6.3,14-14 S53.7,20,46,20z" />
          <g stroke={color} strokeWidth="3" strokeLinecap="round">
            <line x1="24" y1="56" x2="22" y2="62" />
            <line x1="32" y1="56" x2="30" y2="62" />
            <line x1="40" y1="56" x2="38" y2="62" />
            <line x1="48" y1="56" x2="46" y2="62" />
          </g>
       </svg>
    ),
    'thunder': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
         <path d="M46,20c-7.2,0-13.3,4.4-15.8,10.7C28.7,30.2,27.4,30,26,30c-6.6,0-12,5.4-12,12s5.4,12,12,12h20c7.7,0,14-6.3,14-14 S53.7,20,46,20z" />
         <polygon points="36,46 30,62 44,54 38,54 44,46" fill={color} />
       </svg>
    ),
    'snow': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
         <path d="M46,20c-7.2,0-13.3,4.4-15.8,10.7C28.7,30.2,27.4,30,26,30c-6.6,0-12,5.4-12,12s5.4,12,12,12h20c7.7,0,14-6.3,14-14 S53.7,20,46,20z" />
         <g fill={color}>
           <circle cx="28" cy="58" r="2" />
           <circle cx="38" cy="58" r="2" />
           <circle cx="33" cy="62" r="2" />
           <circle cx="43" cy="62" r="2" />
         </g>
       </svg>
    ),
    // iOS Style Fog: Cloud with horizontal lines
    'fog': (
       <svg viewBox="0 0 64 64" className={className} fill={color}>
          <path d="M46,18c-7.2,0-13.3,4.4-15.8,10.7C28.7,28.2,27.4,28,26,28c-6.6,0-12,5.4-12,12c0,3.3,1.3,6.3,3.5,8.5" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <line x1="16" y1="50" x2="56" y2="50" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <line x1="22" y1="58" x2="50" y2="58" stroke={color} strokeWidth="4" strokeLinecap="round" />
       </svg>
    )
  };

  return icons[type] || icons['sun'];
};

const getWeatherDescription = (code: number, isDay: number = 1) => {
  const descriptions: Record<number, string> = {
    0: isDay ? 'Nắng' : 'Quang đãng',
    1: 'Ít mây', 2: 'Có mây', 3: 'Nhiều mây',
    45: 'Sương mù', 48: 'Sương muối',
    51: 'Mưa nhỏ', 53: 'Mưa phùn', 55: 'Mưa dày',
    61: 'Mưa nhỏ', 63: 'Mưa vừa', 65: 'Mưa to',
    71: 'Tuyết nhẹ', 73: 'Tuyết rơi', 75: 'Tuyết dày',
    80: 'Mưa rào', 81: 'Mưa rào', 82: 'Mưa rất to',
    95: 'Dông', 96: 'Dông mưa đá', 99: 'Dông mưa đá'
  };

  return {
    text: descriptions[code] || 'Không xác định',
    bgType: code === 0 || code === 1 ? (isDay ? 'sunny' : 'night') :
            code > 50 ? 'rain' : 'cloudy'
  };
};

const getDayName = (isoString: string) => {
  const date = new Date(isoString);
  const today = new Date();
  if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth()) return "Hôm nay";
  return date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', '');
};

const getWindDirectionText = (degree: number) => {
  const directions = ['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];
  return directions[Math.round(degree / 45) % 8];
};

// --- Visual Components ---

const SkyBackground = ({ isDay, code }: { isDay: number, code: number }) => {
  const [sunPos, setSunPos] = useState({ x: 50, y: 10 });

  useEffect(() => {
    // Calculate simulated sun/moon position based on current time
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const dayStart = 6 * 60; // 6:00 AM
    const dayEnd = 18 * 60; // 6:00 PM
    
    let percentage = 0;
    
    if (isDay) {
      // Sun moves from left (0%) to right (100%) between 6am and 6pm
      percentage = Math.max(0, Math.min(1, (totalMinutes - dayStart) / (dayEnd - dayStart)));
    } else {
      // Moon logic (simplified)
      if (totalMinutes > dayEnd) {
         percentage = (totalMinutes - dayEnd) / (24 * 60 - dayEnd);
      } else {
         percentage = 0.5 + (totalMinutes / dayStart) * 0.5;
      }
    }

    // Arc movement: x is percentage, y follows a curve
    // Y should be low at 0% (sunrise), high at 50% (noon), low at 100% (sunset)
    // In CSS top%, smaller is higher. So 10% is high, 80% is horizon.
    const x = percentage * 100; 
    const y = 80 - (Math.sin(percentage * Math.PI) * 70); 
    
    setSunPos({ x, y });
  }, [isDay]);

  const isRain = code >= 50 && code <= 99;
  const isCloudy = code === 2 || code === 3 || code === 45;

  return (
    <div className="sky-layer">
      {!isDay && <div className="stars"></div>}
      
      {/* Sun or Moon Orb */}
      {!isRain && !isCloudy && (
        <div 
          className={isDay ? "sun-orb" : "moon-orb"}
          style={{ 
            left: `${sunPos.x}%`, 
            top: `${sunPos.y}%` 
          }}
        />
      )}

      {/* Clouds Layer */}
      {(isCloudy || isRain) && (
        <div className="cloud-layer">
           <div className="cloud c1"></div>
           <div className="cloud c2"></div>
        </div>
      )}

      {/* Rain Layer */}
      {isRain && (
         <div className="rain-container">
            {[...Array(40)].map((_,i)=><div key={i} className="rain-drop" style={{left:`${Math.random()*100}%`, animationDuration:`${0.5+Math.random()}s`, animationDelay:`-${Math.random()}s`}}/>)}
         </div>
      )}
    </div>
  );
};

const Compass = ({ speed, deg }: { speed: number, deg: number }) => (
  <div className="compass-container">
    <div className="compass-circle">
      <div className="compass-ticks">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="tick" style={{ transform: `rotate(${i * 30}deg)` }}></div>
        ))}
      </div>
      <div className="compass-label n">B</div>
      <div className="compass-label e">Đ</div>
      <div className="compass-label s">N</div>
      <div className="compass-label w">T</div>
      <div className="compass-arrow-container" style={{ transform: `rotate(${deg}deg)` }}>
         <div className="compass-arrow"></div>
      </div>
      <div className="compass-center-text">
        <span className="speed-val">{speed}</span>
        <span className="speed-unit">km/h</span>
      </div>
    </div>
  </div>
);

const SunGraph = ({ sunrise, sunset, currentTime }: { sunrise: string, sunset: string, currentTime: Date }) => {
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  
  const sr = parseTime(sunrise);
  const ss = parseTime(sunset);
  const now = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  let progress = 0;
  if (now > sr && now < ss) {
    progress = (now - sr) / (ss - sr);
  } else if (now >= ss) {
    progress = 1;
  }

  const x = progress * 100;
  const y = 50 - (Math.sin(progress * Math.PI) * 40);

  return (
    <div className="sun-graph-container">
      <div className="sun-times">
        <span>Lên: {sunrise}</span>
        <span>Lặn: {sunset}</span>
      </div>
      <div className="sun-viz-wrapper">
        <svg viewBox="0 -10 100 60" className="sun-svg">
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <path d="M0,50 Q50,-20 100,50" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 2" />
          <path d="M0,50 Q50,-20 100,50" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="1000" strokeDashoffset={1000 * (1 - progress)} pathLength="1000" />
          
          {now > sr && now < ss && (
              <circle cx={x} cy={y} r="5" fill="#fff" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
          )}
        </svg>
      </div>
    </div>
  );
};

const PressureGauge = ({ pressure }: { pressure: number }) => {
  // Pressure range typically 960 to 1060 hPa
  const minP = 960;
  const maxP = 1060;
  const percent = Math.min(Math.max((pressure - minP) / (maxP - minP), 0), 1);
  const rotation = -135 + (percent * 270); // 270 degree arc

  return (
    <div className="pressure-container">
       <div className="gauge-outer">
         <div className="gauge-tick-ring"></div>
       </div>
       <div className="gauge-center-info">
         <div className="p-val">{pressure}</div>
         <div className="p-unit">hPa</div>
       </div>
       <div className="gauge-hand" style={{ transform: `rotate(${rotation}deg)` }}>
         <div className="hand-tip"></div>
       </div>
    </div>
  );
};

// --- Main App Component ---

function App() {
  const [cityInput, setCityInput] = useState('');
  const [countryInput, setCountryInput] = useState('');
  
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bgClass, setBgClass] = useState('default');
  const [isSearching, setIsSearching] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0); 
  
  // Drag scrolling ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Reset scroll on selected day change
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
    }
  }, [selectedDayIndex]);

  // --- Drag Scroll Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const fetchCoordinates = async (query: string) => {
    const baseUrl = "https://geocoding-api.open-meteo.com/v1/search";
    const fetchQuery = async (q: string) => {
      const url = `${baseUrl}?name=${encodeURIComponent(q)}&count=5&language=vi&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      return data.results?.[0];
    };
    let loc = await fetchQuery(query);
    if (!loc && query.includes(',')) {
        const parts = query.split(',');
        if (parts[0].trim()) loc = await fetchQuery(parts[0].trim());
    }
    if (!loc) {
         const url = `${baseUrl}?name=${encodeURIComponent(query)}&count=1&format=json`;
         const res = await fetch(url);
         const data = await res.json();
         loc = data.results?.[0];
    }
    if (!loc) throw new Error(`Không tìm thấy "${query}".`);
    return { lat: loc.latitude, lon: loc.longitude, name: loc.name, country: loc.country };
  };

  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,dew_point_2m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&past_days=0&forecast_days=8`;
    
    const res = await fetch(weatherUrl);
    if (!res.ok) throw new Error("Lỗi mạng");
    const data = await res.json();

    const currentCode = data.current.weather_code;
    const isDay = data.current.is_day;
    const weatherInfo = getWeatherDescription(currentCode, isDay);
    setBgClass(weatherInfo.bgType);

    const dailyData = data.daily.time.map((time: string, index: number) => ({
      day: getDayName(time),
      date: time, // YYYY-MM-DD
      min: Math.round(data.daily.temperature_2m_min[index]),
      max: Math.round(data.daily.temperature_2m_max[index]),
      code: data.daily.weather_code[index],
      details: {
        uvIndex: data.daily.uv_index_max[index].toString(),
        sunrise: new Date(data.daily.sunrise[index]).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}),
        sunset: new Date(data.daily.sunset[index]).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}),
        windSpeed: Math.round(data.daily.wind_speed_10m_max[index]),
        windDirection: data.daily.wind_direction_10m_dominant[index],
        humidity: 'N/A', 
        feelsLike: 'N/A',
        visibility: '10 km',
        pressure: 1013,
        precipitation: `${data.daily.precipitation_sum[index]} mm`,
        dewPoint: 'N/A'
      }
    }));

    // Update current day details with current measurements
    dailyData[0].details = {
      ...dailyData[0].details,
      humidity: `${data.current.relative_humidity_2m}%`,
      feelsLike: `${Math.round(data.current.apparent_temperature)}°`,
      pressure: Math.round(data.current.surface_pressure),
      precipitation: `${data.current.precipitation} mm`,
      windSpeed: Math.round(data.current.wind_speed_10m),
      windDirection: data.current.wind_direction_10m,
      dewPoint: `${Math.round(data.current.dew_point_2m)}°`
    };

    // Store ALL hourly data without slicing
    const hourlyData = data.hourly.time.map((t: string, i: number) => ({
      time: t,
      temp: Math.round(data.hourly.temperature_2m[i]),
      code: data.hourly.weather_code[i],
      isDay: data.hourly.is_day[i]
    }));

    const finalData: WeatherData = {
      current: {
        temp: Math.round(data.current.temperature_2m),
        conditionCode: currentCode,
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
        city: cityName,
        description: weatherInfo.text,
        details: dailyData[0].details,
        isDay: isDay,
        time: new Date()
      },
      hourly: hourlyData,
      daily: dailyData,
      advice: "..."
    };

    setWeatherData(finalData);
    setLoading(false);
    setIsSearching(false);
    setSelectedDayIndex(0);

    try {
       const prompt = `Thời tiết ${cityName}: ${finalData.current.temp} độ, ${finalData.current.description}. Cho 1 lời khuyên cực ngắn (dưới 10 từ) hữu ích.`;
       const aiRes = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
       if (aiRes.text) setWeatherData(prev => prev ? { ...prev, advice: aiRes.text.trim() } : null);
    } catch(e) {}
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cityInput.trim()) return;
    setLoading(true);
    try {
      const query = countryInput.trim() ? `${cityInput.trim()}, ${countryInput.trim()}` : cityInput.trim();
      const coords = await fetchCoordinates(query);
      const displayName = coords.country ? `${coords.name}, ${coords.country}` : coords.name;
      await fetchWeather(coords.lat, coords.lon, displayName);
    } catch (err: any) {
      setError("Không tìm thấy địa điểm");
      setLoading(false);
    }
  };

  const displayDetails = weatherData ? weatherData.daily[selectedDayIndex].details : null;
  
  // Compute hours to display based on selected day
  const displayedHourly = useMemo(() => {
    if (!weatherData) return [];
    
    // If "Today" (index 0): Show continuous forecast starting from Now (next 26 hours to cover overlap)
    if (selectedDayIndex === 0) {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        const nowTime = now.getTime();

        // Find the index of the hour closest to NOW
        const nowIndex = weatherData.hourly.findIndex(h => new Date(h.time).getTime() >= nowTime);
        
        if (nowIndex !== -1) {
            // Slice next 26 hours (enough to cover today and part of tomorrow)
            const list = weatherData.hourly.slice(nowIndex, nowIndex + 26);
            return list.map((h, i) => ({
                ...h,
                timeLabel: i === 0 ? "Bây giờ" : new Date(h.time).getHours().toString()
            }));
        }
    }
    
    // If specific future day: Show full 24h (00:00 to 23:00) of that date
    const selectedDate = weatherData.daily[selectedDayIndex].date; // YYYY-MM-DD
    return weatherData.hourly
        .filter(h => h.time.startsWith(selectedDate))
        .map(h => ({
            ...h,
            timeLabel: new Date(h.time).getHours().toString()
        }));
  }, [weatherData, selectedDayIndex]);

  // Helper for current temp dot on daily bar
  const getDotPosition = (min: number, max: number, current: number) => {
     if (current < min) return 0;
     if (current > max) return 100;
     return ((current - min) / (max - min)) * 100;
  };

  return (
    <div className={`ios-wrapper ${bgClass}`}>
      {weatherData && (
        <SkyBackground 
          isDay={weatherData.current.isDay} 
          code={weatherData.current.conditionCode} 
        />
      )}

      {/* Search Screen */}
      <div className={`search-overlay ${!isSearching ? 'minimize' : ''}`}>
        <div className="search-box">
          <h1 style={{fontWeight:200, fontSize:'3rem', marginBottom: 20}}>Thời Tiết</h1>
          <form onSubmit={handleSearch}>
            <div className="input-group mb-2"><input value={cityInput} onChange={e=>setCityInput(e.target.value)} placeholder="Tên Thành Phố" /></div>
            <div className="input-group mb-4"><input value={countryInput} onChange={e=>setCountryInput(e.target.value)} placeholder="Tên Quốc Gia" /></div>
            <button type="submit" className="search-btn" disabled={loading}>{loading ? "Đang tìm..." : "Xem Thời Tiết"}</button>
          </form>
          {error && <div className="error-text">{error}</div>}
        </div>
      </div>

      {/* Main View */}
      {weatherData && (
        <div className={`main-content ${!isSearching ? 'fade-in-up' : ''}`}>
          
          <div className="top-bar">
             <button className="back-btn" onClick={() => setIsSearching(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> 
             </button>
             <div className="location-title clickable" onClick={() => setIsSearching(true)}>
               {weatherData.current.city}
               <span style={{fontSize:'0.8rem', display:'block', fontWeight:400, opacity:0.8}}>📍 Vị trí của tôi</span>
             </div>
             <div style={{width: 24}}></div> 
          </div>

          {/* Hero */}
          <div className="hero-section">
            <div className="temp-hero">{selectedDayIndex === 0 ? weatherData.current.temp : weatherData.daily[selectedDayIndex].max}°</div>
            <div className="condition-hero">{getWeatherDescription(weatherData.daily[selectedDayIndex].code).text}</div>
            <div className="hi-low"><span>C:{weatherData.daily[selectedDayIndex].max}°</span> <span>T:{weatherData.daily[selectedDayIndex].min}°</span></div>
          </div>

          {/* Hourly Forecast - Dynamic based on selected day */}
          <div className="weather-card hourly-card">
            <div className="card-header-text">
                {selectedDayIndex === 0 ? "DỰ BÁO THEO GIỜ" : `DỰ BÁO THEO GIỜ - ${weatherData.daily[selectedDayIndex].day}`}
            </div>
            {displayedHourly.length > 0 ? (
                <div 
                    className="hourly-scroll" 
                    ref={scrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    {displayedHourly.map((h, i) => (
                    <div key={i} className="hour-item">
                        <div className="h-time">{h.timeLabel}</div>
                        <div className="h-icon">
                        <WeatherIcon code={h.code} isDay={h.isDay} className="weather-icon-small" />
                        </div>
                        <div className="h-temp">{h.temp}°</div>
                    </div>
                    ))}
                </div>
            ) : (
                <div style={{textAlign:'center', padding:'20px', opacity:0.6}}>Không có dữ liệu giờ</div>
            )}
          </div>

          {/* Daily */}
          <div className="weather-card">
            <div className="card-header-text">📅 DỰ BÁO 7 NGÀY</div>
            <div className="daily-list">
              {weatherData.daily.map((day, i) => (
                <div key={i} className={`day-row ${selectedDayIndex === i ? 'active' : ''}`} onClick={() => setSelectedDayIndex(i)}>
                  <div className="d-day">{day.day}</div>
                  <div className="d-icon">
                     <WeatherIcon code={day.code} className="weather-icon-small" />
                  </div>
                  <div className="d-min">{day.min}°</div>
                  <div className="d-temp-bar">
                    <div className="temp-range-bg">
                      <div className="temp-range-fill" style={{left:`0%`, width:`100%`}}></div>
                      {/* Current temp dot only for today (index 0) */}
                      {i === 0 && (
                         <div className="current-dot" style={{left: `${getDotPosition(day.min, day.max, weatherData.current.temp)}%`}}></div>
                      )}
                    </div>
                  </div>
                  <div className="d-max">{day.max}°</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Details */}
          {displayDetails && (
            <div className="details-grid">
              <div className="weather-card detail-item">
                <div className="detail-header">☀️ CHỈ SỐ UV</div>
                <div className="detail-value">{displayDetails.uvIndex}</div>
                <div className="detail-sub">{Number(displayDetails.uvIndex) > 5 ? 'Cao' : 'Thấp'}</div>
                <div className="uv-bar-container">
                    <div className="uv-bar"></div>
                    <div className="uv-dot" style={{left: `${Math.min(Number(displayDetails.uvIndex)*10, 100)}%`}}></div>
                </div>
              </div>

              <div className="weather-card detail-item">
                <div className="detail-header">🌅 MẶT TRỜI</div>
                <SunGraph sunrise={displayDetails.sunrise} sunset={displayDetails.sunset} currentTime={selectedDayIndex === 0 ? new Date() : new Date('2000-01-01 12:00')} />
              </div>

              <div className="weather-card detail-item">
                <div className="detail-header">🌬️ GIÓ</div>
                <Compass speed={displayDetails.windSpeed} deg={displayDetails.windDirection} />
                <div className="compass-footer">{getWindDirectionText(displayDetails.windDirection)}</div>
              </div>

              <div className="weather-card detail-item">
                <div className="detail-header">🌧️ LƯỢNG MƯA</div>
                <div className="detail-value" style={{fontSize: '1.8rem'}}>{displayDetails.precipitation}</div>
                <div className="detail-sub">Trong 24h qua</div>
              </div>

              <div className="weather-card detail-item">
                <div className="detail-header">🌡️ CẢM GIÁC</div>
                <div className="detail-value">{displayDetails.feelsLike}</div>
                <div className="detail-sub">Giống thực tế</div>
              </div>
              
              <div className="weather-card detail-item">
                <div className="detail-header">💧 ĐỘ ẨM</div>
                <div className="detail-value">{displayDetails.humidity}</div>
                <div className="detail-sub">Điểm sương {displayDetails.dewPoint}</div>
              </div>

              <div className="weather-card detail-item">
                <div className="detail-header">🌀 ÁP SUẤT</div>
                <PressureGauge pressure={displayDetails.pressure} />
              </div>
              
              <div className="weather-card detail-item">
                 <div className="detail-header">👁️ TẦM NHÌN</div>
                 <div className="detail-value">{displayDetails.visibility}</div>
                 <div className="detail-sub">Tầm nhìn tốt</div>
              </div>
            </div>
          )}

          {weatherData.advice && (
             <div className="weather-card ai-advice-card">
                 <div className="ai-icon">✨</div>
                 <div className="ai-text">{weatherData.advice}</div>
             </div>
          )}
          
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);