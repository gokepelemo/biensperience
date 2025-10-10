# Copilot Instructions

## Platform Purpose
Biensperience is a visual travel experience platform that enables users to plan experiences and share their plans with other users who can plan similar experiences. Users can create detailed travel plans with checklists, photos, and hierarchical plan items, then share these experiences to inspire and guide others in planning their own adventures.

## Architecture & Technology Stack
- **Frontend**: React 18 with React Router, Bootstrap 5, React Icons
- **Backend**: Node.js with Express.js, MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: AWS S3 for image uploads
- **Security**: Helmet, CORS, rate limiting, input sanitization
- **Deployment**: PM2 process manager, DigitalOcean App Platform

## Data Models & Relationships
- **Experience**: Core entity with name, destination, plan_items (hierarchical), photo, user relationships
- **Destination**: Travel locations with fuzzy matching for duplicates
- **Photo**: Image assets stored in AWS S3 with metadata
- **User**: Authentication and profile management with experience relationships
- **Plan Items**: Hierarchical checklist items with photos, URLs, cost estimates, and planning days

## Security Considerations
- **Input Validation**: Strict validation for all user inputs, ObjectId conversion for database queries
- **Error Handling**: Never expose stack traces in production, use custom APIError class
- **Authentication**: JWT tokens with proper validation, bcrypt for password hashing
- **File Uploads**: Path traversal protection, filename sanitization
- **Rate Limiting**: Express rate limiting to prevent abuse
- **Regex Security**: Avoid vulnerable regex patterns, use escapeRegex utility for user inputs

## Error Handling Patterns
- Use `APIError` class for consistent error responses
- Implement `withErrorHandling` wrapper for async functions
- Provide user-friendly error messages via `getErrorMessage` utility
- Never expose internal error details to clients

## Utility Functions
- **Fuzzy Matching**: Levenshtein distance for duplicate detection with input length limits
- **Deduplication**: String similarity calculations for destination management
- **Error Handling**: Centralized error management with user-friendly messages
- **Send Request**: HTTP request utilities with error handling
- **Date Utils**: Date formatting and manipulation helpers
- **URL Utils**: URL validation and manipulation utilities

## Development Practices
- **JSDoc Documentation**: Comprehensive documentation for all utilities and functions
- **Security First**: Regular security audits and vulnerability fixes
- **Data Enrichment**: Automated scripts for populating missing experience data
- **Sample Data**: Robust sample data generation for development and testing
- **Git History**: Detailed commit messages documenting security fixes and feature additions

## Key Features
- **Experience Planning**: Hierarchical plan items with photos and cost estimates
- **Visual Travel**: Image-rich experience sharing and discovery
- **User Collaboration**: Shared planning and experience inspiration
- **Destination Management**: Fuzzy matching to prevent duplicate locations
- **Photo Integration**: AWS S3 storage with automatic enrichment