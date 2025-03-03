# Implementation Plan

Below is a detailed implementation plan for the Rivvi Voice AI Platform, broken into phases with one clear action per step. Each step contains file or endpoint paths and cites the related documents/sections.

## Phase 1: Environment Setup

1. **Install Core Tools:** Verify installation of Node.js (use latest LTS as no specific version was given) and install PostgreSQL (as specified in the tech stack). (_Tech Stack Document: Core Tools_)
2. **Initialize Next.js Project:** Create a new Next.js 15 project with the App Router enabled (using Next.js 15 as specified). (_Tech Stack Document: next js 15 w/ app router_)
3. **Set Up Git Repository:** Initialize a Git repository with `main` and `dev` branches and add branch protection rules. (_Project Requirements Document: Authentication and Access Control_)
4. **Create Directory Structure:** Create `/src` folder with subfolders for `app` (frontend), `api` (backend endpoints), and `lib` (shared utilities). (_App Flow Document: Directory Layout_)
5. **Validation:** Run `node -v` and `psql --version` to verify installations.

## Phase 2: Frontend Development

1. **Setup Authentication Page:** Create `/src/app/login/page.js` to render a multi-tenant login using Clerk. (_Project Requirements Document: Authentication and Access Control_)
2. **Dashboard Routing:** Create dynamic route `/src/app/dashboard/page.js` that displays a user-specific dashboard post-login. (_App Flow Document: User Authentication and Dashboard Access_)
3. **Campaign Creation Page:** Create `/src/app/campaign/create/page.js` where super admins can set up new campaigns. Hide direct prompt view and instead provide a natural language input field for campaign intent. (_Project Requirements Document: Campaign Management and Natural Language Input_)
4. **Excel/CSV Upload Interface:** Develop `/src/app/campaign/upload/page.js` for users to upload Excel or CSV files; integrate a column mapping UI component. (_Project Requirements Document: Data Intake and Excel/CSV Upload Flow_)
5. **Scheduling Interface:** Build `/src/app/campaign/schedule/page.js` letting users schedule campaign runs. Ensure the UI respects time zone and business hours. (_Project Requirements Document: Scheduling and Run Execution_)
6. **Prompt Iteration Input:** Create a component `/src/components/PromptIteration.js` where users provide natural language input to update campaign messaging. (_Project Requirements Document: Iterative Campaign Refinement with Natural Language Input_)
7. **Campaign Change Log Viewer:** Develop `/src/app/campaign/changelog/page.js` for super admins to view historical prompt iteration logs. (_Project Requirements Document: Voice AI Interaction and Prompt Management_)
8. **Validation:** Run local frontend tests with a tool like Jest; verify that each page renders correctly by executing `npm run dev` and manually testing navigation.

## Phase 3: Backend Development

