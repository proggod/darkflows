module.exports = {
  apps: [{
    name: 'darkflows',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      SESSION_SECRET: 'your-secret-here'
    }
  }]
} 