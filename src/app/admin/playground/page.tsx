"use client";

import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { notificationSchema } from "../../api/ai/playground/schema";
import NotificationCard from "./_components/card";

export default function PlaygroundPage() {
  const { object, submit, isLoading, stop } = useObject({
    api: "/api/ai/playground",
    schema: notificationSchema,
  });

  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Organizations", href: "/" }]} />
      <AppBody>
        <AppHeader title="Playground" className="mb-4" />
        <AppContent className="h-full">
          <div>
            <button
              onClick={() => submit("Messages during finals week.")}
              disabled={isLoading}
            >
              Generate notifications
            </button>

            {isLoading && (
              <div>
                <div>Loading...</div>
                <button type="button" onClick={() => stop()}>
                  Stop
                </button>
              </div>
            )}

            {object?.notifications?.map((notification, index) => (
              <NotificationCard key={index} notification={notification} />
            ))}
          </div>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
