const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
app.use(bodyParser.json());

const TELEGRAM_BOT_TOKEN = '5477889304:AAGIrBexQdhdzlXWWoyrOVcjNdPKLh7WP_o'; // Replace with your actual token
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Function to extract and parse the caption
async function extractAndParseCaption(caption) {
  if (!caption) {
    return null;
  }
  let title = '';
  let price = '';
  let url = '';
  let brand = '';
  // Extract URL
  const urlMatch = caption.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    url = await resolveShortenedUrl(urlMatch[0]);
  }
  // Remove the URL from the caption for easier processing of the remaining parts
  const captionWithoutUrl = caption.replace(urlMatch ? urlMatch[0] : '', '').trim();

  // Split the remaining caption into lines
  const lines = captionWithoutUrl.split('\n').map(line => line.trim()).filter(line => line);
  // Extract price from the lines
  const priceMatch = captionWithoutUrl.match(/(?:₹|Rs|@|At\.?)\s?(\d+[\d,.]*)/);
  if (priceMatch) {
    price = priceMatch[1].replace(',', '');
  }

  // Identify the title and brand from the remaining lines
  if (lines.length > 0) {
    let words = lines[0].split(' ');
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ') + '...';
    } else {
      title = lines[0];
    }

    if (/[^\w\s]/.test(words[0])) {
      brand = words[1] || '';
    } else {
      brand = words[0] || '';
    }
    brand = brand.replace(/[^\w\s]/gi, '');
  }

  // Ensure the tag parameter is correctly set
  const modifiedUrl = url ? url.replace(/tag=[^&]+/, 'tag=715104-21') : '';

  return {
    title: title,
    brand: brand,
    price: price,
    url: modifiedUrl
  };
}

// Function to resolve shortened URLs
async function resolveShortenedUrl(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });

    if (response.status === 301 || response.status === 302) {
      return response.headers.location;
    }

    return response.request.res.responseUrl || shortUrl;
  } catch (error) {
    if (error.response && (error.response.status === 301 || error.response.status === 302)) {
      return error.response.headers.location;
    } else {
      console.error('Error resolving shortened URL:', error);
      return shortUrl;
    }
  }
}

// Function to extract the product image URL
async function extractImageURL(productURL) {
  try {
    const response = await axios.get(productURL);
    const $ = cheerio.load(response.data);

    let imageURL = $('img#landingImage').attr('src');
    if (!imageURL) {
      imageURL = $('img.a-dynamic-image').first().attr('src');
    }

    return imageURL || 'Image URL not found';
  } catch (error) {
    console.error('Error fetching product image:', error);
    return null;
  }
}

// Endpoint to handle incoming updates from Telegram
app.post('/webhook', async (req, res) => {
  const { message, channel_post } = req.body;
  const caption = message?.caption || channel_post?.caption;

  if (caption) {
    const parsedData = await extractAndParseCaption(caption);
    if (parsedData) {
      parsedData.imageURL = await extractImageURL(parsedData.url);
      console.log('Parsed Data with Image URL:', parsedData);

      // Send data to Google Script
      const url = 'https://script.google.com/macros/s/AKfycbxeNnFadcB9OfRZdURt64Ri7i7Nv5sIeoFxHZGH17Ia2b8abtRCWnTkYyyrnfciZ4fVuw/exec';
      const data = {
        productType: parsedData.price,
        brand: parsedData.brand,
        imageURL: parsedData.imageURL,
        productName: parsedData.title,
        productURL: parsedData.url,
        Coupon: parsedData.price,
      };

      axios.post(url, new URLSearchParams(data), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }).then(response => {
        if (response.data.result === 'success') {
          console.log('Data appended successfully, row:', response.data.row);
        } else {
          console.error('Error appending data:', response.data.error);
        }
      }).catch(error => {
        console.error('Error:', error);
      });

    } else {
      console.log('Failed to parse caption');
    }
  } else {
    console.log('No caption found in the request:', req.body);
  }

  res.sendStatus(200);
});

// Set webhook URL
axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
  url: 'https://earnstayofferstore-telegram.onrender.com/webhook' // Replace this with your actual ngrok URL
}).then(response => {
  console.log('Webhook set:', response.data);
}).catch(error => {
  console.error('Error setting webhook:', error.response ? error.response.data : error.message);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
