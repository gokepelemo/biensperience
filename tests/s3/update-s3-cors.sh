#!/bin/bash

# Script to update S3 bucket CORS policy
# Reads configuration from .env file or uses environment variables
# Make sure AWS CLI is installed and configured with your credentials

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
elif [ -f .env.local ]; then
    echo "📁 Loading environment variables from .env.local file..."
    export $(grep -v '^#' .env.local | xargs)
fi

# Use environment variable or default to "biensperience"
BUCKET_NAME="${BUCKET_NAME:-biensperience}"
CORS_FILE="s3-cors-policy.json"

# Optional: Set AWS region from environment variable
if [ ! -z "$AWS_REGION" ]; then
    export AWS_DEFAULT_REGION="$AWS_REGION"
fi

echo "🔧 Updating CORS policy for S3 bucket: $BUCKET_NAME"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "❌ AWS CLI is not installed."
    echo ""
    echo "📦 Install it with:"
    echo "   brew install awscli  (macOS)"
    echo "   pip install awscli   (Python)"
    echo ""
    echo "🔑 Then configure with: aws configure"
    exit 1
fi

# Check if CORS file exists
if [ ! -f "$CORS_FILE" ]; then
    echo "❌ CORS policy file not found: $CORS_FILE"
    exit 1
fi

# Display the CORS policy
echo "📋 CORS Policy to be applied:"
cat $CORS_FILE
echo ""

# Apply the CORS policy
echo "🚀 Applying CORS policy..."

# Get the absolute path to the CORS file
CORS_FILE_PATH="$(pwd)/$CORS_FILE"

# Apply using absolute path
aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration "file://$CORS_FILE_PATH" 2>&1

RESULT=$?

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ CORS policy successfully applied to bucket: $BUCKET_NAME"
    echo ""
    echo "🔍 Verifying CORS configuration..."
    aws s3api get-bucket-cors --bucket $BUCKET_NAME
    echo ""
    echo "✨ Done! Your S3 images should now load in the browser."
    echo ""
    echo "💡 If issues persist, try:"
    echo "   1. Clear your browser cache"
    echo "   2. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)"
    echo "   3. Check bucket permissions (should be public read)"
else
    echo ""
    echo "❌ Failed to apply CORS policy."
    echo ""
    echo "🔍 Common issues:"
    echo "   1. AWS credentials not configured (run: aws configure)"
    echo "   2. Insufficient permissions for the bucket"
    echo "   3. Bucket name incorrect"
    echo ""
    echo "📖 Manual setup instructions:"
    echo "   1. Go to: https://console.aws.amazon.com/s3/"
    echo "   2. Click on bucket: $BUCKET_NAME"
    echo "   3. Go to 'Permissions' tab"
    echo "   4. Scroll to 'Cross-origin resource sharing (CORS)'"
    echo "   5. Click 'Edit' and paste the JSON from $CORS_FILE"
    echo "   6. Click 'Save changes'"
fi
