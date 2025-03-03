# Project Requirements Document (PRD) for Rivvi Voice AI Platform

## 1. Project Overview

Rivvi is an enterprise-grade voice AI platform designed to automate complex patient communications for healthcare organizations. The system leverages Retell AI’s voice technology to manage both outbound and inbound call processes. It provides a unified interface for campaign management, dynamic data processing from Excel/CSV files, real-time run execution (with scheduling and concurrency management), and integrated analytics reporting. This platform aims to streamline healthcare communications by reducing manual outreach, ensuring message consistency, and providing actionable insights through a consolidated dashboard.

This platform is being built to meet the unique needs of healthcare organizations by automating communication tasks while preserving a high level of flexibility. By combining multi-tenant authentication, dynamic prompt generation using natural language input, and robust data ingestion mechanisms, the key objectives are to deliver accurate campaign execution, provide a user-friendly configuration experience (without exposing underlying prompt logic), and ensure seamless correlation between inbound and outbound calls. Success will be measured by reliability, ease-of-use, real-time performance monitoring, and comprehensive analytics.

## 2. In-Scope vs. Out-of-Scope

**In-Scope:**

- Multi-tenant authentication and role-based access control (super admin, organization admin, member), with integration using Clerk JWT with organization context.
- Flexible campaign management that allows super admins to configure campaigns with a base prompt and dynamic prompt updates through natural language input. Users provide a natural language description that is used alongside a fixed base prompt to create a run-specific prompt, with a maintained changelog.
- A dynamic data processing engine capable of handling Excel/CSV file uploads with flexible column mapping, multi-phase validations, and deduplication of patient records.
- Run execution engine with configurable scheduling that respects organizational business hours (using time zone awareness), batch processing with concurrency management, and real-time progress updates through WebSockets.
- A dedicated inbound campaign setup per organization, with configuration of variables and dynamic handling of inbound webhook data that correlates with outbound call logs.
- Unified analytics and reporting system that aggregates metrics for both outbound and inbound calls on a single dashboard, including conversion tracking and time-series analytics.
- Webhook integration system to capture real-time call status, both for outbound dispatches and inbound call events.

**Out-of-Scope:**

- EMR (Electronic Medical Record) integrations and external appointment scheduling system connections.
- Complex recurring scheduling beyond basic immediate or scheduled triggering (e.g., deep recurring patterns like 30-day cycles beyond standard daily recurrences).
- Any direct modification or viewing of the underlying base prompt by regular users; only natural language input for prompt iteration is allowed.
- Integration with non-healthcare communication systems unless specified for a future phase.
- Handling of data beyond the Excel/CSV intake format provided, with no specialized support for alternative data sources.

## 3. User Flow

When a user visits the Rivvi Voice AI Platform, they start by authenticating through a multi-tenant login page. The system uses Clerk-based JWT claims to determine the organization and the user role (super admin, organization admin, or member). Once authenticated, the user is brought to a dashboard that dynamically adjusts the available options based on their role. Super admins get access to in-depth configuration options for campaign variables, prompt settings, and inbound campaign parameters, while regular users can initiate campaign runs using natural language input without seeing the underlying prompt details.

After logging in, the user proceeds to the campaign management section. Here, super admins set up the campaigns by entering the base configuration such as the campaign title, selecting between outbound and inbound directions, and configuring necessary variables. Regular users then upload data via Excel or CSV files where they perform a dynamic mapping to key patient information and campaign-specific fields. Finally, the user schedules the campaign run, choosing to start immediately or at a later time in accordance with their business hours. During the run, natural language input may be submitted to iteratively refine messaging, and inbound call data is correlated with previous outbound call histories via webhooks, which in turn are displayed on a unified analytics dashboard.

## 4. Core Features

- **Multi-Tenant Authentication & Access Control:**

  - Supports organization-scoped access using Clerk JWT claims.
  - Enforces role-based permissions with distinctions among super admin, organization admin, and member users.

- **Campaign Management & Natural Language Input:**

  - Allows super admins to create and configure campaigns with a base prompt that remains unchanged.
  - Enables users to submit natural language inputs during campaign runs to update the prompt iteration without direct access to the underlying prompt code.
  - Maintains a change log for all prompt modifications to ensure auditability.

- **Dynamic Data Processing Engine:**

  - Processes Excel/CSV file uploads with flexible column mapping and normalization of dynamic variable names.
  - Applies multi-phase data validation and error reporting to ensure essential data integrity.
  - Implements patient deduplication and record extraction based on defined identifiers.

- **Run Execution Engine & Scheduling:**

  - Batches outbound calls while respecting rotation guidelines and concurrency limits defined by each organization.
  - Schedules campaign runs according to business hours and time zone considerations, allowing both immediate and future execution.
  - Provides real-time call status updates via WebSockets.

