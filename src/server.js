const express = require('express');
const app = express();
const fetch = require('node-fetch'); // For downloading files
const fs = require('fs');
const path = require('path');

app.use(express.json()); // To parse incoming JSON data

// Webhook endpoint to receive the notification from Plainly
app.post('/webhook/render', async (req, res) => {
    try {
        const renderStatus = req.body.status;
        const videoUrl = req.body.videoUrl; // Assuming Plainly sends the video URL
        const renderId = req.body.renderId; // Optional: useful if you want to track the render

        if (renderStatus === 'completed' && videoUrl) {
            console.log(`Render completed! Video URL: ${videoUrl}`);

            // Download the video and save it locally
            const response = await fetch(videoUrl);
            const videoPath = path.join(__dirname, `rendered_video_${renderId}.mp4`);
            const fileStream = fs.createWriteStream(videoPath);
            response.body.pipe(fileStream);

            // Handle completion of the download
            fileStream.on('finish', () => {
                console.log(`Video saved as ${videoPath}`);
            });

            // Optionally, send a response to Plainly to confirm receipt
            res.status(200).json({ message: 'Render received and video download initiated' });
        } else {
            res.status(400).json({ message: 'Render not completed or video URL missing' });
        }
    } catch (error) {
        console.error('Error processing the webhook:', error);
        res.status(500).json({ message: 'Error processing the render' });
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
