# S3 CORS Configuration Fix

## Problem
Images hosted on AWS S3 are being blocked by browser CORS policy with error:
```
Access to image at 'https://biensperience.s3.amazonaws.com/xxx.png' from origin 
'http://localhost:3001' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' 
header is present on the requested resource.
```

## Root Cause
The S3 bucket `biensperience` doesn't have CORS (Cross-Origin Resource Sharing) headers configured, so browsers block loading images from S3 when accessed from your application's domain.

## Solution Overview
Configure the S3 bucket to allow cross-origin requests from your application domains.

## Quick Fix

### Method 1: Automated Script (Requires AWS CLI)

1. **Run the setup script**:
   ```bash
   ./update-s3-cors.sh
   ```

2. **If AWS CLI not installed**:
   ```bash
   # macOS
   brew install awscli
   
   # Or via Python
   pip install awscli
   
   # Configure credentials
   aws configure
   ```

3. **Enter your AWS credentials** when prompted by `aws configure`:
   - AWS Access Key ID: (from your .env ACCESS_KEY_ID)
   - AWS Secret Access Key: (from your .env SECRET_ACCESS_KEY)
   - Default region: us-east-1 (or your AWS_REGION)
   - Default output format: json

### Method 2: AWS Console (Manual)

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)

2. Click on your bucket: **biensperience**

3. Navigate to the **Permissions** tab

4. Scroll down to **Cross-origin resource sharing (CORS)** section

5. Click **Edit**

6. Paste this CORS configuration:
   ```json
   [
       {
           "AllowedHeaders": [
               "*"
           ],
           "AllowedMethods": [
               "GET",
               "HEAD"
           ],
           "AllowedOrigins": [
               "http://localhost:3000",
               "http://localhost:3001",
               "https://biensperience.com",
               "https://www.biensperience.com",
               "https://*.biensperience.com"
           ],
           "ExposeHeaders": [
               "ETag"
           ],
           "MaxAgeSeconds": 3000
       }
   ]
   ```

7. Click **Save changes**

8. **Verify** by clicking on the CORS section again - you should see your policy

## CORS Policy Explanation

### AllowedHeaders
```json
"AllowedHeaders": ["*"]
```
- Allows any HTTP headers in requests
- Necessary for browsers to include headers like `Content-Type`

### AllowedMethods
```json
"AllowedMethods": ["GET", "HEAD"]
```
- **GET**: Allows downloading/viewing images
- **HEAD**: Allows checking if images exist without downloading
- **Note**: No PUT/POST/DELETE needed since uploads happen server-side

### AllowedOrigins
```json
"AllowedOrigins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://biensperience.com",
    "https://www.biensperience.com",
    "https://*.biensperience.com"
]
```
- **localhost:3000**: React development server (default)
- **localhost:3001**: Your custom development port
- **biensperience.com**: Production domain
- **www.biensperience.com**: Production www subdomain
- **\*.biensperience.com**: Any subdomain (staging, beta, etc.)

### ExposeHeaders
```json
"ExposeHeaders": ["ETag"]
```
- Exposes the ETag header to JavaScript
- Useful for caching and checking if images changed

### MaxAgeSeconds
```json
"MaxAgeSeconds": 3000
```
- Browser caches CORS preflight response for 3000 seconds (50 minutes)
- Reduces redundant OPTIONS requests

## Verification Steps

### 1. Check CORS Configuration (AWS CLI)
```bash
aws s3api get-bucket-cors --bucket biensperience
```

Expected output:
```json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": [
                "http://localhost:3000",
                "http://localhost:3001",
                "https://biensperience.com",
                "https://www.biensperience.com",
                "https://*.biensperience.com"
            ],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
```

### 2. Test in Browser
1. **Clear browser cache**:
   - Chrome: Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
   - Select "Cached images and files"
   - Click "Clear data"

2. **Hard refresh your application**:
   - Mac: Cmd+Shift+R
   - Windows/Linux: Ctrl+Shift+R

3. **Open Developer Console** (F12 or Cmd+Option+I)
   - Go to **Network** tab
   - Filter by "Img"
   - Reload page
   - Look for your S3 images
   - Click on an image request
   - Check **Response Headers** - should include:
     ```
     access-control-allow-origin: http://localhost:3001
     access-control-allow-methods: GET, HEAD
     ```

### 3. Test CORS with curl
```bash
# Test from localhost:3001
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -I https://biensperience.s3.amazonaws.com/456-biensperience.png
```

Expected headers in response:
```
HTTP/1.1 200 OK
access-control-allow-origin: http://localhost:3001
access-control-allow-methods: GET, HEAD
access-control-max-age: 3000
```

## Troubleshooting

### Issue: Still Getting CORS Errors

**1. Clear Browser Cache**
- CORS responses are cached by browsers
- Clear cache or use Incognito/Private mode

