import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/server/actions/dashboard/stats";
import { BarChart3, CheckCircle, PhoneCall, User, XCircle } from "lucide-react";

interface DashboardStatsProps {
  orgId: string;
}

interface DashboardStatsSimpleProps {
  stats: any;
}

export async function DashboardStats({ orgId }: DashboardStatsProps) {
  // Fetch dashboard stats using server action
  const stats = await getDashboardStats();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Active Runs"
        value={stats.counts.activeRuns}
        description="Total active runs"
        icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />}
      />
      <StatsCard
        title="Completed Calls"
        value={stats.counts.completedCalls}
        description={`${stats.counts.completedCalls} completed calls`}
        icon={<CheckCircle className="h-4 w-4 text-green-500" />}
      />
      <StatsCard
        title="Patients"
        value={stats.counts.patients}
        description={`${stats.counts.patients} patients`}
        icon={<User className="h-4 w-4 text-red-500" />}
      />
      <StatsCard
        title="Active Campaigns"
        value={stats.counts.campaigns}
        description={`${stats.counts.campaigns} total campaigns`}
        icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
      />
    </div>
  );
}

export function DashboardStatsSimple({ stats }: DashboardStatsSimpleProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Calls"
        value={stats.callStats?.totalCalls || 0}
        description="All-time call count"
        icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />}
      />
      <StatsCard
        title="Completed Calls"
        value={stats.callStats?.completedCalls || 0}
        description={`${(stats.callStats?.completionRate || 0).toFixed(1)}% completion rate`}
        icon={<CheckCircle className="h-4 w-4 text-green-500" />}
      />
      <StatsCard
        title="Failed Calls"
        value={stats.callStats?.failedCalls || 0}
        description={`${(stats.callStats?.failureRate || 0).toFixed(1)}% failure rate`}
        icon={<XCircle className="h-4 w-4 text-red-500" />}
      />
      <StatsCard
        title="Active Campaigns"
        value={stats.campaignStats?.activeCampaigns || 0}
        description={`${stats.campaignStats?.totalCampaigns || 0} total campaigns`}
        icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
      />
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}

function StatsCard({ title, value, description, icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
