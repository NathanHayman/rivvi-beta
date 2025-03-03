# Rivvi Voice AI Tech Stack Document

## Introduction

Rivvi is an enterprise-grade voice AI platform designed to automate healthcare communications. The system handles complex call flows for both outbound and inbound communications while offering an easy-to-use interface for managing campaigns, processing patient data, and tracking results. The technology choices we made are driven by a need for flexibility, reliability, and ease of use. Non-technical users can see that every part of the system is designed to keep data safe, manage multiple users and organizations, and provide a smooth, responsive experience whether you are scheduling a campaign or monitoring call outcomes.

## Frontend Technologies

The frontend of Rivvi is built with React and Next.js. These tools help us create dynamic, interactive web pages that are fast and user-friendly. Next.js, especially in its latest version with the new app router, makes it simpler to organize our application structure and deliver content quickly, even when there is a lot of data to display. To help manage data fetching and ensure a smooth experience for users, we use React Query and Tanstack. These modern libraries handle the challenge of keeping user data updated in real-time and managing the communication between the user interface and the backend. Overall, our choices help ensure that users experience a consistent and responsive application that adapts to their needs.

## Backend Technologies

On the backend, we use Node.js as our server framework, which enables our application to handle many tasks efficiently. PostgreSQL powers our database, providing a robust and reliable system to store everything from campaign details to patient records. Drizzle ORM acts as a bridge between our Node.js application and PostgreSQL by making it easier to work with data without getting bogged down in complex database queries. We also integrate tRPC and Zod into our backend. tRPC helps simplify building our APIs so that different parts of the system can communicate clearly, while Zod helps check that our data is exactly what we expect. This ensures our system processes the correct data at every step, whether during data intake, campaign configuration, or real-time processing of call metrics.

## Infrastructure and Deployment

Our platform is hosted using industry-standard solutions that guarantee reliability and scalability. AWS S3 is used for storing files and other assets securely, which means that even large Excel or CSV files can be managed safely and efficiently. The deployment process leverages modern CI/CD pipelines along with robust version control systems. These infrastructure choices ensure that updates can be rolled out smoothly, and important changes to the system are tracked over time. The careful design of our deployment process means that both developers and users can trust that the system is stable and ready to handle real-time operations such as call batching and scheduling.

## Third-Party Integrations

In addition to our core stack, Rivvi integrates with several third-party services to enhance its functionality. Clerk is used for multi-tenant authentication, ensuring that every user access is controlled appropriately based on their role within the organization. The platform also relies on a specialized voice technology provided by Retell AI to power its voice calls, which are central to our communications functionality. Furthermore, we integrate webhook handling to ensure that both inbound and outbound calls are properly tracked and matched with patient data. These integrations allow the platform to expand its capabilities without compromising on performance or security.

## Security and Performance Considerations

Security is a top priority for Rivvi. To ensure that only authorized users can access sensitive data, the system enforces a strict role-based access control model. Multi-tenant authentication managed by Clerk ensures that organization-specific data remains secure and isolated. Modern tools such as Zod help validate incoming data to prevent errors or malicious input. On the performance side, the use of Node.js, efficient database communications with PostgreSQL and Drizzle ORM, and well-managed API interactions via tRPC all contribute to a fast, responsive user experience. The scheduling and batch processing features have been designed to respect business hours and concurrency limits, ensuring that operations are carried out smoothly even during heavy usage periods.

## Conclusion and Overall Tech Stack Summary

Rivvi’s technology choices are squarely focused on delivering a sophisticated yet user-friendly platform for healthcare communications. The frontend built with React and Next.js makes the user interface both dynamic and intuitive, while the Node.js backend coupled with PostgreSQL and Drizzle ORM ensures that data is managed reliably and securely. The integration of Clerk, tRPC, and Zod reinforces robust security and effective data validation. Our infrastructure choices using AWS S3 and modern deployment pipelines guarantee that the platform scales with ease and remains reliable under load. Together, these technologies create a system that effectively supports complex voice AI interactions, manages multi-tenant data, and provides advanced analytics—all while remaining accessible for users with varying levels of technical expertise.
