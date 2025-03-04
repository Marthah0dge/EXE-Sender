
# Bulk Email Sender

A powerful web application for sending bulk emails with variable support and SMTP rotation.

## Features

- Multiple SMTP server configuration and rotation
- Email personalization with variables ({Email}, {Domain})
- Attachment support
- Recipient list upload
- Sending statistics tracking
- Pause, resume, and cancel functionality

## Installation

1. Clone this repository
2. Install dependencies with `npm install`
3. Start the server with `npm start`

## Usage

1. Configure SMTP servers
2. Upload recipient list
3. Compose your email with HTML support
4. Send to your recipients

## API Endpoints

- `/api/add-smtp`: Add a new SMTP server
- `/api/smtp-servers`: Get configured SMTP servers
- `/api/test-smtp`: Test SMTP connection
- `/api/upload-recipients`: Upload recipient list
- `/api/send-emails`: Send emails to recipients
- `/api/status`: Get current sending status
- `/api/pause-resume`: Pause or resume sending
- `/api/cancel`: Cancel email sending

## License

ISC
