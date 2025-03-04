
// Global variables
let recipients = [];
let totalRecipients = 0;
let smtpServers = [];
let sendingInProgress = false;
let sendingPaused = false;
let statusCheckInterval;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the application
  initTabs();
  initEditor();
  loadSmtpServers();
  setupEventListeners();
  updateRandomLogo();
});

// Initialize tabs
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all tabs
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Activate the clicked tab
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Update logo based on tab
      updateRandomLogo(tabId);
    });
  });
}

// Initialize rich text editor
function initEditor() {
  const editor = document.getElementById('emailEditor');
  const toolbar = document.querySelectorAll('.toolbar-btn');
  const preview = document.getElementById('emailPreview');
  
  // Set default content
  editor.innerHTML = `<p>Hello,</p>
<p>This is a sample email for {Email} from {Domain}.</p>
<p>Best regards,<br>Your Name</p>`;

  // Update preview with sample data for better visualization
  updateLivePreview();
  
  // Add event listeners to buttons
  toolbar.forEach(button => {
    button.addEventListener('click', () => {
      const command = button.getAttribute('data-command');
      
      if (command === 'insertHTML') {
        const value = button.getAttribute('data-value');
        document.execCommand('insertHTML', false, value);
      } else if (command === 'createLink') {
        const url = prompt('Enter URL:', 'http://');
        if (url) document.execCommand(command, false, url);
      } else if (command === 'insertImage') {
        const url = prompt('Enter image URL:', 'http://');
        if (url) document.execCommand(command, false, url);
      } else if (command === 'viewSource') {
        toggleHtmlSource();
      } else {
        document.execCommand(command, false, null);
      }
      
      // Update preview
      updateLivePreview();
    });
  });
  
  // Listen for changes in the editor
  editor.addEventListener('input', () => {
    updateLivePreview();
  });
  
  // Format block dropdown
  const formatSelect = document.querySelector('[data-command="formatBlock"]');
  formatSelect.addEventListener('change', () => {
    document.execCommand('formatBlock', false, formatSelect.value);
    updateLivePreview();
  });
  
  // Add HTML source toggle button if it doesn't exist
  if (!document.querySelector('[data-command="viewSource"]')) {
    const sourceBtn = document.createElement('button');
    sourceBtn.className = 'toolbar-btn source-btn';
    sourceBtn.setAttribute('data-command', 'viewSource');
    sourceBtn.innerHTML = '<i class="fas fa-code"></i>';
    sourceBtn.title = 'View/Edit HTML Source';
    document.querySelector('.editor-toolbar').appendChild(sourceBtn);
  }
}

// Toggle between WYSIWYG and HTML source mode
function toggleHtmlSource() {
  const editor = document.getElementById('emailEditor');
  const sourceMode = editor.getAttribute('data-source-mode') === 'true';
  
  if (sourceMode) {
    // Switch back to WYSIWYG mode
    const textarea = document.getElementById('htmlSourceEditor');
    editor.innerHTML = textarea.value;
    editor.style.display = 'block';
    textarea.remove();
    editor.setAttribute('data-source-mode', 'false');
    editor.focus();
  } else {
    // Switch to HTML source mode
    const htmlContent = editor.innerHTML;
    editor.style.display = 'none';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'htmlSourceEditor';
    textarea.className = 'html-source-editor';
    textarea.value = formatHtmlSource(htmlContent);
    
    editor.parentNode.insertBefore(textarea, editor.nextSibling);
    
    textarea.addEventListener('input', () => {
      editor.innerHTML = textarea.value;
      updateLivePreview();
    });
    
    editor.setAttribute('data-source-mode', 'true');
    textarea.focus();
  }
}

// Format HTML source for better readability
function formatHtmlSource(html) {
  return html
    .replace(/></g, '>\n<')
    .replace(/>\s+</g, '>\n<')
    .replace(/\s+</g, '\n<')
    .replace(/>\s+/g, '>\n');
}

// Update live preview with sample data
function updateLivePreview() {
  const editor = document.getElementById('emailEditor');
  const preview = document.getElementById('emailPreview');
  
  // If in source mode, get content from textarea
  let htmlContent;
  if (editor.getAttribute('data-source-mode') === 'true') {
    htmlContent = document.getElementById('htmlSourceEditor').value;
  } else {
    htmlContent = editor.innerHTML;
  }
  
  // Replace variables with sample data for preview
  let previewContent = htmlContent
    .replace(/{Email}/g, 'sample@example.com')
    .replace(/{Domain}/g, 'example.com');
  
  preview.innerHTML = previewContent;
}

