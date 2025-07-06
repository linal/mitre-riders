#!/bin/bash

# Set up scheduled execution for the cache build job
APP_NAME="mitre-riders-job"

echo "Setting up scheduled execution..."

# Create a scheduled job using fly cron
fly cron create --app $APP_NAME --job cache-build --schedule "0 2 * * *"

echo "Scheduled job has been set up!"
echo "To view your scheduled jobs:"
echo "  fly cron list --app $APP_NAME"
echo ""
echo "To update the schedule:"
echo "  fly cron update --app $APP_NAME --job cache-build --schedule \"<cron-expression>\""