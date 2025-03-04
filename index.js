
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set up file storage for attachments and recipient files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// SMTP server settings array for rotation
let smtpServers = [];
let currentSmtpIndex = 0;

// Email tracking stats
let stats = {
  totalSent: 0,
  totalFailed: 0,
  inProgress: false,
  paused: false
};

// Store processed emails to prevent duplicates
let processedEmails = new Set();

// API to add SMTP server
app.post('/api/add-smtp', (req, res) => {
  const { host, port, user, pass, secure } = req.body;
  
  if (!host || !port || !user || !pass) {
    return res.status(400).json({ success: false, message: 'All SMTP fields are required' });
  }
  
  smtpServers.push({
    host,
    port: parseInt(port),
    auth: { user, pass },
    secure: secure === 'true'
  });
  
  res.json({ success: true, message: 'SMTP server added', servers: smtpServers });
});

// API to get SMTP servers
app.get('/api/smtp-servers', (req, res) => {
  res.json({ success: true, servers: smtpServers });
});

// API to remove SMTP server
app.delete('/api/smtp-servers/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < smtpServers.length) {
    smtpServers.splice(index, 1);
    res.json({ success: true, message: 'SMTP server removed', servers: smtpServers });
  } else {
    res.status(400).json({ success: false, message: 'Invalid server index' });
  }
});

// API to test SMTP connection
app.post('/api/test-smtp', async (req, res) => {
  const { host, port, user, pass, secure } = req.body;
  
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure === 'true',
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful!' });
  } catch (error) {
    res.status(400).json({ success: false, message: `SMTP test failed: ${error.message}` });
  }
});

// API to upload recipient list
app.post('/api/upload-recipients', upload.single('recipientFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const emails = fileContent.split(/[\r\n,;]+/).map(email => email.trim()).filter(email => email);
    
    res.json({ success: true, emails });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error processing file: ${error.message}` });
  }
});

// API to send emails
app.post('/api/send-emails', upload.single('attachment'), async (req, res) => {
  const { subject, senderName, senderEmail, recipients, htmlContent } = req.body;
  
  if (smtpServers.length === 0) {
    return res.status(400).json({ success: false, message: 'No SMTP servers configured' });
  }
  
  if (!subject || !senderName || !senderEmail || !recipients || !htmlContent) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  // Start the sending process - just acknowledge the request
  stats.inProgress = true;
  stats.paused = false;
  stats.totalSent = 0;
  stats.totalFailed = 0;
  
  // Parse recipients
  const emailList = JSON.parse(recipients);
  processedEmails.clear(); // Reset processed emails for new batch
  
  // Set up mail options
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    subject,
    html: htmlContent
  };
  
  // Add attachment if provided
  if (req.file) {
    mailOptions.attachments = [
      {
        filename: req.file.originalname,
        path: req.file.path
      }
    ];
  }
  
  // Start sending process in background
  res.json({ 
    success: true, 
    message: 'Email sending process started', 
    totalRecipients: emailList.length 
  });
  
  // Process emails in the background
  processEmails(emailList, mailOptions);
});

// Function to process emails in the background
async function processEmails(emailList, mailOptions) {
  for (let i = 0; i < emailList.length; i++) {
    // Check if process was paused or cancelled
    if (stats.paused || !stats.inProgress) {
      break;
    }
    
    const email = emailList[i].trim();
    
    // Skip if email already processed (prevents duplicates)
    if (processedEmails.has(email)) {
      continue;
    }
    
    // Get next SMTP server (rotation)
    const smtpConfig = smtpServers[currentSmtpIndex];
    currentSmtpIndex = (currentSmtpIndex + 1) % smtpServers.length;
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Personalize email with variables
    const personalizedHtml = mailOptions.html
      .replace(/{Email}/g, email)
      .replace(/{Domain}/g, email.split('@')[1]);
    
    try {
      // Ensure content-type is set for HTML
      await transporter.sendMail({
        ...mailOptions,
        to: email,
        html: personalizedHtml,
        alternatives: [
          {
            contentType: 'text/html; charset=utf-8',
            content: personalizedHtml
          }
        ]
      });
      
      // Mark as processed and update stats
      processedEmails.add(email);
      stats.totalSent++;
    } catch (error) {
      console.error(`Failed to send to ${email}:`, error);
      stats.totalFailed++;
      
      // Implement retry mechanism (max 3 attempts)
      if (!email.retryCount || email.retryCount < 3) {
        email.retryCount = (email.retryCount || 0) + 1;
        emailList.push(email); // Add back to queue
      }
    }
    
    // Small delay to prevent overwhelming SMTP servers
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  stats.inProgress = false;
}

// API to get current status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    stats
  });
});

// API to pause/resume sending
app.post('/api/pause-resume', (req, res) => {
  const { action } = req.body;
  
  if (action === 'pause') {
    stats.paused = true;
    res.json({ success: true, message: 'Email sending paused' });
  } else if (action === 'resume') {
    stats.paused = false;
    res.json({ success: true, message: 'Email sending resumed' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid action' });
  }
});

// API to cancel sending
app.post('/api/cancel', (req, res) => {
  stats.inProgress = false;
  stats.paused = false;
  res.json({ success: true, message: 'Email sending cancelled' });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