// Load SMTP servers from the server
function loadSmtpServers() {
  fetch('/api/smtp-servers')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        smtpServers = data.servers;
        updateSmtpServerList();
        updateSmtpCount();
      }
    })
    .catch(error => {
      console.error('Error loading SMTP servers:', error);
    });
}

// Update SMTP server list in the UI
function updateSmtpServerList() {
  const serverList = document.getElementById('smtpServerList');
  
  if (smtpServers.length === 0) {
    serverList.innerHTML = `
      <div class="empty-state">
        No SMTP servers configured. Add at least one server above.
      </div>
    `;
    return;
  }
  
  serverList.innerHTML = '';
  
  smtpServers.forEach((server, index) => {
    const serverItem = document.createElement('div');
    serverItem.className = 'smtp-server-item';
    serverItem.innerHTML = `
      <div class="server-info">
        <div class="server-name">${server.host}</div>
        <div class="server-details">
          Port: ${server.port} | User: ${server.auth.user} | Secure: ${server.secure ? 'Yes' : 'No'}
        </div>
      </div>
      <div class="server-actions">
        <button class="test" title="Test Connection" data-index="${index}"><i class="fas fa-check-circle"></i></button>
        <button class="delete" title="Remove Server" data-index="${index}"><i class="fas fa-trash"></i></button>
      </div>
    `;
    
    serverList.appendChild(serverItem);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.server-actions .test').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'));
      testSmtpServer(smtpServers[index]);
    });
  });
  
  document.querySelectorAll('.server-actions .delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'));
      deleteSmtpServer(index);
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // SMTP server actions
  document.getElementById('testSmtp').addEventListener('click', testCurrentSmtpConfig);
  document.getElementById('addSmtp').addEventListener('click', addSmtpServer);
  
  // Recipient actions
  document.getElementById('uploadRecipients').addEventListener('click', uploadRecipientFile);
  document.getElementById('addManualRecipients').addEventListener('click', addManualRecipients);
  document.getElementById('clearRecipients').addEventListener('click', clearRecipients);
  document.getElementById('filterRecipients').addEventListener('click', filterDuplicateRecipients);
  
  // Sending actions
  document.getElementById('startSending').addEventListener('click', startSending);
  document.getElementById('pauseResume').addEventListener('click', togglePauseSending);
  document.getElementById('cancelSending').addEventListener('click', cancelSending);
  
  // Stats actions
  document.getElementById('resetCampaign').addEventListener('click', resetCampaign);
}

// Add an SMTP server
function addSmtpServer() {
  const host = document.getElementById('smtpHost').value.trim();
  const port = document.getElementById('smtpPort').value.trim();
  const user = document.getElementById('smtpUser').value.trim();
  const pass = document.getElementById('smtpPass').value.trim();
  const secure = document.getElementById('smtpSecure').value;
  
  if (!host || !port || !user || !pass) {
    showToast('Please fill all SMTP fields', 'error');
    return;
  }
  
  showLoading('Adding SMTP server...');
  
  fetch('/api/add-smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, user, pass, secure })
  })
    .then(response => response.json())
    .then(data => {
      hideLoading();
      
      if (data.success) {
        showToast('SMTP server added successfully', 'success');
        clearSmtpForm();
        smtpServers = data.servers;
        updateSmtpServerList();
        updateSmtpCount();
      } else {
        showToast(data.message || 'Failed to add SMTP server', 'error');
      }
    })
    .catch(error => {
      hideLoading();
      showToast('Failed to add SMTP server', 'error');
      console.error('Error adding SMTP server:', error);
    });
}

// Test the current SMTP configuration
function testCurrentSmtpConfig() {
  const host = document.getElementById('smtpHost').value.trim();
  const port = document.getElementById('smtpPort').value.trim();
  const user = document.getElementById('smtpUser').value.trim();
  const pass = document.getElementById('smtpPass').value.trim();
  const secure = document.getElementById('smtpSecure').value;
  
  if (!host || !port || !user || !pass) {
    showToast('Please fill all SMTP fields', 'error');
    return;
  }
  
  showLoading('Testing SMTP connection...');
  
  fetch('/api/test-smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, user, pass, secure })
  })
    .then(response => response.json())
    .then(data => {
      hideLoading();
      
      if (data.success) {
        showToast('SMTP connection successful!', 'success');
      } else {
        showToast(data.message || 'SMTP connection failed', 'error');
      }
    })
    .catch(error => {
      hideLoading();
      showToast('SMTP connection failed', 'error');
      console.error('Error testing SMTP connection:', error);
    });
}

