# Barbershop Booking System

A full-stack web application for managing barbershop appointments. Customers can browse services and book appointments, while admins can review and manage bookings through a protected dashboard.

> **Note:** This is a learning project built to practice full-stack development — backend API design, authentication, and vanilla frontend (no frameworks). Built as a first backend project.

## Features

- **Role selection** — the landing page lets visitors continue as a customer or an admin
- **Customer accounts** — customers register with a name, phone number, and password, then log in to book
- **Booking page** — customers select a service, pick a date and an available time, and submit a booking
- **My bookings** — customers can see their bookings and whether each one was approved or rejected
- **Cancellation** — customers can cancel their own pending or approved booking up to 1 hour before it starts
- **Booking limit** — each account can hold up to 2 active bookings (not rejected or cancelled, and not yet past)
- **Automatic cleanup** — bookings are permanently deleted 3 days after their booking date
- **Live availability** — time slots that are past, full, or would end after closing are disabled
- **Capacity rules** — open 10:00–21:00 with up to 5 barbers working at the same time, enforced by the server
- **Admin authentication** — secure login with JWT and bcrypt-hashed passwords
- **Admin dashboard** — view all bookings with pagination, approve or reject pending ones
- **Role-based access** — customer tokens can't reach admin endpoints, and vice versa
- **Rate limiting** — login, registration, and booking endpoints protected against abuse
- **Responsive design** — works on both desktop and mobile

## Tech Stack

**Backend**
- Node.js
- Express
- PostgreSQL
- JSON Web Token (JWT) for authentication
- bcryptjs for password hashing
- express-rate-limit, with counters stored in PostgreSQL

**Frontend**
- HTML, CSS, vanilla JavaScript (no framework)
- Fetch API for communication with the backend

## Project Structure

```
barbershop-booking/
├── public/                  # Frontend (served as static files)
│   ├── css/
│   │   └── style.css
│   ├── fonts/
│   │   └── BarberChop.otf
│   ├── images/
│   │   └── logo.svg
│   ├── js/
│   │   ├── booking.js
│   │   ├── admin-login.js
│   │   ├── admin-dashboard.js
│   │   ├── customer-auth.js
│   │   ├── customer-session.js
│   │   ├── my-bookings.js
│   │   ├── format.js
│   │   ├── password-toggle.js
│   │   ├── pickers.js       # Custom service, date, and time pickers
│   │   ├── service-list.js
│   │   └── toast.js
│   ├── index.html           # Landing page: choose customer or admin
│   ├── customer-login.html  # Customer login
│   ├── customer-register.html # Customer registration
│   ├── booking.html         # Booking page (customer login required)
│   ├── my-bookings.html     # A customer's own bookings and their status
│   ├── admin-login.html     # Admin login
│   └── admin-dashboard.html # Admin dashboard
├── src/
│   ├── db/
│   │   ├── pool.js          # PostgreSQL connection
│   │   ├── cleanup-bookings.js # Deletes old bookings on a schedule
│   │   ├── migrate.js       # Creates or updates the tables
│   │   ├── seed-admin.js    # Script to create the first admin
│   │   ├── set-admin-password.js # Script to change an admin's password
│   │   └── seed-services.js # Script to add the service list
│   ├── middleware/
│   │   └── auth.js          # JWT verification and role checks
│   ├── routes/
│   │   ├── services.js
│   │   ├── bookings.js
│   │   ├── cron.js          # Scheduled cleanup endpoint for Vercel Cron
│   │   └── auth.js
│   └── utils/
│       ├── postgres-rate-limit-store.js # Rate limit counters shared across instances
│       └── schedule.js      # Opening hours, slots, and barber capacity
├── server.js                # Entry point
├── vercel.json              # Vercel Cron schedule
├── .env.example             # Environment variable template
├── .env                     # Environment variables (not committed)
└── package.json
```

## API Endpoints

| Method | Endpoint          | Access      | Description                       |
|--------|-------------------|-------------|-----------------------------------|
| GET    | `/services`       | Public      | List all available services       |
| GET    | `/bookings/availability` | Customer (JWT) | Time slots for `?date=&service_id=` |
| GET    | `/bookings/mine`  | Customer (JWT) | The logged-in customer's 50 latest bookings |
| POST   | `/bookings`       | Customer (JWT) | Create a new booking           |
| POST   | `/bookings/:id/cancel` | Customer (JWT) | Cancel the customer's own booking |
| GET    | `/bookings`       | Admin (JWT) | List bookings (`?page=&limit=`, max 100; total in `X-Total-Count`) |
| PATCH  | `/bookings/:id`   | Admin (JWT) | Approve or reject a pending booking |
| POST   | `/auth/login`     | Public      | Admin login, returns a JWT token  |
| POST   | `/auth/customer/register` | Public | Create a customer account, returns a JWT token |
| POST   | `/auth/customer/login` | Public | Customer login, returns a JWT token |
| GET    | `/cron/cleanup`   | `CRON_SECRET` | Deletes old bookings and expired rate limit counters |

## Setup

### Prerequisites

- Node.js installed
- PostgreSQL installed and running

### 1. Clone the repository

```bash
git clone https://github.com/dappervire/barbershop-booking-website.git
cd barbershop-booking-website
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a PostgreSQL database named `barbershop`, copy `.env.example` to `.env`, and fill it in. Also set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for the next steps.

> Never commit your `.env` file. It is already listed in `.gitignore`.

### 4. Set up the database

```bash
node src/db/migrate.js
```

It's safe to run again on an existing database: it only adds what's missing, and your bookings are kept.

### 5. Create the first admin

```bash
node src/db/seed-admin.js
```

This creates an admin account using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env`.

To change the password of an existing admin later, update those values in `.env` and run:

```bash
node src/db/set-admin-password.js
```

Then add the service list:

```bash
node src/db/seed-services.js
```

It's safe to run again: services whose name already exists are skipped.

### 6. Run the server

```bash
node server.js
```

The app will be available at `http://localhost:3000`.

## Deployment

The app is set up for Vercel (frontend and Express API) with Supabase (PostgreSQL):

- Use Supabase's **transaction pooler** connection string (port `6543`) as `DATABASE_URL`.
- Set `DATABASE_URL`, `JWT_SECRET`, and `CRON_SECRET` as environment variables in Vercel.
- Run `migrate.js`, `seed-admin.js`, and `seed-services.js` once against the Supabase database.
- `vercel.json` runs the booking cleanup once a day through Vercel Cron.

## Usage

- Visit `http://localhost:3000` and choose **Pelanggan** or **Admin**.
- Customers register or log in, book from `/booking.html`, and track their bookings at `/my-bookings.html`.
- Admins log in, then manage bookings from the dashboard.

## What I Learned

This project helped me practice:

- Building a REST API with Express and PostgreSQL
- JWT authentication and password hashing with bcryptjs
- DOM manipulation and the Fetch API in vanilla JavaScript
- Connecting a frontend to a backend through a single Express server
- Debugging with browser DevTools
- Responsive design with CSS Flexbox and media queries

## Author

**Fatih** — [@dappervire](https://github.com/dappervire)
