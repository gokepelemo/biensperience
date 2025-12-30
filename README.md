# Biensperience

_This was a General Assembly bootcamp final project that is being developed with AI agents for open source. Contact me with any questions about it. Find bugs? Create an issue. By all means create a PR with contributions._

A collaborative travel planning application for creating and sharing travel experiences.

## Technologies

React • MongoDB • Bun • Express • AWS S3 • Bootstrap

## Features

- **Collaborative Planning** - Work with others on shared travel experiences
- **Destination Management** - Add and favorite destinations worldwide
- **Plan Tracking** - Mark tasks complete as you finalize plans
- **Photo Uploads** - Add photos to destinations and experiences
- **Social Authentication** - Sign in with Facebook, Google, or X (Twitter)

## Installation

### Prerequisites
- Bun (v1.0+)
- MongoDB Atlas account (recommended - free tier available at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))
- AWS S3 bucket (for photo storage)
- PM2 (`bunx pm2`)

### Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/gokepelemo/biensperience.git
   cd biensperience
   bun install
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

3. **Create upload directories** (required for file uploads)
   ```bash
   mkdir -p uploads/images uploads/documents uploads/temp
   ```
   These directories store user-uploaded content and are gitignored.

4. **Generate sample data** (optional)
   ```bash
   bun run sampleData.js
   # Creates 180 users, 90 destinations, 270 experiences, 450 plans, 600 photos
   ```

5. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   # API: http://localhost:3000
   # Frontend: http://localhost:3001
   ```

   **Development mode** (without PM2):
   ```bash
   npm start
   # Frontend: http://localhost:3001
   # API: http://localhost:3000
   ```

## Development

**PM2 Commands**:
```bash
pm2 start ecosystem.config.js    # Start application
pm2 logs                          # View logs
pm2 stop all                      # Stop application
pm2 restart all                   # Restart application
pm2 delete all                    # Remove from PM2
```

**Testing**:
```bash
bun test                    # Frontend tests
bun run test:api            # Backend tests
bun run build               # Production build
```

**UI Design System & Storybook**:
```bash
bun run storybook           # Start Storybook at http://localhost:6006
```

Storybook provides interactive documentation for all UI components, design tokens, and patterns. Browse:
- **Components** - Reusable UI components (buttons, cards, forms, navigation)
- **Design System** - Colors, typography, spacing, utilities, and patterns
- **Layouts** - Common page layouts and authentication flows

All components follow the design system with full dark mode support and responsive design.
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