// Test an existing SMTP server
function testSmtpServer(server) {
  showLoading('Testing SMTP connection...');
  
  fetch('/api/test-smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: server.host,
      port: server.port,
      user: server.auth.user,
      pass: server.auth.pass,
      secure: server.secure
    })
  })
    .then(response => response.json())
    .then(data => {
      hideLoading();
      
      if (data.success) {
        showToast('SMTP connection successful!', 'success');
      } else {
        showToast(data.message || 'SMTP connection failed', 'error');
      }
    })
    .catch(error => {
      hideLoading();
      showToast('SMTP connection failed', 'error');
      console.error('Error testing SMTP connection:', error);
    });
}

// Delete an SMTP server
function deleteSmtpServer(index) {
  if (confirm('Are you sure you want to remove this SMTP server?')) {
    showLoading('Removing SMTP server...');
    
    fetch(`/api/smtp-servers/${index}`, {
      method: 'DELETE'
    })
      .then(response => response.json())
      .then(data => {
        hideLoading();
        
        if (data.success) {
          showToast('SMTP server removed', 'success');
          smtpServers = data.servers;
          updateSmtpServerList();
          updateSmtpCount();
        } else {
          showToast(data.message || 'Failed to remove SMTP server', 'error');
        }
      })
      .catch(error => {
        hideLoading();
        showToast('Failed to remove SMTP server', 'error');
        console.error('Error removing SMTP server:', error);
      });
  }
}

// Upload recipient file
function uploadRecipientFile() {
  const fileInput = document.getElementById('recipientFile');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a file', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('recipientFile', fileInput.files[0]);
  
  showLoading('Uploading recipient list...');
  
  fetch('/api/upload-recipients', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      hideLoading();
      
      if (data.success) {
        recipients = [...recipients, ...data.emails];
        updateRecipientList();
        fileInput.value = '';
        showToast(`${data.emails.length} recipients added`, 'success');
      } else {
        showToast(data.message || 'Failed to upload recipients', 'error');
      }
    })
    .catch(error => {
      hideLoading();
      showToast('Failed to upload recipients', 'error');
      console.error('Error uploading recipients:', error);
    });
}

// Add manual recipients
function addManualRecipients() {
  const manualInput = document.getElementById('manualRecipients');
  const emailText = manualInput.value.trim();
  
  if (!emailText) {
    showToast('Please enter email addresses', 'error');
    return;
  }
  
  // Split by newline, comma, or semicolon
  const newEmails = emailText.split(/[\r\n,;]+/).map(email => email.trim()).filter(email => email);
  
  if (newEmails.length === 0) {
    showToast('No valid email addresses found', 'error');
    return;
  }
  
  recipients = [...recipients, ...newEmails];
  updateRecipientList();
  manualInput.value = '';
  showToast(`${newEmails.length} recipients added`, 'success');
}

