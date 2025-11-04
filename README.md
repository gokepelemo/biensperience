# Biensperience

_This was a General Assembly bootcamp project that is being developed for open source. Contact me with any questions about it. Find bugs? Create an issue. By all means create a PR with contributions._

A collaborative travel planning application for creating and sharing travel experiences.

## Technologies

React • MongoDB • Node.js • Express • AWS S3 • Bootstrap

## Features

- **Collaborative Planning** - Work with others on shared travel experiences
- **Destination Management** - Add and favorite destinations worldwide
- **Plan Tracking** - Mark tasks complete as you finalize plans
- **Photo Uploads** - Add photos to destinations and experiences
- **Social Authentication** - Sign in with Facebook, Google, or X (Twitter)

## Installation

### Prerequisites
- Node.js (v16+)
- MongoDB database
- AWS S3 bucket (for photos)

### Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/biensperience.git
   cd biensperience
   npm install
   ```

2. **Configure environment** - Create `.env` file:
   ```bash
   DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/db
   SECRET=your-jwt-secret
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   S3_BUCKET_NAME=your-bucket
   ```

3. **Generate sample data**
   ```bash
   node sampleData.js
   # Creates 180 users, 90 destinations, 270 experiences, 450 plans, 600 photos

   # Custom counts:
   node sampleData.js --users 50 --destinations 20 --experiences 100
   ```

4. **Start development**
   ```bash
   npm start  # Frontend: http://localhost:3000
              # Backend: http://localhost:3001
   ```

## Development

```bash
npm test                    # Frontend tests
npm run test:api            # Backend tests
npm run build               # Production build
```

## Documentation

See `documentation/` for detailed guides on OAuth setup, permissions framework, security, and API reference.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

Report bugs via [Issues](https://github.com/gokepelemo/biensperience/issues).

## License

AGPL-3.0 © 2025 Goke Pelemo - See [LICENSE](LICENSE) for details.

Network use requires source code disclosure. See [LICENSE](LICENSE) for full terms.

## Trademark

"Biensperience" is a trademark of Goke Pelemo. See [TRADEMARK.md](TRADEMARK.md) for usage policy.

---

© 2025 Goke Pelemo. All rights reserved.
