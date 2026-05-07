# Implementation Plan: Hershey's CV System

## Overview

This implementation plan provides a comprehensive task breakdown for building the Hershey's Computer Vision System. The system consists of a mobile PWA for image capture, a FastAPI backend with image processing, a React dashboard for visualization, and supporting infrastructure (PostgreSQL, MinIO, Redis). All components are containerized with Docker and use UV for Python package management.

## Tasks

- [ ] 1. Project Setup and Infrastructure Foundation
  - [ ] 1.1 Initialize project repository structure
    - [x] Create root directory structure with mobile-app/, dashboard/, backend/ folders
    - [ ] Initialize Git repository with proper .gitignore (Python, Docker, Node.js patterns)
    - [ ] Create README.md with project description, setup instructions, and usage guide
    - [ ] Create LICENSE file
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [ ] 1.2 Configure Python backend with UV package management
    - [x] Create backend/pyproject.toml with all dependencies (FastAPI, SQLAlchemy, Celery, etc.)
    - [x] Create backend/.python-version file specifying Python 3.12
    - [x] Configure Ruff in pyproject.toml for linting and formatting
    - [x] Initialize UV lock file
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1_

  - [ ] 1.3 Create Docker Compose configuration
    - [x] Create docker-compose.yml with all service definitions
    - [x] Configure service dependencies and health checks
    - [x] Set up volume mounts for persistence
    - [x] Define environment variable placeholders
    - _Requirements: 7.4, 7.5_

  - [ ] 1.4 Create Dockerfiles for all services
    - [x] Create backend/Dockerfile with multi-stage build using UV
    - [x] Create backend/Dockerfile.worker for Celery worker
    - [ ] Create mobile-app/Dockerfile with multi-stage build
    - [ ] Create dashboard/Dockerfile with multi-stage build
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

- [ ] 2. Backend Core Infrastructure
  - [ ] 2.1 Implement configuration management
    - [x] Create backend/app/core/config.py with Pydantic Settings
    - [x] Define all environment variables (DATABASE_URL, REDIS_URL, MINIO_*, JWT_*, etc.)
    - [x] Implement configuration validation
    - _Requirements: 8.3, 11.3, 11.5_

  - [ ] 2.2 Implement logging configuration
    - Create backend/app/core/logging.py with structured JSON logging
    - Configure log rotation (daily, 30-day retention)
    - Implement fallback file logging
    - _Requirements: 12.1, 12.4, 12.5_

  - [ ] 2.3 Set up database connection and models
    - [x] Create backend/app/db/ with SQLAlchemy async engine setup
    - [x] Create backend/app/models/user.py with User model
    - [x] Create backend/app/models/image.py with Image model
    - [x] Create backend/app/models/result.py with ProcessingResult model
    - [ ] Create backend/app/models/audit_log.py with AuditLog model
    - [ ] Implement database migrations structure
    - _Requirements: 3.5, 4.3_

  - [x] 2.4 Implement storage service (MinIO client)
    - [x] Create backend/app/services/storage.py with MinIO client wrapper
    - [x] Implement bucket creation (uploads/, processed/, exports/)
    - [x] Implement upload, download, and delete operations
    - _Requirements: 3.5, 4.3_

  - [ ] 2.5 Implement cache service (Redis client)
    - Create backend/app/services/cache.py with Redis client wrapper
    - Implement session storage operations
    - Implement caching utilities
    - _Requirements: 11.4_

  - [x] 2.6 Implement task queue (Celery)
    - [x] Create backend/app/core/celery_app.py with Celery configuration
    - [x] Create backend/app/services/queue.py with task queue wrapper
    - [x] Configure Redis as broker and result backend
    - _Requirements: 4.1_

