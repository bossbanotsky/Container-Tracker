# ContainerRepairPro

ContainerRepairPro is a professional management system for container repair tracking and automated invoicing. It allows businesses to track the status of local and foreign containers, manage repair history, and generate digital invoices with ease.

## Features

- **Container Tracking**: Manage repair status (Active, Repairing, Repaired, Invoiced, Archived) for containers.
- **Identity Management**: Support for both Local Identity and Foreign Serial codes for accurate tracking.
- **Invoice Management**: Automated invoice generation for repaired containers with status tracking and history.
- **Digital Records**: Detailed history logs for every container and invoice.
- **Analytics Dashboard**: (Planned) Overview of repair efficiency and billing.
- **Real-time Updates**: Powered by Google Firebase for seamless synchronization.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Database / Auth**: Google Firebase (Firestore & Authentication)
- **UI Components**: shadcn/ui, Radix UI, Base UI
- **Icons**: Lucide React
- **Animations**: Motion (formerly Framer Motion)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Configuration

1. **Firebase Setup**:
   - Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
   - Enable Firestore and Authentication (Google Login).
   - Create a web app in your Firebase project and copy the configuration.
   - Replace the values in `firebase-applet-config.json` (or your preferred config location) with your project details.

2. **Environment Variables**:
   - Copy `.env.example` to `.env`.
   - Add your `GEMINI_API_KEY` (if using AI features).

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

## Deployment

The application is optimized for deployment via Cloud Run or any static hosting service (once built). For AI Studio users, the application can be deployed directly through the "Deploy" workflow.

## License

MIT
