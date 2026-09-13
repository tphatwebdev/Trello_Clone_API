# Taskly — RESTful API & Real-Time Collaboration Server (Backend)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native_Driver_6.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![JWT](https://img.shields.io/badge/JWT-Tokens-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_Streaming-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Brevo](https://img.shields.io/badge/Brevo-Transactional_Email-0B996F?logo=brevo&logoColor=white)](https://www.brevo.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 💡 **Project Branding Notice:** This application is officially branded as **Taskly**. The repository directory is named `Trello_Clone_API` for development tracking.
> 
> 🔗 **Frontend Client Repository:** [Taskly Client](https://github.com/tphatwebdev/Trello_Clone)

---

## 📌 Executive Summary

**Taskly API** is a high-performance, production-grade RESTful API and WebSocket server powering the Taskly project management platform. Designed from the ground up following **Clean 3-Layer Architecture** (Routes ➔ Validations ➔ Controllers ➔ Services ➔ Models), it delivers enterprise reliability, sub-millisecond response times, and real-time synchronization.

The server leverages the **MongoDB Native Driver** directly (without the overhead of heavy ORMs like Mongoose) to execute complex, multi-stage aggregation pipelines. It incorporates a resilient **Double-Token JWT security model (Access + Refresh Tokens in HttpOnly Cookies)**, streaming media uploads to Cloudinary directly from memory buffers, and transactional emails via Brevo.

---

## 🌟 Core Architectural Features & Engineering Highlights

### 1. Clean 3-Layer Architecture
- **Separation of Concerns:**
  - **Routes Layer (`src/routes/v1`):** Endpoints definition, middleware binding, and routing.
  - **Validation Layer (`src/validations`):** Schema-based payload validation powered by **Joi** before passing to business logic.
  - **Controller Layer (`src/controllers`):** HTTP request extraction, status code mapping, and response formatting.
  - **Service Layer (`src/services`):** Pure business logic, authorization rules, and cross-model orchestration.
  - **Model Layer (`src/models`):** Raw MongoDB driver operations, collection schemas, custom indexing, and aggregation pipelines.

### 2. High-Performance MongoDB Aggregation Pipelines
- **Single-Query Hierarchy Extraction:** Instead of making multiple round-trips to the database to fetch a board, its columns, and its cards, `boardModel.getDetails` executes a multi-stage `$aggregate` query:
  - `$match`: Board identification and membership verification (`ownerIds` or `memberIds`).
  - `$lookup`: Joins columns, cards, and user profiles.
  - `$project`: Securely strips sensitive fields (`password`, `verifyToken`) from owner and member data before serialization.
- **Relational Integrity via Embedded Subdocuments:** Cards maintain embedded comment arrays with timestamps and user details for instant retrieval without extra join complexity.

### 3. Atomic Cross-Column Card Relocation & Cascading Deletions
- **Cross-Column Support API (`/v1/boards/supports/moving_card`):** Executes coordinated updates across columns and cards:
  1. Removes card ID from origin column (`prevCardOrderIds`).
  2. Appends card ID to target column (`nextCardOrderIds`).
  3. Updates parent `columnId` on the card document.
- **Cascading Column Deletions:** Deleting a column triggers an atomic cleanup: deletes the column document, removes all associated cards via `deleteManyByColumnId`, and pulls the column ID from the parent board's `columnOrderIds`.

### 4. Enterprise Security & Authentication Model
- **Dual JWT Token Architecture:**
  - **Access Token:** Short-lived token for authorized API operations.
  - **Refresh Token:** Long-lived token used solely to renew expired access tokens.
- **HttpOnly Secure Cookies:** Both tokens are delivered and stored via `httpOnly`, `sameSite`, and `secure` cookies, rendering them inaccessible to malicious client-side JavaScript (mitigating XSS).
- **Password Hashing:** Salted hashing with `bcryptjs`.
- **Account Verification:** User registration dispatches an activation token via Brevo transactional email; unverified accounts remain inactive until confirmation.

### 5. Zero-Disk Media Streaming to Cloudinary
- **Memory Buffer Uploads:** Uses **Multer (MemoryStorage)** to accept file uploads directly into RAM buffers.
- **Streamifier Pipe:** Streams buffer data straight to Cloudinary via `CloudinaryProvider.streamUpload` without writing temporary files to server disk, maximizing I/O performance and preventing disk leaks.
- Handles user avatars and card cover images effortlessly.

### 6. Real-Time Collaboration with Socket.io
- **Bidirectional Collaboration:** WebSocket server handles instant notifications for board invitations (`FE_USER_INVITED_TO_BOARD` ➔ `BE_USER_INVITED_TO_BOARD`).
- **Clean Process Lifecycle:** Integrates `async-exit-hook` to gracefully close MongoDB connection pools and active socket connections during server shutdowns.

### 7. Centralized Error Management
- **Custom `ApiError` Class:** Uniform error structures encapsulating HTTP status codes and contextual debug messages.
- **Error Handling Middleware:** Global Express interceptor catching asynchronous errors, preventing server crashes, and returning standardized JSON error responses.

---

## 🗄️ Database Collections & Schemas

| Collection | Key Attributes | Relationships |
| :--- | :--- | :--- |
| `boards` | `title`, `slug`, `description`, `type` (public/private), `columnOrderIds`, `ownerIds`, `memberIds` | Has many `columns`, references `users` |
| `columns` | `boardId`, `title`, `cardOrderIds` | Belongs to `board`, has many `cards` |
| `cards` | `boardId`, `columnId`, `title`, `description`, `cover`, `memberIds`, `comments` (embedded) | Belongs to `column` and `board` |
| `users` | `email`, `password`, `username`, `displayName`, `avatar`, `role`, `isActive`, `verifyToken` | Owns / participates in `boards` |
| `invitations` | `inviterId`, `inviteeId`, `type`, `boardInvitation` (boardId, status: PENDING/ACCEPTED/REJECTED) | References `users` and `boards` |

---

## 🔌 RESTful API Reference

### Health Check
- `GET /v1/status` — Server health status check.

### Authentication & Users (`/v1/users`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/register` | No | Register new user account & dispatch verification email |
| `PUT` | `/verify` | No | Verify account with email verification token |
| `POST` | `/login` | No | Authenticate user & issue JWT tokens in HttpOnly cookies |
| `DELETE` | `/logout` | No | Clear authentication cookies |
| `GET` | `/refresh_token` | Yes (Cookie) | Renew access token via valid refresh token cookie |
| `PUT` | `/update` | Yes | Update profile, change password, or upload avatar (Multer) |

### Boards (`/v1/boards`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/` | Yes | Get paginated boards with optional search filters |
| `POST` | `/` | Yes | Create new board |
| `GET` | `/:id` | Yes | Get detailed board with columns, cards, and members |
| `PUT` | `/:id` | Yes | Update board details or `columnOrderIds` |
| `PUT` | `/supports/moving_card` | Yes | Atomically transfer a card between different columns |

### Columns (`/v1/columns`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/` | Yes | Create a new column in a board |
| `PUT` | `/:id` | Yes | Update column details or `cardOrderIds` |
| `DELETE` | `/:id` | Yes | Cascading delete column and all child cards |

### Cards (`/v1/cards`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/` | Yes | Create new card in a column |
| `PUT` | `/:id` | Yes | Update card (title, markdown description, cover upload, comments, members) |

### Invitations (`/v1/invitations`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/board` | Yes | Send board invitation to user via email |
| `GET` | `/` | Yes | Retrieve pending & past invitations for authenticated user |
| `PUT` | `/board/:invitationId` | Yes | Accept or reject a board invitation |

---

## 📁 Directory Structure

```
Trello_Clone_API/
├── src/
│   ├── config/             # Environment variables, CORS, and MongoDB connection
│   │   ├── cors.js         # Allowed origins and credentials configuration
│   │   ├── environment.js  # Process environment variables parser
│   │   └── mongodb.js      # MongoDB client connection pool & shutdown hooks
│   ├── controllers/        # Request handling and HTTP response dispatchers
│   ├── middlewares/        # Custom middlewares
│   │   ├── authMiddleware.js            # JWT verification & cookie parsing
│   │   ├── errorHandlingMiddleware.js  # Global centralized error catcher
│   │   └── multerUploadMiddleware.js   # Memory storage upload handler
│   ├── models/             # Data access layer (MongoDB native queries & aggregations)
│   ├── providers/          # External integrations (Brevo, Cloudinary, JWT)
│   ├── routes/v1/          # Express API route declarations
│   ├── services/           # Core business logic layer
│   ├── sockets/            # Socket.io event listeners & emitters
│   ├── utils/              # ApiError, constants, formatters, validators
│   ├── validations/        # Joi schema validations
│   └── server.js           # Server initialization and socket attachment
├── .babelrc                # Babel ES6+ compiler configuration
├── .env.example            # Environment variables template
├── .eslintrc.cjs           # ESLint configuration
└── package.json            # Manifest and dependencies
```

---

## ⚙️ Getting Started & Local Setup

### Prerequisites
- **Node.js**: `v18.x` or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster URI
- **Cloudinary Account**: For image upload credentials
- **Brevo Account**: For transactional email API key

### 1. Clone the Repository
```bash
git clone https://github.com/tphatwebdev/Trello_Clone_API.git
cd Trello_Clone_API
```

### 2. Install Dependencies
```bash
yarn install
# or
npm install
```

### 3. Environment Configuration
Copy the template file to create `.env`:
```bash
cp .env.example .env
```
Fill in the required environment variables:
```env
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
DATABASE_NAME="taskly-production"
LOCAL_DEV_APP_HOST="localhost"
LOCAL_DEV_APP_PORT=8017

AUTHOR="Trần Tiến Phát"

WEBSITE_DOMAIN_DEV="http://localhost:5173"
WEBSITE_DOMAIN_PROD="https://taskly.yourdomain.com"

BREVO_API_KEY="xkeysib-..."
ADMIN_EMAIL_ADDRESS="no-reply@taskly.com"
ADMIN_EMAIL_NAME="Taskly Support"

ACCESS_TOKEN_SECRET_SIGNATURE="your-super-secret-access-token-key"
ACCESS_TOKEN_LIFE="1h"

REFRESH_TOKEN_SECRET_SIGNATURE="your-super-secret-refresh-token-key"
REFRESH_TOKEN_LIFE="14d"

CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### 4. Run Development Server
```bash
yarn dev
# or
npm run dev
```
The server will start on `http://localhost:8017`.

### 5. Production Build
```bash
yarn build
yarn production
```

---

## 👨‍💻 Author & Contact

**Trần Tiến Phát** (tphatwebdev)
- **GitHub:** [@tphatwebdev](https://github.com/tphatwebdev)
- **Email:** [trantienphat13112004@gmail.com](mailto:trantienphat13112004@gmail.com)

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