- [ ] 3. Authentication and Security
  - [x] 3.1 Implement password hashing service
    - Create backend/app/core/security.py with bcrypt password hashing
    - Implement hash_password() with cost factor ≥ 12
    - Implement verify_password()
    - _Requirements: 11.5_

  - [ ]* 3.2 Write property test for password hashing
    - **Property 7: Password Hashing Algorithm**
    - **Validates: Requirements 11.5**

  - [x] 3.3 Implement JWT token service
    - Create JWT token generation with 24-hour expiration
    - Implement token validation and decoding
    - Implement token refresh logic (7-day window)
    - _Requirements: 11.3, 11.4_

  - [ ]* 3.4 Write property tests for JWT tokens
    - **Property 5: JWT Token Expiration**
    - **Validates: Requirements 11.3**
    - **Property 6: Token Refresh Window**
    - **Validates: Requirements 11.4**

  - [x] 3.5 Implement authentication endpoints
    - Create backend/app/api/routes/auth.py
    - Implement POST /api/v1/auth/login endpoint
    - Implement POST /api/v1/auth/refresh endpoint
    - Implement account lockout after 5 failed attempts (15-minute lockout)
    - _Requirements: 11.1, 11.2, 11.6_

  - [ ]* 3.6 Write property test for account lockout
    - **Property 8: Account Lockout Threshold**
    - **Validates: Requirements 11.6**

  - [x] 3.7 Create default dashboard user
    - Create database seed for default user (username: hersheys, password: cv-hersheys)
    - Hash password with bcrypt during initialization
    - Document default credentials in README
    - _Requirements: 5.2_

  - [x] 3.8 Implement authentication middleware
    - Create backend/app/api/dependencies.py with auth dependency
    - Implement token extraction and validation
    - Implement current user injection into request context
    - _Requirements: 11.1, 11.2_

- [ ] 4. Image Upload and Validation
  - [x] 4.1 Implement image validation service
    - Create backend/app/services/validation.py
    - Implement format validation (JPEG/PNG magic bytes check)
    - Implement size validation (max 10MB)
    - Implement image integrity verification
    - _Requirements: 3.2, 3.3, 3.4_

  - [x]* 4.2 Write property tests for image validation
    - **Property 2: Image Format Validation Correctness**
    - **Validates: Requirements 3.2, 3.3**
    - **Property 3: Image Size Validation**
    - **Validates: Requirements 3.4**

  - [x] 4.3 Implement image upload endpoint
    - Create backend/app/api/routes/images.py
    - Implement POST /api/v1/images endpoint (multipart/form-data)
    - Generate unique UUID for each image
    - [x] Store image in MinIO with structured path
    - [x] Store metadata in PostgreSQL
    - [x] Queue image for processing
    - Return HTTP 201 with image identifier
    - _Requirements: 3.1, 3.5, 3.6, 4.1_

  - [ ]* 4.4 Write property test for unique identifiers
    - **Property 4: Unique Image Identifiers**
    - **Validates: Requirements 3.5**

  - [x] 4.5 Implement image listing endpoints
    - Implement GET /api/v1/images endpoint with pagination
    - Implement GET /api/v1/images/{id} endpoint
    - Support query parameters (page, limit, status, dates)
    - _Requirements: 5.2, 6.2, 6.3_

- [ ] 5. Image Processing Pipeline
  - [ ] 5.1 Implement image processing task
    - [x] Create backend/app/tasks/process_image.py
    - [x] Implement async Celery task with retry logic (max 3 retries)
    - [x] Implement image fetching from MinIO
    - [ ] Implement CV pipeline placeholder (OpenCV integration)
    - [x] Implement result storage in PostgreSQL
    - [x] Implement error handling and status updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Implement processing results endpoints
    - [x] Create backend/app/api/routes/results.py
    - [x] Implement GET /api/v1/results endpoint with pagination
    - [x] Implement GET /api/v1/results/{id} endpoint
    - [ ] Support filtering by status and date range
    - _Requirements: 5.3, 6.2, 6.3_

  - [ ]* 5.3 Write property test for processing results integrity
    - **Property 13: Processing Results Reference Integrity**
    - **Validates: Requirements 4.3_

- [ ] 6. Error Handling and Health Monitoring
  - [x] 6.1 Implement standardized error responses
    - [x] Create backend/app/core/errors.py with error response models
    - [x] Implement error handlers for validation, auth, and server errors
    - [x] Sanitize error messages (no stack traces, paths, or secrets)
    - _Requirements: 12.2_

  - [ ]* 6.2 Write property test for error message sanitization
    - **Property 14: Error Messages Sanitization**
    - **Validates: Requirements 12.2**

  - [x] 6.3 Implement request logging middleware
    - [x] Log all API requests with method, path, status code, response time
    - [x] Include request_id for tracing
    - _Requirements: 12.3_

  - [x] 6.4 Implement health check endpoints
    - [x] Create backend/app/api/routes/health.py
    - [x] Implement GET /health endpoint
    - [x] Check database connectivity
    - [x] Check storage (MinIO) connectivity
    - [x] Check cache (Redis) connectivity
    - [x] Return HTTP 503 with details if any service unhealthy
    - _Requirements: 13.1, 13.2, 13.4, 13.5_