**2. Check Bucket Public Access**
```bash
aws s3api get-bucket-policy-status --bucket biensperience
```

If bucket is not public, make objects public:
```bash
aws s3api put-bucket-policy --bucket biensperience --policy file://bucket-policy.json
```

Where `bucket-policy.json` contains:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::biensperience/*"
        }
    ]
}
```

**3. Verify Origin Matches Exactly**
- Origin must match exactly (including http/https and port)
- Check your application URL in browser address bar
- Update AllowedOrigins if different

**4. Check Preflight Requests**
- In browser DevTools > Network tab
- Look for OPTIONS requests to S3
- These should return 200 OK with CORS headers

### Issue: AWS CLI Command Fails

**Error: "Unable to locate credentials"**
```bash
# Configure AWS credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

**Error: "Access Denied"**
- Your IAM user needs `s3:PutBucketCORS` permission
- Contact AWS admin or use AWS Console method

**Error: "Bucket does not exist"**
- Verify bucket name is correct: `biensperience`
- Check you're in the correct AWS region

### Issue: Works on Localhost but Not Production

**Update AllowedOrigins** to include your production domain:
```json
"AllowedOrigins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://biensperience.com",           // ✅ Add this
    "https://www.biensperience.com",       // ✅ Add this
    "https://*.biensperience.com"          // ✅ Add this for subdomains
]
```

## Security Considerations

### What This Does NOT Do
- ❌ Does not make your S3 bucket public (that's a separate setting)
- ❌ Does not allow uploads from browser (no PUT/POST methods)
- ❌ Does not expose sensitive headers (only ETag)

### What This DOES
- ✅ Allows browsers to display images from your domains
- ✅ Restricts access to specified origins only
- ✅ Only allows GET/HEAD (read-only) operations

### Best Practices
1. **Limit AllowedOrigins** to only your actual domains
2. **Don't use wildcards** for AllowedOrigins in production (except subdomains)
3. **Only allow GET/HEAD** for public image viewing
4. **Uploads should happen server-side** (already implemented in your app)

## Alternative Solutions

### Option 1: CloudFront CDN (Recommended for Production)
Use AWS CloudFront in front of S3:
- Better performance (global CDN)
- Automatic CORS handling
- SSL/TLS support
- Lower costs for high traffic

### Option 2: Proxy Through Backend (Not Recommended)
Create an endpoint like `/api/images/:key` that:
- Fetches from S3 server-side
- Streams to client
- **Downside**: Increased server load and bandwidth

### Option 3: Pre-signed URLs
Generate pre-signed URLs for images:
- Temporary access without CORS
- Good for private content
- **Downside**: URLs expire, complexity

## Files Created

### s3-cors-policy.json
Contains the CORS policy configuration that can be:
- Applied via AWS CLI
- Copy-pasted into AWS Console
- Versioned in git for documentation

### update-s3-cors.sh
Automated script that:
- Checks for AWS CLI
- Applies CORS policy
- Verifies configuration
- Provides helpful error messages

## Related AWS Documentation
- [CORS Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
- [AWS CLI S3 API](https://docs.aws.amazon.com/cli/latest/reference/s3api/)

## Environment Variables Reference
Your `.env` file should have:
```env
# AWS S3 Configuration
BUCKET_NAME=biensperience
AWS_REGION=us-east-1
ACCESS_KEY_ID=your_access_key_here
SECRET_ACCESS_KEY=your_secret_key_here
```

These are already configured in your application for server-side uploads.

## Quick Command Reference

```bash
# Apply CORS policy
./update-s3-cors.sh

# Or manually with AWS CLI
aws s3api put-bucket-cors \
  --bucket biensperience \
  --cors-configuration file://s3-cors-policy.json

# View current CORS configuration
aws s3api get-bucket-cors --bucket biensperience

# Delete CORS configuration (if needed)
aws s3api delete-bucket-cors --bucket biensperience

# Check bucket policy
aws s3api get-bucket-policy --bucket biensperience

# List bucket contents
aws s3 ls s3://biensperience/
```

## After Applying Fix

Once CORS is configured:
1. ✅ Images will load in browser without errors
2. ✅ User avatars will display correctly
3. ✅ Photo galleries will work
4. ✅ Experience/destination photos will show
5. ✅ No more "blocked by CORS policy" errors

Clear your browser cache and hard refresh to see the changes immediately!

## Support

If you continue having issues:
1. Check browser console for exact error messages
2. Verify CORS policy is applied: `aws s3api get-bucket-cors --bucket biensperience`
3. Test with curl command above
4. Ensure bucket has public read access for objects
5. Try accessing image URL directly in browser (should work)

## Summary

**Problem**: S3 images blocked by CORS policy
**Solution**: Configure S3 bucket CORS to allow your domains
**Method**: Run `./update-s3-cors.sh` or use AWS Console
**Result**: Images load successfully in browser from all your domains
