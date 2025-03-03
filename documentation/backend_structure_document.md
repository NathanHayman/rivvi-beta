# Backend Structure Document

## Introduction

This document outlines the structure of the backend for the Rivvi Voice AI Platform. The Rivvi platform is designed to automate communications in healthcare using advanced voice AI. It handles both inbound and outbound calls by processing patient data and managing campaign configurations securely. The backend plays a central role by ensuring data integrity, scalability, and real-time communication between the various components of the platform, including dynamic data ingestion, campaign management, and robust analytics.

## Backend Architecture

The backend is built using a modular approach that ensures clear separation of concerns while allowing seamless integration between components. The architecture integrates middleware for multi-tenant authentication, dynamic data processing engines to handle Excel and CSV uploads, and a dedicated execution engine for managing call batches. It uses modern frameworks like Node.js along with TRPC and Zod for procedure calls and data validation. The design is set up to scale with increased users and campaigns, while also making maintenance simple, thanks to its service-oriented pattern and clear role-based access controls.

## Database Management

For managing data, the system uses a combination of relational and dynamic storage practices. The core data, such as user accounts, campaign configurations, patient records, and call logs, is maintained in PostgreSQL. This database is chosen for its reliability and capacity to enforce strong relationships like those between users, organizations, and campaigns. Data is structured into entities such as Organizations, Users, Campaigns, Runs, Rows, Patients, and Calls. These relationships are defined clearly to prevent data duplication, especially through techniques like hash-based matching on patient identifiers. Dynamic campaign data and flexible Excel/CSV inputs are ingested, mapped, and stored with no loss of fidelity even when column names vary.

## API Design and Endpoints

The backend exposes a set of well-defined RESTful endpoints to allow smooth communication between the frontend and the backend. These APIs are designed with TRPC and incorporate role-based access control. Because of the multi-tenant environment, every API route verifies the user’s organization context. Key endpoints include those for user authentication, campaign creation and configuration, dynamic data ingestion, and run execution. Special endpoints are also built to handle webhooks for both outbound and inbound call events. These endpoints process real-time updates, such as call status changes and prompt adjustments, and ensure that the data flow is consistent and secure both during and after each campaign run.

## Hosting Solutions

The solution is hosted using a robust cloud provider that combines reliability, scalability, and cost-effectiveness. The choice of cloud hosting means that the backend can automatically scale with increased demand and offer high availability. Infrastructure components like AWS S3 are used for file storage, while the application servers run on scalable Node.js environments. The use of modern technologies like Next.js in version 15 with a new application router further ensures that the backend is optimized for performance and reliability. The hosting platform also supports continuous deployment, making it easier to roll out updates and enhancements without downtime.

## Infrastructure Components

The backend infrastructure is supported by several important components. Load balancers help distribute incoming API requests evenly, ensuring that no single server is overwhelmed. Caching mechanisms are in place to speed up common data lookups, and content delivery networks (CDNs) ensure that static assets load quickly for a good user experience. Additionally, the integration of WebSockets allows for real-time updates during campaign runs, and load balancing between services ensures that batch processing of calls is efficient and within the required business hours defined by each organization’s time zone. These elements work together to create a resilient and performant system.

## Security Measures

Security is a paramount part of the backend. The system uses a multi-tenant authentication layer that leverages Clerk’s JWT claims to confirm the organization context of every request. Role-based access ensures that only super admins can modify sensitive campaign configurations, including dynamic variables and prompt details. All data, whether in transit or at rest, is encrypted to protect sensitive patient information. Additional measures include rigorous API security through middleware that validates every incoming request and the use of webhook authentication to confirm that inbound events are genuine. A detailed access log is maintained to record all changes, especially prompt updates that combine the fixed base prompt with dynamic user input.

## Monitoring and Maintenance

To keep the backend running smoothly, a suite of monitoring tools is in place. These tools track API response times, server uptime, and error logs across the entire platform. Real-time monitoring through WebSocket channels provides up-to-the-minute insights on the health of the run execution engine, and alerts ensure that any issues are quickly addressed. Regular maintenance tasks like database optimization, server restarts, and software updates are planned into the operation schedule. The system architecture also supports seamless patch management, ensuring that updates to critical components can be deployed with little to no disruption in service.

## Conclusion and Overall Backend Summary

The Rivvi Voice AI Platform backend is a comprehensive setup combining robust database management, dynamic API endpoints, secure hosting, and an infrastructure that supports both inbound and outbound communications in a unified manner. Its modular design enables scalability and flexibility, serving the unique challenges of healthcare communication automation. By using clear role-based access, rigorous data validation, and innovative AI-driven prompt management, the backend not only meets current needs but is also prepared for future growth and integration with additional systems. This thoughtful and detailed design sets Rivvi apart, providing a resilient, secure, and highly efficient foundation for its voice AI capabilities.