- [x] 7. Backend API Finalization
  - [x] 7.1 Create main FastAPI application
    - [x] Create backend/app/main.py
    - [x] Register all routers
    - [x] Configure CORS middleware
    - [x] Set up exception handlers
    - _Requirements: 3.1_

  - [x] 7.2 Write unit tests for API endpoints
    - [x] Test auth endpoints (login, refresh)
    - [x] Test image upload and listing
    - [x] Test results endpoints
    - [x] Test health endpoints
    - _Requirements: 12.1_

  - [x] 7.3 Write integration tests
    - Test database operations
    - Test storage operations
    - Test queue processing
    - Test end-to-end image upload and processing
    - _Requirements: 12.1_

- [x] 8. Checkpoint - Backend Complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 9. Mobile App Implementation
  - [x] 9.1 Initialize React PWA project
    - Create mobile-app/ with React 18 + TypeScript
    - Configure PWA manifest and service worker
    - Set up Hershey's theme (colors, typography)
    - _Requirements: 1.5_

  - [x] 9.2 Implement camera capture component
    - Create mobile-app/src/components/CameraCapture/
    - Implement camera access with permission handling
    - Implement live camera preview
    - Implement image capture at max resolution
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 9.3 Implement image preview and confirmation
    - Create mobile-app/src/components/ImagePreview/
    - Display captured image
    - Show upload confirmation dialog
    - _Requirements: 2.1_

  - [x] 9.4 Implement image compression service
    - Create mobile-app/src/services/compression.ts
    - Compress images to max 5MB while preserving aspect ratio
    - _Requirements: 2.2_

  - [x]* 9.5 Write property test for aspect ratio preservation
    - **Property 1: Image Compression Preserves Aspect Ratio**
    - **Validates: Requirements 2.2**

  - [x] 9.6 Implement upload service with retry logic
    - Create mobile-app/src/hooks/useUpload.ts
    - Implement upload with progress tracking
    - Implement retry logic (3 attempts)
    - Implement offline queue for failed uploads
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 9.7 Implement API client service
    - Create mobile-app/src/services/api.ts
    - Implement authentication (login, token storage)
    - Implement image upload API call
    - Implement token refresh handling
    - _Requirements: 2.3_

  - [x] 9.8 Implement offline detection and queue
    - Create mobile-app/src/hooks/useOffline.ts
    - Detect network status changes
    - Queue images when offline
    - Auto-retry when connectivity restored
    - _Requirements: 2.4, 2.5_

  - [x] 9.9 Create Hershey's branded UI components
    - Create mobile-app/src/components/UI/
    - Implement Button, Header, Navigation with brand colors
    - Apply Chocolate Brown (#3E000F), Dark Sienna (#381216), Silver (#A8A9AD)
    - _Requirements: 1.5_

  - [x] 9.10 Write unit tests for mobile app
    - Test camera capture component
    - Test upload service
    - Test offline queue logic
    - _Requirements: 1.1_

- [x] 10. Dashboard Webapp Implementation
  - [x] 10.1 Initialize React dashboard project
    - Create dashboard/ with React 18 + TypeScript
    - Configure routing and state management
    - Set up Hershey's theme
    - _Requirements: 5.6_

  - [x] 10.2 Implement authentication pages
    - Create login page with Hershey's branding
    - Implement login form with error handling
    - Implement token storage and management
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 10.3 Implement main dashboard layout
    - Create dashboard/src/components/Dashboard/
    - Implement header with navigation
    - Implement sidebar/navigation
    - Apply Hershey's brand colors
    - _Requirements: 5.6_

  - [x] 10.4 Implement results display components
    - Create dashboard/src/components/ImageGallery/
    - Display grid of processing results (10 most recent)
    - Implement loading skeletons
    - Implement empty state
    - _Requirements: 5.3, 5.8_

  - [x]* 10.5 Write property test for pagination
    - **Property 12: Recent Results Pagination**
    - **Validates: Requirements 5.2**

  - [x] 10.6 Implement result detail view
    - Create dashboard/src/components/ResultDetail/
    - Display original image
    - Display processing results
    - _Requirements: 5.5_

  - [x] 10.7 Implement search functionality
    - Create dashboard/src/components/Search/
    - Implement search input with debounce
    - Filter results within 500ms
    - _Requirements: 6.1_

  - [x]* 10.8 Write property test for search correctness
    - **Property 9: Search Results Match Query**
    - **Validates: Requirements 6.1**

  - [x] 10.9 Implement filter components
    - Create dashboard/src/components/Filters/
    - Implement date range filter
    - Implement status filter
    - Preserve filter state on navigation
    - _Requirements: 6.2, 6.3, 6.5_

  - [x]* 10.10 Write property tests for filters
    - **Property 10: Date Range Filter Correctness**
    - **Validates: Requirements 6.2**
    - **Property 11: Status Filter Correctness**
    - **Validates: Requirements 6.3**

  - [x] 10.11 Implement notification indicator
    - Display indicator when new results available
    - Poll for updates or use WebSocket
    - _Requirements: 5.7_

  - [x] 10.12 Implement dashboard API client
    - Create dashboard/src/services/api.ts
    - Implement results fetching with pagination
    - Implement search and filter API calls
    - _Requirements: 5.3, 6.1_

  - [x] 10.13 Implement dashboard health endpoint
    - Create simple /health endpoint for load balancer
    - _Requirements: 13.3_

  - [x] 10.14 Write unit tests for dashboard
    - Test login page
    - Test results display
    - Test filter functionality
    - Test search functionality
    - _Requirements: 5.1_

- [x] 11. Checkpoint - Frontend Complete
  - Ensure all frontend tests pass, ask the user if questions arise.

- [x] 12. Integration and Final Wiring
  - [x] 12.1 Wire all services in docker-compose.yml
    - Configure network settings
    - Set up service discovery
    - Configure environment variables for inter-service communication
    - _Requirements: 7.4_

  - [x] 12.2 Create database initialization scripts
    - Create SQL migration scripts for schema
    - Create seed data script for default user
    - _Requirements: 3.5, 5.2_

  - [x] 12.3 Write end-to-end tests
    - Test complete image capture and upload flow
    - Test image processing pipeline
    - Test dashboard visualization
    - _Requirements: 1.1, 2.1, 4.1, 5.3_

  - [x] 12.4 Create smoke tests for containers
    - Test container startup order
    - Test health endpoints
    - Test configuration validation
    - _Requirements: 7.4, 13.1, 13.3_

- [x] 13. Final Documentation and Repository Setup
  - [x] 13.1 Complete README.md documentation
    - Add architecture overview
    - Add detailed setup instructions
    - Add usage guide with examples
    - Document default credentials
    - Add troubleshooting section
    - _Requirements: 10.3_

  - [x] 13.2 Set up GitHub repository
    - Push to https://github.com/EmmanuelRR-data-science/cv-hersheys
    - Configure branch protection
    - _Requirements: 10.2_

  - [x] 13.3 Configure CI pipeline
    - Create .github/workflows/ci.yml
    - Configure lint stage (Ruff)
    - Configure unit test stage
    - Configure property test stage
    - Configure integration test stage
    - Configure build stage
    - Configure smoke test stage
    - _Requirements: 9.4, 9.5, 10.6_

- [x] 14. Final Checkpoint - System Complete
  - Ensure all tests pass, all containers start correctly, and the system is ready for deployment. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The backend must be completed before frontend work begins (API dependency)
- Mobile app and Dashboard can be developed in parallel once backend is stable

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 2, "tasks": ["3.1", "3.3", "3.5", "3.7", "3.8"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "4.1", "4.3", "4.5"] },
    { "id": 4, "tasks": ["4.2", "4.4", "5.1", "5.2", "6.1", "6.3", "6.4"] },
    { "id": 5, "tasks": ["5.3", "6.2", "7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.6", "9.7", "9.8", "9.9", "10.1", "10.2", "10.3", "10.4", "10.6", "10.7", "10.9", "10.11", "10.12", "10.13"] },
    { "id": 7, "tasks": ["9.5", "9.10", "10.5", "10.8", "10.10", "10.14"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 9, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
