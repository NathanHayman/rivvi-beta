import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonCardProps {
  titleWidth?: number;
  descriptionWidth?: number;
  rows?: number;
  rowHeight?: number;
}

export function SkeletonCard({
  titleWidth = 64,
  descriptionWidth = 96,
  rows = 3,
  rowHeight = 10,
}: SkeletonCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <Skeleton className={`h-8 w-${titleWidth}`} />
        </CardTitle>
        <CardDescription>
          <Skeleton className={`h-4 w-${descriptionWidth}`} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className={`h-${rowHeight} w-full`} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