1. **Auth Middleware Update:** Update `/src/middleware.ts` to include multi-tenant authentication (using Clerk JWT claims) and role-based access control logic. (_Technical Implementation Guide: Authentication & Organization Management_)
2. **Setup TRPC Endpoint Structure:** In `/src/server/api/trpc.ts`, create basic TRPC procedures that enforce organization context and role checks. (_Technical Implementation Guide: Authentication & Organization Management_)
3. **Super Admin Utility:** Enhance `/src/lib/super-admin.ts` with robust detection of super admin based on organization ID from Clerk tokens. (_Technical Implementation Guide: Authentication & Organization Management_)
4. **Campaign CRUD API:** Implement REST or TRPC endpoints (e.g., in `/src/server/api/campaigns.ts`) for campaign creation, retrieval, update (only accessible to super admins), and deletion. (_Technical Implementation Guide: Campaign Management System_)
5. **Natural Language Prompt Generation Endpoint:** Create an endpoint `/src/server/api/campaigns/[id]/run.js` that accepts the campaign’s base prompt and user iteration input, calls an AI service (e.g., via GPT o1 or GPT 4o) to generate an updated prompt, and then updates the associated LLM record (do not alter the base prompt). (_Technical Implementation Guide: Voice AI Interaction and Prompt Management_)
6. **Excel/CSV Data Parser Service:** In `/src/server/services/dataProcessor.js`, implement a parser that normalizes column names, validates dynamic variables, extracts patient identifiers, and supports deduplication. (_Technical Implementation Guide: Dynamic Data Processing Engine_)
7. **Endpoint for File Upload & Processing:** Create an endpoint `/src/server/api/data/upload.js` to accept Excel/CSV files, trigger the parser, and save mapped data (using Drizzle ORM for database interactions). (_Technical Implementation Guide: Dynamic Data Processing Engine_)
8. **Run Execution Engine:** Implement a service `/src/server/services/runExecutor.js` that batches outbound calls, enforces concurrency based on organization limits, schedules calls by time zone, and updates statuses in real time. (_Technical Implementation Guide: Run Execution Engine_)
9. **Webhook Endpoints for Outbound:** Develop `/src/app/api/webhooks/retell/[orgId]/post-call/[campaignId].js` to handle post-call data from Retell, processing dynamic post-call variables using Zod validation. (_Technical Implementation Guide: Webhook Integration System_)
10. **Webhook Endpoint for Inbound Calls:** Create `/src/app/api/webhooks/retell/[orgId]/inbound.js` to process inbound call webhooks, match incoming phone numbers with patients, and update call records. (_Technical Implementation Guide: Handling Inbound Call Integration and Post-Call Data_)
11. **Patient Deduplication Logic:** Build a module `/src/server/services/patientService.js` that receives patient data, normalizes phone and DOB, computes a unique hash, checks for existing records (across organizations), and creates or retrieves patient entries accordingly. (_Technical Implementation Guide: Patient Repository and Data Correlation_)
12. **Analytics Aggregation Endpoint:** Implement `/src/server/api/analytics.js` to aggregate inbound and outbound call metrics and prepare data for a unified dashboard view. (_Technical Implementation Guide: Analytics and Reporting_)
13. **Validation:** Write unit tests for each endpoint (using a framework like Jest) and run them (e.g., `npm test` in `/src/server/tests`) ensuring at least 90% coverage.

## Phase 4: Integration

1. **Connect Frontend to Campaign API:** In the frontend, implement a React Query (TanStack Query) hook in `/src/app/hooks/useCampaigns.js` to interact with the campaign CRUD API. (_App Flow Document: Campaign Creation and Configuration_)
2. **Integrate Prompt Iteration Flow:** Connect the natural language input in the frontend to the prompt generation endpoint, ensuring that both the base prompt and user input are sent. (_Project Requirements Document: Iterative Campaign Refinement with Natural Language Input_)
3. **File Upload Integration:** Integrate the Excel/CSV upload component to call the file upload endpoint and then display mapping status and errors. (_Project Requirements Document: Data Intake and Excel/CSV Upload Flow_)
4. **Real-Time Status Updates:** Use Pusher (as specified in the tech stack) to broadcast updates from `/src/server/services/runExecutor.js` to the frontend dashboard. (_Technical Implementation Guide: Run Execution Engine_)
5. **Validation:** From the frontend, run end-to-end testing (e.g., using Cypress) for critical flows: login, campaign creation, file upload, and real-time status display.

## Phase 5: Deployment

1. **Configure AWS S3 for Static Assets:** Build the frontend project and upload the production build to an AWS S3 bucket (ensure it is in the `us-east-1` region). (_Tech Stack Document: aws s3_)
2. **Deploy Backend Server:** Deploy the Node.js backend (with TRPC endpoints and webhook handlers) to a cloud service (e.g., AWS Elastic Beanstalk or a comparable service) with proper environment configuration. (_Tech Stack Document: node.js; Deployment section in App Flow_)
3. **CI/CD Setup:** Configure a CI/CD pipeline (using GitHub Actions or a similar tool) to automate testing and deployment for both frontend and backend upon merging to the `main` branch. (_Project Requirements Document: Deployment and QA Process_)
4. **Monitor Logs and Rollbacks:** Set up logging and a rollback mechanism via your cloud dashboard to track errors and performance. (_Project Requirements Document: Analytics and Reporting_)
5. **Validation:** Run production end-to-end tests (using Cypress or similar) against the deployed production URL to ensure all integrations and flows work as intended.

This plan covers core areas from multi-tenant authentication, campaign management with dynamic prompt merging, flexible data ingestion, run execution scheduling, and unified analytics. Each backend and frontend component interacts per the requirements to ensure accurate processing of Excel/CSV inputs, patient deduplication, and dynamic handling of inbound and outbound calls.

Note: Super admin-only capabilities (viewing/editing campaign configuration, prompt change log) are strictly enforced in both UI and API layers.

This implementation plan should be used as a guide for the iterative development of the Rivvi Voice AI Platform.