- **Patient Repository Management:**

  - Centralized storage that supports cross-organization patient matching and deduplication.
  - Aggregates communication history from all campaign interactions.

- **Inbound Communication Handling:**

  - Dedicated setup for a single inbound campaign per organization with configurable context variables.
  - Processes inbound webhook data similarly to outbound data, allowing dynamic post-call data handling and correlation.

- **Analytics & Reporting Dashboard:**

  - Consolidates metrics for outbound and inbound campaigns into a single, unified dashboard.
  - Tracks call outcomes, conversion metrics, and time-series analytics with detailed filtering capabilities.

- **Webhook Integration System:**

  - Handles real-time status updates for calls, inbound call events, and post-call data processing with secure endpoint configurations.

## 5. Tech Stack & Tools

- **Frontend:**

  - Framework: Next.js (with Next.js 15 using the app router) and React.
  - Components: V0 by Vercel for AI-powered and modern design component building.
  - Tools: React Query and Tanstack Query for data fetching and state management; advanced IDE integration using Cursor.

- **Backend:**

  - Runtime: Node.js with Next.js API routes / tRPC for request handling and role-based procedures.
  - Database: PostgreSQL with Drizzle ORM for structured data management.
  - Libraries: Zod for schema validation and data integrity.
  - Authentication: Clerk for JWT-based multi-tenant authentication.
  - Communication: WebSockets (possibly using Pusher) for real-time status updates; AWS S3 for file storage.

- **AI Models & Libraries:**

  - Voice AI: Retell AI for voice interactions and prompt generation.
  - Dynamic Prompt Generation: Integration with GPT-4o, GPT o1, Claude 3.7 Sonnet, and Deepseek R1 to process natural language input and generate tailored prompts while preserving a base prompt.

- **Additional Tools:**

  - IDE & Plugin Integrations: Cursor for advanced coding with real-time suggestions.

## 6. Non-Functional Requirements

- **Performance:**

  - Ensure near real-time response for webhook events and dashboard updates using WebSocket channels.
  - Outbound call processing should observe minimal latency and remain efficient even under concurrency.

- **Security:**

  - Enforce role-based access control across all API routes with organization-specific restrictions.
  - Ensure secure authentication via Clerk and safe transmission of sensitive data (use HTTPS, JWT token encryption, etc.).
  - Validate and sanitize all dynamic user inputs to prevent injection attacks.

- **Usability:**

  - Intuitive dashboard designs enable users to easily navigate authentication, campaign configuration, data intake, and scheduling interfaces.
  - The natural language input process should clearly guide users on how to refine campaign messaging without exposing underlying technical details.

- **Compliance & Scalability:**

  - The system must be designed to scale with multiple organizations and handle substantial concurrent processing loads while maintaining a reliable user experience.
  - Ensure the platform complies with relevant healthcare communication and data protection regulations.

## 7. Constraints & Assumptions

- The system assumes input data will be provided via Excel/CSV files with a minimal set of required fields despite variations in naming conventions.
- Only one inbound campaign is provisioned per organization, and inbound calls are assumed to primarily originate as callbacks from previously made outbound calls.
- Super admin users are the only ones with access to edit core campaign configurations, including base prompt and variable settings.
- Dynamic prompt generation relies heavily on the availability and performance of integrated AI models (e.g., GPT-4o, Claude 3.7, Deepseek R1) in tandem with the Retell AI platform.
- All campaigns will adhere to organizational defined business hours as determined by stored timezone settings.
- The system does not include deep EMR integrations or external appointment scheduling beyond Excel/CSV ingestion for patient data at this time.

## 8. Known Issues & Potential Pitfalls

- Inconsistent Excel file formats and column naming may introduce errors during dynamic column mapping. To mitigate, robust error handling and user feedback mechanisms need to be implemented.
- The reliance on multiple AI models for dynamic prompt generation may lead to unpredictable prompt outputs if natural language input is overly ambiguous. Clear guidelines and input validation should minimize this risk.
- Potential API rate limits and concurrent processing constraints might surface when dealing with large-scale batch call processing. Implementing retry mechanisms and adjusting concurrency limits based on organization settings can help manage such issues.
- Webhook failures or delays (e.g., in inbound call correlation) could cause discrepancies in real-time status updates and analytics reporting. Establish fallback procedures and detailed logging for troubleshooting.
- Role-based access enforcement must be tightly controlled. Any misconfiguration in middleware or into the authentication layer may lead to unauthorized access to sensitive campaign configurations.
- Timezone and business hour scheduling require precise configuration. Errors in time conversion or scheduling logic might lead to calls being dispatched out of approved hours.

This PRD serves as the comprehensive foundation for designing subsequent documents such as Tech Stack Documentation, Frontend Guidelines, Backend Structure, and Implementation Plans. Every detail here is intended to guide the development of the Rivvi Voice AI Platform with clarity and precision.
