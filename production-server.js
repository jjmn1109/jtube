const express = require('express');
const path = require('path');
const cors = require('cors');

// Import your existing server setup
const app = require('./server/server.js');

// Serve React build files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Handle React routing - send all requests to React app
  app.get('*', (req, res) => {
    // Don't interfere with API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return;
    }
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}

module.exports = app;
