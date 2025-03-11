import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const AdminOverview = ({
  counts,
}: {
  counts: { campaigns: number; organizations: number; calls: number };
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Campaigns</CardTitle>
        </CardHeader>
        <CardContent>{counts?.campaigns}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Organizations</CardTitle>
        </CardHeader>
        <CardContent>{counts?.organizations}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Calls</CardTitle>
        </CardHeader>
        <CardContent>{counts?.calls}</CardContent>
      </Card>
    </div>
  );
};
