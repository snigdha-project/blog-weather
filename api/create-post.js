import fetch from 'node-fetch';
import { Resend } from 'resend';

// --- API KEYS & CONFIG ---
// These are read from Vercel's Environment Variables.
// DO NOT paste your keys here.
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Your specific details
const YOUR_EMAIL = "snigdhachandrapaik@gmail.com";
const SITE_BASE_URL = "https.hamarakhet-7013b6.webflow.io";
const LIVE_WEATHER_IMAGE_URL = "https://mausam.imd.gov.in/imd_latest/contents/satellite/satellite_insat3d.jpg";

/**
 * 1. Fetches Weather Data
 */
async function getWeatherData() {
    // A sample list of major locations.
    const locations = {
        "Delhi": { lat: 28.61, lon: 77.23 },
        "Mumbai": { lat: 19.07, lon: 72.88 },
        "Kolkata": { lat: 22.57, lon: 88.36 },
        "Chennai": { lat: 13.08, lon: 80.27 },
        "Bengaluru": { lat: 12.97, lon: 77.59 },
        "Hyderabad": { lat: 17.38, lon: 78.48 },
        "Jaipur": { lat: 26.91, lon: 75.79 }
    };
    
    let weatherReports = [];
    const url = "https://api.open-meteo.com/v1/forecast";
    
    for (const city in locations) {
        const params = new URLSearchParams({
            latitude: locations[city].lat,
            longitude: locations[city].lon,
            current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
            forecast_days: 1
        });
        
        const response = await fetch(\`\${url}?\${params}\`);
        const data = await response.json();
        
        weatherReports.push({
            city: city,
            temp: data.current.temperature_2m + "°C",
            humidity: data.current.relative_humidity_2m + "%",
            wind: data.current.wind_speed_10m + " km/h",
            condition: getWeatherDescription(data.current.weather_code)
        });
    }
    return weatherReports;
}

// Helper to convert weather codes (WMO) to text
function getWeatherDescription(code) {
    const descriptions = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
        61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
        95: "Slight/moderate thunderstorm"
    };
    return descriptions[code] || "Not available";
}

/**
 * 2. Creates the HTML Weather Table
 */
function createWeatherTable(weatherData) {
    let tableRows = weatherData.map(state => \`
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">\${state.city}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">\${state.temp}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">\${state.condition}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">\${state.humidity}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">\${state.wind}</td>
        </tr>
    \`).join('');

    return \`
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #FBC02D;">
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">State / City</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Temperature</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Condition</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Humidity</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Wind Speed</th>
                </tr>
            </thead>
            <tbody>
                \${tableRows}
            </tbody>
        </table>
    \`;
}

/**
 * 3. Generates Blog Content with OpenRouter
 */
async function generateBlogContent(weatherTableHtml) {
    const prompt = \`
        You are an expert SEO content writer for an Indian audience, specializing in weather and agriculture.
        Your task is to generate a blog post about the current weather report in India.
        
        CRITICAL RULES:
        - DO NOT use any em dashes (—). Use a regular hyphen (-) or rephrase the sentence.
        - The highest heading level MUST be H2.
        - The last heading in the content MUST be H3.
        
        The blog post must include:
        1.  A weather alert section.
        2.  Some "chatpata" (interesting and engaging) content about how this weather affects local farming or daily life.
        3.  The HTML weather table provided below.
        
        Here is the data-driven HTML table to insert:
        <WEATHER_TABLE>
        \${weatherTableHtml}
        </WEATHER_TABLE>
        
        Please provide the output in a single JSON object format. Do not write any text outside the JSON object.
        The JSON object must have these exact keys:
        {
          "blogName": "A catchy, short blog post title.",
          "slug": "A keyword-researched, SEO-friendly slug (lowercase, hyphen-separated, e.g., 'indian-monsoon-update-nov-2025').",
          "metaTitle": "An SEO meta title, min 30 chars, max 45 chars.",
          "metaDescription": "An SEO meta description, min 120 chars, max 145 chars.",
          "imageAlt": "An SEO-optimized alt text for an image of India's satellite weather map. (e.g., 'Live satellite weather map of India showing current cloud cover').",
          "postBody": "The full blog post in HTML format. It MUST start with an H2 heading. It MUST include the <WEATHER_TABLE> placeholder exactly, which I will replace. It MUST end with an H3 heading. It MUST NOT contain any em dashes.",
          "newsSchema": "A valid NewsArticle JSON-LD schema for this post. Use placeholder URLs 'https.your-site.com' which I will replace."
        }
    \`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": \`Bearer \${OPENROUTER_API_KEY}\`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mistralai/mistral-7b-instruct:free",
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(\`OpenRouter API error: \${response.statusText}\`);
    }

    const data = await response.json();
    const contentJson = data.choices[0].message.content;
    
    let parsedContent;
    try {
        parsedContent = JSON.parse(contentJson);
    } catch (e) {
        console.error("Failed to parse JSON from OpenRouter:", contentJson);
        throw new Error("OpenRouter returned invalid JSON.");
    }

    // Replace the placeholder with the real table
    parsedContent.postBody = parsedContent.postBody.replace("<WEATHER_TABLE>", weatherTableHtml);
    return parsedContent;
}

/**
 * 4. Posts the Content to Webflow
 */
async function postToWebflow(content) {
    const url = \`https://api.webflow.com/v2/collections/\${WEBFLOW_COLLECTION_ID}/items\`;
    
    const body = {
        "isArchived": false,
        "isDraft": false, // Set to false to publish immediately
        "fieldData": {
            // !! IMPORTANT !!
            // Make sure these field slugs match your Webflow collection exactly!
            "name": content.blogName,
            "slug": content.slug,
            "main-image": {
                "url": LIVE_WEATHER_IMAGE_URL,
                "alt": content.imageAlt
            },
            "meta-title": content.metaTitle,
            "meta-description": content.metaDescription,
            "post-body": content.postBody,
            "schema": JSON.stringify(content.newsSchema)
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": \`Bearer \${WEBFLOW_API_KEY}\`,
            "accept": "application/json",
            "content-type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Webflow API Error:", errorData);
        throw new Error(\`Webflow API error: \${errorData.message}\`);
    }

    const data = await response.json();
    return data;
}

/**
 * 5. Sends Email Notification using Resend
 */
async function sendEmailNotification(postSlug) {
    // This requires you to have a Resend account and a verified domain
    if (!RESEND_API_KEY) {
        console.warn("RESEND_API_KEY not set. Skipping email notification.");
        return;
    }
    
    const resend = new Resend(RESEND_API_KEY);
    // Assumes your blog post URL structure is /post/slug
    const postUrl = \`\${SITE_BASE_URL}/post/\${postSlug}\`; 

    try {
        await resend.emails.send({
            from: 'automation@your-verified-domain.com', // YOU MUST CHANGE THIS to a verified domain
            to: YOUR_EMAIL,
            subject: 'New Weather Blog Post Published!',
            html: \`
                <p>Your automatic weather blog post has been published.</p>
                <p>View it here: <a href="\${postUrl}">\${postUrl}</a></p>
            \`
        });
    } catch (error) {
        console.error("Resend email failed:", error.message);
        // Don't crash the whole function if email fails
    }
}

/**
 * Main Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests allowed' });
    }

    try {
        // Check for API keys at the start
        if (!WEBFLOW_API_KEY || !WEBFLOW_COLLECTION_ID || !OPENROUTER_API_KEY) {
            throw new Error("One or more required API keys are missing. Check your Vercel Environment Variables.");
        }

        // --- Run the Automation Steps ---
        
        // 1. Get Weather Data
        const weatherData = await getWeatherData();
        
        // 2. Create HTML Table
        const tableHtml = createWeatherTable(weatherData);
        
        // 3. Generate Blog Content
        const blogContent = await generateBlogContent(tableHtml);
        
        // 4. Post to Webflow
        const webflowItem = await postToWebflow(blogContent);
        
        // 5. Send Email
        const newSlug = webflowItem.fieldData.slug;
        await sendEmailNotification(newSlug);

        // 6. Send Success Response
        const newPostUrl = \`\${SITE_BASE_URL}/post/\${newSlug}\`;
        res.status(200).json({ 
            message: "Post created successfully!", 
            url: newPostUrl
        });

    } catch (error) {
        console.error("Automation failed:", error);
        res.status(500).json({ message: \`Automation failed: \${error.message}\` });
    }
}