import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NotificationCard = ({
  notification,
}: {
  notification: { name?: string; message?: string };
}) => {
  if (!notification) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{notification.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{notification.message}</p>
      </CardContent>
    </Card>
  );
};

export default NotificationCard;
