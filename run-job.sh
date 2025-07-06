#!/bin/bash

# Deploy the job to fly.io
echo "Deploying cache build job to fly.io..."

# Check if the app already exists
if fly apps list | grep -q "mitre-riders-job"; then
  echo "App already exists, deploying new version..."
else
  echo "Creating new app..."
  fly apps create mitre-riders-job
fi

# Deploy the job
fly deploy --config fly.job.toml

echo "Job deployed successfully!"
echo "You can run the job manually with: fly apps restart mitre-riders-job"

# Set up scheduled execution (daily at 2 AM UTC)
echo "Setting up scheduled execution (daily at 2 AM UTC)..."
fly machine run . --app mitre-riders-job --schedule "0 2 * * *"

echo "Scheduled job has been set up!"
echo "To modify the schedule, use: fly machine update-schedule <machine-id> --schedule \"<cron-expression>\""