// Update recipient list in the UI
function updateRecipientList() {
  const recipientList = document.getElementById('recipientList');
  const recipientCount = document.getElementById('recipientCount');
  totalRecipients = recipients.length;
  
  recipientCount.textContent = `(${totalRecipients})`;
  document.getElementById('recipientSummary').textContent = `${totalRecipients} recipients`;
  document.getElementById('statTotalRecipients').textContent = totalRecipients;
  
  if (recipients.length === 0) {
    recipientList.innerHTML = `
      <div class="empty-state">
        No recipients added. Upload a file or enter email addresses manually.
      </div>
    `;
    return;
  }
  
  recipientList.innerHTML = '';
  
  recipients.forEach((email, index) => {
    const recipientItem = document.createElement('div');
    recipientItem.className = 'recipient-item';
    recipientItem.innerHTML = `
      <div class="recipient-email">${email}</div>
      <button class="recipient-remove" data-index="${index}">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    recipientList.appendChild(recipientItem);
  });
  
  // Add event listeners to remove buttons
  document.querySelectorAll('.recipient-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'));
      recipients.splice(index, 1);
      updateRecipientList();
    });
  });
}

// Clear all recipients
function clearRecipients() {
  if (recipients.length === 0) return;
  
  if (confirm('Are you sure you want to clear all recipients?')) {
    recipients = [];
    updateRecipientList();
    showToast('All recipients cleared', 'success');
  }
}

// Filter duplicate recipients
function filterDuplicateRecipients() {
  if (recipients.length === 0) return;
  
  const originalCount = recipients.length;
  recipients = [...new Set(recipients)];
  updateRecipientList();
  
  const removedCount = originalCount - recipients.length;
  showToast(`${removedCount} duplicate(s) removed`, 'success');
}

// Start sending emails
function startSending() {
  if (sendingInProgress) {
    showToast('Sending process already in progress', 'error');
    return;
  }
  
  if (smtpServers.length === 0) {
    showToast('Please add at least one SMTP server', 'error');
    return;
  }
  
  if (recipients.length === 0) {
    showToast('Please add recipients', 'error');
    return;
  }
  
  const senderName = document.getElementById('senderName').value.trim();
  const senderEmail = document.getElementById('senderEmail').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const htmlContent = document.getElementById('emailEditor').innerHTML;
  
  if (!senderName || !senderEmail || !subject || !htmlContent) {
    showToast('Please fill all email fields', 'error');
    return;
  }
  
  // Show loading for 5 seconds as requested
  showLoading('Preparing to send emails...', 5000);
  
  // Update the campaign details in stats tab
  document.getElementById('campaignStatus').textContent = 'In progress';
  document.getElementById('campaignSubject').textContent = subject;
  document.getElementById('campaignSender').textContent = `${senderName} <${senderEmail}>`;
  document.getElementById('campaignSmtpCount').textContent = smtpServers.length;
  
  setTimeout(() => {
    const formData = new FormData();
    formData.append('senderName', senderName);
    formData.append('senderEmail', senderEmail);
    formData.append('subject', subject);
    formData.append('recipients', JSON.stringify(recipients));
    formData.append('htmlContent', htmlContent);
    
    // Add attachment if selected
    const attachmentInput = document.getElementById('emailAttachment');
    if (attachmentInput.files && attachmentInput.files.length > 0) {
      formData.append('attachment', attachmentInput.files[0]);
    }
    
    fetch('/api/send-emails', {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        hideLoading();
        
        if (data.success) {
          sendingInProgress = true;
          sendingPaused = false;
          showToast('Email sending process started', 'success');
          
          // Show the progress section
          document.getElementById('sendingProgress').classList.remove('hidden');
          document.getElementById('startSending').disabled = true;
          
          // Reset progress stats
          updateProgressStats(0, 0, recipients.length);
          updateProgressBar(0, recipients.length);
          document.getElementById('statusMessage').textContent = 'Sending emails...';
          
          // Start checking status
          startStatusChecking();
        } else {
          showToast(data.message || 'Failed to start sending process', 'error');
        }
      })
      .catch(error => {
        hideLoading();
        showToast('Failed to start sending process', 'error');
        console.error('Error starting email sending:', error);
      });
  }, 5000); // Wait 5 seconds before starting
}

// Start checking status periodically
function startStatusChecking() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  statusCheckInterval = setInterval(() => {
    fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const { totalSent, totalFailed, inProgress, paused } = data.stats;
          
          // Update stats
          updateProgressStats(totalSent, totalFailed, recipients.length);
          updateProgressBar(totalSent + totalFailed, recipients.length);
          
          // Update status
          sendingInProgress = inProgress;
          sendingPaused = paused;
          
          // Update buttons and messages
          const pauseResumeBtn = document.getElementById('pauseResume');
          pauseResumeBtn.textContent = paused ? 'Resume' : 'Pause';
          
          if (!inProgress) {
            // Process completed
            clearInterval(statusCheckInterval);
            document.getElementById('startSending').disabled = false;
            document.getElementById('statusMessage').textContent = 'Sending process completed';
            document.getElementById('campaignStatus').textContent = 'Completed';
          } else if (paused) {
            document.getElementById('statusMessage').textContent = 'Sending process paused';
            document.getElementById('campaignStatus').textContent = 'Paused';
          } else {
            document.getElementById('statusMessage').textContent = 'Sending emails...';
            document.getElementById('campaignStatus').textContent = 'In progress';
          }
        }
      })
      .catch(error => {
        console.error('Error checking status:', error);
      });
  }, 1000); // Check every second
}

// Toggle pause/resume sending
function togglePauseSending() {
  if (!sendingInProgress) return;
  
  const action = sendingPaused ? 'resume' : 'pause';
  
  fetch('/api/pause-resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        sendingPaused = !sendingPaused;
        showToast(data.message, 'success');
      } else {
        showToast(data.message || `Failed to ${action} sending process`, 'error');
      }
    })
    .catch(error => {
      showToast(`Failed to ${action} sending process`, 'error');
      console.error(`Error ${action}ing sending process:`, error);
    });
}

// Cancel sending
function cancelSending() {
  if (!sendingInProgress) return;
  
  if (confirm('Are you sure you want to cancel the sending process?')) {
    fetch('/api/cancel', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          sendingInProgress = false;
          sendingPaused = false;
          showToast('Sending process cancelled', 'success');
          document.getElementById('startSending').disabled = false;
          document.getElementById('statusMessage').textContent = 'Sending process cancelled';
          document.getElementById('campaignStatus').textContent = 'Cancelled';
          
          // Stop checking status
          clearInterval(statusCheckInterval);
        } else {
          showToast(data.message || 'Failed to cancel sending process', 'error');
        }
      })
      .catch(error => {
        showToast('Failed to cancel sending process', 'error');
        console.error('Error cancelling sending process:', error);
      });
  }
}

// Reset campaign
function resetCampaign() {
  if (sendingInProgress) {
    if (!confirm('A sending process is currently active. Cancel it and start a new campaign?')) {
      return;
    }
    
    cancelSending();
  }
  
  // Reset UI
  document.getElementById('sendingProgress').classList.add('hidden');
  document.getElementById('startSending').disabled = false;
  
  // Clear email fields
  document.getElementById('senderName').value = '';
  document.getElementById('senderEmail').value = '';
  document.getElementById('emailSubject').value = '';
  document.getElementById('emailAttachment').value = '';
  document.getElementById('emailEditor').innerHTML = `<p>Hello,</p>
<p>This is a sample email for {Email} from {Domain}.</p>
<p>Best regards,<br>Your Name</p>`;
  document.getElementById('emailPreview').innerHTML = document.getElementById('emailEditor').innerHTML;
  
  // Reset stats
  updateProgressStats(0, 0, 0);
  document.getElementById('campaignStatus').textContent = 'Not started';
  document.getElementById('campaignSubject').textContent = '-';
  document.getElementById('campaignSender').textContent = '-';
  document.getElementById('campaignSmtpCount').textContent = smtpServers.length;
  
  // Switch to compose tab
  document.querySelector('[data-tab="compose-tab"]').click();
  
  showToast('Campaign reset successfully', 'success');
}

// Update progress stats
function updateProgressStats(sent, failed, total) {
  document.getElementById('totalSent').textContent = sent;
  document.getElementById('totalFailed').textContent = failed;
  document.getElementById('totalRemaining').textContent = total - (sent + failed);
  
  // Update stats tab as well
  document.getElementById('statTotalSent').textContent = sent;
  document.getElementById('statTotalFailed').textContent = failed;
}

// Update progress bar
function updateProgressBar(current, total) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('progressBar').style.width = `${percentage}%`;
}

// Update SMTP count in sending tab
function updateSmtpCount() {
  document.getElementById('smtpCount').textContent = `${smtpServers.length} configured`;
  document.getElementById('campaignSmtpCount').textContent = smtpServers.length;
}

// Update the logo based on active tab
function updateRandomLogo(tabId) {
  const logoImage = document.getElementById('appLogo');
  let domain = 'gmail.com';
  
  if (tabId) {
    switch (tabId) {
      case 'setup-tab':
        domain = 'sendgrid.com';
        break;
      case 'compose-tab':
        domain = 'mailchimp.com';
        break;
      case 'recipients-tab':
        domain = 'constant.com';
        break;
      case 'sending-tab':
        domain = 'awscloud.com';
        break;
      case 'stats-tab':
        domain = 'google.com';
        break;
      default:
        domain = 'gmail.com';
    }
  } else {
    // Random logo on initial load
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'zoho.com', 'mailchimp.com'];
    domain = domains[Math.floor(Math.random() * domains.length)];
  }
  
  logoImage.src = `https://logo.clearbit.com/${domain}`;
  logoImage.alt = `${domain} Logo`;
}

// Clear SMTP form
function clearSmtpForm() {
  document.getElementById('smtpHost').value = '';
  document.getElementById('smtpPort').value = '';
  document.getElementById('smtpUser').value = '';
  document.getElementById('smtpPass').value = '';
  document.getElementById('smtpSecure').value = 'false';
}

// Show loading overlay
function showLoading(message, duration) {
  const overlay = document.getElementById('loadingOverlay');
  const loadingMessage = document.getElementById('loadingMessage');
  
  loadingMessage.textContent = message || 'Loading...';
  overlay.classList.remove('hidden');
  
  if (duration) {
    setTimeout(() => {
      hideLoading();
    }, duration);
  }
}

// Hide loading overlay
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('hidden');
}

// Show toast message
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
      }
      
      .toast {
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        display: flex;
        align-items: center;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        animation: slideIn 0.3s, fadeOut 0.5s 2.5s forwards;
        max-width: 300px;
      }
      
      .toast i {
        margin-right: 10px;
        font-size: 16px;
      }
      
      .toast.success {
        background-color: #34a853;
      }
      
      .toast.error {
        background-color: #ea4335;
      }
      
      .toast.info {
        background-color: #4285f4;
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
