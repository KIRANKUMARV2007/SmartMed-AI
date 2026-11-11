# 🏥 SmartMed AI — Intelligent Hospital Operations & Resource Management

**SmartMed AI** is an AI-powered hospital operations and resource management platform designed to improve hospital efficiency through predictive maintenance, equipment utilization analysis, intelligent recommendations, and centralized operational management.

The platform combines a modern web application, a Node.js REST API, MongoDB database, and a Python-based machine learning microservice to provide data-driven insights into hospital operations.

---

## 🌟 Project Overview

Hospitals manage numerous medical devices, equipment, operational resources, and interconnected departments. Inefficient resource allocation, unexpected equipment failures, and limited operational visibility can affect hospital efficiency.

SmartMed AI aims to address these challenges by integrating machine learning models with a centralized hospital management platform.

The system provides:

- Predictive maintenance risk analysis for hospital equipment.
- Equipment utilization analysis using machine learning clustering.
- Intelligent recommendations using classification models.
- Centralized management of hospital operational information.
- Real-time communication between the frontend, backend, database, and ML services.

**Project Goal:** To make hospital operations more efficient, organized, and data-driven through AI and machine learning.

---

## ✨ Key Features

### 1. Predictive Maintenance

Uses a Random Forest machine learning model to estimate equipment maintenance or failure risk based on operational input data.

- Predictive maintenance risk scoring.
- Early identification of potentially problematic equipment.
- Supports proactive maintenance planning.

### 2. Equipment Utilization Analysis

Uses the K-Means clustering algorithm to analyze equipment utilization patterns.

- Groups equipment based on utilization characteristics.
- Helps identify underutilized and heavily utilized resources.
- Supports better equipment allocation and planning.

### 3. Intelligent Recommendation System

Uses a Random Forest classification model to generate recommendations based on the supplied operational and candidate features.

- Machine learning-based classification.
- Automated recommendation generation.
- Supports data-driven operational decisions.

### 4. Centralized Hospital Management

Provides a web-based interface for accessing and managing hospital operational information.

- Centralized dashboard.
- Backend API integration.
- Database-backed data management.
- Integrated machine learning services.

---

## 🧠 AI & Machine Learning Architecture

SmartMed AI uses a separate Python microservice built with FastAPI and Scikit-learn.

| Model | Algorithm | Purpose |
|---|---|---|
| Predictive Maintenance | Random Forest | Equipment maintenance risk prediction |
| Utilization Analysis | K-Means | Equipment utilization clustering |
| Recommendation Engine | Random Forest | Intelligent classification-based recommendations |

### Machine Learning Workflow

1. Receive operational input data from the backend.
2. Forward the input to the Python ML microservice.
3. Process the input using the corresponding trained model.
4. Generate predictions, clusters, or recommendations.
5. Return the result to the Node.js backend.
6. Deliver the response to the frontend.

**Model Training Disclosure:** The current machine learning models are trained using synthetic hospital operational data. Their outputs are intended for demonstration and operational decision-support purposes. They are not clinically validated and must not be treated as medical diagnoses or independently relied upon for clinical decisions.

---

## 🏗️ System Architecture

SmartMed AI follows a modular, service-oriented architecture.

```text
              USER
                |
                v
       REACT + VITE FRONTEND
                |
                | REST API
                v
        NODE.JS + EXPRESS
             BACKEND
                |
          +-----+------+
          |            |
          v            v
      MONGODB       PYTHON ML
       ATLAS        MICROSERVICE
                       |
                       v
                 SCIKIT-LEARN
                  ML MODELS
                       |
                       v
                 PREDICTIONS
                       |
                       v
                NODE.JS BACKEND
                       |
                       v
                 FRONTEND UI
```

### Architecture Components

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | React, Vite | User interface and interaction |
| Backend | Node.js, Express.js | REST API and application logic |
| Database | MongoDB Atlas, Mongoose | Persistent data storage |
| ML Service | Python, FastAPI | Machine learning inference |
| ML Algorithms | Scikit-learn | Predictive and analytical models |
| Deployment | Vercel, Render | Application hosting |

---

## 🛠️ Technology Stack

### Frontend
- React
- JavaScript
- Vite
- HTML5
- CSS3

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- CORS

### Artificial Intelligence & Machine Learning
- Python
- FastAPI
- Uvicorn
- Scikit-learn
- NumPy
- Pandas
- Joblib

### Deployment & Infrastructure
- Git and GitHub
- Vercel
- Render
- MongoDB Atlas

---

## 📁 Project Structure

