import { PageSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <PageSkeleton
          showFilterBar={false}
          metricCards={4}
          showChart
          showTable
        />
      </div>
    </div>
  )
}