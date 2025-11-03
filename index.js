import express from "express";
import fetch from "node-fetch";
import { Resend } from "resend";

// --- CONFIG & KEYS ---
// These MUST be set in Vercel Environment Variables
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY; // For email, from Resend.com
const YOUR_EMAIL = "snigdhachandrapaik@gmail.com";
const SITE_BASE_URL = "https.hamarakhet-7013b6.webflow.io";

const LIVE_WEATHER_IMAGE_URL =
  "https://mausam.imd.gov.in/imd_latest/contents/satellite/satellite_insat3d.jpg";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json()); // Middleware to parse JSON (though not strictly needed for this POST)

// --- 1. FRONTEND ROUTE (GET /) ---
// Serves the HTML page with the "Start" button
app.get("/", (req, res) => {
  const htmlPage = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Webflow Blog Post Automator</title>
        <style>
            body { font-family: sans-serif; display: grid; place-items: center; min-height: 90vh; background: #f4f4f4; }
            #container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            #startButton {
                font-size: 1.2rem; padding: 0.8rem 1.5rem; color: white;
                background-color: #007bff; border: none; border-radius: 5px; cursor: pointer;
            }
            #startButton:disabled { background-color: #aaa; cursor: not-allowed; }
            #status { margin-top: 1.5rem; font-size: 0.9rem; font-family: monospace; }
        </style>
    </head>
    <body>
        <div id="container">
            <h2>Automatic Indian Weather Blog Post</h2>
            <button id="startButton">Start Automation</button>
            <div id="status">Click the button to publish a new post.</div>
        </div>

        <script>
            document.getElementById('startButton').addEventListener('click', async () => {
                const startButton = document.getElementById('startButton');
                const statusDiv = document.getElementById('status');

                startButton.disabled = true;
                startButton.innerText = "Processing...";
                statusDiv.innerText = "Automation started. This may take up to 60 seconds...";

                try {
                    // This path MUST match the backend route below
                    const response = await fetch('/api/create-post', {
                        method: 'POST'
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Something went wrong');
                    }

                    statusDiv.innerHTML = \`✅ Success! Post created:<br><a href="\${data.url}" target="_blank">\${data.url}</a>\`;
                    startButton.innerText = "Done!";

                } catch (error) {
                    console.error('Error:', error);
                    statusDiv.innerText = \`❌ Error: \${error.message}\`;
                    startButton.disabled = false;
                    startButton.innerText = "Start Automation";
                }
            });
        </script>
    </body>
    </html>
    `;
  res.setHeader("Content-Type", "text/html");
  res.send(htmlPage);
});

// --- 2. BACKEND API ROUTE (POST /api/create-post) ---
// This runs the automation when the button is clicked
app.post("/api/create-post", async (req, res) => {
  try {
    // 1. Get Weather Data
    const weatherData = await getWeatherData();

    // 2. Create HTML Table
    const tableHtml = createWeatherTable(weatherData);

    // 3. Generate Blog Content
    const blogContent = await generateBlogContent(tableHtml);

    // 4. Post to Webflow
    const webflowItem = await postToWebflow(blogContent);
    const newSlug = webflowItem.fieldData.slug;
    const newPostUrl = `${SITE_BASE_URL}/post/${newSlug}`; // Assumes /post/ slug prefix

    // 5. Send Email Notification
    // await sendEmailNotification(newSlug); // Uncomment after setting up Resend

    // 6. Send Success Response
    res.status(200).json({
      message: "Post created successfully!",
      url: newPostUrl,
    });
  } catch (error) {
    console.error("Automation failed:", error);
    res.status(500).json({ message: `Automation failed: ${error.message}` });
  }
});

// --- 3. HELPER FUNCTIONS (All logic lives here) ---

async function getWeatherData() {
  const locations = {
    Delhi: { lat: 28.61, lon: 77.23 },
    Mumbai: { lat: 19.07, lon: 72.88 },
    Kolkata: { lat: 22.57, lon: 88.36 },
    Chennai: { lat: 13.08, lon: 80.27 },
    Bengaluru: { lat: 12.97, lon: 77.59 },
  };

  let weatherReports = [];
  const url = "https://api.open-meteo.com/v1/forecast";

  for (const city in locations) {
    const params = new URLSearchParams({
      latitude: locations[city].lat,
      longitude: locations[city].lon,
      current:
        "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
      forecast_days: 1,
    });

    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    weatherReports.push({
      city: city,
      temp: data.current.temperature_2m + "°C",
      humidity: data.current.relative_humidity_2m + "%",
      wind: data.current.wind_speed_10m + " km/h",
      condition: getWeatherDescription(data.current.weather_code),
    });
  }
  return weatherReports;
}

function getWeatherDescription(code) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Slight/moderate thunderstorm",
  };
  return descriptions[code] || "Not available";
}

function createWeatherTable(weatherData) {
  let tableRows = weatherData
    .map(
      (state) => `
        <tr>
            <td>${state.city}</td>
            <td>${state.temp}</td>
            <td>${state.condition}</td>
            <td>${state.humidity}</td>
            <td>${state.wind}</td>
        </tr>
    `
    )
    .join("");

  return `
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
                ${tableRows}
            </tbody>
        </table>
    `;
}

async function generateBlogContent(weatherTableHtml) {
  const prompt = `
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
        ${weatherTableHtml}
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
          "newsSchema": "A valid NewsArticle JSON-LD schema for this post. Use placeholder URLs 'https://your-site.com' which I will replace."
        }
    `;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
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

  parsedContent.postBody = parsedContent.postBody.replace(
    "<WEATHER_TABLE>",
    weatherTableHtml
  );
  return parsedContent;
}

async function postToWebflow(content) {
  const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

  const body = {
    isArchived: false,
    isDraft: false, // Publish immediately
    fieldData: {
      // !! IMPORTANT: Update these field slugs to match YOUR Webflow collection
      name: content.blogName,
      slug: content.slug,
      "main-image": {
        // Assumes field slug is 'main-image'
        url: LIVE_WEATHER_IMAGE_URL,
        alt: content.imageAlt,
      },
      "meta-title": content.metaTitle, // Assumes 'meta-title'
      "meta-description": content.metaDescription, // Assumes 'meta-description'
      "post-body": content.postBody, // Assumes 'post-body'
      schema: JSON.stringify(content.newsSchema), // Assumes 'schema'
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WEBFLOW_API_KEY}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Webflow API Error:", errorData);
    throw new Error(`Webflow API error: ${errorData.message}`);
  }

  return await response.json();
}

async function sendEmailNotification(postSlug) {
  const resend = new Resend(RESEND_API_KEY);
  const postUrl = `${SITE_BASE_URL}/post/${postSlug}`;

  try {
    await resend.emails.send({
      from: "automation@your-verified-domain.com", // MUST be a verified domain in Resend
      to: YOUR_EMAIL,
      subject: "New Weather Blog Post Published!",
      html: `<p>New post is live: <a href="${postUrl}">${postUrl}</a></p>`,
    });
  } catch (error) {
    console.error("Resend Email Error:", error);
    // Do not throw; we don't want the whole process to fail if email fails
  }
}

// --- 4. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Export the app for Vercel
export default app;