```text
SmartMed-AI/
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── data/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.js
│   │
│   ├── ml/
│   │   ├── ml_service.py
│   │   ├── requirements.txt
│   │   └── ...
│   │
│   ├── test/
│   └── package.json
│
├── test/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
└── README.md
```

*Note: This is a high-level representation of the repository structure. Some subdirectories and files have been abbreviated.*

---

## ⚙️ Installation and Local Setup

### Prerequisites

Install the following before running the project:

- Node.js
- npm
- Python 3.12.5
- MongoDB Atlas account or accessible MongoDB instance
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/KIRANKUMARV2007/SmartMed-AI.git
cd SmartMed-AI
```

### 2. Configure the Frontend

Install frontend dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:5173
```

### 3. Configure the Backend

Navigate to the backend directory:

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
ML_SERVICE_URL=http://127.0.0.1:8000
```

Replace the MongoDB connection string with your own valid connection URI.

Start the backend:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:5000
```

### 4. Configure the Machine Learning Microservice

Open another terminal:

```bash
cd server/ml
```

Create and activate a Python virtual environment:

```bash
python -m venv venv
```

Windows activation:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI service:

```bash
python -m uvicorn ml_service:app --host 0.0.0.0 --port 8000
```

The ML microservice will run at:

```text
http://localhost:8000
```

Check its health:

```text
http://localhost:8000/health
```

---

## 🔗 API Services

SmartMed AI uses REST APIs for communication between its frontend, backend, and machine learning components.

### Backend Health Check

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend and database connectivity |

### Machine Learning Endpoints

The FastAPI microservice exposes the following endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check ML service and model status |
| POST | `/predict/maintenance` | Predict equipment maintenance risk |
| POST | `/cluster/utilization` | Analyze equipment utilization |
| POST | `/predict/recommend` | Generate classification-based recommendations |

The Node.js backend communicates with these ML endpoints through its ML client service.

*For request payloads and response schemas, refer to the corresponding route and service implementation in the repository.*

---

## ☁️ Deployment

SmartMed AI uses a distributed deployment architecture.

| Component | Hosting Platform |
|---|---|
| React Frontend | Vercel |
| Node.js Backend | Render |
| Python ML Microservice | Render |
| Database | MongoDB Atlas |

### Production URLs

**Frontend:**

https://smartmed-ai-rho.vercel.app/

**Backend:**

https://smartmed-backend-i0sl.onrender.com

**Backend Health:**

https://smartmed-backend-i0sl.onrender.com/api/health

**ML Microservice:**

https://smartmed-ml.onrender.com

**ML Health:**

https://smartmed-ml.onrender.com/health

### Production Environment Variables

Frontend:

```env
VITE_API_BASE_URL=https://smartmed-backend-i0sl.onrender.com/api
```

Backend:

```env
PORT=10000
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=https://smartmed-ai-rho.vercel.app
NODE_ENV=production
ML_SERVICE_URL=https://smartmed-ml.onrender.com
```

The hosting platform provides the appropriate runtime port. Never commit actual credentials, database connection strings, or secret keys to GitHub.

**Deployment Note:** Render free instances may spin down after inactivity. The first request after an idle period can take longer to respond.

---

## 🔒 Security Considerations

- Environment variables are used for sensitive configuration.
- Database access is managed through MongoDB connection credentials.
- Authentication-related functionality uses JWT and password hashing dependencies.
- CORS is configured to restrict browser access to the permitted frontend origin.
- Sensitive environment files are excluded from version control.

Never expose database credentials, JWT secrets, or private API keys in public repositories.

---

## 🚀 Future Enhancements

- Train machine learning models using validated real-world operational datasets.
- Improve predictive accuracy through model evaluation and hyperparameter tuning.
- Introduce real-time equipment monitoring and alert notifications.
- Add historical analytics and advanced visualization dashboards.
- Improve model explainability and prediction transparency.
- Expand resource optimization and recommendation capabilities.
- Introduce automated model monitoring and retraining workflows.

---

## 🎯 Project Outcomes

SmartMed AI demonstrates the integration of:

- Full-stack web development.
- REST API development and service integration.
- Database management using MongoDB.
- Machine learning model development and deployment.
- Microservice-based architecture.
- Cloud deployment and environment configuration.

The project aims to demonstrate how modern software engineering and machine learning technologies can work together to improve hospital operational efficiency.

---

## 👨‍💻 Developer

**Kiran Kumar V**

Information Technology Student

GitHub: [KIRANKUMARV2007](https://github.com/KIRANKUMARV2007)

Project Repository: [SmartMed AI](https://github.com/KIRANKUMARV2007/SmartMed-AI)


⭐ If you find this project interesting, consider giving the repository a star!

**SmartMed AI — Smarter Insights. Better Hospital Operations.**
